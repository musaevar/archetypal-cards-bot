#!/usr/bin/env node

/**
 * Скрипт для проверки конфигурации бота
 */

require('dotenv').config();

console.log('🔍 Проверка конфигурации Telegram-бота "Архетипические карты"\n');

// Проверка переменных окружения
const requiredEnvVars = [
    'TELEGRAM_BOT_TOKEN',
    'OPENAI_API_KEY'
];

let allGood = true;

console.log('📋 Проверка переменных окружения:');
requiredEnvVars.forEach(envVar => {
    const value = process.env[envVar];
    if (value && value !== `your_${envVar.toLowerCase()}_here`) {
        console.log(`✅ ${envVar}: настроен`);
    } else {
        console.log(`❌ ${envVar}: не найден или не настроен`);
        allGood = false;
    }
});

console.log('\n📦 Проверка зависимостей:');
try {
    require('node-telegram-bot-api');
    console.log('✅ node-telegram-bot-api: установлен');
} catch (error) {
    console.log('❌ node-telegram-bot-api: не установлен');
    allGood = false;
}

try {
    require('openai');
    console.log('✅ openai: установлен');
} catch (error) {
    console.log('❌ openai: не установлен');
    allGood = false;
}

try {
    require('dotenv');
    console.log('✅ dotenv: установлен');
} catch (error) {
    console.log('❌ dotenv: не установлен');
    allGood = false;
}

console.log('\n🔧 Инструкции по настройке:');

if (!allGood) {
    console.log(`
1. Установите зависимости:
   npm install

2. Скопируйте файл конфигурации:
   cp env.example .env

3. Отредактируйте .env файл и добавьте ваши токены:
   - TELEGRAM_BOT_TOKEN (получите у @BotFather)
   - OPENAI_API_KEY (получите на platform.openai.com)

4. Запустите бота:
   npm start
`);
} else {
    console.log(`
🎉 Всё настроено правильно!

Запустите бота командой:
npm start

Или для разработки:
npm run dev
`);
}

process.exit(allGood ? 0 : 1);
