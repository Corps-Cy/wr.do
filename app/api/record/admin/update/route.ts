import { updateDNSRecord } from "@/lib/cloudflare";
import { updateUserRecord } from "@/lib/dto/cloudflare-dns-record";
import { getDomainsByFeature } from "@/lib/dto/domains";
import { checkUserStatus } from "@/lib/dto/user";
import { getCurrentUser } from "@/lib/session";
import { DNSManager } from "@/lib/dns/manager";
import { DNSConfig } from "@/lib/dns/types";

export async function POST(req: Request) {
  try {
    const user = checkUserStatus(await getCurrentUser());
    if (user instanceof Response) return user;
    if (user.role !== "ADMIN") {
      return Response.json("Unauthorized", {
        status: 401,
        statusText: "Admin access required",
      });
    }

    const zones = await getDomainsByFeature("enable_dns", true);
    if (!zones.length) {
      return Response.json(
        "API key, zone configuration, and email are required",
        { status: 401, statusText: "Missing required configuration" },
      );
    }

    const { record, recordId, userId } = await req.json();
    if (!record || !recordId || !userId) {
      return Response.json("record, recordId, and userId are required", {
        status: 400,
        statusText: "Invalid request body",
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
        `No matching zone found for domain: ${record_name}`,
        {
          status: 400,
          statusText: "Invalid domain",
        },
      );
    }

    // 根据域名的 DNS 提供商选择相应的更新方法
    let data;
    
    console.log("[DNS 提供商调试] 匹配的域名:", matchedZone.domain_name);
    console.log("[DNS 提供商调试] DNS 提供商类型:", matchedZone.dns_provider_type);
    console.log("[DNS 提供商调试] 阿里云域名:", matchedZone.aliyun_domain_name);
    
    if (matchedZone.dns_provider_type === "aliyun") {
      console.log("[DNS 提供商调试] 使用阿里云 DNS 更新记录");
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
        const aliyunRecord = await dnsManager.updateDNSRecord(recordId, {
          name: record.name, // 直接使用原始名称，让阿里云提供商处理
          type: record.type,
          content: record.content,
          ttl: record.ttl || 600,
          priority: record.priority
        }, providerKey);
        
        if (!aliyunRecord.success) {
          return Response.json(aliyunRecord.errors?.[0]?.message || "阿里云 DNS 记录更新失败", {
            status: 501,
          });
        }
        
        data = {
          success: true,
          result: {
            id: aliyunRecord.result?.id || recordId,
            name: aliyunRecord.result?.name || record_name,
            type: aliyunRecord.result?.type || record.type,
            content: aliyunRecord.result?.content || record.content,
            proxied: false, // 阿里云不支持代理
            proxiable: false,
            ttl: aliyunRecord.result?.ttl || record.ttl || 600,
            comment: record.comment || "",
            tags: [],
            modified_on: new Date().toISOString()
          }
        };
      } catch (error: any) {
        // 直接返回验证错误信息
        return Response.json(error.message || "DNS 记录更新失败", {
          status: 400,
        });
      }
    } else {
      console.log("[DNS 提供商调试] 使用 Cloudflare DNS 更新记录");
      // 使用 Cloudflare（默认）
      data = await updateDNSRecord(
        matchedZone.cf_zone_id,
        matchedZone.cf_api_key,
        matchedZone.cf_email,
        recordId,
        { ...record, name: record_name },
      );
    }

    if (!data.success || !data.result?.id) {
      return Response.json(
        data.errors?.[0]?.message || "Failed to update DNS record",
        {
          status: 501,
          statusText: "DNS API error",
        },
      );
    }

    const res = await updateUserRecord(userId, {
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
      modified_on: data.result.modified_on,
      active: 1,
    });

    if (res.status !== "success") {
      return Response.json(res.status, {
        status: 502,
        statusText: "Failed to update user record",
      });
    }

    return Response.json(res.data, {
      status: 200,
      statusText: "success",
    });
  } catch (error) {
    console.error("[Error]", error);
    return Response.json(error.message || "Server error", {
      status: error?.status || 500,
      statusText: error?.statusText || "Server error",
    });
  }
}
