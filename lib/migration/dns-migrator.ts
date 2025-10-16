// DNS 迁移工具

import { DNSManager } from '../dns/manager';
import { DNSConfig, DNSProvider, DNSRecord, DNSError } from '../dns/types';
import { getDomainsByFeature } from '../dto/domains';
import { db } from '../db';

export interface MigrationOptions {
  dryRun?: boolean; // 是否只是预览，不实际执行
  batchSize?: number; // 批量处理大小
  continueOnError?: boolean; // 遇到错误是否继续
  verifyAfterMigration?: boolean; // 迁移后是否验证
}

export interface MigrationResult {
  success: boolean;
  totalRecords: number;
  migratedRecords: number;
  failedRecords: number;
  errors: string[];
  warnings: string[];
  executionTime: number;
}

export interface DomainMigrationResult {
  domainId: string;
  domainName: string;
  success: boolean;
  result: MigrationResult;
}

export class DNSMigrator {
  private dnsManager: DNSManager;

  constructor() {
    this.dnsManager = new DNSManager();
  }

  /**
   * 迁移单个域名的 DNS 记录
   */
  async migrateDomain(
    domainId: string,
    targetProvider: DNSProvider,
    targetConfig: DNSConfig,
    options: MigrationOptions = {}
  ): Promise<DomainMigrationResult> {
    const startTime = Date.now();
    
    try {
      // 获取域名信息
      const domain = await this.getDomainById(domainId);
      if (!domain) {
        throw new DNSError(`域名 ${domainId} 不存在`, 'DOMAIN_NOT_FOUND');
      }

      // 验证目标配置
      if (!this.validateTargetConfig(targetProvider, targetConfig)) {
        throw new DNSError('目标配置验证失败', 'INVALID_CONFIG');
      }

      // 注册目标提供商
      const targetProviderKey = `target_${targetProvider}_${domainId}`;
      this.dnsManager.registerProvider(targetProviderKey, targetConfig);

      // 注册源提供商
      const sourceProviderKey = `source_${domain.dns_provider || 'cloudflare'}_${domainId}`;
      const sourceConfig = this.buildSourceConfig(domain);
      this.dnsManager.registerProvider(sourceProviderKey, sourceConfig);

      if (options.dryRun) {
        // 预览模式：获取记录但不执行迁移
        const records = await this.dnsManager.getDNSRecords(undefined, sourceProviderKey);
        return {
          domainId,
          domainName: domain.domain_name,
          success: true,
          result: {
            success: true,
            totalRecords: records.result?.length || 0,
            migratedRecords: 0,
            failedRecords: 0,
            errors: [],
            warnings: [`预览模式：将迁移 ${records.result?.length || 0} 条记录`],
            executionTime: Date.now() - startTime
          }
        };
      }

      // 执行迁移
      const result = await this.executeMigration(
        sourceProviderKey,
        targetProviderKey,
        options
      );

      // 更新数据库
      await this.updateDomainProvider(domainId, targetProvider, targetConfig);

      return {
        domainId,
        domainName: domain.domain_name,
        success: result.success,
        result
      };

    } catch (error) {
      return {
        domainId,
        domainName: '',
        success: false,
        result: {
          success: false,
          totalRecords: 0,
          migratedRecords: 0,
          failedRecords: 0,
          errors: [error instanceof Error ? error.message : '未知错误'],
          warnings: [],
          executionTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * 批量迁移多个域名
   */
  async migrateMultipleDomains(
    domainIds: string[],
    targetProvider: DNSProvider,
    targetConfig: DNSConfig,
    options: MigrationOptions = {}
  ): Promise<DomainMigrationResult[]> {
    const results: DomainMigrationResult[] = [];

    for (const domainId of domainIds) {
      try {
        const result = await this.migrateDomain(
          domainId,
          targetProvider,
          targetConfig,
          options
        );
        results.push(result);

        if (!options.continueOnError && !result.success) {
          break;
        }
      } catch (error) {
        results.push({
          domainId,
          domainName: '',
          success: false,
          result: {
            success: false,
            totalRecords: 0,
            migratedRecords: 0,
            failedRecords: 0,
            errors: [error instanceof Error ? error.message : '未知错误'],
            warnings: [],
            executionTime: 0
          }
        });

        if (!options.continueOnError) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * 迁移所有启用了 DNS 的域名
   */
  async migrateAllDNSDomains(
    targetProvider: DNSProvider,
    targetConfig: DNSConfig,
    options: MigrationOptions = {}
  ): Promise<DomainMigrationResult[]> {
    const domains = await getDomainsByFeature('enable_dns', true);
    const domainIds = domains.map(domain => domain.id);

    return await this.migrateMultipleDomains(
      domainIds,
      targetProvider,
      targetConfig,
      options
    );
  }

  /**
   * 回滚迁移
   */
  async rollbackMigration(
    domainId: string,
    options: MigrationOptions = {}
  ): Promise<DomainMigrationResult> {
    // 实现回滚逻辑
    // 这里需要从备份中恢复原始配置
    throw new DNSError('回滚功能尚未实现', 'NOT_IMPLEMENTED');
  }

  /**
   * 验证迁移结果
   */
  async verifyMigration(
    domainId: string,
    targetProvider: DNSProvider
  ): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const domain = await this.getDomainById(domainId);
      if (!domain) {
        return { valid: false, errors: ['域名不存在'] };
      }

      // 构建目标配置
      const targetConfig = this.buildTargetConfig(domain, targetProvider);
      const providerKey = `verify_${targetProvider}_${domainId}`;
      
      this.dnsManager.registerProvider(providerKey, targetConfig);

      // 验证域名配置
      const isValid = await this.dnsManager.validateDomain(providerKey);
      
      if (!isValid) {
        return { valid: false, errors: ['域名验证失败'] };
      }

      // 获取记录并验证
      const records = await this.dnsManager.getDNSRecords(undefined, providerKey);
      
      return {
        valid: records.success && (records.result?.length || 0) > 0,
        errors: []
      };

    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : '验证失败']
      };
    }
  }

  /**
   * 执行实际迁移
   */
  private async executeMigration(
    sourceProviderKey: string,
    targetProviderKey: string,
    options: MigrationOptions
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    let totalRecords = 0;
    let migratedRecords = 0;
    let failedRecords = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 获取源记录
      const sourceRecords = await this.dnsManager.getDNSRecords(undefined, sourceProviderKey);
      
      if (!sourceRecords.success || !sourceRecords.result) {
        throw new DNSError('获取源记录失败', 'SOURCE_RECORDS_FAILED');
      }

      totalRecords = sourceRecords.result.length;
      const batchSize = options.batchSize || 10;

      // 批量迁移记录
      for (let i = 0; i < sourceRecords.result.length; i += batchSize) {
        const batch = sourceRecords.result.slice(i, i + batchSize);
        
        for (const record of batch) {
          try {
            const createRecord = this.convertRecordForTarget(record);
            await this.dnsManager.createDNSRecord(createRecord, targetProviderKey);
            migratedRecords++;

            // 添加延迟避免 API 限制
            if (migratedRecords % 5 === 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }

          } catch (error) {
            failedRecords++;
            const errorMsg = `${record.name} (${record.type}): ${error instanceof Error ? error.message : '未知错误'}`;
            errors.push(errorMsg);

            if (!options.continueOnError) {
              throw error;
            }
          }
        }
      }

      // 验证迁移结果
      if (options.verifyAfterMigration) {
        const targetRecords = await this.dnsManager.getDNSRecords(undefined, targetProviderKey);
        if (targetRecords.result?.length !== totalRecords) {
          warnings.push(`记录数量不匹配：源 ${totalRecords}，目标 ${targetRecords.result?.length || 0}`);
        }
      }

      return {
        success: failedRecords === 0,
        totalRecords,
        migratedRecords,
        failedRecords,
        errors,
        warnings,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        totalRecords,
        migratedRecords,
        failedRecords: totalRecords - migratedRecords,
        errors: [error instanceof Error ? error.message : '迁移失败'],
        warnings,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * 获取域名信息
   */
  private async getDomainById(domainId: string) {
    return await db.domain.findUnique({
      where: { id: domainId }
    });
  }

  /**
   * 验证目标配置
   */
  private validateTargetConfig(provider: DNSProvider, config: DNSConfig): boolean {
    switch (provider) {
      case 'cloudflare':
        return !!(config.cf_zone_id && config.cf_api_key && config.cf_email);
      case 'aliyun':
        return !!(config.aliyun_access_key_id && config.aliyun_access_key_secret && config.aliyun_domain_name);
      default:
        return false;
    }
  }

  /**
   * 构建源配置
   */
  private buildSourceConfig(domain: any): DNSConfig {
    return {
      provider: domain.dns_provider || 'cloudflare',
      cf_zone_id: domain.cf_zone_id,
      cf_api_key: domain.cf_api_key,
      cf_email: domain.cf_email,
      aliyun_access_key_id: domain.aliyun_access_key_id,
      aliyun_access_key_secret: domain.aliyun_access_key_secret,
      aliyun_region: domain.aliyun_region,
      aliyun_domain_name: domain.aliyun_domain_name
    };
  }

  /**
   * 构建目标配置
   */
  private buildTargetConfig(domain: any, provider: DNSProvider): DNSConfig {
    const config: DNSConfig = { provider };

    switch (provider) {
      case 'cloudflare':
        config.cf_zone_id = domain.cf_zone_id;
        config.cf_api_key = domain.cf_api_key;
        config.cf_email = domain.cf_email;
        break;
      case 'aliyun':
        config.aliyun_access_key_id = domain.aliyun_access_key_id;
        config.aliyun_access_key_secret = domain.aliyun_access_key_secret;
        config.aliyun_region = domain.aliyun_region;
        config.aliyun_domain_name = domain.aliyun_domain_name;
        break;
    }

    return config;
  }

  /**
   * 转换记录格式以适应目标提供商
   */
  private convertRecordForTarget(record: DNSRecord) {
    // 移除提供商特定的字段
    const { id, zone_id, zone_name, created_on, modified_on, meta, ...convertedRecord } = record;
    
    return {
      type: convertedRecord.type,
      name: convertedRecord.name,
      content: convertedRecord.content,
      ttl: convertedRecord.ttl,
      priority: convertedRecord.priority,
      comment: convertedRecord.comment,
      tags: convertedRecord.tags,
      proxied: convertedRecord.proxied
    };
  }

  /**
   * 更新域名提供商配置
   */
  private async updateDomainProvider(
    domainId: string,
    provider: DNSProvider,
    config: DNSConfig
  ): Promise<void> {
    const updateData: any = {
      dns_provider: provider
    };

    // 根据提供商更新相应字段
    if (provider === 'cloudflare') {
      updateData.cf_zone_id = config.cf_zone_id;
      updateData.cf_api_key = config.cf_api_key;
      updateData.cf_email = config.cf_email;
    } else if (provider === 'aliyun') {
      updateData.aliyun_access_key_id = config.aliyun_access_key_id;
      updateData.aliyun_access_key_secret = config.aliyun_access_key_secret;
      updateData.aliyun_region = config.aliyun_region;
      updateData.aliyun_domain_name = config.aliyun_domain_name;
    }

    await db.domain.update({
      where: { id: domainId },
      data: updateData
    });
  }
}
