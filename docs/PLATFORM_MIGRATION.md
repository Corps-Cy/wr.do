# DNS 平台迁移指南

本文档介绍如何将 DNS 管理从 Cloudflare 迁移到阿里云 DNS 平台。

## 概述

wr.do 现在支持多个 DNS 提供商，包括：
- Cloudflare（原有支持）
- 阿里云 DNS（新增支持）

## 前置条件

### 1. 阿里云账户配置

1. 登录 [阿里云控制台](https://ecs.console.aliyun.com/)
2. 创建 RAM 用户并获取 AccessKey
3. 为 RAM 用户授予 DNS 管理权限

```bash
# 环境变量配置
export ALIYUN_ACCESS_KEY_ID="your_access_key_id"
export ALIYUN_ACCESS_KEY_SECRET="your_access_key_secret"
export ALIYUN_REGION="cn-hangzhou"  # 可选，默认为杭州
export ALIYUN_DOMAIN_NAME="your-domain.com"  # 要管理的域名
```

#### 获取 AccessKey 步骤：
1. 访问 [RAM 访问控制](https://ram.console.aliyun.com/users)
2. 创建 RAM 用户或使用现有用户
3. 在用户详情页面创建 AccessKey
4. 确保用户具有 `AliyunDNSFullAccess` 权限

### 2. 数据库迁移

运行数据库迁移脚本以添加多平台支持：

```bash
# 应用数据库迁移
npx prisma migrate deploy

# 或者使用 Prisma Studio 手动执行
npx prisma studio
```

## 迁移步骤

### 方法一：使用命令行脚本

1. **预览迁移**（推荐先执行）
```bash
tsx scripts/migrate-to-aliyun.ts --dry-run
```

2. **迁移单个域名**
```bash
tsx scripts/migrate-to-aliyun.ts --domain example.com
```

3. **迁移所有域名**
```bash
tsx scripts/migrate-to-aliyun.ts --continue-on-error
```

### 方法二：使用管理界面

1. 登录管理后台 (`/admin`)
2. 进入域名管理页面
3. 选择要迁移的域名
4. 点击"平台切换"按钮
5. 配置阿里云参数
6. 执行迁移

### 方法三：使用 API

```bash
# 迁移单个域名
curl -X POST /api/admin/migrate-platform \
  -H "Content-Type: application/json" \
  -d '{
    "domainId": "domain-uuid",
    "targetProvider": "aliyun",
    "config": {
      "aliyun_access_key_id": "your_key_id",
      "aliyun_access_key_secret": "your_key_secret",
      "aliyun_domain_name": "example.com"
    },
    "options": {
      "dryRun": false,
      "batchSize": 10,
      "verify": true
    }
  }'
```

## 配置说明

### 阿里云 DNS 配置

在域名管理界面中，需要配置以下参数：

| 参数 | 说明 | 示例 |
|------|------|------|
| AccessKey ID | 阿里云访问密钥 ID | `LTAI5t*****` |
| AccessKey Secret | 阿里云访问密钥 Secret | `*****` |
| 区域 | 阿里云区域 | `cn-hangzhou` |
| 域名 | 要管理的域名 | `example.com` |

### 环境变量

在 `.env` 文件中添加：

```bash
# 阿里云 DNS 配置
ALIYUN_ACCESS_KEY_ID=your_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret
ALIYUN_REGION=cn-hangzhou

# 第三方邮件服务配置（可选）
FORWARD_EMAIL_API_KEY=your_forward_email_key
IMPROVMX_API_KEY=your_improvmx_key
MAILGUN_API_KEY=your_mailgun_key
MAILGUN_DOMAIN=your_mailgun_domain
```

## 功能对比

| 功能 | Cloudflare | 阿里云 DNS |
|------|------------|------------|
| DNS 记录管理 | ✅ | ✅ |
| A 记录 | ✅ | ✅ |
| CNAME 记录 | ✅ | ✅ |
| MX 记录 | ✅ | ✅ |
| TXT 记录 | ✅ | ✅ |
| 批量操作 | ✅ | ✅ |
| 邮件转发 | ✅ (Worker) | ❌ (需第三方) |
| 代理功能 | ✅ | ❌ |
| 缓存控制 | ✅ | ❌ |

## 邮件转发迁移

由于阿里云 DNS 不直接提供邮件转发功能，需要配置第三方邮件服务：

### 选项 1：ForwardEmail（推荐）

1. 注册 [ForwardEmail](https://forwardemail.net) 账户
2. 添加域名并验证
3. 配置转发规则
4. 更新 DNS MX 记录

### 选项 2：ImprovMX

1. 注册 [ImprovMX](https://improvmx.com) 账户
2. 添加域名
3. 配置转发地址
4. 更新 DNS MX 记录

### 选项 3：Mailgun

1. 注册 [Mailgun](https://mailgun.com) 账户
2. 添加域名并验证
3. 配置路由规则
4. 更新 DNS MX 记录

## 验证迁移结果

### 1. 自动验证

迁移完成后，系统会自动验证：
- DNS 记录数量
- 域名解析状态
- 配置有效性

### 2. 手动验证

```bash
# 验证单个域名
curl -X GET "/api/admin/migrate-platform?domainId=domain-uuid"

# 检查 DNS 解析
nslookup example.com
dig example.com
```

### 3. 功能测试

1. **DNS 解析测试**
   ```bash
   # 测试 A 记录
   nslookup subdomain.example.com
   
   # 测试 CNAME 记录
   nslookup www.example.com
   ```

2. **邮件转发测试**
   ```bash
   # 发送测试邮件
   echo "Test email" | mail -s "Test" test@example.com
   ```

## 故障排除

### 常见问题

1. **认证失败**
   - 检查 AccessKey 是否正确
   - 确认 RAM 用户权限
   - 验证域名是否在阿里云托管

2. **记录创建失败**
   - 检查记录格式是否正确
   - 确认域名权限
   - 查看 API 调用限制

3. **邮件转发不工作**
   - 检查 MX 记录配置
   - 验证第三方服务配置
   - 确认 DNS 传播完成

### 日志查看

```bash
# 查看迁移日志
tail -f logs/migration.log

# 查看 DNS 操作日志
tail -f logs/dns.log
```

### 回滚方案

如果迁移出现问题，可以回滚到 Cloudflare：

```bash
# 回滚单个域名
curl -X POST /api/admin/migrate-platform \
  -H "Content-Type: application/json" \
  -d '{
    "domainId": "domain-uuid",
    "targetProvider": "cloudflare",
    "config": {
      "cf_zone_id": "original_zone_id",
      "cf_api_key": "original_api_key",
      "cf_email": "original_email"
    }
  }'
```

## 性能优化

### API 调用优化

- 使用批量操作减少 API 调用
- 实现请求重试和指数退避
- 添加请求缓存机制

### 监控和告警

- 监控 API 调用成功率
- 设置 DNS 解析延迟告警
- 跟踪迁移进度和状态

## 安全注意事项

1. **密钥管理**
   - 使用环境变量存储敏感信息
   - 定期轮换访问密钥
   - 限制 RAM 用户权限

2. **API 安全**
   - 使用 HTTPS 传输
   - 实现请求签名验证
   - 添加访问频率限制

3. **数据保护**
   - 加密存储配置信息
   - 定期备份 DNS 记录
   - 审计所有操作日志

## 技术支持

如果在迁移过程中遇到问题，请：

1. 查看本文档的故障排除部分
2. 检查系统日志和错误信息
3. 联系技术支持团队

---

**文档版本**: 1.0.0  
**最后更新**: 2025-01-15
