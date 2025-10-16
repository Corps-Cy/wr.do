#!/usr/bin/env tsx

/**
 * 阿里云 DNS 集成测试脚本
 * 使用方法: tsx scripts/test-aliyun-dns.ts
 */

import { AliyunDNSProvider } from '../lib/dns/providers/aliyun';
import { DNSConfig } from '../lib/dns/types';

async function testAliyunDNS() {
  console.log('🧪 开始测试阿里云 DNS 集成...');

  // 从环境变量获取配置
  const config: DNSConfig = {
    provider: 'aliyun',
    aliyun_access_key_id: process.env.ALIYUN_ACCESS_KEY_ID || '',
    aliyun_access_key_secret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
    aliyun_region: process.env.ALIYUN_REGION || 'cn-hangzhou',
    aliyun_domain_name: process.env.ALIYUN_DOMAIN_NAME || ''
  };

  // 验证配置
  if (!config.aliyun_access_key_id || !config.aliyun_access_key_secret || !config.aliyun_domain_name) {
    console.error('❌ 配置不完整，请设置以下环境变量：');
    console.error('   ALIYUN_ACCESS_KEY_ID');
    console.error('   ALIYUN_ACCESS_KEY_SECRET');
    console.error('   ALIYUN_DOMAIN_NAME');
    process.exit(1);
  }

  try {
    // 创建提供商实例
    const provider = new AliyunDNSProvider(config);
    console.log('✅ 阿里云 DNS 提供商创建成功');

    // 测试域名验证
    console.log('🔍 验证域名配置...');
    const isValid = await provider.validateDomain();
    if (isValid) {
      console.log('✅ 域名验证成功');
    } else {
      console.log('❌ 域名验证失败');
      process.exit(1);
    }

    // 测试获取域名信息
    console.log('📋 获取域名信息...');
    const domainInfo = await provider.getDomainInfo();
    console.log('域名信息:', {
      id: domainInfo.id,
      name: domainInfo.name,
      status: domainInfo.status,
      name_servers: domainInfo.name_servers.slice(0, 2) // 只显示前两个
    });

    // 测试获取 DNS 记录列表
    console.log('📝 获取 DNS 记录列表...');
    const records = await provider.getDNSRecords({ per_page: 5 });
    console.log(`找到 ${records.result?.length || 0} 条 DNS 记录`);
    
    if (records.result && records.result.length > 0) {
      console.log('前几条记录:');
      records.result.slice(0, 3).forEach((record, index) => {
        console.log(`  ${index + 1}. ${record.name} ${record.type} ${record.content}`);
      });
    }

    // 测试创建 DNS 记录（仅预览，不实际创建）
    console.log('🧪 测试创建 DNS 记录（预览模式）...');
    const testRecord = {
      type: 'TXT' as const,
      name: `test-${Date.now()}`,
      content: 'test-record',
      ttl: 600,
      comment: '测试记录'
    };
    
    console.log('测试记录参数:', testRecord);
    console.log('⚠️  注意：这是预览模式，不会实际创建记录');

    console.log('\n🎉 阿里云 DNS 集成测试完成！');
    console.log('✅ 所有测试通过，可以正常使用阿里云 DNS 功能');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('InvalidAccessKeyId')) {
        console.error('💡 建议：检查 ALIYUN_ACCESS_KEY_ID 是否正确');
      } else if (error.message.includes('SignatureDoesNotMatch')) {
        console.error('💡 建议：检查 ALIYUN_ACCESS_KEY_SECRET 是否正确');
      } else if (error.message.includes('DomainNotExist')) {
        console.error('💡 建议：检查域名是否在阿里云 DNS 中托管');
      } else if (error.message.includes('Forbidden')) {
        console.error('💡 建议：检查 AccessKey 是否有 DNS 管理权限');
      }
    }
    
    process.exit(1);
  }
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

// 运行测试
testAliyunDNS().catch(console.error);
