import * as z from "zod";

export const createDomainSchema = z.object({
  id: z.string().optional(),
  domain_name: z.string().min(2),
  enable_short_link: z.boolean(),
  enable_email: z.boolean(),
  enable_dns: z.boolean(),
  // DNS 提供商类型
  dns_provider_type: z.enum(["cloudflare", "aliyun"]).default("cloudflare"),
  // Cloudflare 配置
  cf_zone_id: z.string().optional(),
  cf_api_key: z.string().optional(),
  cf_email: z.string().optional(),
  cf_record_types: z.string().optional(),
  cf_api_key_encrypted: z.boolean().default(false),
  // 阿里云 DNS 配置
  aliyun_access_key_id: z.string().optional(),
  aliyun_access_key_secret: z.string().optional(),
  aliyun_region: z.string().default("cn-hangzhou"),
  aliyun_domain_name: z.string().optional(),
  aliyun_record_types: z.string().default("A,AAAA,CNAME,MX,TXT,NS,SRV,CAA,PTR"),
  // 邮件服务配置
  resend_api_key: z.string().optional(),
  // 限制配置
  max_short_links: z.number().optional(),
  max_email_forwards: z.number().optional(),
  max_dns_records: z.number().optional(),
  min_url_length: z.number().min(1).default(1),
  min_email_length: z.number().min(1).default(1),
  min_record_length: z.number().min(1).default(1),
  active: z.boolean().default(true),
}).refine((data) => {
  // 如果启用 DNS，根据提供商类型验证必需的字段
  if (data.enable_dns) {
    if (data.dns_provider_type === "cloudflare") {
      return data.cf_zone_id && data.cf_api_key && data.cf_email;
    } else if (data.dns_provider_type === "aliyun") {
      return data.aliyun_access_key_id && data.aliyun_access_key_secret && data.aliyun_domain_name;
    }
  }
  return true;
}, {
  message: "启用 DNS 时，请填写对应提供商的所有必需配置",
  path: ["enable_dns"],
});
