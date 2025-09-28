#!/bin/bash

echo "🛑 Остановка Telegram-бота"
echo "========================="

# Остановка бота
if [ -f "bot.pid" ]; then
    BOT_PID=$(cat bot.pid)
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
    rm -f bot.pid
else
    echo "ℹ️  PID файл бота не найден"
fi

# Остановка мониторинга
if [ -f "monitor.pid" ]; then
    MONITOR_PID=$(cat monitor.pid)
    if kill -0 $MONITOR_PID 2>/dev/null; then
        echo "🛑 Останавливаю мониторинг (PID: $MONITOR_PID)..."
        kill $MONITOR_PID
        echo "✅ Мониторинг остановлен"
    else
        echo "ℹ️  Мониторинг уже не запущен"
    fi
    rm -f monitor.pid
else
    echo "ℹ️  PID файл мониторинга не найден"
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
if [ -f "logs/bot.log" ]; then
    echo "   - Строк в логе бота: $(wc -l < logs/bot.log)"
fi
if [ -f "logs/monitor.log" ]; then
    echo "   - Строк в логе мониторинга: $(wc -l < logs/monitor.log)"
fi

echo ""
echo "✅ Остановка завершена"
