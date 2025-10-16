import { env } from "@/env.mjs";
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

    const { record_id, zone_id, active } = await req.json();

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

    if (active !== 3) {
      let res;
      
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
          res = {
            success: result,
            result: result ? { id: record_id } : null
          };
        } catch (error: any) {
          console.error("[阿里云删除错误]", error.message);
          res = { success: false, result: null };
        }
      } else {
        console.log("[DNS 提供商调试] 使用 Cloudflare DNS 删除记录");
        // 使用 Cloudflare（默认）
        res = await deleteDNSRecord(
          matchedZone.cf_zone_id!,
          matchedZone.cf_api_key!,
          matchedZone.cf_email!,
          record_id,
        );
      }

      console.log("[删除API调试] DNS删除结果:", res);

      if (res && res.result?.id) {
        console.log("[删除API调试] DNS删除成功，开始删除数据库记录");
        try {
          await deleteUserRecord(user.id, record_id, zone_id, active);
          console.log("[删除API调试] 数据库记录删除成功");
          return Response.json("success", {
            status: 200,
            statusText: "success",
          });
        } catch (dbError) {
          console.error("[删除API调试] 数据库删除失败:", dbError);
          return Response.json("DNS记录已删除，但数据库删除失败", {
            status: 500,
            statusText: "Database delete failed",
          });
        }
      } else {
        console.log("[删除API调试] DNS删除失败，不删除数据库记录");
      }
    } else {
      await deleteUserRecord(user.id, record_id, zone_id, active);
      return Response.json("success", {
        status: 200,
        statusText: "success",
      });
    }

    return Response.json({
      status: 501,
      statusText: "Failed to delete DNS record",
    });
  } catch (error) {
    console.error("[Error]", error);
    return Response.json(error.message || "Server error", {
      status: error.status || 500,
      statusText: error.statusText || "Server error",
    });
  }
}
