#!/bin/bash

echo "🛑 Остановка Telegram-бота с эмодзи"
echo "================================="

# Остановка бота
if [ -f "bot-with-emojis.pid" ]; then
    BOT_PID=$(cat bot-with-emojis.pid)
    if kill -0 $BOT_PID 2>/dev/null; then
        echo "🛑 Останавливаю бота (PID: $BOT_PID)..."
        kill $BOT_PID
        sleep 2
        
        # Принудительная остановка если не остановился
        if kill -0 $BOT_PID 2>/dev/null; then
            echo "⚠️  Принудительная остановка бота..."
            kill -9 $BOT_PID
        fi
        
        echo "✅ Бот остановлен"
    else
        echo "ℹ️  Бот уже не запущен"
    fi
    rm -f bot-with-emojis.pid
else
    echo "ℹ️  PID файл не найден, ищу процессы..."
    pkill -f "bot-with-emojis.js" 2>/dev/null || true
    echo "✅ Все процессы бота остановлены"
fi

# Очистка временных файлов
echo "🧹 Очистка временных файлов..."
if [ -d "temp" ]; then
    rm -rf temp/*
    echo "✅ Временные файлы очищены"
fi

# Показать статистику
echo ""
echo "📊 Статистика сессии:"
if [ -f "logs/bot-with-emojis.log" ]; then
    echo "   - Строк в логе: $(wc -l < logs/bot-with-emojis.log)"
    echo "   - Размер лога: $(du -h logs/bot-with-emojis.log | cut -f1)"
fi

echo ""
echo "✅ Остановка завершена"
