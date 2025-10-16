# wr.do 项目启动指南

## 🚀 快速启动

### 1. 环境准备

#### 必需依赖
- Node.js 18+ 
- PostgreSQL 数据库
- pnpm 包管理器

#### 安装依赖
```bash
cd /Users/kechangchang-mini/Code/Github/wr.do
npm install
# 或者使用 pnpm
pnpm install
```

### 2. 环境变量配置

创建 `.env.local` 文件：

```bash
# ===========================================
# 基础配置 (必需)
# ===========================================
NEXTAUTH_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
AUTH_SECRET=your-super-secret-auth-secret-here
DATABASE_URL="postgresql://username:password@localhost:5432/wrdo_db"

# ===========================================
# 阿里云 DNS 配置 (新增功能)
# ===========================================
ALIYUN_ACCESS_KEY_ID=your-aliyun-access-key-id
ALIYUN_ACCESS_KEY_SECRET=your-aliyun-access-key-secret
ALIYUN_REGION=cn-hangzhou
ALIYUN_DOMAIN_NAME=your-domain.com

# ===========================================
# 邮件服务配置 (可选)
# ===========================================
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# ===========================================
# 客户端配置
# ===========================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPPORT_EMAIL=support@yourdomain.com
NEXT_PUBLIC_APP_NAME=wr.do
```

### 3. 数据库配置

#### 选项 1: 使用 Docker (推荐)
```bash
# 启动本地 PostgreSQL
docker-compose -f docker-compose-localdb.yml up -d

# 检查数据库状态
docker-compose -f docker-compose-localdb.yml ps
```

#### 选项 2: 使用现有数据库
确保 PostgreSQL 数据库正在运行，并更新 `DATABASE_URL` 为正确的连接字符串。

### 4. 数据库迁移

```bash
# 生成 Prisma 客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate deploy

# 查看数据库结构
npx prisma studio
```

### 5. 测试阿里云 DNS 集成

```bash
# 测试阿里云 DNS 配置
tsx scripts/test-aliyun-dns.ts
```

### 6. 启动开发服务器

```bash
npm run dev
# 或者
pnpm dev
```

访问 http://localhost:3000

## 🔧 阿里云 DNS 配置详解

### 获取 AccessKey

1. **登录阿里云控制台**
   - 访问 [阿里云控制台](https://ecs.console.aliyun.com/)

2. **创建 RAM 用户**
   - 访问 [RAM 访问控制](https://ram.console.aliyun.com/users)
   - 创建新用户或使用现有用户

3. **获取 AccessKey**
   - 在用户详情页面点击"创建 AccessKey"
   - 保存 AccessKey ID 和 AccessKey Secret

4. **配置权限**
   - 为用户添加 `AliyunDNSFullAccess` 权限
   - 或者自定义权限策略，包含以下权限：
     ```
     alidns:AddDomainRecord
     alidns:UpdateDomainRecord
     alidns:DeleteDomainRecord
     alidns:DescribeDomainRecords
     alidns:DescribeDomainRecordInfo
     alidns:DescribeDomainInfo
     ```

### 域名配置

确保您的域名已在阿里云 DNS 中托管：
1. 在 [DNS 控制台](https://dns.console.aliyun.com/) 中确认域名状态
2. 记录域名名称用于环境变量配置

## 🧪 功能测试

### 测试阿里云 DNS 集成
```bash
# 运行集成测试
tsx scripts/test-aliyun-dns.ts
```

### 测试平台迁移
```bash
# 预览迁移（不实际执行）
tsx scripts/migrate-to-aliyun.ts --dry-run

# 迁移单个域名
tsx scripts/migrate-to-aliyun.ts --domain example.com
```

### 测试 API 接口
```bash
# 测试 DNS 记录管理
curl -X GET "http://localhost:3000/api/dns/records?domainId=your-domain-id"

# 测试平台迁移 API
curl -X POST "http://localhost:3000/api/admin/migrate-platform" \
  -H "Content-Type: application/json" \
  -d '{
    "domainId": "your-domain-id",
    "targetProvider": "aliyun",
    "config": {
      "aliyun_access_key_id": "your-key-id",
      "aliyun_access_key_secret": "your-key-secret",
      "aliyun_domain_name": "example.com"
    },
    "options": {
      "dryRun": true
    }
  }'
```

## 🎯 新功能使用

### 1. DNS 提供商切换

在管理界面中：
1. 访问 `/admin` 页面
2. 进入域名管理
3. 选择要迁移的域名
4. 点击"平台切换"按钮
5. 配置阿里云参数并执行迁移

### 2. 统一 DNS 管理

使用新的统一 API：
```typescript
import { dnsManager } from '@/lib/dns';

// 注册阿里云提供商
dnsManager.registerProvider('aliyun_example', {
  provider: 'aliyun',
  aliyun_access_key_id: 'your-key-id',
  aliyun_access_key_secret: 'your-key-secret',
  aliyun_domain_name: 'example.com'
});

// 创建 DNS 记录
const result = await dnsManager.createDNSRecord({
  type: 'A',
  name: 'www',
  content: '192.168.1.1',
  ttl: 600
}, 'aliyun_example');
```

## 🔍 故障排除

### 常见问题

1. **数据库连接失败**
   ```bash
   # 检查数据库状态
   docker-compose -f docker-compose-localdb.yml ps
   
   # 重启数据库
   docker-compose -f docker-compose-localdb.yml restart
   ```

2. **阿里云 API 认证失败**
   - 检查 AccessKey ID 和 Secret 是否正确
   - 确认用户具有 DNS 管理权限
   - 验证域名是否在阿里云托管

3. **端口冲突**
   ```bash
   # 检查端口占用
   lsof -i :3000
   
   # 使用其他端口启动
   npm run dev -- -p 3001
   ```

4. **依赖安装失败**
   ```bash
   # 清理缓存重新安装
   rm -rf node_modules package-lock.json
   npm install
   ```

### 日志查看

```bash
# 查看应用日志
npm run dev 2>&1 | tee app.log

# 查看数据库日志
docker-compose -f docker-compose-localdb.yml logs postgres
```

## 📚 相关文档

- [平台迁移指南](./docs/PLATFORM_MIGRATION.md)
- [技术规格书](./speckit.specify)
- [实现总结](./IMPLEMENTATION_SUMMARY.md)
- [阿里云 DNS API 文档](https://help.aliyun.com/zh/dns/quick-start-1)

## 🆘 获取帮助

如果遇到问题：
1. 查看本文档的故障排除部分
2. 检查系统日志和错误信息
3. 运行测试脚本验证配置
4. 联系技术支持团队

---

**启动指南版本**: 1.0.0  
**最后更新**: 2025-01-15
