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
    WAITING_FOR_METAPHOR: 'waiting_for_metaphor',
    WAITING_FOR_CARD1_RESPONSE: 'waiting_for_card1',
    WAITING_FOR_CARD2_RESPONSE: 'waiting_for_card2',
    WAITING_FOR_PSYCHOLOGICAL_ANALYSIS: 'waiting_for_analysis',
    WAITING_FOR_CARD3_RESPONSE: 'waiting_for_card3',
    WAITING_FOR_MEANING_CARD: 'waiting_for_meaning',
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
        meaningCardData: null,
        card1Response: '',
        card2Response: '',
        card3Response: '',
        meaningResponse: '',
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
                    content: "Ты - мудрый психолог и специалист по архетипам. Твоя задача - создавать глубокие, метафорические интерпретации состояний человека через архетипические образы. Отвечай на русском языке, используй поэтический и образный язык."
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

// Генерация карты состояния (оптимизированная)
async function generateStateCard(stateDescription, metaphor) {
    const prompt = `Ты — архетипический рассказчик и UX-редактор.
Сгенерируй метафорическое описание состояния пользователя.

Состояние: "${stateDescription}"
Метафора: "${metaphor}"

Создай:
1. Визуальное описание для генерации изображения (на английском, для DALL-E)
2. Краткое описание состояния (2-3 предложения)
3. Список символов (2-3 пункта со смайлами)

Формат ответа:
VISUAL: [описание для генерации изображения]
DESCRIPTION: [описание состояния 2-3 предложения]
SYMBOLS: [символы со смайлами, каждый с новой строки]`;

    const response = await generateText(prompt);
    
    const visualMatch = response.match(/VISUAL:\s*(.+?)(?=DESCRIPTION:|$)/s);
    const descriptionMatch = response.match(/DESCRIPTION:\s*(.+?)(?=SYMBOLS:|$)/s);
    const symbolsMatch = response.match(/SYMBOLS:\s*(.+?)$/s);
    
    return {
        visualPrompt: visualMatch ? visualMatch[1].trim() : `Archetypal card representing ${stateDescription} in ${metaphor}`,
        description: descriptionMatch ? descriptionMatch[1].trim() : response,
        symbols: symbolsMatch ? symbolsMatch[1].trim() : '🌫️ Туман неопределенности\n💔 Трещины в душе\n🌊 Волны эмоций'
    };
}

// Генерация карты ресурса (оптимизированная)
async function generateResourceCard(stateDescription, metaphor) {
    const prompt = `Ты — психолог-проводник и архетипический рассказчик.
Сгенерируй карту-ресурс для пользователя, которая помогает ему выйти из состояния.

Исходное состояние: "${stateDescription}"
Метафора: "${metaphor}"

Создай:
1. Визуальное описание для генерации изображения (на английском, для DALL-E)
2. Краткое описание ресурса (2-3 предложения)
3. Список символов (2-3 пункта со смайлами)

Формат ответа:
VISUAL: [описание для генерации изображения]
DESCRIPTION: [описание ресурса 2-3 предложения]
SYMBOLS: [символы со смайлами, каждый с новой строки]`;

    const response = await generateText(prompt);
    
    const visualMatch = response.match(/VISUAL:\s*(.+?)(?=DESCRIPTION:|$)/s);
    const descriptionMatch = response.match(/DESCRIPTION:\s*(.+?)(?=SYMBOLS:|$)/s);
    const symbolsMatch = response.match(/SYMBOLS:\s*(.+?)$/s);
    
    return {
        visualPrompt: visualMatch ? visualMatch[1].trim() : `Archetypal resource card for transition from ${stateDescription}`,
        description: descriptionMatch ? descriptionMatch[1].trim() : response,
        symbols: symbolsMatch ? symbolsMatch[1].trim() : '🌱 Росток надежды\n💎 Внутренняя сила\n🌟 Путеводная звезда'
    };
}

