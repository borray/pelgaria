# Production checklist

Перед запуском в production пройдите по списку.

## Секреты и доступ
- [ ] Сменить `JWT_SECRET` на длинное случайное значение (32+ байт).
- [ ] Сменить `JWT_REFRESH_SECRET` (отличное от access).
- [ ] Задать безопасный `ADMIN_PASSWORD` (≥ 8 символов) перед seed; сменить пароль после входа.
- [ ] Убедиться, что секреты не в репозитории (только окружение/Secrets).
- [ ] `POSTGRES_PASSWORD` — не дефолтный.

## Сеть и доступность
- [ ] HTTPS на reverse proxy (nginx/Caddy), редирект http→https.
- [ ] `CLIENT_URL` = конкретный домен (CORS), не `*`.
- [ ] Проксирование `/api`, `/uploads`, `/socket.io` (WebSocket) настроено.
- [ ] `client_max_body_size` ≥ 30m.

## Данные
- [ ] PostgreSQL на persistent volume.
- [ ] Загрузки на persistent volume.
- [ ] Настроен регулярный backup БД (pg_dump) и проверено восстановление.
- [ ] Настроен backup загрузок, согласованный с бэкапом БД.
- [ ] Применены миграции схемы (`prisma migrate deploy` или `db push`).
- [ ] Выполнен seed (роли + администратор).

## Безопасность приложения
- [ ] Включены rate limits (`/api`, строже на `/api/auth/login` и `/refresh`).
- [ ] Включён helmet с проверенной CSP (не ломает SPA/uploads/PDF).
- [ ] Refresh-токены хранятся в виде хеша (после внедрения; см. MIGRATION_NOTES).
- [ ] Audit log включён, доступ к `/api/audit` только суперадмину.
- [ ] Критичные действия скрыты в UI без права `system.superadmin`.

## Функциональные проверки
- [ ] Публичная витрина `/` открывается.
- [ ] Вход `/login`, dashboard `/dashboard`.
- [ ] Центр обслуживания `/office`, `/office/sessions/:id`.
- [ ] Печатный центр (генерация PDF, ч/б, Pantum).
- [ ] Проверка подлинности `/verify`.
- [ ] Загрузка файлов и их отдача по `/uploads`.
- [ ] OCR сканов отрабатывает (асинхронно).
- [ ] Тёмная и светлая темы.

## Логи и мониторинг
- [ ] `LOG_LEVEL` адекватен (info/warn в prod).
- [ ] Логи не содержат паролей/токенов/секретов.
- [ ] `/api/health` и `/api/readiness` мониторятся.

## Инфраструктурный долг
- [ ] Обновить версии GitHub Actions до non-deprecated (Node20→Node24).
- [ ] Снизить размер клиентского бандла (по необходимости).
