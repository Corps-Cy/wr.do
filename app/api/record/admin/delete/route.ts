import { deleteDNSRecord } from "@/lib/cloudflare";
import { deleteUserRecord } from "@/lib/dto/cloudflare-dns-record";
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

    const { record_id, zone_id, userId, active } = await req.json();
    if (!record_id || !userId || !zone_id) {
      return Response.json("record_id, userId, and zone_id are required", {
        status: 400,
        statusText: "Invalid request body",
      });
    }

    const zones = await getDomainsByFeature("enable_dns", true);
    if (!zones.length) {
      return Response.json("Please add at least one domain", {
        status: 400,
        statusText: "Please add at least one domain",
      });
    }

    const matchedZone = zones.find((zone) => 
      zone.cf_zone_id === zone_id || zone.aliyun_domain_name === zone_id
    );
    if (!matchedZone) {
      return Response.json(`Invalid or unsupported zone_id: ${zone_id}`, {
        status: 400,
        statusText: "Invalid zone_id",
      });
    }

    // force delete
    await deleteUserRecord(userId, record_id, zone_id, active);
    
    // 根据域名的 DNS 提供商选择相应的删除方法
    console.log("[DNS 提供商调试] 匹配的域名:", matchedZone.domain_name);
    console.log("[DNS 提供商调试] DNS 提供商类型:", matchedZone.dns_provider_type);
    
    if (matchedZone.dns_provider_type === "aliyun") {
      console.log("[DNS 提供商调试] 使用阿里云 DNS 删除记录");
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
        const result = await dnsManager.deleteDNSRecord(record_id, providerKey);
        console.log("[阿里云删除调试] 删除结果:", result);
        if (!result) {
          console.error("[阿里云删除错误] 删除失败");
        }
      } catch (error: any) {
        console.error("[阿里云删除错误]", error.message);
      }
    } else {
      console.log("[DNS 提供商调试] 使用 Cloudflare DNS 删除记录");
      // 使用 Cloudflare（默认）
      await deleteDNSRecord(
        matchedZone.cf_zone_id!,
        matchedZone.cf_api_key!,
        matchedZone.cf_email!,
        record_id,
      );
    }

    return Response.json("success", {
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
