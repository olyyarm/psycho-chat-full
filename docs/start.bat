@echo off
chcp 65001 > nul
echo Запуск PsychoChat...
echo Проверка зависимостей...

:: Проверка Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo Ошибка: Python не установлен или не добавлен в PATH
    echo Установите Python с сайта https://www.python.org/downloads/
    echo и убедитесь, что отметили галочку "Add Python to PATH" при установке
    pause
    exit /b 1
)

:: Проверка сервера модели
echo.
echo Проверка доступности сервера модели...
curl -X POST "http://localhost:1234/v1/chat/completions" ^
-H "Content-Type: application/json" ^
-d "{\"model\":\"gemma-3-27b-it\",\"messages\":[{\"role\":\"system\",\"content\":\"test\"},{\"role\":\"user\",\"content\":\"test\"}]}" >nul 2>&1

if %errorlevel% neq 0 (
    echo.
    echo ВНИМАНИЕ: Сервер модели недоступен на http://localhost:1234
    echo Убедитесь что:
    echo 1. Сервер модели запущен с флагом --cors ^(для поддержки CORS^)
    echo 2. Он работает на порту 1234
    echo 3. Поддерживает API endpoint /v1/chat/completions
    echo.
    echo Пример запуска:
    echo lmstudio ai serve --cors
    echo.
    choice /C YN /M "Продолжить запуск приложения?"
    if errorlevel 2 exit /b 1
)

:: Запуск веб-сервера в новом окне
echo.
echo Запуск веб-сервера...
start "PsychoChat Server" cmd /k "python -m http.server 8000"

:: Ожидание запуска сервера
timeout /t 2 >nul

:: Открытие браузера
echo.
echo Открываю приложение в браузере...
start http://localhost:8000/index.html

echo.
echo PsychoChat запущен успешно!
echo Адрес приложения: http://localhost:8000/index.html
echo.
echo Для завершения работы:
echo 1. Закройте это окно
echo 2. Закройте окно сервера (где запущен Python)
echo.
pause