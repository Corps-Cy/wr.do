<div align="center">
  <img src="https://wr.do/_static/images/x-preview.png" alt="WR.DO" >
  <h1>WR.DO</h1>
  <p>All-in-one domain service platform with integrated short link services, temporary email, subdomain management, file storage, and open API</p>
  <p><a href="https://wr.do">Official Site</a><a href="https://wr.do/docs/developer">Docs</a> · <a href="https://wr.do/feedback">Feedback</a> · English | <a href="/README.md">简体中文</a></p>
  <img alt="GitHub" src="https://img.shields.io/github/license/Corps-Cy/wr.do?style=flat-square" alt="MIT"/>
  <img src="https://img.shields.io/github/stars/Corps-Cy/wr.do.svg?logo=github&style=flat-square" alt="star"/>
  <img alt="GitHub forks" src="https://img.shields.io/github/forks/Corps-Cy/wr.do?style=flat-square">
  <img src="https://img.shields.io/github/contributors/Corps-Cy/wr.do?color=c4f042&labelColor=black&style=flat-square" alt="contributors"/>
  <img alt="GitHub Issues or Pull Requests" src="https://img.shields.io/github/issues/Corps-Cy/wr.do?style=flat-square"> <br>
  <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/Corps-Cy/wr.do?style=flat-square">
  <img alt="GitHub repo size" src="https://img.shields.io/github/repo-size/Corps-Cy/wr.do?style=flat-square">
</div>

## Screenshots

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

## Features

- 🔗 **Short Link Service**:
  - Custom short links
  - Generate custom QR codes
  - Password-protected links
  - Expiration time control
  - Access analytics (real-time logs, maps, and multi-dimensional data analysis)
  - API integration for link creation

- 📮 **Email Service**:
  - Create custom prefix emails
  - Filter unread email lists
  - Unlimited mailbox creation
  - Receive unlimited emails (powered by Cloudflare Email Worker)
  - Send emails (powered by Resend)
  - Support catch-all emails
  - Support push to telegram groups
  - API endpoints for mailbox creation
  - API endpoints for inbox retrieval

- 🌐 **Subdomain Management Service**:
  - Manage DNS records across multiple DNS providers (Cloudflare, Aliyun DNS, etc.)
  - Create various DNS record types (CNAME, A, TXT, MX, AAAA, etc.)
  - Support DNS provider switching and platform migration
  - Support enabling application mode (user submission, admin approval)
  - Support email notification of administrator and user domain application status
  - Support batch DNS record synchronization

- 💳 **Cloud Storage Service**
  - Connects to multiple channels (S3 API) cloud storage platforms (Cloudflare R2, AWS S3)
  - Supports single-channel multi-bucket configuration
  - Dynamic configuration (user quota settings) for file upload size limits
  - Supports drag-and-drop, batch, and chunked file uploads
  - Supports batch file deletion
  - Quickly generates short links and QR codes for files
  - Supports online preview of certain file types
  - Supports file uploads via API calls

- 📡 **Open API Module**:
  - Website metadata extraction API
  - Website screenshot capture API
  - Website QR code generation API
  - Convert websites to Markdown/Text format
  - Comprehensive API call logging and statistics
  - User API key generation for third-party integrations
  
- 🔒 **Administrator Module**:
  - Multi-dimensional dashboard with website analytics
  - Dynamic service configuration (toggle short links, email, subdomain management)
  - User management (permissions, quotas, account control)
  - Dynamically configure login methods (Google, GitHub, Magic Link, Credentials, LinuxDO)
  - Centralized short link administration
  - Centralized email management
  - Centralized subdomain administration

## Quick Start

See step by step installation tutorial at [Quick Start for Developer](https://wr.do/docs/developer/quick-start).

## Self-hosted

### Deploy with Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Corps-Cy/wr.do.git&project-name=wrdo)

Remember to fill in the necessary environment variables.

### Deploy with Docker Compose

Create a new folder and copy the [`docker-compose.yml`](https://github.com/Corps-Cy/wr.do/blob/main/docker-compose.yml)、[`.env`](https://github.com/Corps-Cy/wr.do/blob/main/.env.example) file to the folder.

```yml
- wrdo
  | - docker-compose.yml
  | - .env
```

Fill in the environment variables in the `.env` file, then: 

```bash
docker compose up -d
```

## Local development

```bash
git clone https://github.com/Corps-Cy/wr.do.git
cd wr.do
pnpm install
```

copy `.env.example` to `.env` and fill in the necessary environment variables.

#### Init database

```bash
pnpm postinstall
pnpm db:push
```

```bash
# run on localhost:3000
pnpm dev
```

- Default admin account：`admin@admin.com`
- Default admin password：`123456`

#### Setup Admin Panel

> After v1.0.2, this setup guide is not needed anymore

Follow https://localhost:3000/setup


## Environment Variables

Via [Installation For Developer](https://wr.do/docs/developer).

## Technology Stack

- **Frontend Framework**: Next.js 14 + React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL + Prisma ORM
- **DNS Services**: Cloudflare DNS, Aliyun DNS (multi-provider support)
- **Cloud Infrastructure**: Cloudflare, Vercel
- **Email Service**: Resend
- **Internationalization**: Next-Intl

## About This Project

This project is based on [oiov/wr.do](https://github.com/oiov/wr.do) with customizations and improvements, including:

- ✅ **Multi DNS Provider Support** - Support for Cloudflare and Aliyun DNS with flexible switching
- ✅ **DNS Record Sync Optimization** - Support for paginated fetching and batch synchronization
- ✅ **Database Migration Fixes** - Fixed database migration issues for multi-platform support
- ✅ **Improved Error Handling** - Optimized API error handling and logging output

## Upstream Project

This project is forked from [oiov/wr.do](https://github.com/oiov/wr.do). Thanks to the original author for the excellent work.

## Community Group

- Discord: https://discord.gg/AHPQYuZu3m
- 微信群：

<img width="300" src="https://wr.do/group" />

## Contributors

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

## License

[MIT](/LICENSE.md)