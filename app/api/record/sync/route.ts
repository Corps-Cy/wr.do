import { getDNSRecordsList } from "@/lib/cloudflare";
import { createUserRecord } from "@/lib/dto/cloudflare-dns-record";
import { getDomainsByFeature } from "@/lib/dto/domains";
import { checkUserStatus } from "@/lib/dto/user";
import { getCurrentUser } from "@/lib/session";

// 使用 require 方式导入阿里云 SDK，避免 ES 模块问题
const Core = require('@alicloud/pop-core');

export async function POST(req: Request) {
  try {
    console.log("[同步调试] 开始同步DNS记录");
    const user = checkUserStatus(await getCurrentUser());
    if (user instanceof Response) return user;
    console.log("[同步调试] 用户验证通过:", user.id);

    const requestBody = await req.json();
    console.log("[同步调试] 请求参数:", requestBody);

    const zones = await getDomainsByFeature("enable_dns", true);
    if (!zones.length) {
      console.log("[同步调试] 没有找到可用的域名");
      return Response.json("Please add at least one domain", {
        status: 400,
        statusText: "Please add at least one domain",
      });
    }

    console.log("[同步调试] 找到域名数量:", zones.length);
    console.log("[同步调试] 域名列表:", zones.map(z => ({
      domain_name: z.domain_name,
      dns_provider_type: z.dns_provider_type,
      aliyun_domain_name: z.aliyun_domain_name,
      cf_zone_id: z.cf_zone_id
    })));

    // 如果没有指定zone_id，则同步所有域名
    let zonesToSync = zones;
    if (requestBody.zone_id) {
      const matchedZone = zones.find((zone) => 
        zone.cf_zone_id === requestBody.zone_id || zone.aliyun_domain_name === requestBody.zone_id
      );
      if (matchedZone) {
        zonesToSync = [matchedZone];
      }
    }

    let totalSynced = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    // 遍历所有需要同步的域名
    for (const matchedZone of zonesToSync) {
      console.log("[同步调试] 开始同步域名:", matchedZone.domain_name);
      console.log("[同步DNS调试] DNS提供商类型:", matchedZone.dns_provider_type);

      let records;
      
      if (matchedZone.dns_provider_type === "aliyun") {
        console.log("[同步DNS调试] 使用阿里云DNS获取记录");
        console.log("[同步DNS调试] 阿里云配置:", {
          aliyun_access_key_id: matchedZone.aliyun_access_key_id ? "已设置" : "未设置",
          aliyun_access_key_secret: matchedZone.aliyun_access_key_secret ? "已设置" : "未设置",
          aliyun_region: matchedZone.aliyun_region,
          aliyun_domain_name: matchedZone.aliyun_domain_name
        });
        
        // 检查必要的配置
        if (!matchedZone.aliyun_access_key_id || !matchedZone.aliyun_access_key_secret || !matchedZone.aliyun_domain_name) {
          const missingFields = [];
          if (!matchedZone.aliyun_access_key_id) missingFields.push('aliyun_access_key_id');
          if (!matchedZone.aliyun_access_key_secret) missingFields.push('aliyun_access_key_secret');
          if (!matchedZone.aliyun_domain_name) missingFields.push('aliyun_domain_name');
          console.error(`[同步DNS调试] 阿里云配置不完整，缺少: ${missingFields.join(', ')}`);
          errors.push(`${matchedZone.domain_name}: 阿里云配置不完整，缺少 ${missingFields.join(', ')}`);
          continue;
        }
        
        // 按照您提供的示例直接使用阿里云API
        try {
          const client = new Core({
            accessKeyId: matchedZone.aliyun_access_key_id,
            accessKeySecret: matchedZone.aliyun_access_key_secret,
            endpoint: 'https://alidns.aliyuncs.com',
            apiVersion: '2015-01-09'
          });

          const params = {
            "Lang": "zh",
            "DomainName": matchedZone.aliyun_domain_name
          };

          const requestOption = {
            method: 'POST',
            formatParams: false,
          };

          console.log(`[阿里云API调试] 调用DescribeDomainRecords，域名: ${matchedZone.aliyun_domain_name}`);
          const result = await client.request('DescribeDomainRecords', params, requestOption);
          
          console.log(`[阿里云API调试] 获取到结果:`, {
            RequestId: result.RequestId,
            TotalCount: result.TotalCount,
            RecordCount: result.DomainRecords?.Record?.length || 0
          });

          if (result.DomainRecords?.Record) {
            records = result.DomainRecords.Record.map((record: any) => ({
              id: record.RecordId,
              zone_name: matchedZone.domain_name,
              type: record.Type,
              name: record.RR,
              content: record.Value,
              ttl: parseInt(record.TTL) || 600,
              priority: record.Priority ? parseInt(record.Priority) : undefined,
              proxied: false,
              proxiable: false,
              comment: record.Remark || "",
              tags: "",
              created_on: record.CreateTimestamp ? new Date(parseInt(record.CreateTimestamp)).toISOString() : new Date().toISOString(),
              modified_on: record.UpdateTimestamp ? new Date(parseInt(record.UpdateTimestamp)).toISOString() : new Date().toISOString(),
              active: 1
            }));
          }
        } catch (error: any) {
          console.error(`[阿里云同步错误] ${matchedZone.domain_name}:`, error);
          let errorMessage = error.message || error.toString();
          
          // 处理特定的阿里云错误
          if (error.code === 'InvalidAccessKeyId.NotFound') {
            errorMessage = `阿里云Access Key ID不存在或无效，请检查域名 ${matchedZone.domain_name} 的配置`;
          } else if (error.code === 'SignatureDoesNotMatch') {
            errorMessage = `阿里云Access Key Secret不正确，请检查域名 ${matchedZone.domain_name} 的配置`;
          } else if (error.code === 'Forbidden.AccessDenied') {
            errorMessage = `阿里云Access Key没有访问域名 ${matchedZone.domain_name} 的权限`;
          }
          
          errors.push(`${matchedZone.domain_name}: ${errorMessage}`);
          continue;
        }
      } else {
        console.log("[同步DNS调试] 使用Cloudflare DNS获取记录");
        
        // 使用 Cloudflare（默认）
        try {
          const result = await getDNSRecordsList(
            matchedZone.cf_zone_id!,
            matchedZone.cf_api_key!,
            matchedZone.cf_email!,
          );
          
          if (result && result.result) {
            records = result.result.map(record => ({
              id: record.id,
              zone_name: matchedZone.domain_name,
              type: record.type,
              name: record.name,
              content: record.content,
              ttl: record.ttl,
              priority: record.priority,
              proxied: record.proxied || false,
              proxiable: record.proxiable || false,
              comment: record.comment || "",
              tags: record.tags?.join(",") || "",
              created_on: record.created_on,
              modified_on: record.modified_on,
              active: 1
            }));
          }
        } catch (error: any) {
          console.error(`[Cloudflare同步错误] ${matchedZone.domain_name}:`, error);
          const errorMessage = error.message || error.toString();
          errors.push(`${matchedZone.domain_name}: ${errorMessage}`);
          continue;
        }
      }

      if (!records || records.length === 0) {
        console.log(`[同步调试] ${matchedZone.domain_name} 没有找到记录`);
        continue;
      }

      console.log(`[同步DNS调试] ${matchedZone.domain_name} 找到记录数量:`, records.length);

      // 同步记录到数据库
      for (const record of records) {
        try {
          const result = await createUserRecord(user.id, {
            record_id: record.id,
            zone_id: matchedZone.dns_provider_type === 'aliyun' 
              ? matchedZone.aliyun_domain_name 
              : matchedZone.cf_zone_id,
            zone_name: record.zone_name,
            name: record.name,
            type: record.type,
            content: record.content,
            ttl: record.ttl,
            priority: record.priority,
            proxied: record.proxied,
            proxiable: record.proxiable,
            comment: record.comment,
            tags: record.tags,
            created_on: record.created_on,
            modified_on: record.modified_on,
            active: record.active
          });

          if (result.status === "success") {
            totalSynced++;
          } else {
            totalSkipped++;
          }
        } catch (error) {
          console.error(`[同步记录错误] ${matchedZone.domain_name}:`, error);
          totalSkipped++;
        }
      }
    }

    console.log("[同步DNS调试] 所有域名同步完成 - 成功:", totalSynced, "跳过:", totalSkipped);

    return Response.json({
      message: "Sync completed",
      synced: totalSynced,
      skipped: totalSkipped,
      errors: errors
    }, {
      status: 200,
      statusText: "Sync completed",
    });

  } catch (error: any) {
    console.error("[同步DNS错误]", error);
    return Response.json(error.message || "Server error", {
      status: error.status || 500,
      statusText: error.statusText || "Server error",
    });
  }
}