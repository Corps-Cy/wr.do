import { env } from "@/env.mjs";
import { siteConfig } from "@/config/site";
import { createDNSRecord } from "@/lib/cloudflare";
import { DNSManager } from "@/lib/dns/manager";
import { DNSConfig } from "@/lib/dns/types";
import {
  createUserRecord,
  getUserRecordByTypeNameContent,
  getUserRecordCount,
} from "@/lib/dto/cloudflare-dns-record";
import { getDomainsByFeature } from "@/lib/dto/domains";
import { getPlanQuota } from "@/lib/dto/plan";
import { getMultipleConfigs } from "@/lib/dto/system-config";
import { checkUserStatus, getFirstAdminUser } from "@/lib/dto/user";
import { applyRecordEmailHtml, resend } from "@/lib/email";
import { reservedDomains } from "@/lib/enums";
import { getCurrentUser } from "@/lib/session";
import { generateSecret } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const user = checkUserStatus(await getCurrentUser());
    if (user instanceof Response) return user;

    const zones = await getDomainsByFeature("enable_dns", true);
    if (!zones.length) {
      return Response.json("Please add at least one domain", {
        status: 400,
        statusText: "Please add at least one domain",
      });
    }

    const plan = await getPlanQuota(user.team);

    const { total } = await getUserRecordCount(user.id);
    if (total >= plan.rcNewRecords) {
      return Response.json("Your records have reached the free limit.", {
        status: 409,
      });
    }

    const { records } = await req.json();
    const record = {
      ...records[0],
      id: generateSecret(16),
    };

    if (reservedDomains.includes(record.name)) {
      return Response.json("Domain name is reserved", {
        status: 403,
      });
    }

    let record_name = ["A", "CNAME", "AAAA"].includes(record.type)
      ? record.name
      : `${record.name}.${record.zone_name}`;

    let matchedZone;

    for (const zone of zones) {
      if (record.zone_name === zone.domain_name) {
        matchedZone = zone;
        break;
      }
    }

    if (!matchedZone) {
      return Response.json(
        `No matching zone found for domain: ${record.zone_name}`,
        {
          status: 400,
          statusText: "Invalid zone name",
        },
      );
    }

    const user_record = await getUserRecordByTypeNameContent(
      user.id,
      record.type,
      record_name,
      record.content,
      record.zone_name,
      1,
    );
    if (user_record && user_record.length > 0) {
      return Response.json("Record already exists", {
        status: 400,
      });
    }

    const configs = await getMultipleConfigs([
      "enable_subdomain_apply",
      "enable_subdomain_status_email_pusher",
    ]);

    // apply subdomain
    if (configs.enable_subdomain_apply) {
      const res = await createUserRecord(user.id, {
        record_id: generateSecret(16),
        zone_id: matchedZone.cf_zone_id,
        zone_name: matchedZone.domain_name,
        name: record.name,
        type: record.type,
        content: record.content,
        proxied: record.proxied,
        proxiable: false,
        ttl: record.ttl,
        comment: record.comment,
        tags: "",
        created_on: new Date().toISOString(),
        modified_on: new Date().toISOString(),
        active: 2, // pending
      });

      if (res.status !== "success") {
        return Response.json(res.status, {
          status: 502,
        });
      }
      const admin_user = await getFirstAdminUser();
      if (configs.enable_subdomain_status_email_pusher && admin_user) {
        await resend.emails.send({
          from: env.RESEND_FROM_EMAIL,
          to: admin_user.email || "",
          subject: "New record pending approval",
          html: applyRecordEmailHtml({
            appUrl: siteConfig.url,
            appName: siteConfig.name,
            zone_name: record.zone_name,
            type: record.type,
            name: record.name,
            content: record.content,
          }),
        });
      }
      return Response.json(res.data?.id);
    }

    // 根据域名的 DNS 提供商选择相应的创建方法
    let data;
    
    console.log("[DNS 提供商调试] 匹配的域名:", matchedZone.domain_name);
    console.log("[DNS 提供商调试] DNS 提供商类型:", matchedZone.dns_provider_type);
    console.log("[DNS 提供商调试] 阿里云域名:", matchedZone.aliyun_domain_name);
    
    if (matchedZone.dns_provider_type === "aliyun") {
      console.log("[DNS 提供商调试] 使用阿里云 DNS 创建记录");
      // 使用阿里云 DNS 管理器
      const dnsConfig: DNSConfig = {
        provider: 'aliyun',
        aliyun_access_key_id: matchedZone.aliyun_access_key_id!,
        aliyun_access_key_secret: matchedZone.aliyun_access_key_secret!,
        aliyun_region: matchedZone.aliyun_region || 'cn-hangzhou',
        aliyun_domain_name: matchedZone.aliyun_domain_name!
      };
      
      const dnsManager = new DNSManager();
      const providerKey = 'aliyun';
      dnsManager.registerProvider(providerKey, dnsConfig);
      
      try {
        const aliyunRecord = await dnsManager.createDNSRecord({
          name: record_name,
          type: record.type,
          content: record.content,
          ttl: record.ttl || 600,
          priority: record.priority
        }, providerKey);
        
        if (!aliyunRecord.success) {
          return Response.json(aliyunRecord.errors?.[0]?.message || "阿里云 DNS 记录创建失败", {
            status: 501,
          });
        }
        
        data = {
          success: true,
          result: {
            id: aliyunRecord.result?.id || generateSecret(16),
            name: aliyunRecord.result?.name || record_name,
            type: aliyunRecord.result?.type || record.type,
            content: aliyunRecord.result?.content || record.content,
            proxied: false, // 阿里云不支持代理
            proxiable: false,
            ttl: aliyunRecord.result?.ttl || record.ttl || 600,
            comment: record.comment || "",
            tags: [],
            created_on: new Date().toISOString(),
            modified_on: new Date().toISOString()
          }
        };
      } catch (error: any) {
        // 直接返回验证错误信息
        return Response.json(error.message || "DNS 记录创建失败", {
          status: 400,
        });
      }
    } else {
      console.log("[DNS 提供商调试] 使用 Cloudflare DNS 创建记录");
      // 使用 Cloudflare（默认）
      data = await createDNSRecord(
        matchedZone.cf_zone_id,
        matchedZone.cf_api_key,
        matchedZone.cf_email,
        record,
      );
    }

    if (!data.success || !data.result?.id) {
      // console.log("[data]", data);
      return Response.json(data.errors?.[0]?.message || "DNS 记录创建失败", {
        status: 501,
      });
    } else {
      const res = await createUserRecord(user.id, {
        record_id: data.result.id,
        zone_id: matchedZone.dns_provider_type === "aliyun" ? matchedZone.aliyun_domain_name : matchedZone.cf_zone_id,
        zone_name: matchedZone.domain_name,
        name: data.result.name,
        type: data.result.type,
        content: data.result.content,
        proxied: data.result.proxied,
        proxiable: data.result.proxiable,
        ttl: data.result.ttl,
        priority: data.result.priority || record.priority,
        comment: data.result.comment ?? "",
        tags: data.result.tags?.join("") ?? "",
        created_on: data.result.created_on,
        modified_on: data.result.modified_on,
        active: 0,
      });

      if (res.status !== "success") {
        return Response.json(res.status, {
          status: 502,
        });
      }
      return Response.json(res.data);
    }
  } catch (error) {
    console.error("[错误]", error);
    return Response.json(error, {
      status: error?.status || 500,
    });
  }
}
