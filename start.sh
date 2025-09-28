#!/bin/bash

echo "🤖 Запуск Telegram-бота «Архетипические карты»"
echo "=============================================="

# Проверка наличия Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден. Установите Node.js с https://nodejs.org/"
    exit 1
fi

# Проверка наличия npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не найден. Установите npm"
    exit 1
fi

# Проверка наличия package.json
if [ ! -f "package.json" ]; then
    echo "❌ package.json не найден. Убедитесь, что вы в правильной директории"
    exit 1
fi

# Проверка зависимостей
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm install
fi

# Проверка конфигурации
echo "🔍 Проверка конфигурации..."
npm run check

if [ $? -eq 0 ]; then
    echo ""
    echo "🚀 Запуск бота..."
    npm start
else
    echo ""
    echo "❌ Сначала настройте конфигурацию согласно инструкциям выше"
    exit 1
fi
