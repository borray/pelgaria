# Архитектура

## Обзор

Монорепозиторий из двух приложений:

- **`sonar/client`** — SPA на React 18 + Vite + TypeScript, состояние через zustand,
  маршрутизация через react-router. Ленивые маршруты (code-splitting). PWA (manifest + service worker,
  network-first). Тёмная/светлая темы через `data-theme` на `<html>`.
- **`sonar/server`** — Express + Prisma (PostgreSQL) + Socket.IO. PDF через puppeteer-core +
  Chromium. OCR через tesseract.js. Загрузки через multer на локальный диск.

В Docker фронтенд раздаётся nginx, который проксирует `/api`, `/uploads`, `/socket.io` на backend.
В dev Vite проксирует `/api` и `/uploads` на `:3001`.

## Client / Server split

- Клиент общается с сервером только по HTTP `/api/*` (axios, `sonar/client/src/api/client.ts`)
  и по WebSocket `/socket.io` (чат).
- Access-токен хранится в zustand-сторе (`store/auth.ts`) и добавляется в заголовок `Authorization`.
- Статика загрузок отдаётся сервером по `UPLOADS_PUBLIC_PATH` (`/uploads`).

## API namespaces (`/api/*`)

`auth`, `auth/discord`, `citizens`, `accounts`, `roles`, `passports`, `laws`, `cases`,
`punishments`, `taxes`, `treasury`, `buildings`, `chat`, `dashboard`, `print-center`,
`verify`, `office`, `service-center`, `health`. Подробности — в [API.md](API.md).

## Аутентификация (auth flow)

1. `POST /api/auth/login` (логин/пароль) → bcrypt-проверка → выдаётся **access JWT** (короткий)
   и **refresh-токен** (длинный), refresh сохраняется в таблице `RefreshToken`.
2. Access-токен подписан `JWT_SECRET`, содержит `id`, `login`, `role`, `permissions`.
3. Middleware `requireAuth` проверяет access-токен; `requirePermission(...)` — наличие права;
   `requireSuperadmin`/`requireHeadOfState` — право `system.superadmin` (или историческая
   роль «Глава государства» как fallback).
4. `must_change_password` заставляет пользователя сменить пароль при первом входе.

### Refresh-token flow

- `POST /api/auth/refresh` принимает refresh-токен, проверяет его в БД и подписи `JWT_REFRESH_SECRET`,
  выдаёт новый access (и ротирует refresh).
- `change-login` перевыпускает токены, чтобы новый логин был актуален во всех частях системы.
- План усиления (хранение хеша refresh вместо открытого текста) — см. [MIGRATION_NOTES.md](../MIGRATION_NOTES.md).

## Uploads flow

- Загрузка файлов через multer (chat, законы, центр обслуживания) на диск `UPLOADS_DIR`.
- Файлы отдаются статикой по `/uploads/...` с заголовками `X-Content-Type-Options: nosniff`
  и ограничительным CSP (sandbox).
- Введён слой абстракции хранилища (`services/storage/`, драйвер `local`), чтобы позже
  подключить S3/R2/MinIO без переписывания маршрутов — см. MIGRATION_NOTES.

## PDF generation

- `services/pdf.ts`: HTML → PDF через puppeteer-core. Chromium ищется по
  `PUPPETEER_EXECUTABLE_PATH` → системным путям → встроенному `@sparticuz/chromium`.
- Шаблоны документов (паспорта, законы, печатные формы, пробные листы) — ориентированы на
  **ч/б печать на слабом принтере Pantum** (гильоши, ШК, реперные метки).
- Формирование PDF искусственно показывает прогресс ~7 секунд (UX-требование).

## OCR

- Сканы (изображения) в центре обслуживания распознаются через tesseract.js.
- Сейчас запуск близок к fire-and-forget из маршрута; план — вынести в фоновый job-механизм
  (`BackgroundJob` + in-process runner), чтобы HTTP-ответ был быстрым. См. MIGRATION_NOTES.

## Socket.IO chat

- Авторизация сокета по access-токену (право `chat.send`).
- Комнаты: `user:<id>`, `conv:<conversationId>`. События: `join/leave_conversation`,
  `message_read`, `mark_read`, рассылка прочтений.

## Центр контакта (service center / office)

- Обращения (`ServiceSession`) с многодневными статусами `ACTIVE`, `WAITING_SCAN`, `REVIEW`,
  `COMPLETED`, `CANCELLED`; архив завершённых/отменённых; возобновление закрытых.
- Заявки (`ServiceRequest`) открываются подробной карточкой (содержание, заявитель,
  ответственный, срок, резолюция, история событий), а не сразу на печать.
- Удаление материалов центра — только суперадмину.

## Печатный центр (print center)

- Каталог печатных форм, генерация документов с уникальным номером и контрольным ШК,
  архив, пробные листы проверки печатной станции.

## Verify flow

- `/verify`: поиск документа по номеру или ШК по всем реестрам (паспорта, законы, дела,
  наказания, договоры, формы, пробные листы). 2-й этап проверки искусственно длится ~5 секунд.

## Номера и ШК

- `services/documentRegistry.ts`: случайные «зашифрованные» номера (вида `X7F3-A9K2-M4P8`) и
  контрольные коды ШК (sha256-производные). По номеру нельзя восстановить порядок выдачи.
