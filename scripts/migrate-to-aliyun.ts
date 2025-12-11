#!/usr/bin/env tsx

/**
 * 平台迁移脚本 - 使用官方阿里云 SDK
 * 使用方法: tsx scripts/migrate-to-aliyun.ts [options]
 */

/**
 * 平台迁移脚本
 * 使用方法: tsx scripts/migrate-to-aliyun.ts [options]
 */

import { DNSMigrator } from '../lib/migration/dns-migrator';
import { DNSProvider } from '../lib/dns/types';
import { getDomainsByFeature } from '../lib/dto/domains';
import { prisma } from '../lib/db';

interface MigrationCLIOptions {
  dryRun: boolean;
  domain?: string;
  batchSize: number;
  continueOnError: boolean;
  verify: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const options: MigrationCLIOptions = {
    dryRun: false,
    batchSize: 10,
    continueOnError: false,
    verify: true
  };

  // 解析命令行参数
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--domain':
        options.domain = args[++i];
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i]);
        break;
      case '--continue-on-error':
        options.continueOnError = true;
        break;
      case '--no-verify':
        options.verify = false;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
    }
  }

  console.log('🚀 开始 DNS 平台迁移...');
  console.log(`📋 迁移选项:`, options);

  try {
    const migrator = new DNSMigrator();

    // 构建目标配置
    const targetConfig = buildAliyunConfig();
    if (!targetConfig) {
      console.error('❌ 阿里云配置不完整，请检查环境变量');
      process.exit(1);
    }

    let results;

    if (options.domain) {
      // 迁移单个域名
      console.log(`🎯 迁移域名: ${options.domain}`);
      
      const domain = await prisma.domain.findFirst({
        where: { domain_name: options.domain }
      });

      if (!domain) {
        console.error(`❌ 域名 ${options.domain} 不存在`);
        process.exit(1);
      }

      results = [await migrator.migrateDomain(
        domain.id,
        'aliyun',
        targetConfig,
        options
      )];
    } else {
      // 迁移所有启用 DNS 的域名
      console.log('🌐 迁移所有启用 DNS 的域名...');
      
      results = await migrator.migrateAllDNSDomains(
        'aliyun',
        targetConfig,
        options
      );
    }

    // 输出结果
    printMigrationResults(results);

    // 验证迁移结果
    if (options.verify && !options.dryRun) {
      console.log('\n🔍 验证迁移结果...');
      await verifyMigrationResults(results, migrator);
    }

    console.log('\n✅ 迁移完成！');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function buildAliyunConfig() {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const region = process.env.ALIYUN_REGION || 'cn-hangzhou';

  if (!accessKeyId || !accessKeySecret) {
    return null;
  }

  return {
    provider: 'aliyun' as DNSProvider,
    aliyun_access_key_id: accessKeyId,
    aliyun_access_key_secret: accessKeySecret,
    aliyun_region: region
  };
}

function printMigrationResults(results: any[]) {
  console.log('\n📊 迁移结果统计:');
  console.log('=' .repeat(50));

  let totalDomains = 0;
  let successfulDomains = 0;
  let totalRecords = 0;
  let migratedRecords = 0;
  let failedRecords = 0;

  for (const result of results) {
    totalDomains++;
    if (result.success) successfulDomains++;

    const migration = result.result;
    totalRecords += migration.totalRecords;
    migratedRecords += migration.migratedRecords;
    failedRecords += migration.failedRecords;

    console.log(`\n🏷️  域名: ${result.domainName}`);
    console.log(`   状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`   总记录数: ${migration.totalRecords}`);
    console.log(`   已迁移: ${migration.migratedRecords}`);
    console.log(`   失败: ${migration.failedRecords}`);
    console.log(`   耗时: ${migration.executionTime}ms`);

    if (migration.errors.length > 0) {
      console.log(`   ❌ 错误:`);
      migration.errors.forEach((error: string) => {
        console.log(`      - ${error}`);
      });
    }

    if (migration.warnings.length > 0) {
      console.log(`   ⚠️  警告:`);
      migration.warnings.forEach((warning: string) => {
        console.log(`      - ${warning}`);
      });
    }
  }

  console.log('\n📈 总体统计:');
  console.log(`   总域名数: ${totalDomains}`);
  console.log(`   成功域名数: ${successfulDomains}`);
  console.log(`   成功率: ${totalDomains > 0 ? (successfulDomains / totalDomains * 100).toFixed(2) : 0}%`);
  console.log(`   总记录数: ${totalRecords}`);
  console.log(`   已迁移记录: ${migratedRecords}`);
  console.log(`   失败记录: ${failedRecords}`);
  console.log(`   记录成功率: ${totalRecords > 0 ? (migratedRecords / totalRecords * 100).toFixed(2) : 0}%`);
}

async function verifyMigrationResults(results: any[], migrator: DNSMigrator) {
  for (const result of results) {
    if (!result.success) continue;

    console.log(`🔍 验证域名: ${result.domainName}`);
    
    try {
      const verification = await migrator.verifyMigration(result.domainId, 'aliyun');
      
      if (verification.valid) {
        console.log(`   ✅ 验证通过`);
      } else {
        console.log(`   ❌ 验证失败:`, verification.errors);
      }
    } catch (error) {
      console.log(`   ❌ 验证错误:`, error);
    }
  }
}

function printHelp() {
  console.log(`
DNS 平台迁移工具

使用方法:
  tsx scripts/migrate-to-aliyun.ts [options]

选项:
  --dry-run              预览模式，不实际执行迁移
  --domain <name>        只迁移指定域名
  --batch-size <size>    批量处理大小 (默认: 10)
  --continue-on-error    遇到错误继续执行
  --no-verify           迁移后不验证结果
  --help                显示帮助信息

环境变量:
  ALIYUN_ACCESS_KEY_ID      阿里云 AccessKey ID
  ALIYUN_ACCESS_KEY_SECRET  阿里云 AccessKey Secret
  ALIYUN_REGION            阿里云区域 (默认: cn-hangzhou)

示例:
  # 预览所有域名迁移
  tsx scripts/migrate-to-aliyun.ts --dry-run

  # 迁移指定域名
  tsx scripts/migrate-to-aliyun.ts --domain example.com

  # 迁移所有域名，遇到错误继续
  tsx scripts/migrate-to-aliyun.ts --continue-on-error
`);
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

// 运行主函数
main().catch(console.error);