// Генерация карты перехода (оптимизированная)
async function generateTransitionCard(card1Data, card2Data, card1Response, card2Response) {
    const prompt = `Ты — архетипический художник-проводник.
Сгенерируй метафорическую карту перехода от состояния к ресурсу.

Карта состояния: ${card1Data.description}
Отклик пользователя: "${card1Response}"

Карта ресурса: ${card2Data.description}
Отклик пользователя: "${card2Response}"

Создай:
1. Визуальное описание для генерации изображения (на английском, для DALL-E)
2. Краткое описание перехода (2-3 предложения)
3. Список символов моста (2-3 пункта со смайлами)

Формат ответа:
VISUAL: [описание для генерации изображения]
DESCRIPTION: [описание перехода 2-3 предложения]
SYMBOLS: [символы моста со смайлами, каждый с новой строки]`;

    const response = await generateText(prompt);
    
    const visualMatch = response.match(/VISUAL:\s*(.+?)(?=DESCRIPTION:|$)/s);
    const descriptionMatch = response.match(/DESCRIPTION:\s*(.+?)(?=SYMBOLS:|$)/s);
    const symbolsMatch = response.match(/SYMBOLS:\s*(.+?)$/s);
    
    return {
        visualPrompt: visualMatch ? visualMatch[1].trim() : `Archetypal transition card bridging two states`,
        description: descriptionMatch ? descriptionMatch[1].trim() : response,
        symbols: symbolsMatch ? symbolsMatch[1].trim() : '🌉 Мост между мирами\n🕯️ Свет на пути\n👣 Следы шагов'
    };
}

// Генерация карты смысла
async function generateMeaningCard(card1Data, card2Data, card3Data, allResponses) {
    const prompt = `Ты — психолог и автор архетипических карт.
Сгенерируй карту смысла (ради чего сейчас движение).

Карта состояния: ${card1Data.description}
Карта ресурса: ${card2Data.description}
Карта перехода: ${card3Data.description}

Отклики пользователя: ${allResponses.join(', ')}

Создай:
1. Визуальное описание для генерации изображения (на английском, для DALL-E)
2. Краткое описание смысла (2-3 предложения)
3. Список символов смысла (2 пункта со смайлами)
4. Заключение о смысле

Формат ответа:
VISUAL: [описание для генерации изображения]
DESCRIPTION: [описание смысла 2-3 предложения]
SYMBOLS: [символы смысла со смайлами, каждый с новой строки]
CONCLUSION: [заключение о смысле]`;

    const response = await generateText(prompt, 600);
    
    const visualMatch = response.match(/VISUAL:\s*(.+?)(?=DESCRIPTION:|$)/s);
    const descriptionMatch = response.match(/DESCRIPTION:\s*(.+?)(?=SYMBOLS:|$)/s);
    const symbolsMatch = response.match(/SYMBOLS:\s*(.+?)(?=CONCLUSION:|$)/s);
    const conclusionMatch = response.match(/CONCLUSION:\s*(.+?)$/s);
    
    return {
        visualPrompt: visualMatch ? visualMatch[1].trim() : `Archetypal meaning card showing purpose and direction`,
        description: descriptionMatch ? descriptionMatch[1].trim() : response,
        symbols: symbolsMatch ? symbolsMatch[1].trim() : '🎯 Цель пути\n💫 Внутренний свет',
        conclusion: conclusionMatch ? conclusionMatch[1].trim() : 'Смысл сейчас для тебя в движении к себе.'
    };
}

