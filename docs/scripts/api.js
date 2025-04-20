class API {
    constructor() {
        this.model = 'gemini-2.0-flash';
        this.defaultPrompt = "Вы — опытный психолог, готовый помочь пользователю.";
        this.headers = {
            'Content-Type': 'application/json',
        };
        this.apiKey = null; // Will be loaded from config
        // Base URL will be constructed in makeRequest using the loaded apiKey
    }

    // Validates the structure expected by getAIResponse before conversion
    validateInternalMessages(messages) {
        if (!Array.isArray(messages)) {
            throw new Error('Messages должен быть массивом');
        }
        if (messages.length === 0) {
            throw new Error('Messages не может быть пустым');
        }
        for (const msg of messages) {
            if (!msg.role || !msg.content) {
                throw new Error('Каждое сообщение должно иметь role и content');
            }
            if (typeof msg.content !== 'string' || msg.content.trim().length === 0) {
                throw new Error('Content должен быть непустой строкой');
            }
            if (!['system', 'user', 'assistant'].includes(msg.role)) {
                throw new Error('Role должен быть system, user или assistant');
            }
        }
        return true;
    }

    // Receives messages in the internal format [{role: 'system', content: '...'}, {role: 'user', content: '...'}]
    async makeRequest(messages) {
        if (!this.apiKey) {
            throw new Error("API key not loaded. Make sure loadConfig() was called successfully.");
        }

        // Convert internal message format to Gemini's format
        const geminiContents = messages.map(msg => {
            let role = msg.role === 'assistant' ? 'model' : 'user';
            if (msg.role === 'system' && messages.length > 1 && messages[1].role === 'user') {
                 return null;
            }
            return {
                role: role,
                parts: [{ text: msg.content }]
            };
        }).filter(Boolean);

        // Prepend system prompt to the first user message if it exists
        const systemMessage = messages.find(msg => msg.role === 'system');
        if (systemMessage && geminiContents.length > 0 && geminiContents[0].role === 'user') {
            geminiContents[0].parts[0].text = `${systemMessage.content}\n\n${geminiContents[0].parts[0].text}`;
        }


        const requestBody = {
            contents: geminiContents
            // Add generationConfig if needed
        };

        try {
            // console.log('Отправка запроса Gemini:', JSON.stringify(requestBody, null, 2)); // Removed for cleaner logs
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(requestBody)
            });

            const responseText = await response.text();
            // console.log('Получен ответ Gemini:', responseText); // Removed for cleaner logs

            if (!response.ok) {
                 let errorMsg = `HTTP error! status: ${response.status}`;
                 try {
                     const errorData = JSON.parse(responseText);
                     if (errorData.error && errorData.error.message) {
                         errorMsg += ` - ${errorData.error.message}`;
                     } else {
                         errorMsg += ` - ${responseText}`;
                     }
                 } catch (parseError) {
                     errorMsg += ` - ${responseText}`;
                 }
                 throw new Error(errorMsg);
            }

            const data = JSON.parse(responseText);
            // console.log('Распарсенный ответ Gemini:', JSON.stringify(data, null, 2)); // Removed for cleaner logs

            // Check for Gemini-specific errors in the response body
            if (data.error) {
                 throw new Error(`Gemini API Error: ${data.error.message}`);
            }
            // Validate successful response structure
            if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0 ||
                !data.candidates[0].content || !Array.isArray(data.candidates[0].content.parts) ||
                data.candidates[0].content.parts.length === 0 || typeof data.candidates[0].content.parts[0].text !== 'string') {
                console.error('Неожиданная структура ответа Gemini:', data);
                throw new Error('Неожиданная структура ответа от Gemini API.');
            }

            return data; // Return the full parsed data object
        } catch (error) {
            console.error('Ошибка запроса Gemini:', error);
            throw error;
        }
    }

    async loadPrompt(psychId) {
        try {
            // console.log(`Загрузка промпта для психолога ${psychId}...`); // Removed for cleaner logs
            const promptPath = `prompts/${psychId}.txt`;
            // console.log('Путь к файлу промпта:', promptPath); // Removed for cleaner logs

            const response = await fetch(promptPath);
            if (!response.ok) {
                console.warn(`Промпт для ${psychId} не найден (статус ${response.status}), использую стандартный промпт`);
                return this.defaultPrompt;
            }

            const text = await response.text();
            if (!text || text.trim().length === 0) {
                console.warn(`Промпт для ${psychId} пуст, использую стандартный промпт`);
                return this.defaultPrompt;
            }

            // console.log(`Промпт для ${psychId} успешно загружен (${text.length} символов)`); // Removed for cleaner logs
            return text.trim();
        } catch (error) {
            console.error(`Ошибка загрузки промпта для ${psychId}:`, error);
            console.error('Stack trace:', error.stack);
            return this.defaultPrompt;
        }
    }

    // Added loadConfig method
    async loadConfig() {
        try {
            // console.log('Загрузка конфигурации приложения (config.json)...'); // Removed for cleaner logs

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд таймаут

            const response = await fetch('config.json', { signal: controller.signal });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Не удалось загрузить config.json: статус ${response.status}`);
            }
            let config;
            try {
                 // console.log('[API] Попытка парсинга JSON из config.json...'); // Removed for cleaner logs
                 config = await response.json();
                 // console.log('[API] JSON успешно распарсен.'); // Removed for cleaner logs
            } catch (jsonError) {
                 console.error('[API] Ошибка парсинга JSON в config.json:', jsonError);
                 throw new Error(`Ошибка парсинга config.json: ${jsonError.message}`);
            }
            // console.log('Конфигурация успешно загружена.'); // Removed for cleaner logs
            // Basic validation
            if (!config || !config.apiKey || !Array.isArray(config.psychologists)) {
                 throw new Error('Некорректный формат config.json: отсутствует apiKey или массив psychologists.');
            }
            this.apiKey = config.apiKey; // Store the API key
            console.log('API Key загружен.'); // Keep this one as it's important
            return config;
        } catch (error) {
            console.error('Ошибка загрузки конфигурации:', error);
            throw new Error(`Ошибка загрузки config.json: ${error.message}${error.name === 'AbortError' ? ' (Таймаут)' : ''}`);
        }
    }


    async testConnection() {
        try {
            console.log('Тестирование подключения к серверу модели...');
            const messages = [
                {
                    role: "system",
                    content: "Test connection"
                },
                {
                    role: "user",
                    content: "Hello"
                }
            ];
             const testMessagesForApi = [ { role: 'user', content: 'Hello' } ];
            const data = await this.makeRequest(testMessagesForApi);

            // Check the specific Gemini response structure
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Ошибка подключения к Gemini API:', error);
            return false;
        }
    }

    async getAIResponse(selectedPsych, message, history = []) { // Added history parameter
        try {
            // console.log('Получение ответа для психолога:', selectedPsych); // Removed for cleaner logs

            if (!message || typeof message !== 'string' || message.trim().length === 0) {
                throw new Error('Сообщение пользователя не может быть пустым');
            }

            const systemPrompt = await this.loadPrompt(selectedPsych);
            // console.log('Загруженный системный промпт:', systemPrompt); // Removed for cleaner logs

            if (!systemPrompt || systemPrompt.trim().length === 0) {
                throw new Error('Системный промпт не может быть пустым');
            }

            // Construct messages including history
            const messages = [
                { role: "system", content: systemPrompt.trim() },
                ...history, // Add history messages here
                { role: "user", content: message.trim() }
            ];

            // Validate the final structure before sending
            this.validateInternalMessages(messages);

            const data = await this.makeRequest(messages);

            const responseText = data.candidates[0].content.parts[0].text;

            // console.log("Получен ответ от Gemini:", responseText); // Removed for cleaner logs
            return responseText;

        } catch (error) {
            console.error('Ошибка при получении ответа от Gemini API:', error);
            console.error('Stack trace:', error.stack);

            let userMessage = 'Произошла ошибка при получении ответа от ИИ. ';

            if (error.message.includes('API key not loaded')) {
                userMessage += 'Ключ API не загружен. Проверьте config.json и перезагрузите страницу.';
            } else if (error.message.includes('HTTP error') || error.message.includes('Gemini API Error')) {
                userMessage += `Ошибка сервера: ${error.message}`;
            } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                userMessage += 'Проблема с сетью. Проверьте ваше интернет-соединение.';
            } else if (error.message.includes('Неожиданная структура ответа')) {
                 userMessage += 'Получен некорректный ответ от сервера ИИ.';
            } else {
                userMessage += `Детали: ${error.message}`;
            }

            throw new Error(userMessage);
        }
    }
}

// Инициализация API при загрузке скрипта
try {
    if (!window.api) {
        // console.log('Создание экземпляра API...'); // Removed for cleaner logs
        window.api = new API();
        console.log('Экземпляр API создан и доступен как window.api'); // Keep this one
    } else {
        // console.log('Экземпляр API уже существует.'); // Removed for cleaner logs
    }
} catch (apiInitError) {
    console.error('КРИТИЧЕСКАЯ ОШИБКА при создании экземпляра API:', apiInitError);
    alert('Критическая ошибка при инициализации API: ' + apiInitError.message);
}
