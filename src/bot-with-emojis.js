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
    WAITING_FOR_STATE_DESCRIPTION: 'waiting_for_state',
    WAITING_FOR_CARD1_RESPONSE: 'waiting_for_card1',
    WAITING_FOR_CARD2_RESPONSE: 'waiting_for_card2',
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
        card1Data: null,
        card2Data: null,
        card3Data: null,
        card1Response: '',
        card2Response: '',
        card3Response: '',
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

// Генерация текста через OpenAI с GPT-4.1 и редактурой по Максиму Ильяхову
async function generateText(prompt, maxTokens = 500) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: [
                {
                    role: "system",
                    content: `Ты - профессиональный психолог, работающий с архетипами и метафорическими картами. Твоя задача - создавать глубокие, метафорические интерпретации состояний человека через архетипические образы. Отвечай на русском языке, используй профессиональный психологический язык.

ПРАВИЛА РЕДАКТУРЫ ПО МАКСИМУ ИЛЬЯХОВУ:
- Пиши ясно и понятно
- Избегай канцеляризмов и штампов
- Используй короткие предложения
- Говори прямо, без воды
- Один абзац = одна мысль
- Избегай слов-паразитов: "является", "осуществляется", "происходит"
- Используй активный залог вместо пассивного
- Конкретные примеры вместо общих фраз
- Простые слова вместо сложных терминов
- Эмоциональность и человечность в тексте`
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

// Генерация карты состояния (новый сценарий)
async function generateStateCard(stateDescription) {
    const prompt = `Ты — профессиональный психолог и работаешь с архетипами.
Сгенерируй метафорическую карту состояния пользователя по его слову/фразе.

Состояние: "${stateDescription}"

Создай:
1. Визуальное описание для генерации изображения (на английском, для DALL-E)
2. Описание состояния (2-3 предложения, простыми словами) с 1-3 эмодзи для передачи образа
3. Символы (2 пункта: объект → значение) с эмодзи

ВАЖНО: Пиши ясно и понятно, без канцеляризмов. Используй короткие предложения, говори прямо. Избегай слов-паразитов. Будь эмоциональным и человечным. Добавляй эмодзи там, где важно передать образ и эмоцию.

Для визуального описания используй этот стиль:
"A traditional oil painting on canvas, archetypal and metaphorical illustration. A symbolic scene in a foggy, mystical landscape with muted earthy colors. Visible brushstrokes, textured canvas. Composition emphasizes solitude, inner transformation, and psychological depth. The image should look like a future tarot-style card, with a central symbolic object. The atmosphere is calm, contemplative, slightly surreal, evoking a sense of inner journey."

Формат ответа:
VISUAL: [описание для генерации изображения в указанном стиле]
DESCRIPTION: [описание состояния 2-3 предложения с эмодзи]
SYMBOLS: [символы: объект → значение с эмодзи, каждый с новой строки]`;

    const response = await generateText(prompt);
    
    const visualMatch = response.match(/VISUAL:\s*(.+?)(?=DESCRIPTION:|$)/s);
    const descriptionMatch = response.match(/DESCRIPTION:\s*(.+?)(?=SYMBOLS:|$)/s);
    const symbolsMatch = response.match(/SYMBOLS:\s*(.+?)$/s);
    
    return {
        visualPrompt: visualMatch ? visualMatch[1].trim() : `Archetypal card representing ${stateDescription}`,
        description: descriptionMatch ? descriptionMatch[1].trim() : response,
        symbols: symbolsMatch ? symbolsMatch[1].trim() : '🌫️ Туман → неопределенность\n💔 Трещины → внутренние раны'
    };
}

// Генерация карты ресурса (новый сценарий)
async function generateResourceCard(stateDescription, card1Response) {
    const prompt = `Ты — психолог-проводник.
Сгенерируй карту-ресурс, которая помогает выйти из состояния.

Исходное состояние: "${stateDescription}"
Отклик пользователя на карту состояния: "${card1Response}"

Создай:
1. Визуальное описание для генерации изображения (на английском, для DALL-E)
2. Описание ресурса (2-3 предложения) с 1-3 эмодзи для передачи образа
3. Символы (2 пункта: объект → значение) с эмодзи

ВАЖНО: Пиши ясно и понятно, без канцеляризмов. Используй короткие предложения, говори прямо. Избегай слов-паразитов. Будь эмоциональным и человечным. Добавляй эмодзи там, где важно передать образ и эмоцию.

Для визуального описания используй этот стиль:
"Композиция:  
— фигура персонажа или символа по принципу кампазции,  
— фон атмосферный и слегка размытый (лес, море, звёздное небо, храм, жилище),  
— пропорции  естественные,  
— контуры  образные, но не фотографические.  

Смысл:  
— вся сцена должна передавать мифический и символический смысл,  
— архетип 
— атмосфера метафорическая, наполненная историей и символами, легко читаемая за секунду, с балансом простоты и глубины. 

Стиль: A traditional oil painting on canvas, archetypal and metaphorical illustration. A symbolic scene in a foggy, mystical landscape with muted earthy colors (grays, browns, pale greens). Visible brushstrokes, textured canvas. Composition emphasizes solitude, inner transformation, and psychological depth. The image should look like a tarot-style card, with a central symbolic object. The atmosphere is calm, contemplative, slightly surreal, evoking a sense of inner journey."

Формат ответа:
VISUAL: [описание для генерации изображения в указанном стиле]
DESCRIPTION: [описание ресурса 2-3 предложения с эмодзи]
SYMBOLS: [символы: объект → значение с эмодзи, каждый с новой строки]`;

    const response = await generateText(prompt);
    
    const visualMatch = response.match(/VISUAL:\s*(.+?)(?=DESCRIPTION:|$)/s);
    const descriptionMatch = response.match(/DESCRIPTION:\s*(.+?)(?=SYMBOLS:|$)/s);
    const symbolsMatch = response.match(/SYMBOLS:\s*(.+?)$/s);
    
    return {
        visualPrompt: visualMatch ? visualMatch[1].trim() : `Archetypal resource card for transition from ${stateDescription}`,
        description: descriptionMatch ? descriptionMatch[1].trim() : response,
        symbols: symbolsMatch ? symbolsMatch[1].trim() : '🌱 Росток → надежда и рост\n💎 Кристалл → внутренняя сила'
    };
}

// Генерация карты перехода + итог (новый сценарий)
async function generateTransitionCard(card1Data, card2Data, card1Response, card2Response) {
    const prompt = `Ты — психолог и архетипический рассказчик.
Сгенерируй карту перехода от состояния (карта 1) к ресурсу (карта 2).
Сделай короткий итог и дай 1 практическое действие.

Карта состояния: ${card1Data.description}
Отклик на карту состояния: "${card1Response}"

Карта ресурса: ${card2Data.description}
Отклик на карту ресурса: "${card2Response}"

Создай:
1. Визуальное описание для генерации изображения (на английском, для DALL-E)
2. Описание перехода (2-3 предложения) с 1-3 эмодзи для передачи образа
3. Символы (2 пункта: объект → значение) с эмодзи
4. Итог с ключевыми смыслами всех карт с эмодзи
5. Одно простое практическое действие с эмодзи

ВАЖНО: Пиши ясно и понятно, без канцеляризмов. Используй короткие предложения, говори прямо. Избегай слов-паразитов. Будь эмоциональным и человечным. Добавляй эмодзи там, где важно передать образ и эмоцию.

Для визуального описания используй этот стиль:
"A traditional oil painting on canvas, archetypal and metaphorical illustration. A symbolic scene in a foggy, mystical landscape with muted earthy colors (grays, browns, pale greens). Visible brushstrokes, textured canvas. Composition emphasizes solitude, inner transformation, and psychological depth. The image should look like a tarot-style card, with a central symbolic object. The atmosphere is calm, contemplative, slightly surreal, evoking a sense of inner journey."

Формат ответа:
VISUAL: [описание для генерации изображения в указанном стиле]
DESCRIPTION: [описание перехода 2-3 предложения с эмодзи]
SYMBOLS: [символы: объект → значение с эмодзи, каждый с новой строки]
SUMMARY: [итог с ключевыми смыслами всех карт с эмодзи]
PRACTICE: [одно простое действие с эмодзи]`;

    const response = await generateText(prompt, 800);
    
    const visualMatch = response.match(/VISUAL:\s*(.+?)(?=DESCRIPTION:|$)/s);
    const descriptionMatch = response.match(/DESCRIPTION:\s*(.+?)(?=SYMBOLS:|$)/s);
    const symbolsMatch = response.match(/SYMBOLS:\s*(.+?)(?=SUMMARY:|$)/s);
    const summaryMatch = response.match(/SUMMARY:\s*(.+?)(?=PRACTICE:|$)/s);
    const practiceMatch = response.match(/PRACTICE:\s*(.+?)$/s);
    
    return {
        visualPrompt: visualMatch ? visualMatch[1].trim() : `Archetypal transition card bridging two states`,
        description: descriptionMatch ? descriptionMatch[1].trim() : response,
        symbols: symbolsMatch ? symbolsMatch[1].trim() : '🌉 Мост → связь между состояниями\n🕯️ Свет → освещение пути',
        summary: summaryMatch ? summaryMatch[1].trim() : 'Ключевые смыслы карт',
        practice: practiceMatch ? practiceMatch[1].trim() : 'Сделай глубокий вдох и выдох'
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

С помощью метафорических карт мы вместе увидим, где ты находишься, и найдём ресурс для движения вперёд.  

Готов начать? ✨  
Напиши одним словом или фразой, как ты себя чувствуешь.`;
    
    await bot.sendMessage(chatId, welcomeMessage);
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
                session.stateDescription = text;
                session.state = DIALOG_STATES.WAITING_FOR_CARD1_RESPONSE;
                
                // Отправляем начальное сообщение о создании карты
                const initialMessage = await bot.sendMessage(chatId, `🔮 <b>Создаю твою карту состояния...</b>

Это может занять минуту, пожалуйста, подожди.`, { parse_mode: 'HTML' });
                
                // Генерация первой карты с прогрессом
                console.log('Генерирую первую карту...');
                await updateProgressMessage(chatId, initialMessage.message_id, 
                    `🔮 <b>Создаю твою карту состояния...</b>

📝 Анализирую твоё состояние "${session.stateDescription}"...`);
                
                const card1Data = await generateStateCard(session.stateDescription);
                session.card1Data = card1Data;
                console.log('Данные карты №1:', card1Data);
                
                await updateProgressMessage(chatId, initialMessage.message_id, 
                    `🔮 <b>Создаю твою карту состояния...</b>

📝 Анализирую твоё состояние "${session.stateDescription}"...
🎨 Генерирую визуальный образ...`);
                
                console.log('Генерирую изображение для карты №1...');
                const card1Image = await generateImage(card1Data.visualPrompt);
                console.log('URL изображения карты №1:', card1Image);
                
                await updateProgressMessage(chatId, initialMessage.message_id, 
                    `🔮 <b>Создаю твою карту состояния...</b>

📝 Анализирую твоё состояние "${session.stateDescription}"...
🎨 Генерирую визуальный образ...
📤 Отправляю карту...`);
                
                await sendImageFromUrl(chatId, card1Image, 
                    `🜃 <b>Карта №1 — Состояние</b>

${card1Data.description}

${card1Data.symbols}

<b>Что в этой карте ближе всего тебе сейчас?</b>`);
                
                // Удаляем прогресс-сообщение
                try {
                    await bot.deleteMessage(chatId, initialMessage.message_id);
                } catch (error) {
                    console.log('Не удалось удалить прогресс-сообщение');
                }
                break;
                
            case DIALOG_STATES.WAITING_FOR_CARD1_RESPONSE:
                session.card1Response = text;
                
                // Отправляем сообщение о создании второй карты
                const card2Message = await bot.sendMessage(chatId, `🌱 <b>Создаю карту ресурса...</b>

⏳ Пожалуйста, подожди...`, { parse_mode: 'HTML' });
                
                // Генерация второй карты с прогрессом
                console.log('Генерирую вторую карту...');
                await updateProgressMessage(chatId, card2Message.message_id, 
                    `🌱 <b>Создаю карту ресурса...</b>

📝 Анализирую ресурсы для перехода из "${session.stateDescription}"...`);
                
                const card2Data = await generateResourceCard(session.stateDescription, session.card1Response);
                session.card2Data = card2Data;
                console.log('Данные карты №2:', card2Data);
                
                await updateProgressMessage(chatId, card2Message.message_id, 
                    `🌱 <b>Создаю карту ресурса...</b>

📝 Анализирую ресурсы для перехода из "${session.stateDescription}"...
🎨 Генерирую визуальный образ...`);
                
                console.log('Генерирую изображение для карты №2...');
                const card2Image = await generateImage(card2Data.visualPrompt);
                console.log('URL изображения карты №2:', card2Image);
                
                await updateProgressMessage(chatId, card2Message.message_id, 
                    `🌱 <b>Создаю карту ресурса...</b>

📝 Анализирую ресурсы для перехода из "${session.stateDescription}"...
🎨 Генерирую визуальный образ...
📤 Отправляю карту...`);
                
                await sendImageFromUrl(chatId, card2Image, 
                    `🜁 <b>Карта №2 — Ресурс</b>

${card2Data.description}

${card2Data.symbols}

<b>Что этот символ может значить в твоей жизни прямо сейчас?</b>`);
                
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
                
                // Отправляем сообщение о создании третьей карты
                const card3Message = await bot.sendMessage(chatId, `🌉 <b>Создаю карту перехода...</b>

⏳ Пожалуйста, подожди...`, { parse_mode: 'HTML' });
                
                // Генерация третьей карты с прогрессом
                console.log('Генерирую третью карту...');
                await updateProgressMessage(chatId, card3Message.message_id, 
                    `🌉 <b>Создаю карту перехода...</b>

📝 Анализирую связь между картами...`);
                
                const card3Data = await generateTransitionCard(
                    session.card1Data, 
                    session.card2Data, 
                    session.card1Response, 
                    session.card2Response
                );
                session.card3Data = card3Data;
                console.log('Данные карты №3:', card3Data);
                
                await updateProgressMessage(chatId, card3Message.message_id, 
                    `🌉 <b>Создаю карту перехода...</b>

📝 Анализирую связь между картами...
🎨 Генерирую визуальный образ...`);
                
                console.log('Генерирую изображение для карты №3...');
                const card3Image = await generateImage(card3Data.visualPrompt);
                console.log('URL изображения карты №3:', card3Image);
                
                await updateProgressMessage(chatId, card3Message.message_id, 
                    `🌉 <b>Создаю карту перехода...</b>

📝 Анализирую связь между картами...
🎨 Генерирую визуальный образ...
📤 Отправляю карту...`);
                
                await sendImageFromUrl(chatId, card3Image, 
                    `🜂 <b>Карта №3 — Переход</b>

${card3Data.description}

${card3Data.symbols}

<b>Что может быть таким мостом для тебя прямо сейчас?</b>`);
                
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
                
                // Отправляем финальное сообщение с итогом
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
                
                // Отправляем итоговый анализ
                const summary = `✨ <b>Итог:</b>

🜃 <b>Карта №1 — Состояние:</b> ${session.card1Data.description}  
🜁 <b>Карта №2 — Ресурс:</b> ${session.card2Data.description}  
🜂 <b>Карта №3 — Переход:</b> ${session.card3Data.description}  

${session.card3Data.summary}

<b>Практика:</b> ${session.card3Data.practice}

Береги себя. Если чувствуешь, что нужен человек рядом — можно обратиться к психотерапевту.`;
                
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

Напиши одним словом или фразой, как ты себя чувствуешь.`);
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
        if (data === 'new_session') {
            initUserSession(userId);
            await bot.sendMessage(chatId, `Отлично! Начинаем новую сессию. 

Напиши одним словом или фразой, как ты себя чувствуешь.`);
        }
    } catch (error) {
        console.error('Ошибка обработки callback:', error);
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
console.log('🤖 Telegram-бот "Архетипические карты" запущен с новым сценарием!');
console.log('🔧 Функции: GPT-4.1, правила редактуры Максима Ильяхова, упрощенный сценарий, inline-кнопки');
console.log('📋 Убедитесь, что в .env файле указаны:');
console.log('   - TELEGRAM_BOT_TOKEN');
console.log('   - OPENAI_API_KEY');
