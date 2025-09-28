#!/bin/bash

echo "🛑 Остановка Telegram-бота с лоадерами"
echo "===================================="

# Остановка бота
if [ -f "bot-loaders.pid" ]; then
    BOT_PID=$(cat bot-loaders.pid)
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
    rm -f bot-loaders.pid
else
    echo "ℹ️  PID файл не найден, ищу процессы..."
    pkill -f "bot-with-loaders.js" 2>/dev/null || true
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
if [ -f "logs/bot-loaders.log" ]; then
    echo "   - Строк в логе: $(wc -l < logs/bot-loaders.log)"
    echo "   - Размер лога: $(du -h logs/bot-loaders.log | cut -f1)"
fi

echo ""
echo "✅ Остановка завершена"
