const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// Инициализация бота
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN не найден в переменных окружения');
    process.exit(1);
}

const bot = new TelegramBot(token, { 
    polling: {
        interval: 1000,
        autoStart: true,
        params: {
            timeout: 10
        }
    }
});

// Инициализация OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Состояния пользователей
const userSessions = new Map();

// Состояния диалога
const DIALOG_STATES = {
    IDLE: 'idle',
    WAITING_FOR_READINESS: 'waiting_for_readiness',
    WAITING_FOR_STATE_DESCRIPTION: 'waiting_for_state',
    WAITING_FOR_METAPHOR: 'waiting_for_metaphor',
    WAITING_FOR_CARD1_RESPONSE: 'waiting_for_card1',
    WAITING_FOR_CARD2_RESPONSE: 'waiting_for_card2',
    WAITING_FOR_PSYCHOLOGICAL_ANALYSIS: 'waiting_for_analysis',
    WAITING_FOR_CARD3_RESPONSE: 'waiting_for_card3',
    COMPLETED: 'completed'
};

// Функция для обрезки текста до лимита Telegram (1024 символа)
function truncateCaption(text, maxLength = 1000) {
    if (text.length <= maxLength) return text;
    
    const truncated = text.substring(0, maxLength);
    const lastParagraph = truncated.lastIndexOf('\n\n');
    
    if (lastParagraph > maxLength * 0.7) {
        return truncated.substring(0, lastParagraph) + '\n\n...';
    }
    
    return truncated + '...';
}

// Функция для отправки индикатора типизации
async function sendTyping(chatId) {
    try {
        await bot.sendChatAction(chatId, 'typing');
    } catch (error) {
        // Игнорируем ошибки типизации
    }
}

// Функция для отправки прогресс-сообщений
async function sendProgressMessage(chatId, message, delay = 1000) {
    await sendTyping(chatId);
    await new Promise(resolve => setTimeout(resolve, delay));
    return await bot.sendMessage(chatId, message);
}

// Функция для обновления прогресс-сообщения
async function updateProgressMessage(chatId, messageId, newText) {
    try {
        await bot.editMessageText(newText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML'
        });
    } catch (error) {
        // Если не удалось обновить, отправляем новое сообщение
        console.log('Не удалось обновить сообщение, отправляю новое');
        return await bot.sendMessage(chatId, newText, { parse_mode: 'HTML' });
    }
}

// Инициализация сессии пользователя
function initUserSession(userId) {
    userSessions.set(userId, {
        state: DIALOG_STATES.IDLE,
        stateDescription: '',
        metaphor: '',
        card1Data: null,
        card2Data: null,
        card3Data: null,
        card1Response: '',
        card2Response: '',
        card3Response: '',
        psychologicalAnalysis: '',
        recommendations: '',
        lastActivity: Date.now()
    });
}

// Получение сессии пользователя
function getUserSession(userId) {
    if (!userSessions.has(userId)) {
        initUserSession(userId);
    }
    return userSessions.get(userId);
}

// Генерация текста через OpenAI
async function generateText(prompt, maxTokens = 500) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "Ты - профессиональный психолог, работающий с архетипами и метафорическими картами. Твоя задача - создавать глубокие, метафорические интерпретации состояний человека через архетипические образы. Отвечай на русском языке, используй профессиональный психологический язык."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: maxTokens,
            temperature: 0.8
        });
        
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Ошибка генерации текста:', error);
        throw new Error('Не удалось сгенерировать текст');
    }
}

// Генерация изображения через OpenAI
async function generateImage(prompt) {
    try {
        console.log('Отправляю запрос в DALL-E с промптом:', prompt);
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            size: "1024x1024",
            quality: "standard",
            n: 1
        });
        
        console.log('Получен ответ от DALL-E:', response.data[0]);
        return response.data[0].url;
    } catch (error) {
        console.error('Ошибка генерации изображения:', error);
        console.error('Детали ошибки:', error.response?.data || error.message);
        throw new Error('Не удалось сгенерировать изображение');
    }
}

