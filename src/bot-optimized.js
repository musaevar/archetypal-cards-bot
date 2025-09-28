const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
require('dotenv').config();

// Конфигурация для высокой нагрузки
const CONFIG = {
    MAX_CONCURRENT_REQUESTS: 10,
    RATE_LIMIT_PER_USER: 2, // запросов в минуту на пользователя
    IMAGE_CACHE_TTL: 3600000, // 1 час в мс
    MAX_SESSION_SIZE: 1000,
    CLEANUP_INTERVAL: 300000, // 5 минут
    WORKER_TIMEOUT: 30000, // 30 секунд
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
};

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

// Инициализация OpenAI с оптимизацией
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 60000,
    maxRetries: 3
});

// Кэш для изображений и сессий
const imageCache = new Map();
const userSessions = new Map();
const rateLimitMap = new Map();
const requestQueue = [];
let activeRequests = 0;

// Состояния диалога
const DIALOG_STATES = {
    IDLE: 'idle',
    WAITING_FOR_STATE_DESCRIPTION: 'waiting_for_state',
    WAITING_FOR_METAPHOR: 'waiting_for_metaphor',
    WAITING_FOR_CARD1_RESPONSE: 'waiting_for_card1',
    WAITING_FOR_CARD2_RESPONSE: 'waiting_for_card2',
    COMPLETED: 'completed'
};

// Очистка старых сессий
function cleanupSessions() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [userId, session] of userSessions.entries()) {
        if (session.lastActivity && (now - session.lastActivity) > CONFIG.CLEANUP_INTERVAL) {
            userSessions.delete(userId);
            rateLimitMap.delete(userId);
            cleaned++;
        }
    }
    
    // Очистка кэша изображений
    for (const [key, data] of imageCache.entries()) {
        if (data.timestamp && (now - data.timestamp) > CONFIG.IMAGE_CACHE_TTL) {
            imageCache.delete(key);
        }
    }
    
    if (cleaned > 0) {
        console.log(`🧹 Очищено ${cleaned} старых сессий`);
    }
}

// Rate limiting
function checkRateLimit(userId) {
    const now = Date.now();
    const userLimit = rateLimitMap.get(userId) || { count: 0, resetTime: now + 60000 };
    
    if (now > userLimit.resetTime) {
        userLimit.count = 0;
        userLimit.resetTime = now + 60000;
    }
    
    if (userLimit.count >= CONFIG.RATE_LIMIT_PER_USER) {
        return false;
    }
    
    userLimit.count++;
    rateLimitMap.set(userId, userLimit);
    return true;
}

// Инициализация сессии пользователя
function initUserSession(userId) {
    const session = {
        state: DIALOG_STATES.IDLE,
        stateDescription: '',
        metaphor: '',
        card1Data: null,
        card2Data: null,
        card1Response: '',
        card2Response: '',
        lastActivity: Date.now()
    };
    
    userSessions.set(userId, session);
    return session;
}

// Получение сессии пользователя
function getUserSession(userId) {
    if (!userSessions.has(userId)) {
        return initUserSession(userId);
    }
    
    const session = userSessions.get(userId);
    session.lastActivity = Date.now();
    return session;
}

// Очередь запросов с приоритетом
class RequestQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }
    
    async add(request, priority = 0) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                request,
                priority,
                resolve,
                reject,
                timestamp: Date.now()
            });
            
            this.queue.sort((a, b) => b.priority - a.priority);
            this.process();
        });
    }
    
    async process() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        
        while (this.queue.length > 0 && activeRequests < CONFIG.MAX_CONCURRENT_REQUESTS) {
            const item = this.queue.shift();
            activeRequests++;
            
            try {
                const result = await item.request();
                item.resolve(result);
            } catch (error) {
                item.reject(error);
            } finally {
                activeRequests--;
            }
        }
        
        this.processing = false;
    }
}

const requestQueue = new RequestQueue();

// Оптимизированная генерация текста
async function generateText(prompt, maxTokens = 500) {
    const cacheKey = `text_${Buffer.from(prompt).toString('base64').slice(0, 50)}`;
    
    if (imageCache.has(cacheKey)) {
        console.log('📋 Использую кэшированный текст');
        return imageCache.get(cacheKey).data;
    }
    
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
        
        const result = completion.choices[0].message.content;
        
        // Кэшируем результат
        imageCache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });
        
        return result;
    } catch (error) {
        console.error('Ошибка генерации текста:', error);
        throw new Error('Не удалось сгенерировать текст');
    }
}

