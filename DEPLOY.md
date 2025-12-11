# wr.do 生产环境部署指南

## 📋 前置要求

- Docker 和 Docker Compose 已安装
- PostgreSQL 数据库（可以是远程数据库或本地 Docker 容器）
- GitHub 账号（用于拉取 GHCR 镜像，如果镜像设为私有需要配置访问令牌）

## 🚀 快速部署

### 1. 准备配置文件

```bash
# 复制配置模板
cp .env.example .env

# 编辑配置文件，填写你的实际配置
nano .env  # 或使用你喜欢的编辑器
```

### 2. 配置必需的环境变量

**必须配置的变量：**
- `AUTH_SECRET`: 使用以下命令生成
  ```bash
  openssl rand -base64 32
  ```
- `DATABASE_URL`: PostgreSQL 数据库连接字符串
- `NEXTAUTH_URL`: 你的应用公网访问地址
- `AUTH_URL`: 通常与 NEXTAUTH_URL 相同
- `NEXT_PUBLIC_APP_URL`: 应用公网访问地址

### 3. 登录 GitHub Container Registry（如果镜像设为私有）

```bash
# 使用 GitHub Personal Access Token 登录
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

或者手动输入：
```bash
docker login ghcr.io
# Username: YOUR_GITHUB_USERNAME
# Password: YOUR_GITHUB_TOKEN (需要 repo 和 read:packages 权限)
```

### 4. 拉取并启动容器

```bash
# 拉取最新镜像
docker-compose -f docker-compose.prod.yml pull

# 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

### 5. 验证部署

```bash
# 检查容器状态
docker-compose -f docker-compose.prod.yml ps

# 检查健康状态
docker-compose -f docker-compose.prod.yml exec wrdo wget -q -O- http://localhost:3000/api/health
```

## 🔄 更新部署

```bash
# 停止当前容器
docker-compose -f docker-compose.prod.yml down

# 拉取最新镜像
docker-compose -f docker-compose.prod.yml pull

# 重新启动
docker-compose -f docker-compose.prod.yml up -d

# 查看日志确认启动成功
docker-compose -f docker-compose.prod.yml logs -f
```

## 📊 常用命令

```bash
# 查看运行状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f

# 查看最近 100 行日志
docker-compose -f docker-compose.prod.yml logs --tail=100

# 重启服务
docker-compose -f docker-compose.prod.yml restart

# 停止服务
docker-compose -f docker-compose.prod.yml stop

# 停止并删除容器
docker-compose -f docker-compose.prod.yml down

# 进入容器
docker-compose -f docker-compose.prod.yml exec wrdo sh
```

## 🔒 安全建议

1. **保护 .env 文件**
   - 确保 `.env` 文件权限设置为 `600`
   ```bash
   chmod 600 .env
   ```

2. **使用强密码**
   - `AUTH_SECRET` 必须使用强随机字符串
   - 数据库密码要足够复杂

3. **网络安全**
   - 如果使用 Nginx 反向代理，建议配置 SSL/TLS
   - 限制数据库端口只允许应用服务器访问

4. **定期更新**
   - 定期拉取最新镜像以获取安全更新
   - 监控容器日志，及时发现异常

## 🌐 使用 Nginx 反向代理（推荐）

如果你使用 Nginx 作为反向代理，示例配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## ❓ 故障排查

### 容器无法启动

```bash
# 查看详细日志
docker-compose -f docker-compose.prod.yml logs wrdo

# 检查环境变量
docker-compose -f docker-compose.prod.yml config
```

### 数据库连接失败

- 检查 `DATABASE_URL` 是否正确
- 确认数据库服务可访问
- 检查防火墙设置

### 镜像拉取失败

- 确认已登录 GHCR
- 检查网络连接
- 如果镜像设为私有，确认有访问权限

## 📝 注意事项

- `.env` 文件包含敏感信息，**不要**提交到 Git
- 首次启动会自动运行数据库迁移
- 建议在生产环境使用 `SKIP_DB_CHECK=false` 和 `SKIP_DB_MIGRATION=false` 以确保数据库正确配置

