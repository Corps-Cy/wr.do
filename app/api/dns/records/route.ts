// 统一 DNS 记录管理 API

import { NextRequest, NextResponse } from 'next/server';
import { dnsManager } from '@/lib/dns/manager';
import { getDomainsByFeature } from '@/lib/dto/domains';
import { getCurrentUser } from '@/lib/session';
import { checkUserStatus } from '@/lib/dto/user';
import { CreateDNSRecord, UpdateDNSRecord, DNSFilters, DNSConfig, DNSProvider } from '@/lib/dns/types';

export async function POST(req: NextRequest) {
  try {
    const user = checkUserStatus(await getCurrentUser());
    if (user instanceof Response) return user;

    const body = await req.json();
    const { domainId, record } = body;

    if (!domainId || !record) {
      return NextResponse.json('域名 ID 和记录信息不能为空', { status: 400 });
    }

    // 获取域名配置
    const domains = await getDomainsByFeature('enable_dns', true);
    const domain = domains.find(d => d.id === domainId);

    if (!domain) {
      return NextResponse.json('域名不存在或未启用 DNS', { status: 404 });
    }

    // 构建 DNS 配置
    const dnsConfig: DNSConfig = {
      provider: (domain.dns_provider_type as DNSProvider) || 'cloudflare',
      cf_zone_id: domain.cf_zone_id ?? undefined,
      cf_api_key: domain.cf_api_key ?? undefined,
      cf_email: domain.cf_email ?? undefined,
      aliyun_access_key_id: domain.aliyun_access_key_id ?? undefined,
      aliyun_access_key_secret: domain.aliyun_access_key_secret ?? undefined,
      aliyun_region: domain.aliyun_region ?? undefined,
      aliyun_domain_name: domain.aliyun_domain_name ?? undefined
    };

    // 注册提供商
    const providerKey = `domain_${domainId}`;
    dnsManager.registerProvider(providerKey, dnsConfig);

    // 创建 DNS 记录
    const result = await dnsManager.createDNSRecord(record as CreateDNSRecord, providerKey);

    if (!result.success) {
      return NextResponse.json(
        { error: result.errors?.[0]?.message || '创建记录失败' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      record: result.result
    });

  } catch (error) {
    console.error('创建 DNS 记录失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建记录失败' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = checkUserStatus(await getCurrentUser());
    if (user instanceof Response) return user;

    const body = await req.json();
    const { domainId, recordId, record } = body;

    if (!domainId || !recordId || !record) {
      return NextResponse.json('域名 ID、记录 ID 和记录信息不能为空', { status: 400 });
    }

    // 获取域名配置
    const domains = await getDomainsByFeature('enable_dns', true);
    const domain = domains.find(d => d.id === domainId);

    if (!domain) {
      return NextResponse.json('域名不存在或未启用 DNS', { status: 404 });
    }

    // 构建 DNS 配置
    const dnsConfig: DNSConfig = {
      provider: (domain.dns_provider_type as DNSProvider) || 'cloudflare',
      cf_zone_id: domain.cf_zone_id ?? undefined,
      cf_api_key: domain.cf_api_key ?? undefined,
      cf_email: domain.cf_email ?? undefined,
      aliyun_access_key_id: domain.aliyun_access_key_id ?? undefined,
      aliyun_access_key_secret: domain.aliyun_access_key_secret ?? undefined,
      aliyun_region: domain.aliyun_region ?? undefined,
      aliyun_domain_name: domain.aliyun_domain_name ?? undefined
    };

    // 注册提供商
    const providerKey = `domain_${domainId}`;
    dnsManager.registerProvider(providerKey, dnsConfig);

    // 更新 DNS 记录
    const result = await dnsManager.updateDNSRecord(
      recordId,
      record as UpdateDNSRecord,
      providerKey
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.errors?.[0]?.message || '更新记录失败' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      record: result.result
    });

  } catch (error) {
    console.error('更新 DNS 记录失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新记录失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = checkUserStatus(await getCurrentUser());
    if (user instanceof Response) return user;

    const { searchParams } = new URL(req.url);
    const domainId = searchParams.get('domainId');
    const recordId = searchParams.get('recordId');

    if (!domainId || !recordId) {
      return NextResponse.json('域名 ID 和记录 ID 不能为空', { status: 400 });
    }

    // 获取域名配置
    const domains = await getDomainsByFeature('enable_dns', true);
    const domain = domains.find(d => d.id === domainId);

    if (!domain) {
      return NextResponse.json('域名不存在或未启用 DNS', { status: 404 });
    }

    // 构建 DNS 配置
    const dnsConfig: DNSConfig = {
      provider: (domain.dns_provider_type as DNSProvider) || 'cloudflare',
      cf_zone_id: domain.cf_zone_id ?? undefined,
      cf_api_key: domain.cf_api_key ?? undefined,
      cf_email: domain.cf_email ?? undefined,
      aliyun_access_key_id: domain.aliyun_access_key_id ?? undefined,
      aliyun_access_key_secret: domain.aliyun_access_key_secret ?? undefined,
      aliyun_region: domain.aliyun_region ?? undefined,
      aliyun_domain_name: domain.aliyun_domain_name ?? undefined
    };

    // 注册提供商
    const providerKey = `domain_${domainId}`;
    dnsManager.registerProvider(providerKey, dnsConfig);

    // 删除 DNS 记录
    const result = await dnsManager.deleteDNSRecord(recordId, providerKey);

    return NextResponse.json({
      success: result
    });

  } catch (error) {
    console.error('删除 DNS 记录失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除记录失败' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = checkUserStatus(await getCurrentUser());
    if (user instanceof Response) return user;

    const { searchParams } = new URL(req.url);
    const domainId = searchParams.get('domainId');
    const recordId = searchParams.get('recordId');

    if (!domainId) {
      return NextResponse.json('域名 ID 不能为空', { status: 400 });
    }

    // 获取域名配置
    const domains = await getDomainsByFeature('enable_dns', true);
    const domain = domains.find(d => d.id === domainId);

    if (!domain) {
      return NextResponse.json('域名不存在或未启用 DNS', { status: 404 });
    }

    // 构建 DNS 配置
    const dnsConfig: DNSConfig = {
      provider: (domain.dns_provider_type as DNSProvider) || 'cloudflare',
      cf_zone_id: domain.cf_zone_id ?? undefined,
      cf_api_key: domain.cf_api_key ?? undefined,
      cf_email: domain.cf_email ?? undefined,
      aliyun_access_key_id: domain.aliyun_access_key_id ?? undefined,
      aliyun_access_key_secret: domain.aliyun_access_key_secret ?? undefined,
      aliyun_region: domain.aliyun_region ?? undefined,
      aliyun_domain_name: domain.aliyun_domain_name ?? undefined
    };

    // 注册提供商
    const providerKey = `domain_${domainId}`;
    dnsManager.registerProvider(providerKey, dnsConfig);

    if (recordId) {
      // 获取单个记录
      const result = await dnsManager.getDNSRecord(recordId, providerKey);
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.errors?.[0]?.message || '获取记录失败' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        record: result.result
      });
    } else {
      // 获取记录列表
      const filters: DNSFilters = {};
      
      if (searchParams.get('type')) filters.type = searchParams.get('type') as any;
      const nameParam = searchParams.get('name');
      if (nameParam !== null) filters.name = nameParam;
      const contentParam = searchParams.get('content');
      if (contentParam !== null) filters.content = contentParam;
      const pageParam = searchParams.get('page');
      if (pageParam) filters.page = parseInt(pageParam);
      const perPageParam = searchParams.get('per_page');
      if (perPageParam) filters.per_page = parseInt(perPageParam);

      const result = await dnsManager.getDNSRecords(filters, providerKey);

      if (!result.success) {
        return NextResponse.json(
          { error: result.errors?.[0]?.message || '获取记录列表失败' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        records: result.result,
        result_info: result.result_info
      });
    }

  } catch (error) {
    console.error('获取 DNS 记录失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取记录失败' },
      { status: 500 }
    );
  }
}
