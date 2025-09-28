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

const bot = new TelegramBot(token, { polling: true });

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
    COMPLETED: 'completed'
};

// Инициализация сессии пользователя
function initUserSession(userId) {
    userSessions.set(userId, {
        state: DIALOG_STATES.IDLE,
        stateDescription: '',
        metaphor: '',
        card1Data: null,
        card2Data: null,
        card1Response: '',
        card2Response: ''
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

// Генерация карты состояния
async function generateStateCard(stateDescription, metaphor) {
    const prompt = `Создай архетипическую карту состояния человека. 
    
Состояние: "${stateDescription}"
Метафора: "${metaphor}"

Создай:
1. Визуальное описание для генерации изображения (на английском, для DALL-E)
2. Архетипическую интерпретацию состояния
3. Символы и образы, отражающие это состояние

Формат ответа:
VISUAL: [описание для генерации изображения]
INTERPRETATION: [архетипическая интерпретация]`;

    const response = await generateText(prompt);
    
    const visualMatch = response.match(/VISUAL:\s*(.+?)(?=INTERPRETATION:|$)/s);
    const interpretationMatch = response.match(/INTERPRETATION:\s*(.+?)$/s);
    
    return {
        visualPrompt: visualMatch ? visualMatch[1].trim() : `Archetypal card representing ${stateDescription} in ${metaphor}`,
        interpretation: interpretationMatch ? interpretationMatch[1].trim() : response
    };
}

// Генерация карты ресурса
async function generateResourceCard(stateDescription, metaphor) {
    const prompt = `Создай архетипическую карту ресурса для перехода из состояния.
    
Исходное состояние: "${stateDescription}"
Метафора: "${metaphor}"

Создай:
1. Визуальное описание для генерации изображения (на английском, для DALL-E)
2. Архетипический символ ресурса и перехода
3. Интерпретацию того, как этот ресурс поможет

Формат ответа:
VISUAL: [описание для генерации изображения]
INTERPRETATION: [архетипическая интерпретация ресурса]`;

    const response = await generateText(prompt);
    
    const visualMatch = response.match(/VISUAL:\s*(.+?)(?=INTERPRETATION:|$)/s);
    const interpretationMatch = response.match(/INTERPRETATION:\s*(.+?)$/s);
    
    return {
        visualPrompt: visualMatch ? visualMatch[1].trim() : `Archetypal resource card for transition from ${stateDescription}`,
        interpretation: interpretationMatch ? interpretationMatch[1].trim() : response
    };
}

// Скачивание и отправка изображения
async function sendImageFromUrl(chatId, imageUrl, caption) {
    try {
        console.log('Скачиваю изображение с URL:', imageUrl);
        
        // Скачиваем изображение
        const response = await axios({
            method: 'GET',
            url: imageUrl,
            responseType: 'stream'
        });
        
        // Создаем временный файл
        const tempPath = path.join(__dirname, '..', 'temp', `image_${Date.now()}.png`);
        
        // Создаем директорию temp если её нет
        const tempDir = path.dirname(tempPath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Сохраняем изображение
        const writer = fs.createWriteStream(tempPath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', async () => {
                try {
                    console.log('Отправляю изображение в Telegram...');
                    await bot.sendPhoto(chatId, tempPath, { 
                        caption: caption, 
                        parse_mode: 'HTML' 
                    });
                    
                    // Удаляем временный файл
                    fs.unlinkSync(tempPath);
                    console.log('Изображение успешно отправлено');
                    resolve();
                } catch (error) {
                    console.error('Ошибка отправки изображения:', error);
                    // Удаляем временный файл даже при ошибке
                    if (fs.existsSync(tempPath)) {
                        fs.unlinkSync(tempPath);
                    }
                    reject(error);
                }
            });
            
            writer.on('error', (error) => {
                console.error('Ошибка сохранения изображения:', error);
                reject(error);
            });
        });
        
    } catch (error) {
        console.error('Ошибка обработки изображения:', error);
        // Fallback - отправляем только текст
        await bot.sendMessage(chatId, `🖼️ Изображение карты:\n\n${caption}`);
    }
}

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    console.log(`Пользователь ${userId} начал сессию`);
    
    // Инициализация новой сессии
    initUserSession(userId);
    
    const welcomeMessage = `Привет 👋 

Я помогу тебе увидеть твоё текущее состояние через метафорическую карту и найти ресурс для выхода. 

Готов начать путешествие к самопониманию? ✨

Напиши "Да" или "Начать" чтобы продолжить.`;
    
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

Например: "я потерял путь", "пустота", "тревога", "застрял"`);
                } else {
                    await bot.sendMessage(chatId, `Пожалуйста, напиши "Да" или "Начать" чтобы начать работу с картами.`);
                }
                break;
                
            case DIALOG_STATES.WAITING_FOR_STATE_DESCRIPTION:
                session.stateDescription = text;
                session.state = DIALOG_STATES.WAITING_FOR_METAPHOR;
                
                await bot.sendMessage(chatId, `Понял, ты чувствуешь "${text}". 

Если представить твоё состояние как место или картину — что это могло бы быть? 

Лес, пустыня, море, туман, горы, дождь? Опиши образ, который приходит в голову.`);
                break;
                
            case DIALOG_STATES.WAITING_FOR_METAPHOR:
                session.metaphor = text;
                
                await bot.sendMessage(chatId, `Создаю твои архетипические карты... 🔮

Это может занять минуту, пожалуйста, подожди.`);
                
                // Генерация первой карты
                console.log('Генерирую первую карту...');
                const card1Data = await generateStateCard(session.stateDescription, session.metaphor);
                session.card1Data = card1Data;
                console.log('Данные карты №1:', card1Data);
                
                console.log('Генерирую изображение для карты №1...');
                const card1Image = await generateImage(card1Data.visualPrompt);
                console.log('URL изображения карты №1:', card1Image);
                
                await sendImageFromUrl(chatId, card1Image, 
                    `🜃 <b>Карта №1 — Твоё состояние</b>\n\n${card1Data.interpretation}`);
                
                session.state = DIALOG_STATES.WAITING_FOR_CARD1_RESPONSE;
                
                await bot.sendMessage(chatId, `Что в этой карте откликается тебе сильнее всего? 
Опиши свои ощущения от увиденного.`);
                break;
                
            case DIALOG_STATES.WAITING_FOR_CARD1_RESPONSE:
                session.card1Response = text;
                
                await bot.sendMessage(chatId, `Теперь создаю вторую карту — ресурс для перехода... 🌱`);
                
                // Генерация второй карты
                console.log('Генерирую вторую карту...');
                const card2Data = await generateResourceCard(session.stateDescription, session.metaphor);
                session.card2Data = card2Data;
                console.log('Данные карты №2:', card2Data);
                
                console.log('Генерирую изображение для карты №2...');
                const card2Image = await generateImage(card2Data.visualPrompt);
                console.log('URL изображения карты №2:', card2Image);
                
                await sendImageFromUrl(chatId, card2Image, 
                    `🜁 <b>Карта №2 — Твой ресурс</b>\n\n${card2Data.interpretation}`);
                
                session.state = DIALOG_STATES.WAITING_FOR_CARD2_RESPONSE;
                
                await bot.sendMessage(chatId, `Как думаешь, что этот символ может значить именно для тебя?`);
                break;
                
            case DIALOG_STATES.WAITING_FOR_CARD2_RESPONSE:
                session.card2Response = text;
                session.state = DIALOG_STATES.COMPLETED;
                
                const summary = `✨ <b>Твой путь завершён</b>

🜃 <b>Карта №1 — где ты сейчас:</b> ${session.stateDescription}
🜁 <b>Карта №2 — что тебе помогает:</b> ${session.card2Data.interpretation}

Твои отклики:
• На первую карту: "${session.card1Response}"
• На вторую карту: "${session.card2Response}"

Ты можешь сохранить эти карты в свою личную коллекцию 📂 или написать "новая карта" для следующей сессии.

Спасибо за доверие! 🙏`;
                
                await bot.sendMessage(chatId, summary);
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

// Запуск бота
console.log('🤖 Telegram-бот "Архетипические карты" запущен!');
console.log('📋 Убедитесь, что в .env файле указаны:');
console.log('   - TELEGRAM_BOT_TOKEN');
console.log('   - OPENAI_API_KEY');
