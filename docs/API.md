# API

Базовый префикс: `/api`. Авторизация — заголовок `Authorization: Bearer <access_token>`.
Большинство маршрутов требуют аутентификации и соответствующего права.

## Формат ошибок

```json
{ "error": "Человекочитаемое сообщение" }
```
Для ошибок валидации (план, Zod):
```json
{ "error": "Некорректные данные", "details": [ { "path": "...", "message": "..." } ] }
```

## Auth (`/api/auth`)

| Метод | Путь | Описание |
|---|---|---|
| POST | `/login` | вход по логину/паролю → `{ accessToken, refreshToken, user }` |
| POST | `/refresh` | обновление токенов по refresh |
| POST | `/change-password` | смена пароля (auth) |
| POST | `/change-login` | смена логина (auth, перевыпуск токенов) |
| GET  | `/me` | текущий пользователь |
| GET/… | `/discord/...` | OAuth Discord (status, login, callback, привязка/отвязка) |

## Реестры и модули

| Namespace | Назначение |
|---|---|
| `/api/citizens` | игроки (реестр); деталь по id |
| `/api/passports` | паспорта (выдача/перевыдача/PDF) |
| `/api/laws` | законы/акты (CRUD, вложения, PDF, отмена) |
| `/api/cases` | судебные дела |
| `/api/punishments` | наказания |
| `/api/taxes` | налоги |
| `/api/treasury` | казна и транзакции |
| `/api/buildings` | РЕЛИКТ (строения) |
| `/api/accounts` | служебные аккаунты |
| `/api/roles` | роли и права |
| `/api/chat` | чат, вложения |
| `/api/dashboard` | метрики главной |
| `/api/print-center` | печатные формы, документы, пробные листы |
| `/api/verify/:code` | проверка подлинности по номеру/ШК |
| `/api/office` | заявки/реестр обращений (карточка с created_by, assignee, events) |
| `/api/project-initiatives` | проектные инициативы Канцелярии Верховного Совета (реестр, решение, PDF) |
| `/api/service-center` | центр обслуживания: обращения, вложения, OCR, документы |

## Служебные

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/health` | live-check `{ status, timestamp }` |
| GET | `/api/readiness` | (план) проверка БД и хранилища |
| GET | `/api/audit` | (план) журнал аудита, фильтры `actor_id`, `action`, `entity_type`, `entity_id`, `from`, `to`, `limit` (суперадмин) |

## Удаление материалов центра обслуживания

`DELETE /api/service-center/attachments/:id|documents/:id|requests/:id` и связанные —
доступны **только суперадмину** (`requireSuperadmin`).

## Совместимость

Все перечисленные пути сохраняются без изменений. Новые маршруты добавляются аддитивно.
`/print-center` на фронте — редирект в `/office?tab=print` (сохранён).