// Генерация карты состояния (улучшенная)
async function generateStateCard(stateDescription, metaphor) {
    const prompt = `Ты — профессиональный психолог, работающий с архетипами и метафорическими картами.
Сгенерируй метафорическое описание состояния пользователя по его запросу.

Состояние: "${stateDescription}"
Метафора: "${metaphor}"

Создай:
1. Визуальное описание для генерации изображения (на английском, для DALL-E)
2. Краткое и понятное описание сути метафоры (2-3 предложения)
3. Список символов (2-3 пункта: объект → что он значит)

Формат ответа:
VISUAL: [описание для генерации изображения]
DESCRIPTION: [описание состояния 2-3 предложения]
SYMBOLS: [символы: объект → значение, каждый с новой строки]`;

    const response = await generateText(prompt);
    
    const visualMatch = response.match(/VISUAL:\s*(.+?)(?=DESCRIPTION:|$)/s);
    const descriptionMatch = response.match(/DESCRIPTION:\s*(.+?)(?=SYMBOLS:|$)/s);
    const symbolsMatch = response.match(/SYMBOLS:\s*(.+?)$/s);
    
    return {
        visualPrompt: visualMatch ? visualMatch[1].trim() : `Archetypal card representing ${stateDescription} in ${metaphor}`,
        description: descriptionMatch ? descriptionMatch[1].trim() : response,
        symbols: symbolsMatch ? symbolsMatch[1].trim() : '🌫️ Туман → неопределенность\n💔 Трещины → внутренние раны\n🌊 Волны → эмоциональные переживания'
    };
}

// Генерация карты ресурса (улучшенная)
async function generateResourceCard(stateDescription, metaphor, card1Response) {
    const prompt = `Ты — профессиональный психолог, работающий с архетипами и метафорическими картами.
На основе предыдущего ответа пользователя сгенерируй карту-ресурс, которая помогает выйти из состояния.

Исходное состояние: "${stateDescription}"
Метафора: "${metaphor}"
Отклик пользователя на карту состояния: "${card1Response}"

Создай:
1. Визуальное описание для генерации изображения (на английском, для DALL-E)
2. Описание ресурса (2-3 предложения)
3. Список символов (2-3 пункта: объект → значение)

Формат ответа:
VISUAL: [описание для генерации изображения]
DESCRIPTION: [описание ресурса 2-3 предложения]
SYMBOLS: [символы: объект → значение, каждый с новой строки]`;

    const response = await generateText(prompt);
    
    const visualMatch = response.match(/VISUAL:\s*(.+?)(?=DESCRIPTION:|$)/s);
    const descriptionMatch = response.match(/DESCRIPTION:\s*(.+?)(?=SYMBOLS:|$)/s);
    const symbolsMatch = response.match(/SYMBOLS:\s*(.+?)$/s);
    
    return {
        visualPrompt: visualMatch ? visualMatch[1].trim() : `Archetypal resource card for transition from ${stateDescription}`,
        description: descriptionMatch ? descriptionMatch[1].trim() : response,
        symbols: symbolsMatch ? symbolsMatch[1].trim() : '🌱 Росток → надежда и рост\n💎 Кристалл → внутренняя сила\n🌟 Звезда → путеводный свет'
    };
}

// Генерация карты перехода (улучшенная)
async function generateTransitionCard(card1Data, card2Data, card1Response, card2Response) {
    const prompt = `Ты — профессиональный психолог, работающий с архетипами и метафорическими картами.
Сгенерируй метафорическую карту перехода от состояния к ресурсу.

Карта состояния: ${card1Data.description}
Отклик пользователя: "${card1Response}"

Карта ресурса: ${card2Data.description}
Отклик пользователя: "${card2Response}"

Создай:
1. Визуальное описание для генерации изображения (на английском, для DALL-E)
2. Описание перехода (2-3 предложения)
3. Список символов моста (2-3 пункта: объект → значение)

Формат ответа:
VISUAL: [описание для генерации изображения]
DESCRIPTION: [описание перехода 2-3 предложения]
SYMBOLS: [символы моста: объект → значение, каждый с новой строки]`;

    const response = await generateText(prompt);
    
    const visualMatch = response.match(/VISUAL:\s*(.+?)(?=DESCRIPTION:|$)/s);
    const descriptionMatch = response.match(/DESCRIPTION:\s*(.+?)(?=SYMBOLS:|$)/s);
    const symbolsMatch = response.match(/SYMBOLS:\s*(.+?)$/s);
    
    return {
        visualPrompt: visualMatch ? visualMatch[1].trim() : `Archetypal transition card bridging two states`,
        description: descriptionMatch ? descriptionMatch[1].trim() : response,
        symbols: symbolsMatch ? symbolsMatch[1].trim() : '🌉 Мост → связь между состояниями\n🕯️ Свет → освещение пути\n👣 Следы → шаги к изменению'
    };
}

