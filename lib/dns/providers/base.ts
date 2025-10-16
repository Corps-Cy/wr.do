// DNS 提供商基础接口

import {
  DNSConfig,
  CreateDNSRecord,
  UpdateDNSRecord,
  DNSRecord,
  DNSRecordResponse,
  DNSListResponse,
  DNSFilters,
  DomainInfo,
  EmailSettings,
  DNSProvider
} from '../types';

export abstract class BaseDNSProvider {
  protected config: DNSConfig;
  protected provider: DNSProvider;

  constructor(config: DNSConfig, provider: DNSProvider) {
    this.config = config;
    this.provider = provider;
    this.validateConfig();
  }

  /**
   * 验证配置有效性
   */
  protected abstract validateConfig(): void;

  /**
   * 创建 DNS 记录
   */
  abstract createDNSRecord(record: CreateDNSRecord): Promise<DNSRecordResponse>;

  /**
   * 更新 DNS 记录
   */
  abstract updateDNSRecord(recordId: string, record: UpdateDNSRecord): Promise<DNSRecordResponse>;

  /**
   * 删除 DNS 记录
   */
  abstract deleteDNSRecord(recordId: string): Promise<boolean>;

  /**
   * 获取 DNS 记录列表
   */
  abstract getDNSRecords(filters?: DNSFilters): Promise<DNSListResponse>;

  /**
   * 获取单个 DNS 记录
   */
  abstract getDNSRecord(recordId: string): Promise<DNSRecordResponse>;

  /**
   * 验证域名是否托管在当前平台
   */
  abstract validateDomain(): Promise<boolean>;

  /**
   * 获取域名信息
   */
  abstract getDomainInfo(): Promise<DomainInfo>;

  /**
   * 配置邮件转发（可选实现）
   */
  async configureEmailForwarding?(settings: EmailSettings): Promise<boolean>;

  /**
   * 获取提供商名称
   */
  getProviderName(): DNSProvider {
    return this.provider;
  }

  /**
   * 获取配置信息（隐藏敏感信息）
   */
  getSafeConfig(): Partial<DNSConfig> {
    const safeConfig = { ...this.config };
    
    // 隐藏敏感信息
    if (safeConfig.cf_api_key) {
      safeConfig.cf_api_key = '***' + safeConfig.cf_api_key.slice(-4);
    }
    if (safeConfig.aliyun_access_key_secret) {
      safeConfig.aliyun_access_key_secret = '***' + safeConfig.aliyun_access_key_secret.slice(-4);
    }
    
    return safeConfig;
  }

  /**
   * 标准化错误处理
   */
  protected handleError(error: any, operation: string): never {
    if (error instanceof Error) {
      throw error;
    }

    // 根据提供商特性处理错误
    if (this.provider === 'cloudflare') {
      this.handleCloudflareError(error, operation);
    } else if (this.provider === 'aliyun') {
      this.handleAliyunError(error, operation);
    }

    throw new Error(`DNS operation failed: ${operation} - ${JSON.stringify(error)}`);
  }

  /**
   * 处理 Cloudflare 错误
   */
  private handleCloudflareError(error: any, operation: string): never {
    if (error.errors && Array.isArray(error.errors)) {
      const firstError = error.errors[0];
      throw new Error(`Cloudflare ${operation} failed: ${firstError.message} (Code: ${firstError.code})`);
    }
    throw new Error(`Cloudflare ${operation} failed: ${JSON.stringify(error)}`);
  }

  /**
   * 处理阿里云错误
   */
  private handleAliyunError(error: any, operation: string): never {
    if (error.Code) {
      throw new Error(`阿里云 ${operation} failed: ${error.Message} (Code: ${error.Code})`);
    }
    throw new Error(`阿里云 ${operation} failed: ${JSON.stringify(error)}`);
  }

  /**
   * 重试机制
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // 如果是认证错误，不重试
        if (error instanceof Error && error.message.includes('authentication')) {
          throw error;
        }

        if (attempt === maxRetries) {
          throw lastError;
        }

        // 指数退避延迟
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
      }
    }

    throw lastError!;
  }

  /**
   * 验证记录参数
   */
  protected validateRecord(record: CreateDNSRecord | UpdateDNSRecord): void {
    if (!record.type) {
      throw new Error('Record type is required');
    }
    if (!record.name) {
      throw new Error('Record name is required');
    }
    if (!record.content) {
      throw new Error('Record content is required');
    }

    // 验证记录类型特定的参数
    if (record.type === 'MX' && !record.priority) {
      throw new Error('MX record requires priority');
    }
  }

  /**
   * 标准化记录名称
   */
  protected normalizeRecordName(name: string, zoneName?: string): string {
    // 移除末尾的点
    name = name.replace(/\.$/, '');
    
    // 如果是根域名记录
    if (name === '@' || name === zoneName) {
      return zoneName || name;
    }
    
    // 如果名称不包含域名，添加域名后缀
    if (zoneName && !name.endsWith(zoneName)) {
      return `${name}.${zoneName}`;
    }
    
    return name;
  }
}
