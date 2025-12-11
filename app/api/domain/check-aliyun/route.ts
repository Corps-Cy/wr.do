import { NextRequest, NextResponse } from "next/server";
import { AliyunDNSProvider } from "@/lib/dns/providers/aliyun";
import { DNSConfig } from "@/lib/dns/types";

// 标记为动态路由，避免静态生成
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accessKeyId = searchParams.get("access_key_id");
    const accessKeySecret = searchParams.get("access_key_secret");
    const domainName = searchParams.get("domain_name");

    if (!accessKeyId || !accessKeySecret || !domainName) {
      return NextResponse.json(
        { success: false, message: "缺少必需参数" },
        { status: 400 }
      );
    }

    // 创建 DNS 配置
    const config: DNSConfig = {
      provider: 'aliyun',
      aliyun_access_key_id: accessKeyId,
      aliyun_access_key_secret: accessKeySecret,
      aliyun_region: 'cn-hangzhou',
      aliyun_domain_name: domainName
    };

    try {
      // 创建阿里云 DNS 提供商实例
      const provider = new AliyunDNSProvider(config);
      
      // 验证域名配置
      const isValid = await provider.validateDomain();
      
      if (isValid) {
        // 获取域名信息以进一步验证
        const domainInfo = await provider.getDomainInfo();
        
        return NextResponse.json({
          success: true,
          message: "阿里云 DNS 配置验证成功",
          data: {
            domainId: domainInfo.id,
            domainName: domainInfo.name,
            nameServers: domainInfo.name_servers
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          message: "域名验证失败"
        }, { status: 400 });
      }
    } catch (error: any) {
      console.error("阿里云 DNS 配置验证错误:", error);
      
      // 根据错误类型返回具体的错误信息
      let errorMessage = "阿里云 DNS 配置验证失败";
      
      if (error.message?.includes("InvalidAccessKeyId")) {
        errorMessage = "AccessKey ID 无效";
      } else if (error.message?.includes("SignatureDoesNotMatch")) {
        errorMessage = "AccessKey Secret 无效";
      } else if (error.message?.includes("DomainNotExist")) {
        errorMessage = "域名不存在或未在阿里云托管";
      } else if (error.message?.includes("Forbidden")) {
        errorMessage = "AccessKey 权限不足";
      } else if (error.message?.includes("ECONNREFUSED") || error.message?.includes("timeout")) {
        errorMessage = "网络连接失败，请检查网络设置";
      }
      
      return NextResponse.json({
        success: false,
        message: errorMessage,
        error: error.message
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error("阿里云 DNS 配置验证 API 错误:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "服务器内部错误",
        error: error.message 
      },
      { status: 500 }
    );
  }
}