// Психологический анализ (улучшенный)
async function generatePsychologicalAnalysis(card1Data, card2Data, card1Response, card2Response) {
    const prompt = `Ты — профессиональный психолог, работающий с юнгианской и аналитической психологией.
Сделай короткий итог анализа карт 1 и 2, учитывая ответы пользователя.

Карта состояния: ${card1Data.description}
Отклик пользователя: "${card1Response}"

Карта ресурса: ${card2Data.description}
Отклик пользователя: "${card2Response}"

Создай:
1. 2-3 абзаца по 2 предложения
2. Свяжи символы состояния и ресурса в единую историю
3. Дай 5 практических рекомендаций из КПТ и при необходимости других направлений

Формат ответа:
ANALYSIS: [психологический анализ связки]
RECOMMENDATIONS: [5 практических рекомендаций, каждая с новой строки]`;

    const response = await generateText(prompt, 800);
    
    const analysisMatch = response.match(/ANALYSIS:\s*(.+?)(?=RECOMMENDATIONS:|$)/s);
    const recommendationsMatch = response.match(/RECOMMENDATIONS:\s*(.+?)$/s);
    
    return {
        analysis: analysisMatch ? analysisMatch[1].trim() : response,
        recommendations: recommendationsMatch ? recommendationsMatch[1].trim() : '1. Практикуйте осознанное дыхание\n2. Ведите дневник эмоций\n3. Используйте техники заземления\n4. Планируйте маленькие достижения\n5. Обращайтесь за поддержкой'
    };
}

// Итоговый анализ сессии
async function generateSessionSummary(card1Data, card2Data, card3Data, allResponses) {
    const prompt = `Ты — профессиональный психолог, работающий с архетипами и метафорическими картами.
Составь итог сессии.

Карта состояния: ${card1Data.description}
Карта ресурса: ${card2Data.description}
Карта перехода: ${card3Data.description}

Отклики пользователя: ${allResponses.join(', ')}

Создай:
1. Краткие ключевые смыслы для каждой карты
2. 5 практических рекомендаций из КПТ и других подходов
3. Заключение с упоминанием возможности обращения к психотерапевту

Формат ответа:
SUMMARY: [итог сессии с ключевыми смыслами]
RECOMMENDATIONS: [5 практических рекомендаций, каждая с новой строки]
CONCLUSION: [заключение]`;

    const response = await generateText(prompt, 600);
    
    const summaryMatch = response.match(/SUMMARY:\s*(.+?)(?=RECOMMENDATIONS:|$)/s);
    const recommendationsMatch = response.match(/RECOMMENDATIONS:\s*(.+?)(?=CONCLUSION:|$)/s);
    const conclusionMatch = response.match(/CONCLUSION:\s*(.+?)$/s);
    
    return {
        summary: summaryMatch ? summaryMatch[1].trim() : response,
        recommendations: recommendationsMatch ? recommendationsMatch[1].trim() : '1. Практикуйте осознанное дыхание\n2. Ведите дневник эмоций\n3. Используйте техники заземления\n4. Планируйте маленькие достижения\n5. Обращайтесь за поддержкой',
        conclusion: conclusionMatch ? conclusionMatch[1].trim() : 'Береги себя. Если почувствуешь, что ресурсов недостаточно — всегда можно обратиться к психотерапевту: https://yasno.live/'
    };
}

