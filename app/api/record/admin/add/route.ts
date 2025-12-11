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
import { checkUserStatus, getUserByEmail } from "@/lib/dto/user";
import { getCurrentUser } from "@/lib/session";
import { generateSecret } from "@/lib/utils";

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
      return Response.json("Please add at least one domain", {
        status: 400,
        statusText: "Please add at least one domain",
      });
    }

    const { records, email } = await req.json();
    const target_user = await getUserByEmail(email);
    if (!target_user) {
      return Response.json("User not found", {
        status: 404,
        statusText: "User not found",
      });
    }

    const plan = await getPlanQuota(user.team);

    const { total } = await getUserRecordCount(target_user.id);
    if (total >= plan.rcNewRecords) {
      return Response.json("Your records have reached the free limit.", {
        status: 409,
      });
    }

    const record = {
      ...records[0],
      id: generateSecret(16),
    };

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

    const user_record = await getUserRecordByTypeNameContent(
      target_user.id,
      record.type,
      record_name,
      record.content,
      record.zone_name,
      1,
    );
    if (user_record && user_record.length > 0) {
      return Response.json("Record already exists", {
        status: 403,
      });
    }

    // 根据域名的 DNS 提供商选择相应的创建方法
    let data;
    
    if (matchedZone.dns_provider_type === "aliyun") {
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
      const aliyunRecord = await dnsManager.createDNSRecord({
        name: record_name,
        type: record.type,
        content: record.content,
        ttl: record.ttl || 600
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
    } else {
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
      const res = await createUserRecord(target_user.id, {
        record_id: data.result.id,
        zone_id: matchedZone.dns_provider_type === "aliyun" ? matchedZone.aliyun_domain_name : matchedZone.cf_zone_id,
        zone_name: matchedZone.domain_name,
        name: data.result.name,
        type: data.result.type,
        content: data.result.content,
        proxied: data.result.proxied,
        proxiable: data.result.proxiable,
        ttl: data.result.ttl,
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
