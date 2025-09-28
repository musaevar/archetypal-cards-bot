#!/bin/bash

echo "🚀 Запуск Telegram-бота с новым сценарием"
echo "========================================"

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
pkill -f "bot-gpt41-editing.js" 2>/dev/null || true
pkill -f "bot-new-scenario.js" 2>/dev/null || true
sleep 2

# Запуск бота в фоне с логированием
echo "🚀 Запуск бота с новым сценарием..."
nohup node src/bot-new-scenario.js > logs/bot-new-scenario.log 2>&1 &
BOT_PID=$!

# Сохранение PID
echo $BOT_PID > bot-new-scenario.pid

echo "✅ Бот запущен (PID: $BOT_PID)"
echo "📋 Логи: tail -f logs/bot-new-scenario.log"
echo "🛑 Остановка: kill $BOT_PID или ./stop-new-scenario.sh"

# Проверка через 5 секунд
sleep 5
if kill -0 $BOT_PID 2>/dev/null; then
    echo "✅ Бот работает корректно"
    echo ""
    echo "🎯 Новый сценарий включает:"
    echo "   🤖 GPT-4.1 для лучшего качества текста"
    echo "   ✍️  Правила редактуры Максима Ильяхова"
    echo "   📝 Упрощенное приветствие"
    echo "   🎨 Улучшенная генерация изображений"
    echo "   🔮 Профессиональные психологические промпты"
    echo "   📝 Ясный и понятный текст без канцеляризмов"
    echo "   🎨 Поэтапная генерация с лоадерами"
    echo "   🌉 Три карты: состояние, ресурс, переход"
    echo "   💡 Практическое действие"
    echo "   🏥 Ссылка на психотерапевта"
    echo "   ✨ Итоговый анализ сессии"
    echo "   🔘 Inline-кнопки для новой сессии"
else
    echo "❌ Бот не запустился. Проверьте логи: cat logs/bot-new-scenario.log"
    exit 1
fi

echo ""
echo "🎉 Бот с новым сценарием запущен!"
echo "💡 Для остановки используйте: ./stop-new-scenario.sh"
