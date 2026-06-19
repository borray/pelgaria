# Эксплуатация

## Логи

- `LOG_LEVEL` управляет детальностью. План: структурированный логгер (pino) + request logging,
  без логирования паролей/токенов/секретов. Сейчас — `console` + централизованный error handler (план).

## Здоровье сервиса

- `GET /api/health` — жив ли процесс.
- `GET /api/readiness` (план) — готов ли принимать трафик (БД, хранилище). Использовать в
  healthcheck оркестратора/Docker.

## Резервное копирование

### PostgreSQL
```bash
# бэкап
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup_$(date +%F).sql
# восстановление
cat backup_YYYY-MM-DD.sql | docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```
Планируйте регулярный бэкап (cron) и проверяйте восстановление.

### Загрузки (uploads)
- Хранятся в volume `uploads_data` (Docker) или каталоге `UPLOADS_DIR` (bare-metal).
- Бэкапьте каталог/volume вместе с БД (ссылки на файлы хранятся в БД — бэкапы должны быть согласованы).
```bash
docker run --rm -v pelgaria_uploads_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/uploads_$(date +%F).tar.gz -C /data .
```

## Persistent volumes

- `pg_data` — данные PostgreSQL.
- `uploads_data` — загруженные файлы.
Не удалять при пересборке контейнеров. `docker compose down` без `-v` их сохраняет.

## Сид и администратор

- Первичный seed: роли + администратор (`ADMIN_PASSWORD`). Идемпотентен: существующий админ не
  перезаписывается. См. README.

## Обновление

1. Бэкап БД и загрузок.
2. Деплой новой версии (Actions/Docker).
3. Применение схемы (`prisma db push` / `migrate deploy`).
4. Проверка `/api/health` (и `/api/readiness` после внедрения).

## OCR / PDF

- OCR (tesseract.js) и PDF (Chromium) ресурсоёмки. Для нагрузки выделяйте CPU/память серверу.
- Проверка подлинности (≈5s) и формирование PDF (≈7s) содержат искусственную задержку (UX-требование) —
  это ожидаемое поведение, не таймаут.

## Известные технические долги

- Размер клиентского бандла; устаревание Node20 в GitHub Actions; см. MIGRATION_NOTES и
  PRODUCTION_CHECKLIST.
