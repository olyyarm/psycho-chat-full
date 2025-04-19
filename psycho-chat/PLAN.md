# План Разработки: Добавление Регистрации и Сохранения Истории в Psycho-Chat

## 1. Цель

Добавить функциональность регистрации пользователей по email/паролю и обеспечить безопасное сохранение истории чатов для каждого диалога с психологом, с возможностью очистки истории.

## 2. Текущая Архитектура (Проблема)

*   Чисто фронтенд-приложение (HTML, CSS, JS).
*   Прямое обращение к Google Gemini API из браузера.
*   API ключ хранится в `config.json` на фронтенде (небезопасно).
*   История чата хранится временно в JS-переменной и теряется при закрытии/обновлении страницы.
*   Отсутствует бэкенд и база данных.

## 3. Предлагаемая Архитектура

Создание полноценного веб-приложения с разделением на фронтенд и бэкенд.

**Стек:**

*   **Фронтенд:** Текущий HTML, CSS, JavaScript (`psycho-chat`).
*   **Бэкенд:** Node.js + Express.
*   **База Данных:** MongoDB (с использованием Mongoose).
*   **Аутентификация:** JWT (JSON Web Tokens).
*   **Хеширование паролей:** bcryptjs.

**Схема Взаимодействия:**

```mermaid
graph LR
    subgraph Browser (Frontend - psycho-chat)
        direction LR
        FE_UI[UI (Регистрация, Вход, Чат)]
        FE_JS[JavaScript (app.js, api.js)] -- Calls --> FE_API_WRAP[Frontend API Wrapper (api.js)]
    end

    subgraph Your Server (Backend - Node.js/Express)
        direction TB
        BE_ROUTER[Router (/api/auth/*, /api/chat/*, /api/admin/*)]
        BE_AUTH_MW[Auth Middleware (JWT Verify)]
        BE_CONTROLLERS[Controllers (Auth, Chat, Admin)]
        BE_SERVICES[Services (Gemini Interaction, DB Logic)]
        BE_MODELS[Mongoose Models (User, Chat)]
    end

    subgraph MongoDB
        direction TB
        DB_USERS[Users Collection]
        DB_CHATS[Chats Collection]
    end

    subgraph External Services
        GEMINI[Google Gemini API]
    end

    FE_API_WRAP -- HTTP Requests (Login, Register, Get History, Send Msg, Delete History) --> BE_ROUTER
    BE_ROUTER -- Uses --> BE_AUTH_MW
    BE_ROUTER -- Routes to --> BE_CONTROLLERS
    BE_CONTROLLERS -- Uses --> BE_SERVICES
    BE_SERVICES -- Uses --> BE_MODELS
    BE_SERVICES -- Calls --> GEMINI
    BE_MODELS -- Interacts with --> DB_USERS
    BE_MODELS -- Interacts with --> DB_CHATS
    BE_ROUTER -- HTTP Responses (Token, History, AI Msg, Success/Error) --> FE_API_WRAP

```

## 4. Детализированный План Реализации

1.  **Настройка Бэкенда (Node.js + Express + MongoDB):**
    *   Создание структуры проекта (`backend`).
    *   Инициализация `npm`, установка зависимостей: `express`, `mongoose`, `bcryptjs`, `jsonwebtoken`, `dotenv`, `cors`.
    *   Настройка базового Express-сервера.
    *   Создание файла `.env` для секретов (API ключ Gemini, строка MongoDB, секрет JWT) и добавление в `.gitignore`.
2.  **Модели Данных (Mongoose Schemas):**
    *   `User`: `email` (unique, required), `password` (required, hashed).
    *   `Chat`: `userId` (ref: 'User'), `psychologistId` (String), `messages` (Array of `{ role: String, content: String, timestamp: Date }`).
    *   Настройка подключения к MongoDB.
3.  **API Аутентификации:**
    *   `POST /api/auth/register`: Регистрация (проверка email, хеширование пароля, создание User).
    *   `POST /api/auth/login`: Вход (поиск User, сравнение хеша, генерация JWT).
    *   Middleware для проверки JWT.
4.  **API Чата:**
    *   `GET /api/chat/:psychologistId/history` (защищенный): Получение истории для user/psychologist.
    *   `POST /api/chat/:psychologistId` (защищенный):
        *   Получение сообщения, истории из БД.
        *   Формирование контекста для Gemini.
        *   **Безопасный** вызов Gemini API с сервера.
        *   Сохранение сообщения user и ответа AI в БД.
        *   Возврат ответа AI фронтенду.
    *   `DELETE /api/chat/:psychologistId/history` (защищенный): Очистка истории чата в БД.
5.  **API для Статистики (Опционально):**
    *   `GET /api/admin/stats` (защищенный): Подсчет пользователей.
6.  **Модификация Фронтенда (`psycho-chat`):**
    *   Добавление UI для регистрации/входа.
    *   Обновление `app.js`:
        *   Логика UI для auth.
        *   Вызовы API бэкенда (`/api/auth/*`, `/api/chat/*`).
        *   Сохранение/удаление JWT в `localStorage`.
        *   Добавление токена в заголовки `Authorization`.
        *   Загрузка истории при входе.
        *   Кнопка "Очистить историю" и вызов `DELETE`.
        *   Логика выхода.
    *   Обновление `api.js`:
        *   Удаление прямого вызова Gemini.
        *   Функции-обертки для вызова бэкенд API.
7.  **Развертывание:**
    *   Размещение бэкенда (Heroku, Render, Vercel...).
    *   Размещение фронтенда (там же или статический хостинг).
    *   Настройка CORS.

## 5. Ключевые Преимущества Новой Архитектуры

*   **Безопасность:** API ключ Gemini надежно хранится на сервере.
*   **Аутентификация:** Только зарегистрированные пользователи могут пользоваться чатом.
*   **Сохранение данных:** История чатов надежно хранится в базе данных.
*   **Масштабируемость:** Бэкенд позволяет добавлять новую функциональность в будущем (профили пользователей, настройки, админ-панель и т.д.).