# MIGRATION NOTES

Документ описывает: (1) что уже изменено в этом инкременте и безопасно ли это для прод-данных,
(2) код-уровневый план оставшихся усилений с заметками по миграции данных.

Принцип: не ломать существующие функции, маршруты, дизайн и пользовательские сценарии; рискованные
изменения внедрять максимально безопасно и документировать здесь.

---

## 1. Внедрено в этом инкременте (безопасно, без миграции данных)

### Документация и инфраструктура (аддитивно)
- `README.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/SECURITY.md`, `docs/API.md`,
  `docs/OPERATIONS.md`, `docs/PRODUCTION_CHECKLIST.md`.
- Docker: `docker-compose.yml` (postgres + server + client, persistent volumes `pg_data`,
  `uploads_data`), `sonar/server/Dockerfile` (с системным Chromium для PDF),
  `sonar/client/Dockerfile` (+ `nginx.conf`), `.dockerignore`.
- Расширенный `sonar/server/.env.example` и корневой `.env.example`.
- Локальный запуск без Docker сохранён.

### `system.superadmin` (обратносовместимо)
- В `middleware/permissions.ts`:
  - `requirePermission` пропускает обладателя `system.superadmin`;
  - добавлены `isSuperadmin`, `requireSuperadmin`; `requireHeadOfState` стал **алиасом**
    `requireSuperadmin` (проверяет право `system.superadmin`, fallback — роль «Глава государства»).
  - **Совместимость:** все текущие маршруты с `requireHeadOfState` продолжают работать без изменений.
- В seed роли «Глава государства» добавлено право `system.superadmin`.
- В тип `Permission` (frontend) добавлен `'system.superadmin'`.
- **Данные:** действующему администратору право проставится при следующем `npm run db:seed`
  (роли апсертятся). Если seed не запускается на проде — право можно выдать вручную через роль
  в разделе «Роли» или одним UPDATE (см. ниже). Fallback по имени роли гарантирует, что доступ
  суперадмина не пропадёт до миграции.

  ```sql
  -- при необходимости вручную:
  UPDATE "Role" SET permissions = permissions || '{"system.superadmin": true}'::jsonb
  WHERE name = 'Глава государства';
  ```

### Seed без хардкода пароля (безопасно для существующего прод-админа)
- `src/prisma/seed.ts` больше не использует `admin123`. Пароль берётся из `ADMIN_PASSWORD`:
  - production без `ADMIN_PASSWORD` → ошибка **только при создании нового админа**;
  - development без пароля → генерируется временный, печатается один раз;
  - **существующий админ не перезаписывается** (idempotent) — прод не затрагивается;
  - сохранён `must_change_password=true`.

### Проектная инициатива (новый модуль, аддитивно)
- Prisma: добавлены модели `ProjectInitiative`, `ProjectInitiativeEvent` и enum'ы
  `InitiativeType`, `InitiativeStatus`. Только новые таблицы — существующие данные не затрагиваются.
  На деплое `prisma db push` создаёт их без потери данных.
- Сервер: `routes/projectInitiatives.ts`, смонтирован на `/api/project-initiatives` (CRUD,
  `/stats`, `/:id/events`, `/:id/pdf`, `DELETE` только суперадмину).
- Регистрационный номер СОНАР: сквозной по году `ПИ-<год>-<NNNN>` (через `DocumentSequence`),
  контрольный ШК `ШК-ПИ-…`. Жизненный цикл: подана → на рассмотрении →
  принята/отклонена/на доработке → реализована/архив.
- Доступ по полям/действиям: `initiatives.view` (чтение), `initiatives.create` (подача),
  `initiatives.manage` (делопроизводство Канцелярии, отметки, ответственный),
  `initiatives.decide` (решение Совета: принять/отклонить/на доработку/реализовать/в архив + подпись).
  Удаление записи реестра — только суперадмин (Председатель Верховного Совета).
- Frontend: страница `/initiatives`, пункт в навигационном центре, типы и права в `types/index.ts`.
- **Доступ после деплоя:** Председатель (право `system.superadmin`) получает модуль сразу —
  `requirePermission` пропускает суперадмина. Прочим ролям права `initiatives.*` выдаются через
  раздел «Роли» (seed на проде не перезаписывает существующие роли). В seed права добавлены для
  новых инсталляций (роли «Глава государства», «Министр»).

> Все изменения этого раздела не требуют миграции схемы и не ломают обратную совместимость.

---

## 2. План оставшихся усилений (следующие инкременты)

Эти пункты затрагивают «горячие» файлы (`index.ts`, `schema.prisma`, `routes/serviceCenter.ts`,
`routes/printCenter.ts`), которые сейчас активно меняются параллельно. Их безопаснее внедрять
отдельными сфокусированными PR/коммитами, когда соответствующие файлы не редактируются другим
агентом, с прогоном сборки и деплоя. Ниже — конкретный план.

### 2.1 Хеширование refresh-токенов (требует миграции данных)
- Prisma: в модели `RefreshToken` заменить `token String @unique` на `token_hash String @unique`
  (или добавить `token_hash` и удалить `token` после переноса).