// Отправка изображения по URL
async function sendImageFromUrl(chatId, imageUrl, caption) {
    try {
        console.log('Скачиваю изображение с URL:', imageUrl);
        
        const response = await axios({
            method: 'GET',
            url: imageUrl,
            responseType: 'stream',
            timeout: 30000
        });
        
        const tempPath = path.join(__dirname, '..', 'temp', `image_${Date.now()}.png`);
        const tempDir = path.dirname(tempPath);
        
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const writer = fs.createWriteStream(tempPath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout при скачивании изображения'));
            }, 30000);
            
            writer.on('finish', async () => {
                clearTimeout(timeout);
                try {
                    console.log('Отправляю изображение в Telegram...');
                    
                    const shortCaption = truncateCaption(caption);
                    
                    await bot.sendPhoto(chatId, tempPath, { 
                        caption: shortCaption, 
                        parse_mode: 'HTML' 
                    });
                    
                    if (shortCaption !== caption) {
                        await bot.sendMessage(chatId, `📝 Полная интерпретация:\n\n${caption}`, {
                            parse_mode: 'HTML'
                        });
                    }
                    
                    fs.unlinkSync(tempPath);
                    console.log('Изображение успешно отправлено');
                    resolve();
                } catch (error) {
                    console.error('Ошибка отправки изображения:', error);
                    if (fs.existsSync(tempPath)) {
                        fs.unlinkSync(tempPath);
                    }
                    reject(error);
                }
            });
            
            writer.on('error', (error) => {
                clearTimeout(timeout);
                console.error('Ошибка сохранения изображения:', error);
                reject(error);
            });
        });
        
    } catch (error) {
        console.error('Ошибка обработки изображения:', error);
        await bot.sendMessage(chatId, `🖼️ Изображение карты:\n\n${caption}`);
    }
}

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    console.log(`Пользователь ${userId} начал сессию`);
    
    initUserSession(userId);
    
    const welcomeMessage = `Привет 👋  
Я твой проводник в мире психологических состояний.  

С помощью психоанализа и метафорических карт мы вместе найдём ресурс для тебя и твоего сознания.  

✨ Нажми "Готов", чтобы начать трансформацию.  
✨ Нажми "Подумаю", если хочешь взять паузу.`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '✨ Готов', callback_data: 'ready' },
                { text: '🤔 Подумаю', callback_data: 'think' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, welcomeMessage, { reply_markup: keyboard });
});

// Обработка callback-запросов (нажатие кнопок)
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    
    console.log(`Пользователь ${userId} нажал кнопку: ${data}`);
    
    // Подтверждаем получение callback
    await bot.answerCallbackQuery(callbackQuery.id);
    
    const session = getUserSession(userId);
    
    try {
        if (data === 'ready') {
            session.state = DIALOG_STATES.WAITING_FOR_STATE_DESCRIPTION;
            await bot.sendMessage(chatId, `Ты сделал первый шаг поздравляю! 
Для начала опиши кратко — Что ты сейчас чувствуешь?  Какой у тебя запрос?   
Например: "я потерял путь", "я устал", "чувствую злость", "мне тревожно", "я боюсь".`);
        } else if (data === 'think') {
            await bot.sendMessage(chatId, `Понятно. Когда будешь готов, просто напиши "Готов" или используй /start для начала заново.`);
        } else if (data === 'new_session') {
            initUserSession(userId);
            await bot.sendMessage(chatId, `Отлично! Начинаем новую сессию. 

Опиши своё текущее состояние одним-двумя словами или короткой фразой.`);
        }
    } catch (error) {
        console.error('Ошибка обработки callback:', error);
        await bot.sendMessage(chatId, `Произошла ошибка при обработке твоего запроса. Попробуй еще раз или используй /start для начала заново.`);
    }
});

