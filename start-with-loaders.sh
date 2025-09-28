#!/bin/bash

echo "🚀 Запуск Telegram-бота с лоадерами"
echo "=================================="

# Проверка переменных окружения
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "❌ TELEGRAM_BOT_TOKEN не установлен"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY не установлен"
    exit 1
fi

# Создание необходимых директорий
mkdir -p temp
mkdir -p logs

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден. Установите Node.js"
    exit 1
fi

echo "✅ Node.js найден: $(node --version)"

# Остановка предыдущих процессов
echo "🛑 Остановка предыдущих процессов..."
pkill -f "bot-full-scenario.js" 2>/dev/null || true
pkill -f "bot-with-loaders.js" 2>/dev/null || true
sleep 2

# Запуск бота в фоне с логированием
echo "🚀 Запуск бота с лоадерами..."
nohup node src/bot-with-loaders.js > logs/bot-loaders.log 2>&1 &
BOT_PID=$!

# Сохранение PID
echo $BOT_PID > bot-loaders.pid

echo "✅ Бот запущен (PID: $BOT_PID)"
echo "📋 Логи: tail -f logs/bot-loaders.log"
echo "🛑 Остановка: kill $BOT_PID или ./stop-with-loaders.sh"

# Проверка через 5 секунд
sleep 5
if kill -0 $BOT_PID 2>/dev/null; then
    echo "✅ Бот работает корректно"
    echo ""
    echo "🎯 Функции с лоадерами:"
    echo "   🔮 Индикаторы типизации"
    echo "   📝 Прогресс-сообщения"
    echo "   🎨 Поэтапная генерация карт"
    echo "   🧠 Психологический анализ"
    echo "   🌉 Третья карта-мост"
    echo "   ✨ Итоговый анализ"
else
    echo "❌ Бот не запустился. Проверьте логи: cat logs/bot-loaders.log"
    exit 1
fi

echo ""
echo "🎉 Бот запущен с улучшенным UX!"
echo "💡 Для остановки используйте: ./stop-with-loaders.sh"
