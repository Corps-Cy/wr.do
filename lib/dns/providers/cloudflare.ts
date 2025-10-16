// Cloudflare DNS 提供商实现（重构现有代码）

import { BaseDNSProvider } from './base';
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
  DNSError,
  DNSAuthenticationError
} from '../types';

const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';

export class CloudflareDNSProvider extends BaseDNSProvider {
  constructor(config: DNSConfig) {
    super(config, 'cloudflare');
  }

  protected validateConfig(): void {
    if (!this.config.cf_zone_id) {
      throw new DNSAuthenticationError('Cloudflare Zone ID 未配置', 'cloudflare');
    }
    if (!this.config.cf_api_key) {
      throw new DNSAuthenticationError('Cloudflare API Key 未配置', 'cloudflare');
    }
    if (!this.config.cf_email) {
      throw new DNSAuthenticationError('Cloudflare Email 未配置', 'cloudflare');
    }
  }

  async createDNSRecord(record: CreateDNSRecord): Promise<DNSRecordResponse> {
    this.validateRecord(record);

    const url = `${CLOUDFLARE_API_URL}/zones/${this.config.cf_zone_id}/dns_records`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.cf_api_key}`,
      'X-Auth-Email': this.config.cf_email!,
      'X-Auth-Key': this.config.cf_api_key!
    };

    const requestBody = {
      type: record.type,
      name: record.name,
      content: record.content,
      ttl: record.ttl || 1,
      proxied: record.proxied || false,
      comment: record.comment,
      tags: record.tags
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new DNSError(data.errors?.[0]?.message || '创建记录失败', 'CREATE_FAILED');
      }

      return {
        success: true,
        result: data.result
      };
    } catch (error) {
      this.handleError(error, 'createDNSRecord');
    }
  }

  async updateDNSRecord(recordId: string, record: UpdateDNSRecord): Promise<DNSRecordResponse> {
    this.validateRecord(record);

    const url = `${CLOUDFLARE_API_URL}/zones/${this.config.cf_zone_id}/dns_records/${recordId}`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.cf_api_key}`,
      'X-Auth-Email': this.config.cf_email!,
      'X-Auth-Key': this.config.cf_api_key!
    };

    const requestBody = {
      type: record.type,
      name: record.name,
      content: record.content,
      ttl: record.ttl || 1,
      proxied: record.proxied || false,
      comment: record.comment,
      tags: record.tags
    };

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new DNSError(data.errors?.[0]?.message || '更新记录失败', 'UPDATE_FAILED');
      }

      return {
        success: true,
        result: data.result
      };
    } catch (error) {
      this.handleError(error, 'updateDNSRecord');
    }
  }

  async deleteDNSRecord(recordId: string): Promise<boolean> {
    const url = `${CLOUDFLARE_API_URL}/zones/${this.config.cf_zone_id}/dns_records/${recordId}`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.cf_api_key}`,
      'X-Auth-Email': this.config.cf_email!,
      'X-Auth-Key': this.config.cf_api_key!
    };

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });

      const data = await response.json();
      return data.success === true;
    } catch (error) {
      this.handleError(error, 'deleteDNSRecord');
    }
  }

  async getDNSRecords(filters?: DNSFilters): Promise<DNSListResponse> {
    const queryParams = new URLSearchParams();
    
    if (filters?.type) queryParams.append('type', filters.type);
    if (filters?.name) queryParams.append('name', filters.name);
    if (filters?.content) queryParams.append('content', filters.content);
    if (filters?.page) queryParams.append('page', filters.page.toString());
    if (filters?.per_page) queryParams.append('per_page', filters.per_page.toString());

    const url = `${CLOUDFLARE_API_URL}/zones/${this.config.cf_zone_id}/dns_records?${queryParams}`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.cf_api_key}`,
      'X-Auth-Email': this.config.cf_email!,
      'X-Auth-Key': this.config.cf_api_key!
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new DNSError(data.errors?.[0]?.message || '获取记录列表失败', 'LIST_FAILED');
      }

      return {
        success: true,
        result: data.result,
        result_info: data.result_info
      };
    } catch (error) {
      this.handleError(error, 'getDNSRecords');
    }
  }

  async getDNSRecord(recordId: string): Promise<DNSRecordResponse> {
    const url = `${CLOUDFLARE_API_URL}/zones/${this.config.cf_zone_id}/dns_records/${recordId}`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.cf_api_key}`,
      'X-Auth-Email': this.config.cf_email!,
      'X-Auth-Key': this.config.cf_api_key!
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new DNSError(data.errors?.[0]?.message || '获取记录详情失败', 'GET_FAILED');
      }

      return {
        success: true,
        result: data.result
      };
    } catch (error) {
      this.handleError(error, 'getDNSRecord');
    }
  }

  async validateDomain(): Promise<boolean> {
    try {
      await this.getDomainInfo();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getDomainInfo(): Promise<DomainInfo> {
    const url = `${CLOUDFLARE_API_URL}/zones/${this.config.cf_zone_id}`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.cf_api_key}`,
      'X-Auth-Email': this.config.cf_email!,
      'X-Auth-Key': this.config.cf_api_key!
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new DNSError(data.errors?.[0]?.message || '获取域名信息失败', 'DOMAIN_INFO_FAILED');
      }

      return {
        id: data.result.id,
        name: data.result.name,
        status: data.result.status,
        name_servers: data.result.name_servers,
        original_name_servers: data.result.original_name_servers,
        original_registrar: data.result.original_registrar,
        created_on: data.result.created_on,
        modified_on: data.result.modified_on,
        activated_on: data.result.activated_on,
        meta: data.result.meta
      };
    } catch (error) {
      this.handleError(error, 'getDomainInfo');
    }
  }

  async configureEmailForwarding(settings: EmailSettings): Promise<boolean> {
    // Cloudflare 邮件转发通过 Email Worker 实现
    // 这里可以集成 Cloudflare Email Worker 配置
    console.log('Cloudflare 邮件转发配置:', settings);
    return true;
  }
}
