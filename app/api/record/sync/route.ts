import { getDNSRecordsList } from "@/lib/cloudflare";
import { createUserRecord } from "@/lib/dto/cloudflare-dns-record";
import { getDomainsByFeature } from "@/lib/dto/domains";
import { checkUserStatus } from "@/lib/dto/user";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

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
          const missingFields: string[] = [];
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

          const requestOption = {
            method: 'POST',
            formatParams: false,
          };

          // 分页获取所有记录
          const allRecords: any[] = [];
          let pageNumber = 1;
          const pageSize = 100; // 每页最多 100 条
          let totalCount = 0;
          let hasMore = true;

          console.log(`[阿里云API调试] 开始分页获取DNS记录，域名: ${matchedZone.aliyun_domain_name}`);

          while (hasMore) {
            const params = {
              "Lang": "zh",
              "DomainName": matchedZone.aliyun_domain_name,
              "PageNumber": pageNumber,
              "PageSize": pageSize
            };

            console.log(`[阿里云API调试] 获取第 ${pageNumber} 页记录...`);
            const result = await client.request('DescribeDomainRecords', params, requestOption);
            
            totalCount = result.TotalCount || 0;
            const currentPageRecords = result.DomainRecords?.Record || [];
            
            console.log(`[阿里云API调试] 第 ${pageNumber} 页结果:`, {
              RequestId: result.RequestId,
              TotalCount: totalCount,
              RecordCount: currentPageRecords.length,
              PageNumber: result.PageNumber,
              PageSize: result.PageSize
            });

            if (currentPageRecords.length > 0) {
              allRecords.push(...currentPageRecords);
            }

            // 判断是否还有更多页
            const currentPageCount = allRecords.length;
            hasMore = currentPageCount < totalCount && currentPageRecords.length === pageSize;
            
            if (hasMore) {
              pageNumber++;
            } else {
              break;
            }
          }

          console.log(`[阿里云API调试] 总共获取到 ${allRecords.length} 条记录（总数: ${totalCount}）`);

          if (allRecords.length > 0) {
            records = allRecords.map((record: any) => ({
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
          
          if (result && result.length > 0) {
            records = result.map(record => ({
              id: record.id,
              zone_name: matchedZone.domain_name,
              type: record.type,
              name: record.name,
              content: record.content,
              ttl: record.ttl,
              priority: (record as any).priority,
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
          // 使用 upsert 操作：如果记录存在则更新，不存在则创建
          // 处理日期字段：如果不存在则使用当前时间
          const now = new Date().toISOString();
          const recordData = {
            record_id: record.id,
            zone_id: (matchedZone.dns_provider_type === 'aliyun' 
              ? matchedZone.aliyun_domain_name 
              : matchedZone.cf_zone_id) || "",
            zone_name: record.zone_name || matchedZone.domain_name,
            name: record.name || "@",
            type: record.type,
            content: record.content || "",
            ttl: record.ttl || 1,
            priority: record.priority,
            proxied: record.proxied || false,
            proxiable: record.proxiable !== undefined ? record.proxiable : true,
            comment: record.comment || "",
            tags: record.tags || "",
            created_on: record.created_on || now,
            modified_on: record.modified_on || now,
            active: record.active !== undefined ? record.active : 1
          };

          // 检查记录是否已存在
          const existingRecord = await prisma.userRecord.findUnique({
            where: { record_id: record.id }
          });

          if (existingRecord) {
            // 记录已存在，更新它
            await prisma.userRecord.update({
              where: { record_id: record.id },
              data: {
                zone_id: recordData.zone_id ?? undefined,
                zone_name: recordData.zone_name ?? undefined,
                name: recordData.name ?? undefined,
                type: recordData.type ?? undefined,
                content: recordData.content ?? undefined,
                ttl: recordData.ttl ?? undefined,
                priority: recordData.priority ?? undefined,
                proxied: recordData.proxied ?? undefined,
                proxiable: recordData.proxiable ?? undefined,
                comment: recordData.comment ?? undefined,
                tags: recordData.tags ?? undefined,
                modified_on: recordData.modified_on ?? undefined,
                active: recordData.active ?? undefined
              }
            });
            totalSynced++;
            console.log(`[同步记录] 更新记录: ${record.name}.${record.zone_name} (${record.type})`);
          } else {
            // 记录不存在，创建新记录
            const result = await createUserRecord(user.id, recordData);
            if (result.status === "success") {
              totalSynced++;
              console.log(`[同步记录] 创建记录: ${record.name}.${record.zone_name} (${record.type})`);
            } else {
              const errorMsg = result.message || (typeof result.status === 'string' ? result.status : 'Unknown error');
              console.error(`[同步记录失败] ${record.name}.${record.zone_name} (${record.type}):`, errorMsg);
              totalSkipped++;
            }
          }
        } catch (error: any) {
          console.error(`[同步记录错误] ${matchedZone.domain_name} - ${record.name}:`, error?.message || error);
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