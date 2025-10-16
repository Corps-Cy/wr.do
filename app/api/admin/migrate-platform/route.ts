// 平台迁移 API

import { NextRequest, NextResponse } from 'next/server';
import { DNSMigrator } from '@/lib/migration/dns-migrator';
import { DNSProvider, DNSConfig } from '@/lib/dns/types';
import { getCurrentUser } from '@/lib/session';
import { checkUserStatus } from '@/lib/dto/user';

export async function POST(req: NextRequest) {
  try {
    const user = checkUserStatus(await getCurrentUser());
    if (user instanceof Response) return user;

    // 检查管理员权限
    if (user.role !== 'admin') {
      return NextResponse.json('需要管理员权限', { status: 403 });
    }

    const body = await req.json();
    const { 
      domainId, 
      targetProvider, 
      config,
      options = {}
    } = body;

    // 验证参数
    if (!domainId) {
      return NextResponse.json('域名 ID 不能为空', { status: 400 });
    }

    if (!targetProvider || !['cloudflare', 'aliyun'].includes(targetProvider)) {
      return NextResponse.json('无效的目标提供商', { status: 400 });
    }

    if (!config) {
      return NextResponse.json('配置不能为空', { status: 400 });
    }

    // 验证配置
    const dnsConfig: DNSConfig = {
      provider: targetProvider as DNSProvider,
      ...config
    };

    const migrator = new DNSMigrator();
    
    // 执行迁移
    const result = await migrator.migrateDomain(
      domainId,
      targetProvider as DNSProvider,
      dnsConfig,
      {
        dryRun: options.dryRun || false,
        batchSize: options.batchSize || 10,
        continueOnError: options.continueOnError || false,
        verifyAfterMigration: options.verify || true
      }
    );

    return NextResponse.json({
      success: result.success,
      domainId: result.domainId,
      domainName: result.domainName,
      result: result.result
    });

  } catch (error) {
    console.error('平台迁移失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '迁移失败' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = checkUserStatus(await getCurrentUser());
    if (user instanceof Response) return user;

    // 检查管理员权限
    if (user.role !== 'admin') {
      return NextResponse.json('需要管理员权限', { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const domainId = searchParams.get('domainId');

    if (!domainId) {
      return NextResponse.json('域名 ID 不能为空', { status: 400 });
    }

    const migrator = new DNSMigrator();
    
    // 验证迁移结果
    const verification = await migrator.verifyMigration(domainId, 'aliyun');

    return NextResponse.json({
      success: verification.valid,
      domainId,
      errors: verification.errors
    });

  } catch (error) {
    console.error('验证迁移失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '验证失败' },
      { status: 500 }
    );
  }
}