// Обработка всех текстовых сообщений
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    
    if (!text || text.startsWith('/')) return;
    
    const session = getUserSession(userId);
    console.log(`Пользователь ${userId}, состояние: ${session.state}, сообщение: ${text}`);
    
    try {
        switch (session.state) {
            case DIALOG_STATES.IDLE:
                if (text.toLowerCase().includes('готов')) {
                    session.state = DIALOG_STATES.WAITING_FOR_STATE_DESCRIPTION;
                    await bot.sendMessage(chatId, `Ты сделал первый шаг — поздравляю! 
Для начала опиши кратко — Что ты сейчас чувствуешь?  Какой у тебя запрос?   
Например: "я потерял путь", "я устал", "чувствую злость", "мне тревожно", "я боюсь".`);
                } else if (text.toLowerCase().includes('подумаю')) {
                    await bot.sendMessage(chatId, `Понятно. Когда будешь готов, просто напиши "Готов" или используй /start для начала заново.`);
                } else {
                    await bot.sendMessage(chatId, `Пожалуйста, напиши "Готов" или "Подумаю".`);
                }
                break;
                
            case DIALOG_STATES.WAITING_FOR_STATE_DESCRIPTION:
                session.stateDescription = text;
                session.state = DIALOG_STATES.WAITING_FOR_METAPHOR;
                
                await bot.sendMessage(chatId, `Понял, ты чувствуешь "${text}". 

Если бы это состояние было местом или объектом — что бы это было?  
Камень, лес, пустыня, море, туман, дождь?  
Какой он по форме: твёрдый, мягкий, тягучий, холодный?  

Можно описать подробно, а можно коротко.`);
                break;
                
            case DIALOG_STATES.WAITING_FOR_METAPHOR:
                session.metaphor = text;
                
                // Отправляем начальное сообщение о создании карт
                const initialMessage = await bot.sendMessage(chatId, `🔮 <b>Создаю твои архетипические карты...</b>

Это может занять минуту, пожалуйста, подожди.`, { parse_mode: 'HTML' });
                
                // Генерация первой карты с прогрессом
                console.log('Генерирую первую карту...');
                await updateProgressMessage(chatId, initialMessage.message_id, 
                    `🔮 <b>Создаю твои архетипические карты...</b>

📝 Анализирую твоё состояние "${session.stateDescription}" в образе "${session.metaphor}"...`);
                
                const card1Data = await generateStateCard(session.stateDescription, session.metaphor);
                session.card1Data = card1Data;
                console.log('Данные карты №1:', card1Data);
                
                await updateProgressMessage(chatId, initialMessage.message_id, 
                    `🔮 <b>Создаю твои архетипические карты...</b>

📝 Анализирую твоё состояние "${session.stateDescription}" в образе "${session.metaphor}"...
🎨 Генерирую визуальный образ для карты состояния...`);
                
                console.log('Генерирую изображение для карты №1...');
                const card1Image = await generateImage(card1Data.visualPrompt);
                console.log('URL изображения карты №1:', card1Image);
                
                await updateProgressMessage(chatId, initialMessage.message_id, 
                    `🔮 <b>Создаю твои архетипические карты...</b>

📝 Анализирую твоё состояние "${session.stateDescription}" в образе "${session.metaphor}"...
🎨 Генерирую визуальный образ для карты состояния...
📤 Отправляю первую карту...`);
                
                await sendImageFromUrl(chatId, card1Image, 
                    `🜃 <b>Карта №1 — Состояние</b>

${card1Data.description}

${card1Data.symbols}

<b>Что ты чувствуешь? Что в этой карте откликается тебе сильнее всего?</b>`);
                
                // Удаляем прогресс-сообщение
                try {
                    await bot.deleteMessage(chatId, initialMessage.message_id);
                } catch (error) {
                    console.log('Не удалось удалить прогресс-сообщение');
                }
                
                session.state = DIALOG_STATES.WAITING_FOR_CARD1_RESPONSE;
                break;
                
            case DIALOG_STATES.WAITING_FOR_CARD1_RESPONSE:
                session.card1Response = text;
                
                // Отправляем сообщение о создании второй карты
                const card2Message = await bot.sendMessage(chatId, `🌱 <b>Создаю вторую карту — ресурс для перехода...</b>

⏳ Пожалуйста, подожди...`, { parse_mode: 'HTML' });
                
                // Генерация второй карты с прогрессом
                console.log('Генерирую вторую карту...');
                await updateProgressMessage(chatId, card2Message.message_id, 
                    `🌱 <b>Создаю вторую карту — ресурс для перехода...</b>

📝 Анализирую ресурсы для перехода из "${session.stateDescription}"...`);
                
                const card2Data = await generateResourceCard(session.stateDescription, session.metaphor, session.card1Response);
                session.card2Data = card2Data;
                console.log('Данные карты №2:', card2Data);
                
                await updateProgressMessage(chatId, card2Message.message_id, 
                    `🌱 <b>Создаю вторую карту — ресурс для перехода...</b>

📝 Анализирую ресурсы для перехода из "${session.stateDescription}"...
🎨 Генерирую визуальный образ для карты ресурса...`);
                
                console.log('Генерирую изображение для карты №2...');
                const card2Image = await generateImage(card2Data.visualPrompt);
                console.log('URL изображения карты №2:', card2Image);
                
                await updateProgressMessage(chatId, card2Message.message_id, 
                    `🌱 <b>Создаю вторую карту — ресурс для перехода...</b>

📝 Анализирую ресурсы для перехода из "${session.stateDescription}"...
🎨 Генерирую визуальный образ для карты ресурса...
📤 Отправляю вторую карту...`);
                
                await sendImageFromUrl(chatId, card2Image, 
                    `🜁 <b>Карта №2 — Ресурс</b>

${card2Data.description}

${card2Data.symbols}

<b>Какие чувства вызывают образы на карте? Что это может значить в твоей жизни?</b>`);
                
                // Удаляем прогресс-сообщение
                try {
                    await bot.deleteMessage(chatId, card2Message.message_id);
                } catch (error) {
                    console.log('Не удалось удалить прогресс-сообщение');
                }
                
                session.state = DIALOG_STATES.WAITING_FOR_CARD2_RESPONSE;
                break;
                
            case DIALOG_STATES.WAITING_FOR_CARD2_RESPONSE:
                session.card2Response = text;
                
                // Отправляем сообщение о психологическом анализе
                const analysisMessage = await bot.sendMessage(chatId, `🧠 <b>Провожу психологический анализ...</b>

📊 Анализирую твои ответы и создаю связку между картами...
⏳ Это может занять несколько секунд...`, { parse_mode: 'HTML' });
                
                // Генерация психологического анализа
                console.log('Генерирую психологический анализ...');
                const analysisData = await generatePsychologicalAnalysis(
                    session.card1Data, 
                    session.card2Data, 
                    session.card1Response, 
                    session.card2Response
                );
                session.psychologicalAnalysis = analysisData.analysis;
                session.recommendations = analysisData.recommendations;
                
                // Удаляем прогресс-сообщение
                try {
                    await bot.deleteMessage(chatId, analysisMessage.message_id);
                } catch (error) {
                    console.log('Не удалось удалить прогресс-сообщение');
                }
                
                await bot.sendMessage(chatId, `📊 <b>Психологический анализ</b>

${analysisData.analysis}

💡 <b>Практические рекомендации:</b>
${analysisData.recommendations}`, { parse_mode: 'HTML' });
                
                session.state = DIALOG_STATES.WAITING_FOR_PSYCHOLOGICAL_ANALYSIS;
                
                // Отправляем сообщение о создании третьей карты
                const card3Message = await bot.sendMessage(chatId, `🌉 <b>Создаю третью карту — мост между состояниями...</b>

⏳ Пожалуйста, подожди...`, { parse_mode: 'HTML' });
                
                // Генерация третьей карты с прогрессом
                console.log('Генерирую третью карту...');
                await updateProgressMessage(chatId, card3Message.message_id, 
                    `🌉 <b>Создаю третью карту — мост между состояниями...</b>

📝 Анализирую связь между картой состояния и картой ресурса...`);
                
                const card3Data = await generateTransitionCard(
                    session.card1Data, 
                    session.card2Data, 
                    session.card1Response, 
                    session.card2Response
                );
                session.card3Data = card3Data;
                console.log('Данные карты №3:', card3Data);
                
                await updateProgressMessage(chatId, card3Message.message_id, 
                    `🌉 <b>Создаю третью карту — мост между состояниями...</b>

📝 Анализирую связь между картой состояния и картой ресурса...
🎨 Генерирую визуальный образ моста-перехода...`);
                
                console.log('Генерирую изображение для карты №3...');
                const card3Image = await generateImage(card3Data.visualPrompt);
                console.log('URL изображения карты №3:', card3Image);
                
                await updateProgressMessage(chatId, card3Message.message_id, 
                    `🌉 <b>Создаю третью карту — мост между состояниями...</b>

📝 Анализирую связь между картой состояния и картой ресурса...
🎨 Генерирую визуальный образ моста-перехода...
📤 Отправляю третью карту...`);
                
                await sendImageFromUrl(chatId, card3Image, 
                    `🜂 <b>Карта №3 — Переход</b>

${card3Data.description}

${card3Data.symbols}

<b>Что может быть таким мостом в твоей жизни прямо сейчас?</b>`);
                
                // Удаляем прогресс-сообщение
                try {
                    await bot.deleteMessage(chatId, card3Message.message_id);
                } catch (error) {
                    console.log('Не удалось удалить прогресс-сообщение');
                }
                
                session.state = DIALOG_STATES.WAITING_FOR_CARD3_RESPONSE;
                break;
                
            case DIALOG_STATES.WAITING_FOR_CARD3_RESPONSE:
                session.card3Response = text;
                
                // Отправляем финальное сообщение с прогрессом
                const finalMessage = await bot.sendMessage(chatId, `✨ <b>Создаю итоговый анализ...</b>

📋 Формирую полную картину твоего пути...
⏳ Почти готово...`, { parse_mode: 'HTML' });
                
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                // Удаляем прогресс-сообщение
                try {
                    await bot.deleteMessage(chatId, finalMessage.message_id);
                } catch (error) {
                    console.log('Не удалось удалить прогресс-сообщение');
                }
                
                // Генерация итогового анализа
                console.log('Генерирую итоговый анализ...');
                const sessionSummary = await generateSessionSummary(
                    session.card1Data, 
                    session.card2Data, 
                    session.card3Data, 
                    [session.card1Response, session.card2Response, session.card3Response]
                );
                
                const summary = `${sessionSummary.summary}

🜃 <b>Карта №1 — Состояние:</b> ${session.card1Data.description}  
🜁 <b>Карта №2 — Ресурс:</b> ${session.card2Data.description}  
🜂 <b>Карта №3 — Переход:</b> ${session.card3Data.description}  

<b>Практические рекомендации:</b>
${sessionSummary.recommendations}

${sessionSummary.conclusion}`;
                
                // Добавляем кнопку для новой сессии
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '🔄 Новая сессия', callback_data: 'new_session' }
                        ]
                    ]
                };
                
                await bot.sendMessage(chatId, summary, { parse_mode: 'HTML', reply_markup: keyboard });
                session.state = DIALOG_STATES.COMPLETED;
                break;
                
            case DIALOG_STATES.COMPLETED:
                if (text.toLowerCase().includes('новая') || text.toLowerCase().includes('еще') || text.toLowerCase().includes('готов')) {
                    initUserSession(userId);
                    await bot.sendMessage(chatId, `Отлично! Начинаем новую сессию. 

Опиши своё текущее состояние одним-двумя словами или короткой фразой.`);
                } else {
                    await bot.sendMessage(chatId, `Напиши "новая карта" или "готов" для следующей сессии или используй /start для начала заново.`);
                }
                break;
        }
    } catch (error) {
        console.error('Ошибка обработки сообщения:', error);
        await bot.sendMessage(chatId, `Произошла ошибка при обработке твоего запроса. Попробуй еще раз или используй /start для начала заново.`);
    }
});

