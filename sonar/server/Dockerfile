# syntax=docker/dockerfile:1
# ── Сборка ─────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Рантайм ────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Chromium для генерации PDF (puppeteer-core берёт путь из PUPPETEER_EXECUTABLE_PATH).
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-liberation fonts-dejavu-core ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=builder /app/dist ./dist

# Каталог загрузок (монтируется как volume).
RUN mkdir -p /app/uploads
ENV UPLOADS_DIR=/app/uploads
EXPOSE 3001

# При старте применяем схему к БД (prisma db push) и запускаем сервер.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