// Оптимизированная генерация изображения
async function generateImage(prompt) {
    const cacheKey = `image_${Buffer.from(prompt).toString('base64').slice(0, 50)}`;
    
    if (imageCache.has(cacheKey)) {
        console.log('🖼️ Использую кэшированное изображение');
        return imageCache.get(cacheKey).data;
    }
    
    try {
        console.log('🎨 Генерирую новое изображение...');
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            size: "1024x1024",
            quality: "standard",
            n: 1
        });
        
        const imageUrl = response.data[0].url;
        
        // Кэшируем URL
        imageCache.set(cacheKey, {
            data: imageUrl,
            timestamp: Date.now()
        });
        
        return imageUrl;
    } catch (error) {
        console.error('Ошибка генерации изображения:', error);
        throw new Error('Не удалось сгенерировать изображение');
    }
}

// Оптимизированная отправка изображения
async function sendImageFromUrl(chatId, imageUrl, caption) {
    try {
        console.log('📥 Скачиваю изображение...');
        
        const response = await axios({
            method: 'GET',
            url: imageUrl,
            responseType: 'stream',
            timeout: 30000
        });
        
        const tempPath = path.join(__dirname, '..', 'temp', `image_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
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
                    console.log('📤 Отправляю изображение...');
                    await bot.sendPhoto(chatId, tempPath, { 
                        caption: caption, 
                        parse_mode: 'HTML' 
                    });
                    
                    fs.unlinkSync(tempPath);
                    console.log('✅ Изображение отправлено');
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

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    console.log(`👤 Пользователь ${userId} начал сессию`);
    
    if (!checkRateLimit(userId)) {
        await bot.sendMessage(chatId, `⏰ Слишком много запросов. Попробуйте через минуту.`);
        return;
    }
    
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
    
    if (!checkRateLimit(userId)) {
        await bot.sendMessage(chatId, `⏰ Слишком много запросов. Попробуйте через минуту.`);
        return;
    }
    
    const session = getUserSession(userId);
    console.log(`👤 Пользователь ${userId}, состояние: ${session.state}, сообщение: ${text}`);
    
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
                
                // Асинхронная генерация карт
                requestQueue.add(async () => {
                    console.log('🎯 Генерирую первую карту...');
                    const card1Data = await generateStateCard(session.stateDescription, session.metaphor);
                    session.card1Data = card1Data;
                    
                    const card1Image = await generateImage(card1Data.visualPrompt);
                    
                    await sendImageFromUrl(chatId, card1Image, 
                        `🜃 <b>Карта №1 — Твоё состояние</b>\n\n${card1Data.interpretation}`);
                    
                    session.state = DIALOG_STATES.WAITING_FOR_CARD1_RESPONSE;
                    
                    await bot.sendMessage(chatId, `Что в этой карте откликается тебе сильнее всего? 
Опиши свои ощущения от увиденного.`);
                }, 1);
                break;
                
            case DIALOG_STATES.WAITING_FOR_CARD1_RESPONSE:
                session.card1Response = text;
                
                await bot.sendMessage(chatId, `Теперь создаю вторую карту — ресурс для перехода... 🌱`);
                
                requestQueue.add(async () => {
                    console.log('🎯 Генерирую вторую карту...');
                    const card2Data = await generateResourceCard(session.stateDescription, session.metaphor);
                    session.card2Data = card2Data;
                    
                    const card2Image = await generateImage(card2Data.visualPrompt);
                    
                    await sendImageFromUrl(chatId, card2Image, 
                        `🜁 <b>Карта №2 — Твой ресурс</b>\n\n${card2Data.interpretation}`);
                    
                    session.state = DIALOG_STATES.WAITING_FOR_CARD2_RESPONSE;
                    
                    await bot.sendMessage(chatId, `Как думаешь, что этот символ может значить именно для тебя?`);
                }, 1);
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

// Периодическая очистка
setInterval(cleanupSessions, CONFIG.CLEANUP_INTERVAL);

// Мониторинг производительности
setInterval(() => {
    console.log(`📊 Статистика: Активных запросов: ${activeRequests}, Сессий: ${userSessions.size}, Кэш: ${imageCache.size}`);
}, 60000);

// Запуск бота
console.log('🚀 Telegram-бот "Архетипические карты" запущен в режиме высокой нагрузки!');
console.log('⚡ Оптимизации: кэширование, очереди, rate limiting, очистка памяти');
console.log('📋 Убедитесь, что в .env файле указаны:');
console.log('   - TELEGRAM_BOT_TOKEN');
console.log('   - OPENAI_API_KEY');
