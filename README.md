# Пельгария / PG-BRIDGE · СОНАР

**Пельгария** — игровое (вымышленное) государство на сервере **Minecraft Java** с собственной
сборкой модификаций. **PG-BRIDGE** («Мост Пельгарии») — публичная витрина проекта на корне домена.
**СОНАР** — служебная государственная информационная система: единый рабочий контур для реестров,
документооборота, права, экономики и обслуживания игроков.

> Это вымышленный проект ролевой игры. СОНАР не относится к реальным государственным органам
> и не оказывает настоящих государственных услуг.

## Возможности

- Публичный «мост» Пельгарии (`/`) и служебный вход (`/login`).
- Реестр **игроков** (бывш. «Граждане»), **паспортов**, **законов**, **дел**, **наказаний**.
- **Экономика**: налоги и казна.
- **РЕЛИКТ** — реестр строений.
- **Центр контакта** (обращения/дела игроков) с архивом, возобновлением и многодневными статусами.
- **Печатный центр**: генерация PDF-документов (ч/б, под слабый принтер Pantum), пробные листы.
- **Проверка подлинности** документов по номеру/ШК.
- **Чат** (Socket.IO), привязка Discord, тёмная/светлая темы, PWA.

## Структура репозитория

```
pelgaria/
├── sonar/
│   ├── client/        # React + Vite + TypeScript (SPA)
│   │   ├── src/       # страницы, компоненты, стор (zustand), стили
│   │   └── public/    # манифест, иконки, service worker
│   └── server/        # Express + Prisma + PostgreSQL + Socket.IO
│       ├── src/
│       │   ├── routes/        # HTTP-маршруты (/api/*)
│       │   ├── middleware/    # auth, permissions
│       │   ├── services/      # pdf, шаблоны, реестр номеров, ocr и т.д.
│       │   └── prisma/        # seed
│       └── prisma/schema.prisma
├── docs/              # ARCHITECTURE / DEPLOYMENT / SECURITY / API / OPERATIONS / PRODUCTION_CHECKLIST
├── docker-compose.yml
├── .env.example       # корневой пример (для docker compose)
└── MIGRATION_NOTES.md
```

## Локальный запуск (без Docker)

Требуется Node.js 22+ и PostgreSQL 14+.

**Сервер:**
```bash
cd sonar/server
cp .env.example .env          # заполните DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
npm install
npm run db:generate           # prisma generate
npm run db:push               # применить схему к БД
npm run db:seed               # роли + администратор (см. ADMIN_PASSWORD)
npm run dev                   # http://localhost:3001
```

**Клиент:**
```bash
cd sonar/client
npm install
npm run dev                   # http://localhost:5173 (проксирует /api и /uploads на :3001)
```

## Запуск через Docker

```bash
cp .env.example .env          # при необходимости измените секреты/пароли
docker compose up --build
# фронтенд:  http://localhost:8080
# backend:   проксируется через nginx на /api
```

Сервис `postgres` использует постоянный volume `pg_data`, загрузки — volume `uploads_data`.
Сервер при старте применяет схему (`prisma db push`). Сид администратора запускается отдельно:

```bash
docker compose exec server npx tsx src/prisma/seed.ts
```

## Переменные окружения

Полный список — в `sonar/server/.env.example` и корневом `.env.example`. Ключевые:

| Переменная | Назначение |
|---|---|
| `NODE_ENV` | `development` / `production` |
| `PORT` | порт backend (по умолчанию 3001) |
| `CLIENT_URL` | адрес фронтенда для CORS |
| `DATABASE_URL` | строка подключения PostgreSQL |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | секреты подписи токенов |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS` | время жизни токенов |
| `ADMIN_LOGIN`, `ADMIN_PASSWORD` | первичный администратор (seed) |
| `UPLOADS_DIR`, `UPLOADS_PUBLIC_PATH`, `FILE_STORAGE_DRIVER` | хранилище файлов |
| `RATE_LIMIT_*`, `AUTH_RATE_LIMIT_MAX` | лимиты запросов (план, см. MIGRATION_NOTES) |
| `DISCORD_*` | OAuth Discord (опционально) |
| `LOG_LEVEL` | уровень логирования |

## Создание администратора

Пароль администратора берётся **только из окружения** (`ADMIN_PASSWORD`):

- **production** без `ADMIN_PASSWORD` → seed завершится ошибкой при создании нового админа;
- **development** без `ADMIN_PASSWORD` → будет сгенерирован временный пароль и выведен в консоль;
- существующий админ **не перезаписывается** (seed идемпотентен);
- у созданного админа `must_change_password=true` — пароль нужно сменить при первом входе.

## Команды

**Server** (`sonar/server`): `dev`, `build`, `start`, `db:generate`, `db:push`, `db:migrate`, `db:seed`.
**Client** (`sonar/client`): `dev`, `build`, `preview`.

## Документация

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — устройство системы
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — развёртывание
- [docs/SECURITY.md](docs/SECURITY.md) — безопасность
- [docs/API.md](docs/API.md) — API
- [docs/OPERATIONS.md](docs/OPERATIONS.md) — эксплуатация
- [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) — чек-лист прод-запуска
- [MIGRATION_NOTES.md](MIGRATION_NOTES.md) — миграции и план усиления
