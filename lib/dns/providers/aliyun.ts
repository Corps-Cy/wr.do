// 阿里云 DNS 提供商实现

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

// 阿里云 SDK
const Core = require('@alicloud/pop-core');

// 阿里云 API 响应类型
interface AliyunResponse<T = any> {
  RequestId: string;
  Success?: boolean;
  Code?: string;
  Message?: string;
  Data?: T;
}

interface AliyunDomainRecord {
  RecordId: string;
  RR: string;
  Type: string;
  Value: string;
  TTL: number;
  Priority?: number;
  Line: string;
  Status: string;
  Locked: boolean;
}

interface AliyunDomainInfo {
  DomainId: string;
  DomainName: string;
  PunyCode: string;
  AliDomain: boolean;
  RecordCount: number;
  RegistrantEmail: string;
  Remark: string;
  GroupId: string;
  GroupName: string;
  InstanceId: string;
  VersionCode: string;
  DnsServers: {
    DnsServer: string[];
  };
}

export class AliyunDNSProvider extends BaseDNSProvider {
  private readonly client: any;
  private readonly region: string;

  constructor(config: DNSConfig) {
    super(config, 'aliyun');
    this.region = config.aliyun_region || 'cn-hangzhou';
    
    // 初始化阿里云客户端
    this.client = new Core({
      accessKeyId: config.aliyun_access_key_id,
      accessKeySecret: config.aliyun_access_key_secret,
      endpoint: 'https://alidns.aliyuncs.com',
      apiVersion: '2015-01-09'
    });
  }

  protected validateConfig(): void {
    if (!this.config.aliyun_access_key_id) {
      throw new DNSAuthenticationError('阿里云 AccessKey ID 未配置', 'aliyun');
    }
    if (!this.config.aliyun_access_key_secret) {
      throw new DNSAuthenticationError('阿里云 AccessKey Secret 未配置', 'aliyun');
    }
    if (!this.config.aliyun_domain_name) {
      throw new Error('阿里云域名名称未配置');
    }
  }

  async createDNSRecord(record: CreateDNSRecord): Promise<DNSRecordResponse> {
    this.validateRecord(record);

    // 验证记录值格式
    this.validateRecordValue(record.type, record.content);

    // 阿里云 DNS TTL 必须在 600-86400 秒之间
    const ttl = record.ttl ? Math.max(600, Math.min(86400, record.ttl)) : 600;

    const params: any = {
      DomainName: this.config.aliyun_domain_name!,
      RR: this.extractRR(record.name),
      Type: record.type,
      Value: record.content,
      TTL: ttl,
      Line: 'default'
    };

    // 只有 MX 和 SRV 记录类型需要 Priority 参数
    if (record.type === 'MX' || record.type === 'SRV') {
      params.Priority = record.priority || 10;
    }

    try {
      const response = await this.client.request('AddDomainRecord', params, {
        method: 'POST'
      });
      
      return {
        success: true,
        result: {
          id: response.RecordId,
          zone_name: this.config.aliyun_domain_name,
          name: record.name,
          type: record.type,
          content: record.content,
          ttl: ttl,
          priority: record.priority,
          comment: '',
          tags: [],
          created_on: undefined,
          modified_on: undefined,
          proxied: false,
          proxiable: false
        }
      };
    } catch (error) {
      this.handleError(error, 'createDNSRecord');
    }
  }

  async updateDNSRecord(recordId: string, record: UpdateDNSRecord): Promise<DNSRecordResponse> {
    this.validateRecord(record);

    // 验证记录值格式
    this.validateRecordValue(record.type, record.content);

    // 阿里云 DNS TTL 必须在 600-86400 秒之间
    const ttl = record.ttl ? Math.max(600, Math.min(86400, record.ttl)) : 600;

    const params: any = {
      RecordId: recordId,
      RR: this.extractRR(record.name),
      Type: record.type,
      Value: record.content,
      TTL: ttl,
      Line: 'default'
    };

    // 只有 MX 和 SRV 记录类型需要 Priority 参数
    if (record.type === 'MX' || record.type === 'SRV') {
      params.Priority = record.priority || 10;
    }

    try {
      const response = await this.client.request('UpdateDomainRecord', params, {
        method: 'POST'
      });
      
      return {
        success: true,
        result: {
          id: recordId,
          zone_name: this.config.aliyun_domain_name,
          name: record.name,
          type: record.type,
          content: record.content,
          ttl: ttl,
          priority: record.priority,
          comment: '',
          tags: [],
          created_on: undefined,
          modified_on: undefined,
          proxied: false,
          proxiable: false
        }
      };
    } catch (error) {
      this.handleError(error, 'updateDNSRecord');
    }
  }

