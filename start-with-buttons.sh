#!/bin/bash

echo "🚀 Запуск Telegram-бота с кнопками"
echo "================================="

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
pkill -f "bot-ultimate.js" 2>/dev/null || true
pkill -f "bot-with-buttons.js" 2>/dev/null || true
sleep 2

# Запуск бота в фоне с логированием
echo "🚀 Запуск бота с кнопками..."
nohup node src/bot-with-buttons.js > logs/bot-buttons.log 2>&1 &
BOT_PID=$!

# Сохранение PID
echo $BOT_PID > bot-buttons.pid

echo "✅ Бот запущен (PID: $BOT_PID)"
echo "📋 Логи: tail -f logs/bot-buttons.log"
echo "🛑 Остановка: kill $BOT_PID или ./stop-with-buttons.sh"

# Проверка через 5 секунд
sleep 5
if kill -0 $BOT_PID 2>/dev/null; then
    echo "✅ Бот работает корректно"
    echo ""
    echo "🎯 Версия с кнопками включает:"
    echo "   🔘 Inline-кнопки для удобства"
    echo "   🔮 Профессиональные психологические промпты"
    echo "   📝 Улучшенное приветствие и UX"
    echo "   🎨 Поэтапная генерация с лоадерами"
    echo "   🧠 Психологический анализ с КПТ"
    echo "   🌉 Третья карта-мост"
    echo "   💡 5 практических рекомендаций"
    echo "   🏥 Ссылка на психотерапевта"
    echo "   ✨ Итоговый анализ сессии"
else
    echo "❌ Бот не запустился. Проверьте логи: cat logs/bot-buttons.log"
    exit 1
fi

echo ""
echo "🎉 Бот с кнопками запущен!"
echo "💡 Для остановки используйте: ./stop-with-buttons.sh"
