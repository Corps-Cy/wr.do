// DNS 提供商通用类型定义

export type DNSProvider = 'cloudflare' | 'aliyun';

export type RecordType = 'A' | 'CNAME' | 'MX' | 'TXT' | 'AAAA' | 'NS' | 'SRV';

export interface DNSConfig {
  provider: DNSProvider;
  
  // Cloudflare 配置
  cf_zone_id?: string;
  cf_api_key?: string;
  cf_email?: string;
  
  // 阿里云配置
  aliyun_access_key_id?: string;
  aliyun_access_key_secret?: string;
  aliyun_region?: string;
  aliyun_domain_name?: string;
}

export interface CreateDNSRecord {
  id?: string;
  zone_name?: string;
  type: RecordType;
  name: string;
  content: string;
  ttl?: number;
  priority?: number; // MX 记录优先级
  comment?: string;
  tags?: string[];
  proxied?: boolean; // Cloudflare 特有
}

export interface UpdateDNSRecord extends Omit<CreateDNSRecord, 'id'> {}

export interface DNSRecord {
  id: string;
  zone_id?: string;
  zone_name?: string;
  name: string;
  type: RecordType;
  content: string;
  ttl: number;
  priority?: number;
  comment?: string;
  tags?: string[];
  proxied?: boolean;
  proxiable?: boolean;
  created_on?: string;
  modified_on?: string;
  meta?: {
    auto_added?: boolean;
    managed_by_apps?: boolean;
    managed_by_argo_tunnel?: boolean;
  };
}

export interface DNSRecordResponse {
  success: boolean;
  errors?: Array<{
    code: number;
    message: string;
  }>;
  messages?: Array<{
    code: number;
    message: string;
  }>;
  result?: DNSRecord;
  result_info?: {
    count: number;
    page: number;
    per_page: number;
    total_count: number;
  };
}

export interface DNSFilters {
  type?: RecordType;
  name?: string;
  content?: string;
  page?: number;
  per_page?: number;
}

export interface DNSListResponse {
  success: boolean;
  errors?: Array<{
    code: number;
    message: string;
  }>;
  result?: DNSRecord[];
  result_info?: {
    count: number;
    page: number;
    per_page: number;
    total_count: number;
  };
}

export interface DomainInfo {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'moved' | 'deleted';
  name_servers: string[];
  original_name_servers?: string[];
  original_registrar?: string;
  created_on?: string;
  modified_on?: string;
  activated_on?: string;
  meta?: {
    step?: number;
    custom_certificate_quota?: number;
    page_rule_quota?: number;
    phishing_detected?: boolean;
    multiple_railguns_allowed?: boolean;
  };
}

export interface EmailSettings {
  enabled: boolean;
  catch_all?: string; // 转发目标邮箱
  rules?: Array<{
    name: string;
    pattern: string;
    destination: string;
  }>;
}

// 错误类型定义
export class DNSError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public provider?: DNSProvider
  ) {
    super(message);
    this.name = 'DNSError';
  }
}

export class DNSValidationError extends DNSError {
  constructor(message: string, field: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'DNSValidationError';
  }
}

export class DNSRateLimitError extends DNSError {
  constructor(message: string, retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR');
    this.name = 'DNSRateLimitError';
  }
}

export class DNSAuthenticationError extends DNSError {
  constructor(message: string, provider: DNSProvider) {
    super(message, 'AUTHENTICATION_ERROR', 401, provider);
    this.name = 'DNSAuthenticationError';
  }
}
