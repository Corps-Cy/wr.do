-- 添加多 DNS 提供商支持

-- 添加 DNS 提供商字段
ALTER TABLE domains ADD COLUMN dns_provider_type VARCHAR(20) DEFAULT 'cloudflare';

-- 添加阿里云配置字段
ALTER TABLE domains ADD COLUMN aliyun_access_key_id VARCHAR(255);
ALTER TABLE domains ADD COLUMN aliyun_access_key_secret VARCHAR(255);
ALTER TABLE domains ADD COLUMN aliyun_region VARCHAR(50) DEFAULT 'cn-hangzhou';
ALTER TABLE domains ADD COLUMN aliyun_domain_name VARCHAR(255);
ALTER TABLE domains ADD COLUMN aliyun_record_types VARCHAR(255) DEFAULT 'A,AAAA,CNAME,MX,TXT,NS,SRV,CAA,PTR';

-- 添加提供商配置表
CREATE TABLE platform_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  provider VARCHAR(20) NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  config_value TEXT,
  encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
  CONSTRAINT unique_domain_provider_key UNIQUE (domain_id, provider, config_key)
);

-- 添加索引
CREATE INDEX idx_domains_dns_provider_type ON domains(dns_provider_type);
CREATE INDEX idx_platform_configs_domain_provider ON platform_configs(domain_id, provider);

-- 更新现有域名的 DNS 提供商
UPDATE domains SET dns_provider_type = 'cloudflare' WHERE enable_dns = true AND dns_provider_type IS NULL;
