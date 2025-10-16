// DNS 提供商工厂和管理器

import { BaseDNSProvider } from './base';
import { CloudflareDNSProvider } from './cloudflare';
import { AliyunDNSProvider } from './aliyun';
import { DNSConfig, DNSProvider, DNSError } from '../types';

/**
 * 创建 DNS 提供商实例
 */
export function createDNSProvider(config: DNSConfig): BaseDNSProvider {
  switch (config.provider) {
    case 'cloudflare':
      return new CloudflareDNSProvider(config);
    case 'aliyun':
      return new AliyunDNSProvider(config);
    default:
      throw new DNSError(`不支持的 DNS 提供商: ${config.provider}`, 'UNSUPPORTED_PROVIDER');
  }
}

/**
 * 获取所有支持的提供商
 */
export function getSupportedProviders(): DNSProvider[] {
  return ['cloudflare', 'aliyun'];
}

/**
 * 验证提供商配置
 */
export function validateProviderConfig(config: DNSConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.provider) {
    errors.push('提供商类型未指定');
    return { valid: false, errors };
  }

  if (!getSupportedProviders().includes(config.provider)) {
    errors.push(`不支持的提供商: ${config.provider}`);
    return { valid: false, errors };
  }

  // 验证提供商特定的配置
  switch (config.provider) {
    case 'cloudflare':
      if (!config.cf_zone_id) errors.push('Cloudflare Zone ID 未配置');
      if (!config.cf_api_key) errors.push('Cloudflare API Key 未配置');
      if (!config.cf_email) errors.push('Cloudflare Email 未配置');
      break;
    
    case 'aliyun':
      if (!config.aliyun_access_key_id) errors.push('阿里云 AccessKey ID 未配置');
      if (!config.aliyun_access_key_secret) errors.push('阿里云 AccessKey Secret 未配置');
      if (!config.aliyun_domain_name) errors.push('阿里云域名名称未配置');
      break;
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * DNS 提供商管理器
 */
export class DNSProviderManager {
  private providers: Map<string, BaseDNSProvider> = new Map();

  /**
   * 注册提供商
   */
  registerProvider(key: string, config: DNSConfig): BaseDNSProvider {
    const provider = createDNSProvider(config);
    this.providers.set(key, provider);
    return provider;
  }

  /**
   * 获取提供商
   */
  getProvider(key: string): BaseDNSProvider | undefined {
    return this.providers.get(key);
  }

  /**
   * 移除提供商
   */
  removeProvider(key: string): boolean {
    return this.providers.delete(key);
  }

  /**
   * 获取所有提供商
   */
  getAllProviders(): Map<string, BaseDNSProvider> {
    return new Map(this.providers);
  }

  /**
   * 清除所有提供商
   */
  clear(): void {
    this.providers.clear();
  }

  /**
   * 批量验证提供商配置
   */
  validateAllProviders(): { [key: string]: { valid: boolean; errors: string[] } } {
    const results: { [key: string]: { valid: boolean; errors: string[] } } = {};
    
    for (const [key, provider] of this.providers) {
      try {
        // 这里可以添加实际的验证逻辑
        results[key] = { valid: true, errors: [] };
      } catch (error) {
        results[key] = { 
          valid: false, 
          errors: [error instanceof Error ? error.message : '未知错误'] 
        };
      }
    }
    
    return results;
  }
}

// 默认导出
export default {
  createDNSProvider,
  getSupportedProviders,
  validateProviderConfig,
  DNSProviderManager
};

// 导出所有提供商类
export { BaseDNSProvider, CloudflareDNSProvider, AliyunDNSProvider };
