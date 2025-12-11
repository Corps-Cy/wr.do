FROM node:20-alpine AS base

FROM base AS deps

RUN apk update && apk add --no-cache openssl libc6-compat && \
    npm install -g pnpm && \
    rm -rf /var/cache/apk/* /tmp/*

WORKDIR /app

ENV CI=true

COPY . .

RUN pnpm i --frozen-lockfile && \
    pnpm store prune

FROM base AS builder
WORKDIR /app

RUN apk update && apk add --no-cache openssl && \
    npm install -g pnpm && \
    rm -rf /var/cache/apk/* /tmp/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build && \
    rm -rf node_modules/.cache .next/cache

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV IS_DOCKER=true
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# 只安装运行时必需的包，合并命令减少层数并清理缓存
RUN apk update && apk add --no-cache openssl && \
    npm install -g --production npm-run-all dotenv prisma@5.17.0 @prisma/client@5.17.0 && \
    npm cache clean --force && \
    rm -rf /var/cache/apk/* /tmp/*

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Check db - 复制脚本到 standalone 目录
COPY scripts/check-db.js ./scripts/check-db.js

# 在 standalone 目录中安装 check-db.js 需要的依赖
WORKDIR /app
RUN npm install --production --no-save dotenv chalk semver && \
    npm cache clean --force

EXPOSE 3000

# 使用 npm-run-all 来运行数据库检查和启动服务器
CMD ["npm-run-all", "check-db", "start-server"]