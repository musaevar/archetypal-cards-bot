#!/bin/bash

echo "📊 Мониторинг Telegram-бота"
echo "=========================="

# Проверка статуса
if [ -f "bot.pid" ]; then
    BOT_PID=$(cat bot.pid)
    if kill -0 $BOT_PID 2>/dev/null; then
        echo "✅ Бот работает (PID: $BOT_PID)"
        
        # Информация о процессе
        echo ""
        echo "📈 Информация о процессе:"
        ps -p $BOT_PID -o pid,ppid,cmd,etime,pcpu,pmem
        
        # Использование памяти
        echo ""
        echo "💾 Использование памяти:"
        ps -p $BOT_PID -o pid,vsz,rss,pmem,cmd
        
    else
        echo "❌ Бот не работает (PID файл есть, но процесс не найден)"
    fi
else
    echo "❌ PID файл не найден"
fi

# Проверка логов
echo ""
echo "📋 Последние записи в логе:"
if [ -f "logs/bot.log" ]; then
    tail -10 logs/bot.log
else
    echo "Лог файл не найден"
fi

# Проверка временных файлов
echo ""
echo "🗂️  Временные файлы:"
if [ -d "temp" ]; then
    ls -la temp/ | head -10
    echo "Всего файлов: $(ls temp/ | wc -l)"
else
    echo "Директория temp не найдена"
fi

# Проверка места на диске
echo ""
echo "💽 Место на диске:"
df -h . | tail -1

# Проверка сетевых соединений
echo ""
echo "🌐 Сетевые соединения бота:"
if [ -f "bot.pid" ]; then
    BOT_PID=$(cat bot.pid)
    lsof -p $BOT_PID 2>/dev/null | grep -E "(TCP|UDP)" | head -5 || echo "Нет активных соединений"
fi

echo ""
echo "💡 Для просмотра логов в реальном времени: tail -f logs/bot.log"