// Обработка ошибок
bot.on('error', (error) => {
    console.error('Ошибка бота:', error);
});

bot.on('polling_error', (error) => {
    console.error('Ошибка polling:', error);
});

// Автоматическая очистка старых сессий каждые 10 минут
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [userId, session] of userSessions.entries()) {
        if (session.lastActivity && (now - session.lastActivity) > 600000) { // 10 минут
            userSessions.delete(userId);
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        console.log(`🧹 Очищено ${cleaned} старых сессий`);
    }
}, 600000);

// Периодическая очистка временных файлов
setInterval(() => {
    const tempDir = path.join(__dirname, '..', 'temp');
    if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        const now = Date.now();
        
        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            const stats = fs.statSync(filePath);
            
            // Удаляем файлы старше 1 часа
            if (now - stats.mtime.getTime() > 3600000) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Удален старый временный файл: ${file}`);
            }
        });
    }
}, 300000); // каждые 5 минут

// Запуск бота
console.log('🤖 Telegram-бот "Архетипические карты" запущен с кнопками!');
console.log('🔧 Функции: inline-кнопки, профессиональные промпты, улучшенный UX');
console.log('📋 Убедитесь, что в .env файле указаны:');
console.log('   - TELEGRAM_BOT_TOKEN');
console.log('   - OPENAI_API_KEY');
