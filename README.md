<div align="center">
  <img src="https://wr.do/_static/images/x-preview.png" alt="WR.DO" >
  <h1>WR.DO</h1>
  <p>一站式域名服务平台，集成短链服务、临时邮箱、子域名管理、文件存储和开放API接口。</p>
  <p>
    <a href="https://wr.do">官网</a> · <a href="https://wr.do/docs/developer">部署文档</a> · <a href="https://wr.do/feedback">反馈讨论</a> · <a href="/README-en.md">English</a> | 简体中文
  </p>
  <img alt="GitHub" src="https://img.shields.io/github/license/Corps-Cy/wr.do?style=flat-square" alt="MIT"/>
  <img src="https://img.shields.io/github/stars/Corps-Cy/wr.do.svg?logo=github&style=flat-square" alt="star"/>
  <img alt="GitHub forks" src="https://img.shields.io/github/forks/Corps-Cy/wr.do?style=flat-square">
  <img src="https://img.shields.io/github/contributors/Corps-Cy/wr.do?color=c4f042&labelColor=black&style=flat-square" alt="contributors"/>
  <img alt="GitHub Issues or Pull Requests" src="https://img.shields.io/github/issues/Corps-Cy/wr.do?style=flat-square"> <br>
  <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/Corps-Cy/wr.do?style=flat-square">
  <img alt="GitHub repo size" src="https://img.shields.io/github/repo-size/Corps-Cy/wr.do?style=flat-square">
</div>

## 截图预览

<table>
  <tr>
    <td><img src="https://wr.do/_static/images/light-preview.png" /></td>
    <td><img src="https://wr.do/_static/images/example_02.png" /></td>
  </tr>
  <tr>
    <td><img src="https://wr.do/_static/images/example_01.png" /></td>
    <td><img src="https://wr.do/_static/images/realtime-globe.png" /></td>
  </tr>
  <tr>
    <td><img src="https://wr.do/_static/images/example_03.png" /></td>
    <td><img src="https://wr.do/_static/images/domains.png" /></td>
  </tr>
</table>


## 功能列表

<details>
<summary><strong> 🔗 短链服务</strong> - <a href="javascript:;">[功能列表]</a></summary>
<ul>
<li>支持自定义短链</li>
<li>支持生成自定义二维码</li>
<li>支持密码保护链接</li>
<li>支持设置过期时间</li>
<li>支持访问统计（实时日志、地图等多维度数据分析）</li>
<li>支持调用 API 创建短链</li>
</ul>
</details>

<details>
<summary><strong> 📮 域名邮箱服务</strong> - <a href="javascript:;">[功能列表]</a></summary>
<ul>
<li>支持创建自定义前缀邮箱</li>
<li>支持过滤未读邮件列表</li>
<li>可创建无限数量邮箱</li>
<li>支持接收无限制邮件 （依赖 Cloudflare Email Worker）</li>
<li>支持发送邮件（依赖 Resend）</li>
<li>支持 Catch-All 配置</li>
<li>支持 Telegram 推送（多频道/群组）</li>
<li>支持调用 API 创建邮箱</li>
<li>支持调用 API 获取收件箱邮件</li>
</ul>
</details>

<details>
<summary><strong>🌐 子域名管理服务</strong> - <a href="javascript:;">[功能列表]</a></summary>
<ul>
<li>支持管理多 DNS 提供商（Cloudflare、阿里云 DNS 等）的多个域名</li>
<li>支持创建多种 DNS 记录类型（CNAME、A、TXT、MX、AAAA 等）</li>
<li>支持 DNS 提供商切换和平台迁移</li>
<li>支持开启申请模式（用户提交、管理员审批）</li>
<li>支持邮件通知管理员、用户域名申请状态</li>
<li>支持批量同步 DNS 记录</li>
</ul>
</details>

<details>
<summary><strong>📂 文件存储服务</strong> - <a href="javascript:;">[功能列表]</a></summary>
<ul>
<li>支持多渠道（S3 API）云存储平台（Cloudflare R2、AWS S3、OSS等）
<li>支持单渠道多存储桶配置
<li>动态配置文件上传大小限制
<li>支持拖拽、批量、粘贴上传文件
<li>支持批量删除文件
<li>快捷生成文件短链、二维码
<li>支持部分文件在线预览内容
</ul>
</details>

