// DNS 管理器 - 统一 DNS 操作接口

import { createDNSProvider, DNSProviderManager } from './providers';
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
  DNSError
} from './types';

/**
 * DNS 管理器类
 */
export class DNSManager {
  private providerManager: DNSProviderManager;
  private defaultProvider?: string;

  constructor() {
    this.providerManager = new DNSProviderManager();
  }

  /**
   * 设置默认提供商
   */
  setDefaultProvider(key: string): void {
    if (!this.providerManager.getProvider(key)) {
      throw new DNSError(`提供商 ${key} 未注册`, 'PROVIDER_NOT_FOUND');
    }
    this.defaultProvider = key;
  }

  /**
   * 注册提供商
   */
  registerProvider(key: string, config: DNSConfig): BaseDNSProvider {
    return this.providerManager.registerProvider(key, config);
  }

  /**
   * 获取提供商
   */
  getProvider(key?: string): BaseDNSProvider {
    const providerKey = key || this.defaultProvider;
    
    if (!providerKey) {
      throw new DNSError('未指定提供商且未设置默认提供商', 'NO_PROVIDER');
    }

    const provider = this.providerManager.getProvider(providerKey);
    if (!provider) {
      throw new DNSError(`提供商 ${providerKey} 未找到`, 'PROVIDER_NOT_FOUND');
    }

    return provider;
  }

  /**
   * 创建 DNS 记录
   */
  async createDNSRecord(
    record: CreateDNSRecord, 
    providerKey?: string
  ): Promise<DNSRecordResponse> {
    const provider = this.getProvider(providerKey);
    return await provider.createDNSRecord(record);
  }

  /**
   * 更新 DNS 记录
   */
  async updateDNSRecord(
    recordId: string,
    record: UpdateDNSRecord,
    providerKey?: string
  ): Promise<DNSRecordResponse> {
    const provider = this.getProvider(providerKey);
    return await provider.updateDNSRecord(recordId, record);
  }

  /**
   * 删除 DNS 记录
   */
  async deleteDNSRecord(
    recordId: string,
    providerKey?: string
  ): Promise<boolean> {
    const provider = this.getProvider(providerKey);
    return await provider.deleteDNSRecord(recordId);
  }

  /**
   * 获取 DNS 记录列表
   */
  async getDNSRecords(
    filters?: DNSFilters,
    providerKey?: string
  ): Promise<DNSListResponse> {
    const provider = this.getProvider(providerKey);
    return await provider.getDNSRecords(filters);
  }

  /**
   * 获取单个 DNS 记录
   */
  async getDNSRecord(
    recordId: string,
    providerKey?: string
  ): Promise<DNSRecordResponse> {
    const provider = this.getProvider(providerKey);
    return await provider.getDNSRecord(recordId);
  }

  /**
   * 验证域名
   */
  async validateDomain(providerKey?: string): Promise<boolean> {
    const provider = this.getProvider(providerKey);
    return await provider.validateDomain();
  }

  /**
   * 获取域名信息
   */
  async getDomainInfo(providerKey?: string): Promise<DomainInfo> {
    const provider = this.getProvider(providerKey);
    return await provider.getDomainInfo();
  }

  /**
   * 配置邮件转发
   */
  async configureEmailForwarding(
    settings: EmailSettings,
    providerKey?: string
  ): Promise<boolean> {
    const provider = this.getProvider(providerKey);
    
    if (!provider.configureEmailForwarding) {
      throw new DNSError('当前提供商不支持邮件转发配置', 'FEATURE_NOT_SUPPORTED');
    }
    
    return await provider.configureEmailForwarding(settings);
  }

  /**
   * 批量创建 DNS 记录
   */
  async batchCreateDNSRecords(
    records: CreateDNSRecord[],
    providerKey?: string
  ): Promise<DNSRecordResponse[]> {
    const provider = this.getProvider(providerKey);
    const results: DNSRecordResponse[] = [];

    for (const record of records) {
      try {
        const result = await provider.createDNSRecord(record);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          errors: [{
            code: -1,
            message: error instanceof Error ? error.message : '未知错误'
          }]
        });
      }
    }

    return results;
  }

  /**
   * 批量删除 DNS 记录
   */
  async batchDeleteDNSRecords(
    recordIds: string[],
    providerKey?: string
  ): Promise<boolean[]> {
    const provider = this.getProvider(providerKey);
    const results: boolean[] = [];

    for (const recordId of recordIds) {
      try {
        const result = await provider.deleteDNSRecord(recordId);
        results.push(result);
      } catch (error) {
        results.push(false);
      }
    }

    return results;
  }

  /**
   * 同步 DNS 记录到另一个提供商
   */
  async syncRecordsToProvider(
    fromProviderKey: string,
    toProviderKey: string,
    filters?: DNSFilters
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const fromProvider = this.getProvider(fromProviderKey);
    const toProvider = this.getProvider(toProviderKey);

    // 获取源提供商的记录
    const sourceRecords = await fromProvider.getDNSRecords(filters);
    
    if (!sourceRecords.success || !sourceRecords.result) {
      throw new DNSError('获取源记录失败', 'SYNC_FAILED');
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // 同步记录到目标提供商
    for (const record of sourceRecords.result) {
      try {
        const createRecord: CreateDNSRecord = {
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl,
          priority: record.priority,
          comment: record.comment,
          tags: record.tags,
          proxied: record.proxied
        };

        await toProvider.createDNSRecord(createRecord);
        success++;
      } catch (error) {
        failed++;
        errors.push(`${record.name}: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    return { success, failed, errors };
  }

  /**
   * 获取所有注册的提供商信息
   */
  getAllProviders(): Array<{ key: string; provider: string; config: any }> {
    const providers = this.providerManager.getAllProviders();
    const result: Array<{ key: string; provider: string; config: any }> = [];

    for (const [key, provider] of providers) {
      result.push({
        key,
        provider: provider.getProviderName(),
        config: provider.getSafeConfig()
      });
    }

    return result;
  }

  /**
   * 验证所有提供商配置
   */
  async validateAllProviders(): Promise<{ [key: string]: { valid: boolean; message?: string } }> {
    const providers = this.providerManager.getAllProviders();
    const results: { [key: string]: { valid: boolean; message?: string } } = {};

    for (const [key, provider] of providers) {
      try {
        const isValid = await provider.validateDomain();
        results[key] = { valid: isValid };
      } catch (error) {
        results[key] = { 
          valid: false, 
          message: error instanceof Error ? error.message : '验证失败' 
        };
      }
    }

    return results;
  }
}

// 创建全局 DNS 管理器实例
export const dnsManager = new DNSManager();

// 默认导出
export default dnsManager;
