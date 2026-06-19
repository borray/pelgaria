# Развёртывание

## Способы

1. **Docker Compose** (рекомендуется для self-hosting / стейджинга).
2. **Bare-metal / VPS** + reverse proxy (текущий production через GitHub Actions → SSH → pm2).

## Docker Compose

```bash
cp .env.example .env
# отредактируйте секреты: JWT_SECRET, JWT_REFRESH_SECRET, POSTGRES_PASSWORD, ADMIN_PASSWORD
docker compose up --build -d
docker compose exec server npx tsx src/prisma/seed.ts   # первичный seed (роли + админ)
```

- Фронтенд: `http://localhost:${CLIENT_HTTP_PORT:-8080}` (nginx, проксирует `/api`, `/uploads`, `/socket.io`).
- БД: сервис `postgres`, volume `pg_data` (persistent).
- Загрузки: volume `uploads_data` (persistent).
- Сервер при старте выполняет `prisma db push`. Для строгих сред используйте миграции
  (`prisma migrate deploy`).

Проверка конфигурации без запуска: `docker compose config`.

## Production (текущий контур)

GitHub Actions workflow **Deploy SONAR** при пуше в `main`:
сборка client+server → `.env` на сервере → rsync сборок → `npm ci` → `prisma generate`
→ `prisma db push` → перезапуск `pm2` → проверка `/api/health`.

Секреты задаются в GitHub Actions Secrets (`DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`,
`DISCORD_*` и т.д.) и **никогда не коммитятся**.

### Reverse proxy

- Терминируйте HTTPS на nginx/Caddy перед backend.
- Проксируйте `/api`, `/uploads`, `/socket.io` (с поддержкой WebSocket) на backend-порт.
- Отдавайте собранный SPA (`client/dist`) как статику с history-fallback на `index.html`.
- `client_max_body_size` ≥ 30m (загрузки сканов/документов).

## Миграции БД

- Текущий поток использует `prisma db push` (без папки миграций) — удобно, но для production
  предпочтительны версионированные миграции:
  ```bash
  npx prisma migrate dev --name <change>      # локально
  npx prisma migrate deploy                    # на сервере
  ```
- Любые изменения схемы, затрагивающие существующие данные, документируются в
  [MIGRATION_NOTES.md](../MIGRATION_NOTES.md).

## Chromium для PDF

- В Docker устанавливается системный `chromium`, путь задаётся `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`.
- На bare-metal установите Chromium/Chrome или оставьте встроенный `@sparticuz/chromium`.

## Health / Readiness

- `GET /api/health` — простой live-check.
- `GET /api/readiness` (план, см. MIGRATION_NOTES) — проверка БД и хранилища; использовать
  для Docker healthcheck/оркестратора.
