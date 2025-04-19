Вот детальный план реализации, основанный на `psycho-chat/PLAN.md`:

```markdown
# Детализированный План Реализации: Psycho-Chat v2 (PLAN_v2)

## 1. Цель

Добавить функциональность регистрации/входа пользователей и безопасное сохранение истории чатов для каждого диалога с психологом, с возможностью очистки истории, путем создания бэкенд-сервиса.

## 2. Общая Архитектура

*   **Фронтенд:** Существующий `psycho-chat` (HTML, CSS, JS).
*   **Бэкенд:** Node.js + Express.
*   **База Данных:** MongoDB (с Mongoose).
*   **Аутентификация:** JWT (JSON Web Tokens) + bcryptjs для хеширования паролей.
*   **Взаимодействие с AI:** Google Gemini API (вызовы с бэкенда).

```mermaid
graph LR
    subgraph Browser (Frontend - psycho-chat)
        direction LR
        FE_UI[UI (Регистрация, Вход, Чат)]
        FE_JS[JavaScript (app.js, api.js)] -- Calls --> FE_API_WRAP[Frontend API Wrapper (api.js)]
    end

    subgraph Your Server (Backend - Node.js/Express)
        direction TB
        BE_ROUTER[Router (/api/auth/*, /api/chat/*)]
        BE_AUTH_MW[Auth Middleware (JWT Verify)]
        BE_CONTROLLERS[Controllers (Auth, Chat)]
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

    FE_API_WRAP -- HTTP Requests --> BE_ROUTER
    BE_ROUTER -- Uses --> BE_AUTH_MW
    BE_ROUTER -- Routes to --> BE_CONTROLLERS
    BE_CONTROLLERS -- Uses --> BE_SERVICES
    BE_SERVICES -- Uses --> BE_MODELS
    BE_SERVICES -- Calls --> GEMINI
    BE_MODELS -- Interacts with --> DB_USERS
    BE_MODELS -- Interacts with --> DB_CHATS
    BE_ROUTER -- HTTP Responses --> FE_API_WRAP

```

## 3. Фазы Реализации

### Фаза 1: Настройка Бэкенда и Базы Данных

*   **Задача 1.1:** Создать директорию `backend` на одном уровне с `psycho-chat`.
*   **Задача 1.2:** Инициализировать Node.js проект (`npm init -y`).
*   **Задача 1.3:** Установить основные зависимости:
    ```bash
    npm install express mongoose bcryptjs jsonwebtoken dotenv cors
    npm install --save-dev nodemon # Для удобства разработки
    ```
*   **Задача 1.4:** Создать базовую структуру директорий бэкенда:
    ```
    backend/
    ├── src/
    │   ├── config/       # Конфигурация (DB, JWT)
    │   ├── controllers/  # Обработчики запросов
    │   ├── middleware/   # Middleware (auth, error handling)
    │   ├── models/       # Mongoose модели
    │   ├── routes/       # Определения роутов
    │   ├── services/     # Бизнес-логика, взаимодействие с внешними API
    │   └── server.js     # Точка входа сервера
    ├── .env              # Переменные окружения (НЕ КОММИТИТЬ!)
    ├── .gitignore        # Исключения для Git (node_modules, .env)
    └── package.json
    ```
*   **Задача 1.5:** Настроить базовый Express сервер (`src/server.js`) с подключением `dotenv` и `cors`.
*   **Задача 1.6:** Создать файл `.env` и добавить в него переменные (пока можно с плейсхолдерами):
    ```
    PORT=3000
    MONGODB_URI=mongodb://localhost:27017/psycho_chat_db # Или Atlas URI
    JWT_SECRET=YOUR_SUPER_SECRET_KEY_HERE # Заменить на сложный ключ
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
    ```
*   **Задача 1.7:** Добавить `node_modules` и `.env` в `.gitignore`.
*   **Задача 1.8:** Настроить подключение к MongoDB с использованием Mongoose (`src/config/db.js`).
*   **Задача 1.9:** Создать Mongoose модели (`src/models/User.js`, `src/models/Chat.js`):
    *   `User`: `email` (unique, required, lowercase, trim), `password` (required). Добавить метод для сравнения паролей.
    *   `Chat`: `userId` (ObjectId, ref: 'User', required), `psychologistId` (String, required), `messages` (Array of `{ role: String, content: String, timestamp: { type: Date, default: Date.now } }`).

### Фаза 2: Реализация Аутентификации

*   **Задача 2.1:** Создать контроллер аутентификации (`src/controllers/authController.js`).
*   **Задача 2.2:** Реализовать логику регистрации (`register`):
    *   Валидация входных данных (email, password).
    *   Проверка, не занят ли email.
    *   Хеширование пароля с `bcryptjs`.
    *   Создание нового пользователя в БД.
    *   Генерация JWT токена.
    *   Отправка токена клиенту.
*   **Задача 2.3:** Реализовать логику входа (`login`):
    *   Валидация входных данных.
    *   Поиск пользователя по email.
    *   Сравнение предоставленного пароля с хешем в БД (`bcryptjs.compare`).
    *   Генерация JWT токена при успехе.
    *   Отправка токена клиенту.
*   **Задача 2.4:** Создать роуты аутентификации (`src/routes/authRoutes.js`) для `/register` и `/login`.
*   **Задача 2.5:** Подключить роуты аутентификации в `src/server.js` (`/api/auth`).
*   **Задача 2.6:** Создать middleware для проверки JWT (`src/middleware/authMiddleware.js`):
    *   Проверка наличия токена в заголовке `Authorization: Bearer <token>`.
    *   Верификация токена (`jsonwebtoken.verify`).
    *   Добавление информации о пользователе (`userId`) в объект `req`.

### Фаза 3: Реализация API Чата

*   **Задача 3.1:** Создать контроллер чата (`src/controllers/chatController.js`).
*   **Задача 3.2:** Реализовать получение истории чата (`getChatHistory`):
    *   Принимает `psychologistId` из параметров URL.
    *   Использует `userId` из `req` (добавленный `authMiddleware`).
    *   Находит соответствующий чат в БД.
    *   Возвращает массив `messages`.
*   **Задача 3.3:** Реализовать отправку сообщения и получение ответа AI (`sendMessage`):
    *   Принимает `psychologistId` из URL и сообщение пользователя из тела запроса.
    *   Использует `userId` из `req`.
    *   Находит или создает чат в БД для `userId` и `psychologistId`.
    *   Добавляет сообщение пользователя в массив `messages` чата.
    *   Формирует историю сообщений для Gemini API.
    *   **Безопасно** вызывает Gemini API с бэкенда, используя ключ из `.env`. (Создать сервис `src/services/geminiService.js` для инкапсуляции логики Gemini).
    *   Добавляет ответ AI в массив `messages` чата.
    *   Сохраняет обновленный чат в БД.
    *   Возвращает ответ AI клиенту.
*   **Задача 3.4:** Реализовать очистку истории чата (`deleteChatHistory`):
    *   Принимает `psychologistId` из URL.
    *   Использует `userId` из `req`.
    *   Находит чат и очищает его массив `messages` или удаляет документ чата (решить по логике).
*   **Задача 3.5:** Создать роуты чата (`src/routes/chatRoutes.js`):
    *   `GET /:psychologistId/history` (защищенный `authMiddleware`)
    *   `POST /:psychologistId` (защищенный `authMiddleware`)
    *   `DELETE /:psychologistId/history` (защищенный `authMiddleware`)
*   **Задача 3.6:** Подключить роуты чата в `src/server.js` (`/api/chat`).

### Фаза 4: Модификация Фронтенда (`psycho-chat`)

*   **Задача 4.1:** Добавить HTML элементы для форм регистрации и входа (можно на `index.html` или отдельной странице `auth.html`).
*   **Задача 4.2:** Добавить CSS стили для новых форм.
*   **Задача 4.3:** Обновить `scripts/api.js`:
    *   Удалить функцию прямого вызова Gemini и переменную `API_KEY`.
    *   Добавить функции для вызова бэкенд API: `registerUser`, `loginUser`, `getHistory`, `sendMessageToServer`, `deleteHistory`. Эти функции должны принимать токен (если нужен) и отправлять запросы на бэкенд (`/api/auth/*`, `/api/chat/*`).
*   **Задача 4.4:** Обновить `scripts/app.js`:
    *   Добавить логику для отображения/скрытия форм регистрации/входа и основного интерфейса чата.
    *   Реализовать обработчики событий для форм регистрации/входа:
        *   Вызов `registerUser`/`loginUser` из `api.js`.
        *   Сохранение полученного JWT токена в `localStorage`.
        *   После успешного входа/регистрации - скрытие форм, отображение чата, загрузка истории (`getHistory`).
    *   Модифицировать функцию отправки сообщения:
        *   Получение токена из `localStorage`.
        *   Вызов `sendMessageToServer` из `api.js`, передавая токен в заголовке `Authorization: Bearer <token>`.
    *   При загрузке страницы проверять наличие токена в `localStorage`. Если есть - пытаться загрузить историю, если нет - показывать формы входа/регистрации.
    *   Добавить кнопку/логику "Выход": удаление токена из `localStorage`, перезагрузка страницы или показ форм входа.
    *   Добавить кнопку "Очистить историю": вызов `deleteHistory` из `api.js` с токеном.
*   **Задача 4.5:** Удалить `config.json` из `psycho-chat` (или убрать оттуда API ключ). Обновить `.gitignore` в `psycho-chat`, если `config.json` там был.

### Фаза 5: Тестирование и Отладка

*   **Задача 5.1:** Локальное тестирование регистрации, входа, выхода.
*   **Задача 5.2:** Тестирование отправки сообщений и получения ответов для разных психологов.
*   **Задача 5.3:** Тестирование загрузки и очистки истории.
*   **Задача 5.4:** Проверка обработки ошибок (неверный пароль, занятый email, ошибки API Gemini, ошибки сети).
*   **Задача 5.5:** Проверка безопасности (невозможность доступа к чату без токена).

### Фаза 6: Развертывание (Деплой)

*   **Задача 6.1:** Выбрать хостинг-провайдера для бэкенда (Node.js) и фронтенда (статика). Примеры: Render, Vercel, Heroku (платный), Netlify (только фронтенд).
*   **Задача 6.2:** Настроить базу данных MongoDB Atlas (облачная).
*   **Задача 6.3:** Настроить переменные окружения на хостинге (`MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `PORT`).
*   **Задача 6.4:** Настроить скрипты для запуска в `package.json` (`start`).
*   **Задача 6.5:** Развернуть бэкенд.
*   **Задача 6.6:** Обновить URL бэкенд-API во фронтенде (`api.js`) на URL развернутого бэкенда.
*   **Задача 6.7:** Развернуть фронтенд.
*   **Задача 6.8:** Настроить CORS на бэкенде, чтобы разрешить запросы с домена фронтенда.
*   **Задача 6.9:** Финальное тестирование развернутого приложения.

## 4. Дополнительные Соображения

*   **Обработка ошибок:** Реализовать централизованный обработчик ошибок в Express.
*   **Валидация:** Добавить более строгую валидацию входных данных на бэкенде (например, с помощью библиотеки `express-validator`).
*   **Лимиты запросов:** Рассмотреть добавление лимитов на количество запросов к API (rate limiting).
*   **UI/UX:** Улучшить пользовательский интерфейс для регистрации/входа и отображения статусов (загрузка, ошибка).
*   **Безопасность JWT:** Использовать короткое время жизни для токенов доступа и реализовать механизм refresh-токенов (более сложный вариант).

```