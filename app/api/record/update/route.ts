import { updateDNSRecord } from "@/lib/cloudflare";
import {
  updateUserRecord,
  updateUserRecordState,
} from "@/lib/dto/cloudflare-dns-record";
import { getDomainsByFeature } from "@/lib/dto/domains";
import { checkUserStatus } from "@/lib/dto/user";
import { reservedDomains } from "@/lib/enums";
import { getCurrentUser } from "@/lib/session";
import { DNSManager } from "@/lib/dns/manager";
import { DNSConfig } from "@/lib/dns/types";

// Update DNS record
export async function POST(req: Request) {
  try {
    const user = checkUserStatus(await getCurrentUser());
    if (user instanceof Response) return user;

    const zones = await getDomainsByFeature("enable_dns", true);
    if (!zones.length) {
      return Response.json(
        "API key, zone configuration, and email are required",
        { status: 401, statusText: "Missing required configuration" },
      );
    }

    const { record, recordId } = await req.json();
    if (!record || !recordId) {
      return Response.json("Record and recordId are required", {
        status: 400,
        statusText: "Invalid request body",
      });
    }

    if (reservedDomains.includes(record.name)) {
      return Response.json("Domain name is reserved", {
        status: 403,
        statusText: "Reserved domain",
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
      console.log("[DNS 提供商调试] 原始记录名称:", record.name);
      console.log("[DNS 提供商调试] 记录类型:", record.type);
      console.log("[DNS 提供商调试] 记录内容:", record.content);
      console.log("[DNS 提供商调试] 记录ID:", recordId);
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
        { status: 501, statusText: "DNS API error" },
      );
    }

    const res = await updateUserRecord(user.id, {
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

    return Response.json(res.data);
  } catch (error) {
    console.error("[Error]", error);
    return Response.json(error.message || "Server error", {
      status: error?.status || 500,
      statusText: error?.statusText || "Server error",
    });
  }
}

// Update record state
export async function PUT(req: Request) {
  try {
    console.log("[PUT 方法调试] 开始执行记录状态更新");
    
    const user = checkUserStatus(await getCurrentUser());
    if (user instanceof Response) return user;
    console.log("[PUT 方法调试] 用户验证通过:", user.id);

    const zones = await getDomainsByFeature("enable_dns", true);
    if (!zones.length) {
      console.log("[PUT 方法调试] 没有找到可用的域名");
      return Response.json(
        "API key, zone configuration, and email are required",
        { status: 401, statusText: "Missing required configuration" },
      );
    }
    console.log("[PUT 方法调试] 找到域名数量:", zones.length);

    const { zone_id, record_id, target, active } = await req.json();
    console.log("[PUT 方法调试] 请求参数:", { zone_id, record_id, target, active });
    
    if (!zone_id || !record_id || !target) {
      console.log("[PUT 方法调试] 缺少必需参数");
      return Response.json("zone_id, record_id, and target are required", {
        status: 400,
        statusText: "Invalid request body",
      });
    }

    const matchedZone = zones.find((zone) => 
      zone.cf_zone_id === zone_id || zone.aliyun_domain_name === zone_id
    );
    if (!matchedZone) {
      console.log("[PUT 方法调试] 找不到匹配的域名，zone_id:", zone_id);
      return Response.json(`Invalid or unsupported zone_id: ${zone_id}`, {
        status: 400,
        statusText: "Invalid zone_id",
      });
    }
    console.log("[PUT 方法调试] 找到匹配域名:", matchedZone.domain_name);

    // 根据 DNS 提供商类型决定检查逻辑
    let checkUrl;
    if (matchedZone.dns_provider_type === "aliyun") {
      // 阿里云：拼接完整域名进行检查
      checkUrl = `https://${target}.${matchedZone.domain_name}`;
      console.log("[PUT 方法调试] 阿里云域名，拼接完整域名:", checkUrl);
    } else {
      // Cloudflare：保持原有逻辑，直接使用 target
      checkUrl = `https://${target}`;
      console.log("[PUT 方法调试] Cloudflare域名，直接使用target:", checkUrl);
    }
    
    console.log("[PUT 方法调试] 开始检查目标可访问性:", checkUrl);
    let isTargetAccessible = false;
    try {
      const target_res = await fetch(checkUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(10000),
      });
      isTargetAccessible = target_res.status === 200;
      console.log("[PUT 方法调试] 目标响应状态:", target_res.status, "可访问:", isTargetAccessible);
    } catch (fetchError) {
      isTargetAccessible = false;
      console.log("[PUT 方法调试] 目标访问失败:", fetchError.message);
    }

    console.log("[PUT 方法调试] 更新记录状态到数据库，状态:", isTargetAccessible ? 1 : 0);
    const res = await updateUserRecordState(
      user.id,
      record_id,
      zone_id,
      isTargetAccessible ? 1 : 0,
    );

    if (!res) {
      console.log("[PUT 方法调试] 数据库更新失败");
      return Response.json("Failed to update record state", {
        status: 502,
        statusText: "Database error",
      });
    }

    const resultMessage = isTargetAccessible ? "Target is accessible!" : "Target is unaccessible!";
    console.log("[PUT 方法调试] 操作完成，返回结果:", resultMessage);
    return Response.json(resultMessage, { status: 200 });
  } catch (error) {
    console.error("[PUT 方法调试] 发生错误:", error);
    return Response.json(
      `An error occurred: ${error.message || "Unknown error"}`,
      {
        status: 500,
        statusText: "Server error",
      },
    );
  }
}