  async deleteDNSRecord(recordId: string): Promise<boolean> {
    const params = {
      RecordId: recordId
    };

    try {
      await this.client.request('DeleteDomainRecord', params, {
        method: 'POST'
      });
      return true;
    } catch (error) {
      this.handleError(error, 'deleteDNSRecord');
    }
  }

  async getDNSRecords(filters?: DNSFilters): Promise<DNSListResponse> {
    const params = {
      DomainName: this.config.aliyun_domain_name!,
      PageNumber: filters?.page || 1,
      PageSize: filters?.per_page || 100,
      RRKeyWord: filters?.name,
      TypeKeyWord: filters?.type,
      ValueKeyWord: filters?.content
    };

    try {
      const response = await this.client.request('DescribeDomainRecords', params, {
        method: 'POST'
      });

      const records = response.DomainRecords?.Record?.map((record: AliyunDomainRecord) => 
        this.mapAliyunRecordToDNSRecord(record)
      ) || [];

      return {
        success: true,
        result: records,
        result_info: {
          count: records.length,
          page: response.PageNumber || 1,
          per_page: response.PageSize || 100,
          total_count: response.TotalCount || 0
        }
      };
    } catch (error) {
      this.handleError(error, 'getDNSRecords');
    }
  }

  async getDNSRecord(recordId: string): Promise<DNSRecordResponse> {
    const params = {
      RecordId: recordId
    };

    try {
      const response = await this.client.request('DescribeDomainRecordInfo', params, {
        method: 'POST'
      });
      
      return {
        success: true,
        result: this.mapAliyunRecordToDNSRecord(response)
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
    const params = {
      DomainName: this.config.aliyun_domain_name!
    };

    try {
      // 使用 DescribeDomainRecords 来验证域名是否存在
      const response = await this.client.request('DescribeDomainRecords', {
        DomainName: this.config.aliyun_domain_name!,
        PageNumber: 1,
        PageSize: 1
      }, {
        method: 'POST'
      });
      
      // 如果能够获取记录列表，说明域名存在且可访问
      return {
        id: this.config.aliyun_domain_name!,
        name: this.config.aliyun_domain_name!,
        status: 'active',
        name_servers: ['vip1.alidns.com', 'vip2.alidns.com'], // 阿里云默认 DNS 服务器
        created_on: undefined,
        modified_on: undefined
      };
    } catch (error) {
      this.handleError(error, 'getDomainInfo');
    }
  }

  async configureEmailForwarding(settings: EmailSettings): Promise<boolean> {
    // 阿里云 DNS 本身不提供邮件转发功能
    // 这里可以集成阿里云 DirectMail 或其他邮件服务
    console.warn('阿里云 DNS 不直接支持邮件转发，建议使用第三方邮件服务');
    return false;
  }


  /**
   * 验证记录值格式（针对阿里云 DNS 的严格验证）
   */
  private validateRecordValue(type: string, value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error(`${type} 记录值不能为空`);
    }

    switch (type) {
      case 'A':
        // IPv4 地址格式验证
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipv4Regex.test(value)) {
          throw new Error(`A 记录值必须是有效的 IPv4 地址（如：192.168.1.1），当前值：${value}`);
        }
        break;
      
      case 'AAAA':
        // IPv6 地址格式验证（更严格的验证）
        const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
        if (!ipv6Regex.test(value)) {
          throw new Error(`AAAA 记录值必须是有效的 IPv6 地址（如：2001:db8::1），当前值：${value}`);
        }
        break;
      
      case 'CNAME':
        // CNAME 必须是有效的域名格式，不能是 IP 地址
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.?$/;
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        
        if (ipRegex.test(value)) {
          throw new Error(`CNAME 记录值不能是 IP 地址，必须是域名（如：www.example.com），当前值：${value}`);
        }
        
        if (!domainRegex.test(value)) {
          throw new Error(`CNAME 记录值必须是有效的域名格式（如：www.example.com），当前值：${value}`);
        }
        
        if (value.length > 253) {
          throw new Error(`CNAME 记录值长度不能超过 253 字符，当前长度：${value.length}`);
        }
        break;
      
      case 'MX':
        // MX 记录格式：优先级 域名
        const mxParts = value.split(' ');
        if (mxParts.length !== 2) {
          throw new Error(`MX 记录值格式错误，应为 "优先级 域名"（如：10 mail.example.com），当前值：${value}`);
        }
        
        const priority = parseInt(mxParts[0]);
        if (isNaN(priority) || priority < 0 || priority > 65535) {
          throw new Error(`MX 记录优先级必须是 0-65535 之间的数字，当前值：${mxParts[0]}`);
        }
        
        const mxDomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.?$/;
        if (!mxDomainRegex.test(mxParts[1])) {
          throw new Error(`MX 记录域名部分格式错误，当前值：${mxParts[1]}`);
        }
        break;
      
      case 'TXT':
        // TXT 记录值长度限制
        if (value.length > 255) {
          throw new Error(`TXT 记录值长度不能超过 255 字符，当前长度：${value.length}`);
        }
        
        // TXT 记录不能包含控制字符
        if (/[\x00-\x1F\x7F]/.test(value)) {
          throw new Error(`TXT 记录值不能包含控制字符，当前值：${value}`);
        }
        break;
      
      case 'NS':
        // NS 记录必须是有效的域名
        const nsRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.?$/;
        if (!nsRegex.test(value)) {
          throw new Error(`NS 记录值必须是有效的域名格式（如：ns1.example.com），当前值：${value}`);
        }
        
        if (value.length > 253) {
          throw new Error(`NS 记录值长度不能超过 253 字符，当前长度：${value.length}`);
        }
        break;
      
      case 'SRV':
        // SRV 记录格式：优先级 权重 端口 域名
        const srvParts = value.split(' ');
        if (srvParts.length !== 4) {
          throw new Error(`SRV 记录值格式错误，应为 "优先级 权重 端口 域名"（如：10 5 80 server.example.com），当前值：${value}`);
        }
        
        const srvPriority = parseInt(srvParts[0]);
        const srvWeight = parseInt(srvParts[1]);
        const srvPort = parseInt(srvParts[2]);
        
        if (isNaN(srvPriority) || srvPriority < 0 || srvPriority > 65535) {
          throw new Error(`SRV 记录优先级必须是 0-65535 之间的数字，当前值：${srvParts[0]}`);
        }
        
        if (isNaN(srvWeight) || srvWeight < 0 || srvWeight > 65535) {
          throw new Error(`SRV 记录权重必须是 0-65535 之间的数字，当前值：${srvParts[1]}`);
        }
        
        if (isNaN(srvPort) || srvPort < 1 || srvPort > 65535) {
          throw new Error(`SRV 记录端口必须是 1-65535 之间的数字，当前值：${srvParts[2]}`);
        }
        
        const srvDomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.?$/;
        if (!srvDomainRegex.test(srvParts[3])) {
          throw new Error(`SRV 记录域名部分格式错误，当前值：${srvParts[3]}`);
        }
        break;
      
      case 'CAA':
        // CAA 记录格式：标志 标签 "值"
        const caaRegex = /^\d+\s+(issue|issuewild|iodef)\s+"[^"]*"$/;
        if (!caaRegex.test(value)) {
          throw new Error(`CAA 记录值格式错误，应为 "标志 标签 \\"值\\""（如：0 issue "ca.example.com"），当前值：${value}`);
        }
        break;
      
      case 'PTR':
        // PTR 记录必须是有效的域名
        const ptrRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.?$/;
        if (!ptrRegex.test(value)) {
          throw new Error(`PTR 记录值必须是有效的域名格式，当前值：${value}`);
        }
        break;
      
      default:
        // 其他记录类型的通用验证
        if (value.length > 255) {
          throw new Error(`${type} 记录值长度不能超过 255 字符，当前长度：${value.length}`);
        }
        break;
    }
  }

  /**
   * 从完整域名中提取 RR（记录名）
   */
  private extractRR(fullName: string): string {
    const domainName = this.config.aliyun_domain_name!;
    
    if (fullName === domainName || fullName === '@') {
      return '@';
    }
    
    if (fullName.endsWith(`.${domainName}`)) {
      return fullName.slice(0, -(domainName.length + 1));
    }
    
    return fullName;
  }

  /**
   * 将阿里云记录格式转换为标准格式
   */
  private mapAliyunRecordToDNSRecord(record: AliyunDomainRecord): DNSRecord {
    return {
      id: record.RecordId,
      zone_name: this.config.aliyun_domain_name,
      name: record.RR === '@' ? this.config.aliyun_domain_name! : `${record.RR}.${this.config.aliyun_domain_name}`,
      type: record.Type as any,
      content: record.Value,
      ttl: record.TTL,
      priority: record.Priority,
      comment: '',
      tags: [],
      created_on: undefined,
      modified_on: undefined,
      proxied: false,
      proxiable: false
    };
  }
}