- `auth.ts`:
  - при выдаче: `const raw = generateRefreshToken(userId); const hash = sha256(raw)` — в БД пишем `hash`,
    клиенту отдаём `raw`;
  - при refresh/logout: считаем `sha256(raw)` и ищем по `token_hash`;
  - `sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex')` (или HMAC с `JWT_REFRESH_SECRET`).
- **Миграция данных:** старые открытые токены становятся недействительными → все активные сессии
  завершатся, потребуется повторный вход. Это ожидаемо и безопасно. Выполнять в окно обслуживания.
  Через `prisma db push` колонка пересоздаётся; старые refresh можно очистить:
  `DELETE FROM "RefreshToken";`

### 2.2 Rate limiting + helmet (`index.ts`, +deps)
- Добавить deps `express-rate-limit`, `helmet` (обновить lockfile).
- Общий лимит на `/api` (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`), строгий на
  `/api/auth/login` и `/api/auth/refresh` (`AUTH_RATE_LIMIT_MAX`).
- `helmet({ contentSecurityPolicy: false })` на старте (CSP включать отдельно и проверять, что не
  ломает SPA inline-стили, `/uploads` и PDF), `crossOriginResourcePolicy` совместимый с uploads.
- Риск: CSP/CORP могут сломать загрузку изображений/PDF — внедрять с ручной проверкой uploads/verify/print.

### 2.3 Audit log (`schema.prisma` + сервис + endpoint + UI)
- Модель `AuditLog { id, actor_id, actor_login, action, entity_type, entity_id, metadata Json,
  ip, user_agent, created_at }` с индексами `(actor_id, created_at)`, `(entity_type, entity_id)`,
  `(action, created_at)`.
- `services/auditLog.ts`: `writeAudit(...)` в try/catch — **не ронять основной запрос** при сбое аудита.
- Логировать: вход (успех/провал), refresh-сбой, смену пароля/логина, CRUD аккаунтов/ролей/игроков/
  паспортов/законов/дел/наказаний, транзакции казны, service session/attachment/document, удаления.
- `GET /api/audit` (фильтры `actor_id`, `action`, `entity_type`, `entity_id`, `from`, `to`, `limit`)
  под `requireSuperadmin`.
- Frontend: страница/вкладка «Аудит» только для суперадмина (маршрут + пункт меню по `system.superadmin`).
- **Данные:** новая таблица, аддитивно; миграции существующих данных не требуется.

### 2.4 Storage abstraction (адаптация маршрутов)
- Создать `services/storage/` с интерфейсом `saveFile`, `deleteFile`, `getPublicUrl` и драйвером
  `local` (через `UPLOADS_DIR`, `UPLOADS_PUBLIC_PATH`, `FILE_STORAGE_DRIVER`).
- Перевести аплоады/удаления (chat, laws, service-center) на сервис, оставив пути и поведение.
- Подготовлено под S3/R2/MinIO без переписывания маршрутов. **Без миграции данных** (пути файлов те же).

### 2.5 OCR в фоновом job-механизме
- Модель `BackgroundJob { id, type, status, payload Json, attempts, max_attempts, last_error,
  locked_at, created_at, updated_at }` + индексы по `(status, type)`.
- При загрузке изображения создавать job `OCR_ATTACHMENT`; HTTP-ответ — быстрый.
- In-process runner (ограничение concurrency, retry, запись `last_error`). OCR-логику вынести в
  `services/ocr.ts` + handler. Для multi-instance позже — Redis/BullMQ или отдельный worker.
- **Данные:** новая таблица, аддитивно.

### 2.6 Zod-валидация и единый error handler
- Middleware `validateBody/validateQuery/validateParams`; формат ошибки
  `{ error: 'Некорректные данные', details: [...] }`.
- Покрыть: login, change-password, change-login, service session create/update, attachment OCR
  update, generated document create, role/user update.
- Express error handler + структурированный логгер (pino, `LOG_LEVEL`), без логирования секретов.

### 2.7 Модуляризация крупных маршрутов
- Вынести бизнес-логику `routes/serviceCenter.ts` и `routes/printCenter.ts` в
  `modules/serviceCenter/` и `modules/printCenter/` (storage, pdf, шаблоны, registry, session logic).
  Маршруты оставить тонким HTTP-слоем. **Все API-пути сохранить.**

### 2.8 Тесты
- `vitest` + `supertest`. Минимум: health, login success/failure, refresh rotation, 401 без токена,
  403 без права, генератор номера/ШК, verify unknown → `found:false`, create service session,
  upload validation (mime). `.env.test.example` для тестовой БД. Frontend — build/typecheck.

### 2.9 Readiness endpoint
- `GET /api/readiness`: `prisma.$queryRaw\`SELECT 1\``, проверка доступности `UPLOADS_DIR`/хранилища.
  Использовать в Docker healthcheck вместо `/api/health` для готовности.

### 2.10 Инфраструктурный долг
- Обновить версии GitHub Actions (Node20 → Node24).
- Снизить размер клиентского бандла (доп. code-splitting/manualChunks).
