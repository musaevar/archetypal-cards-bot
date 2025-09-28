#!/bin/bash

echo "🚀 Запуск Telegram-бота с GPT-4.1 и редактурой Максима Ильяхова"
echo "============================================================="

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
pkill -f "bot-buttons-improved.js" 2>/dev/null || true
pkill -f "bot-gpt41-editing.js" 2>/dev/null || true
sleep 2

# Запуск бота в фоне с логированием
echo "🚀 Запуск бота с GPT-4.1 и редактурой..."
nohup node src/bot-gpt41-editing.js > logs/bot-gpt41-editing.log 2>&1 &
BOT_PID=$!

# Сохранение PID
echo $BOT_PID > bot-gpt41-editing.pid

echo "✅ Бот запущен (PID: $BOT_PID)"
echo "📋 Логи: tail -f logs/bot-gpt41-editing.log"
echo "🛑 Остановка: kill $BOT_PID или ./stop-gpt41-editing.sh"

# Проверка через 5 секунд
sleep 5
if kill -0 $BOT_PID 2>/dev/null; then
    echo "✅ Бот работает корректно"
    echo ""
    echo "🎯 Версия с GPT-4.1 и редактурой включает:"
    echo "   🔘 Inline-кнопки для удобства"
    echo "   🤖 GPT-4.1 для лучшего качества текста"
    echo "   ✍️  Правила редактуры Максима Ильяхова"
    echo "   🎨 Улучшенная генерация изображений"
    echo "   🔮 Профессиональные психологические промпты"
    echo "   📝 Ясный и понятный текст без канцеляризмов"
    echo "   🎨 Поэтапная генерация с лоадерами"
    echo "   🧠 Психологический анализ с КПТ"
    echo "   🌉 Третья карта-мост"
    echo "   💡 5 практических рекомендаций"
    echo "   🏥 Ссылка на психотерапевта"
    echo "   ✨ Итоговый анализ сессии"
else
    echo "❌ Бот не запустился. Проверьте логи: cat logs/bot-gpt41-editing.log"
    exit 1
fi

echo ""
echo "🎉 Бот с GPT-4.1 и редактурой запущен!"
echo "💡 Для остановки используйте: ./stop-gpt41-editing.sh"
