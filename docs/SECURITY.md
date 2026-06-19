# Безопасность

## Аутентификация и токены

- **Пароли**: bcrypt (cost 12). Хардкод паролей запрещён. Первичный админ — только из
  `ADMIN_PASSWORD` (production падает без него при создании нового админа).
- **Access JWT**: подписан `JWT_SECRET`, короткий срок жизни (`ACCESS_TOKEN_TTL`, по умолчанию 15m),
  содержит `id`, `login`, `role`, `permissions`.
- **Refresh-токены**: подписаны `JWT_REFRESH_SECRET`, срок `REFRESH_TOKEN_TTL_DAYS` (30),
  сохраняются в таблице `RefreshToken`, ротируются при обновлении.
  - **План усиления**: хранить не открытый refresh, а его хеш (SHA-256/HMAC). После миграции
    старые refresh инвалидируются (повторный вход). Детали — [MIGRATION_NOTES.md](../MIGRATION_NOTES.md).
- **must_change_password**: принудительная смена пароля при первом входе.

## Права (permissions) и суперадмин

- Права хранятся как JSON-объект на роли (`Role.permissions`), проверяются `requirePermission`.
- Введён системный признак **`system.superadmin`**: проходит любую проверку прав и даёт доступ к
  критичным действиям. Сидируется роли «Глава государства».
- `requireSuperadmin` (алиас `requireHeadOfState`) проверяет `system.superadmin`, а при его
  отсутствии — историческую роль «Глава государства» (**fallback ради обратной совместимости**,
  помечен в коде и подлежит удалению после полного перехода на permission).
- UI скрывает критичные действия от пользователей без нужного права.

## Password policy

- Минимум 8 символов для административного пароля (seed) и план — для смены пароля пользователем
  (backend+frontend). Запрещены пустые/слишком короткие пароли. См. MIGRATION_NOTES.

## Rate limiting (план)

- Общий лимит на `/api` и более строгий на `/api/auth/login` и `/api/auth/refresh`
  (`RATE_LIMIT_*`, `AUTH_RATE_LIMIT_MAX`). Реализация — следующий инкремент (MIGRATION_NOTES).

## HTTP-заголовки безопасности (план)

- `helmet` с аккуратной CSP, чтобы не сломать SPA, загрузки и PDF. Внедряется отдельным
  инкрементом с проверкой uploads/PDF/inline-стилей.

## Audit log (план)

- Модель `AuditLog` (actor, action, entity, metadata, ip, user_agent, время) и сервис записи,
  не роняющий основной запрос. Логируются входы (успех/провал), refresh-сбои, смена
  пароля/логина, CRUD аккаунтов/ролей/реестров, операции казны, материалы центра обслуживания,
  удаления. Endpoint `GET /api/audit` под суперадмином. Детали и схема — MIGRATION_NOTES.

## Хранение файлов

- Загрузки на диск (`UPLOADS_DIR`), отдаются с `X-Content-Type-Options: nosniff` и
  ограничительным CSP (sandbox). Имена файлов — случайные (без доверия к имени клиента).
- Слой `services/storage/` абстрагирует хранилище (драйвер `local`, заготовка под S3/R2/MinIO).
- Бэкап загрузок — обязателен (volume `uploads_data`). См. OPERATIONS.

## Секреты

- Секреты только в окружении/Secrets, никогда в репозитории. Не логировать пароли, access/refresh
  токены и секреты.

## CORS

- `CLIENT_URL` задаёт разрешённый origin. В production — конкретный домен, не `*`.

## Production-правила

См. [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md): смена секретов, HTTPS, бэкапы БД и
загрузок, persistent volumes, лимиты, миграции, восстановление из бэкапа.