<details>
<summary><strong>📡 开放接口服务</strong> - <a href="javascript:;">[功能列表]</a></summary>
<ul>
<li>支持调用 API 获取网站元数据
<li>支持调用 API 获取网站截图
<li>支持调用 API 生成网站二维码
<li>支持调用 API 将网站转换为 Markdown、Text
<li>支持生成用户 API Key，用于第三方调用开放接口
</ul>
</details>

<details>
<summary><strong>👑 管理员模块</strong> - <a href="javascript:;">[功能列表]</a></summary>
<ul>
<li>多维度图表展示网站状态
<li>域名服务配置（动态配置各项服务是否启用，包括短链、临时邮箱（收发邮件）
<li>用户列表管理（设置权限、分配使用额度、禁用用户等）
<li>动态配置登录方式 (支持 Google, GitHub, 邮箱验证, 账户密码, LinuxDO)
<li>短链管理（管理所有用户创建的短链）
<li>邮箱管理（管理所有用户创建的临时邮箱）
<li>子域名管理（管理所有用户创建的子域名）
</ul>
</details>

## 技术栈

- **前端框架**: Next.js 14 + React 18 + TypeScript
- **样式设计**: Tailwind CSS
- **数据库**: PostgreSQL + Prisma ORM
- **DNS 服务**: Cloudflare DNS、阿里云 DNS（支持多平台）
- **云基础设施**: Cloudflare、Vercel
- **邮件服务**: Resend
- **国际化**: Next-Intl

## 快速开始

查看开发者[手把手部署教程](https://wr.do/docs/developer/quick-start-zh)文档。

## 自部署教程

> 注意，任何部署方式都需要先配置环境变量，若部署后修改了环境变量，需要**重新部署**才会生效。

### 使用 Vercel 部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Corps-Cy/wr.do.git&project-name=wrdo)

记得填写必要的环境变量。

### 使用 Docker Compose 部署

在服务器中创建一个文件夹，进入该文件夹并新建 [docker-compose.yml](https://github.com/Corps-Cy/wr.do/blob/main/docker-compose.yml)、[.env](https://github.com/Corps-Cy/wr.do/blob/main/.env.example) 文件：

```yml
- wrdo
  | - docker-compose.yml
  | - .env
```

在 `.env` 中填写必要的环境变量，然后执行: 

```bash
docker compose up -d
```

> 或只创建 docker-compose.yml 文件，环境变量直接填写在yml中，比如将`DATABASE_URL: ${DATABASE_URL}`替换成`DATABASE_URL: your-database-uri`

### 使用 EdgeOne 部署

> 此方法部署目前无法build成功，不建议使用

[![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2Foiov%2Fwr.do)

## 本地开发

将 `.env.example` 复制为 `.env` 并填写必要的环境变量。

```bash
git clone https://github.com/Corps-Cy/wr.do.git
cd wr.do
pnpm install
```

#### 初始化数据库

```bash
pnpm postinstall
pnpm db:push
```

```bash
# 在 localhost:3000 上运行
pnpm dev
```

- 默认账号(管理员)：`admin@admin.com`
- 默认密码：`123456`

> 登录后请及时修改密码

#### 管理员初始化

> 此初始化引导在 v1.0.2 版本后, 不再是必要步骤

访问 https://localhost:3000/setup

## 环境变量

查看 [开发者文档](https://wr.do/docs/developer).

## 关于本项目

本项目基于 [oiov/wr.do](https://github.com/oiov/wr.do) 进行开发和定制，主要改进包括：

- ✅ **多 DNS 提供商支持** - 支持 Cloudflare 和阿里云 DNS，可灵活切换
- ✅ **DNS 记录同步优化** - 支持分页获取和批量同步
- ✅ **数据库迁移修复** - 修复了多平台支持的数据库迁移问题
- ✅ **错误处理改进** - 优化了 API 错误处理和日志输出

## 上游项目

本项目 Fork 自 [oiov/wr.do](https://github.com/oiov/wr.do)，感谢原作者的优秀工作。

## 社区群组

- Discord: https://discord.gg/AHPQYuZu3m
- 微信群：

<img width="300" src="https://wr.do/group" />

## 贡献者

<a href="https://github.com/Corps-Cy/wr.do/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Corps-Cy/wr.do" />
</a>

## Star History

<a href="https://star-history.com/#Corps-Cy/wr.do&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Corps-Cy/wr.do&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Corps-Cy/wr.do&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Corps-Cy/wr.do&type=Date" />
 </picture>
</a>

## 开源协议

[MIT](/LICENSE.md)