// Психологический анализ (оптимизированный)
async function generatePsychologicalAnalysis(card1Data, card2Data, card1Response, card2Response) {
    const prompt = `Ты — психолог-аналитик и редактор UX.
Сделай короткий итог анализа карт 1 и 2, используя ответы пользователя.

Карта состояния: ${card1Data.description}
Отклик пользователя: "${card1Response}"

Карта ресурса: ${card2Data.description}
Отклик пользователя: "${card2Response}"

Создай:
1. 2-3 абзаца по 2 предложения
2. Свяжи символы состояния и ресурса в одну историю
3. Добавь 1 практическую рекомендацию ("найди маленькое действие...")

Формат ответа:
ANALYSIS: [психологический анализ связки]
RECOMMENDATION: [практическая рекомендация]`;

    const response = await generateText(prompt, 600);
    
    const analysisMatch = response.match(/ANALYSIS:\s*(.+?)(?=RECOMMENDATION:|$)/s);
    const recommendationMatch = response.match(/RECOMMENDATION:\s*(.+?)$/s);
    
    return {
        analysis: analysisMatch ? analysisMatch[1].trim() : response,
        recommendation: recommendationMatch ? recommendationMatch[1].trim() : 'Найди маленькое действие, которое даст тебе ощущение жизни.'
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
Я помогу тебе увидеть своё текущее состояние через метафорические карты и найти ресурс для выхода.  

Готов начать путешествие к самопониманию? ✨  
Напиши "Да" или "Начать", чтобы продолжить.`;
    
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
                if (text.toLowerCase().includes('да') || text.toLowerCase().includes('начать')) {
                    session.state = DIALOG_STATES.WAITING_FOR_STATE_DESCRIPTION;
                    await bot.sendMessage(chatId, `Отлично! 🌟

Опиши своё состояние одним-двумя словами или короткой фразой.  
Например: "я потерял путь", "пустота", "тревога", "застрял".`);
                } else {
                    await bot.sendMessage(chatId, `Пожалуйста, напиши "Да" или "Начать" чтобы начать работу с картами.`);
                }
                break;
                
            case DIALOG_STATES.WAITING_FOR_STATE_DESCRIPTION:
                session.stateDescription = text;
                session.state = DIALOG_STATES.WAITING_FOR_METAPHOR;
                
                await bot.sendMessage(chatId, `Понял, ты чувствуешь "${text}". 

Если бы это состояние было местом или картиной — что бы это было?  
Лес, пустыня, море, туман, дождь?`);
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

<b>Что в этой карте откликается тебе сильнее всего?</b>`);
                
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
                
                const card2Data = await generateResourceCard(session.stateDescription, session.metaphor);
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

<b>Что этот символ может значить именно для тебя?</b>`);
                
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
                session.recommendations = analysisData.recommendation;
                
                // Удаляем прогресс-сообщение
                try {
                    await bot.deleteMessage(chatId, analysisMessage.message_id);
                } catch (error) {
                    console.log('Не удалось удалить прогресс-сообщение');
                }
                
                await bot.sendMessage(chatId, `📊 <b>Психологический анализ</b>

${analysisData.analysis}

💡 <b>Рекомендация:</b>
${analysisData.recommendation}`, { parse_mode: 'HTML' });
                
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
                
                const summary = `Вот твой путь 🌌  

🜃 <b>Карта №1 — Состояние:</b> ${session.stateDescription}  
🜁 <b>Карта №2 — Ресурс:</b> ${session.card2Data.description}  
🜂 <b>Карта №3 — Переход:</b> ${session.card3Data.description}  

Береги свой ресурс и шагай по мосту.  
Хочешь сохранить сессию 📂 или вытянуть карту смысла ✨?`;
                
                await bot.sendMessage(chatId, summary, { parse_mode: 'HTML' });
                session.state = DIALOG_STATES.WAITING_FOR_MEANING_CARD;
                break;
                
            case DIALOG_STATES.WAITING_FOR_MEANING_CARD:
                if (text.toLowerCase().includes('смысл') || text.toLowerCase().includes('смысла') || text.toLowerCase().includes('✨')) {
                    // Генерация карты смысла
                    const meaningMessage = await bot.sendMessage(chatId, `✨ <b>Создаю карту смысла...</b>

🎯 Анализирую ради чего сейчас движение...
⏳ Пожалуйста, подожди...`, { parse_mode: 'HTML' });
                    
                    console.log('Генерирую карту смысла...');
                    const meaningCardData = await generateMeaningCard(
                        session.card1Data, 
                        session.card2Data, 
                        session.card3Data, 
                        [session.card1Response, session.card2Response, session.card3Response]
                    );
                    session.meaningCardData = meaningCardData;
                    console.log('Данные карты смысла:', meaningCardData);
                    
                    await updateProgressMessage(chatId, meaningMessage.message_id, 
                        `✨ <b>Создаю карту смысла...</b>

🎯 Анализирую ради чего сейчас движение...
🎨 Генерирую визуальный образ смысла...`);
                    
                    console.log('Генерирую изображение для карты смысла...');
                    const meaningImage = await generateImage(meaningCardData.visualPrompt);
                    console.log('URL изображения карты смысла:', meaningImage);
                    
                    await updateProgressMessage(chatId, meaningMessage.message_id, 
                        `✨ <b>Создаю карту смысла...</b>

🎯 Анализирую ради чего сейчас движение...
🎨 Генерирую визуальный образ смысла...
📤 Отправляю карту смысла...`);
                    
                    await sendImageFromUrl(chatId, meaningImage, 
                        `✨ <b>Карта смысла</b>

${meaningCardData.description}

${meaningCardData.symbols}

<b>${meaningCardData.conclusion}</b>`);
                    
                    // Удаляем прогресс-сообщение
                    try {
                        await bot.deleteMessage(chatId, meaningMessage.message_id);
                    } catch (error) {
                        console.log('Не удалось удалить прогресс-сообщение');
                    }
                    
                    session.state = DIALOG_STATES.COMPLETED;
                    
                    const finalSummary = `🎉 <b>Твоя сессия завершена!</b>

🜃 <b>Состояние:</b> ${session.stateDescription}  
🜁 <b>Ресурс:</b> ${session.card2Data.description}  
🜂 <b>Переход:</b> ${session.card3Data.description}  
✨ <b>Смысл:</b> ${session.meaningCardData.description}

<b>Твои отклики:</b>
• На первую карту: "${session.card1Response}"
• На вторую карту: "${session.card2Response}"
• На третью карту: "${session.card3Response}"

<b>Психологический анализ:</b>
${session.psychologicalAnalysis}

<b>Рекомендация:</b>
${session.recommendations}

Это твоя история движения. Береги свой ресурс и шагай по мосту. 🙏

Напиши "новая карта" для следующей сессии или используй /start для начала заново.`;
                    
                    await bot.sendMessage(chatId, finalSummary, { parse_mode: 'HTML' });
                } else {
                    session.state = DIALOG_STATES.COMPLETED;
                    
                    const simpleSummary = `🎉 <b>Твоя сессия завершена!</b>

🜃 <b>Состояние:</b> ${session.stateDescription}  
🜁 <b>Ресурс:</b> ${session.card2Data.description}  
🜂 <b>Переход:</b> ${session.card3Data.description}  

<b>Психологический анализ:</b>
${session.psychologicalAnalysis}

<b>Рекомендация:</b>
${session.recommendations}

Это твоя история движения. Береги свой ресурс и шагай по мосту. 🙏

Напиши "новая карта" для следующей сессии или используй /start для начала заново.`;
                    
                    await bot.sendMessage(chatId, simpleSummary, { parse_mode: 'HTML' });
                }
                break;
                
            case DIALOG_STATES.COMPLETED:
                if (text.toLowerCase().includes('новая') || text.toLowerCase().includes('еще')) {
                    initUserSession(userId);
                    await bot.sendMessage(chatId, `Отлично! Начинаем новую сессию. 

Опиши своё текущее состояние одним-двумя словами или короткой фразой.`);
                } else {
                    await bot.sendMessage(chatId, `Напиши "новая карта" для следующей сессии или используй /start для начала заново.`);
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
console.log('🤖 Telegram-бот "Архетипические карты" запущен в финальной версии!');
console.log('🔧 Функции: оптимизированные промпты, улучшенный UX, карта смысла');
console.log('📋 Убедитесь, что в .env файле указаны:');
console.log('   - TELEGRAM_BOT_TOKEN');
console.log('   - OPENAI_API_KEY');
