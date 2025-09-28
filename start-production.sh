#!/bin/bash

echo "🚀 Запуск Telegram-бота в режиме высокой нагрузки"
echo "=================================================="

# Проверка переменных окружения
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "❌ TELEGRAM_BOT_TOKEN не установлен"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY не установлен"
    exit 1
fi

# Создание директорий
mkdir -p temp
mkdir -p reports
mkdir -p logs

# Настройка переменных для высокой нагрузки
export NODE_ENV=production
export MAX_CONCURRENT_REQUESTS=${MAX_CONCURRENT_REQUESTS:-10}
export RATE_LIMIT_PER_USER=${RATE_LIMIT_PER_USER:-2}
export IMAGE_CACHE_TTL=${IMAGE_CACHE_TTL:-3600000}
export MAX_SESSION_SIZE=${MAX_SESSION_SIZE:-1000}
export CLEANUP_INTERVAL=${CLEANUP_INTERVAL:-300000}

echo "⚙️  Конфигурация:"
echo "   - Максимум одновременных запросов: $MAX_CONCURRENT_REQUESTS"
echo "   - Лимит на пользователя: $RATE_LIMIT_PER_USER запросов/мин"
echo "   - TTL кэша изображений: $((IMAGE_CACHE_TTL/1000/60)) минут"
echo "   - Максимум сессий: $MAX_SESSION_SIZE"
echo "   - Интервал очистки: $((CLEANUP_INTERVAL/1000/60)) минут"

# Проверка доступности ресурсов
echo ""
echo "🔍 Проверка системы..."

# Проверка памяти
TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2}')
if [ $TOTAL_MEM -lt 1024 ]; then
    echo "⚠️  Предупреждение: Мало оперативной памяти ($TOTAL_MEM MB)"
fi

# Проверка места на диске
DISK_USAGE=$(df -h . | awk 'NR==2{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "⚠️  Предупреждение: Мало места на диске ($DISK_USAGE% занято)"
fi

# Проверка CPU
CPU_CORES=$(nproc)
echo "💻 CPU ядер: $CPU_CORES"

# Настройка лимитов системы
echo ""
echo "🔧 Настройка лимитов системы..."

# Увеличиваем лимит файловых дескрипторов
ulimit -n 65536

# Настройка Node.js для высокой нагрузки
export NODE_OPTIONS="--max-old-space-size=2048 --max-semi-space-size=128"

echo "✅ Лимиты настроены"

# Запуск с мониторингом
echo ""
echo "🚀 Запуск бота с мониторингом..."

# Запуск в фоне с логированием
nohup node src/bot-optimized.js > logs/bot.log 2>&1 &
BOT_PID=$!

# Запуск мониторинга
nohup node monitor.js > logs/monitor.log 2>&1 &
MONITOR_PID=$!

echo "✅ Бот запущен (PID: $BOT_PID)"
echo "✅ Мониторинг запущен (PID: $MONITOR_PID)"

# Сохранение PID для остановки
echo $BOT_PID > bot.pid
echo $MONITOR_PID > monitor.pid

echo ""
echo "📊 Мониторинг:"
echo "   - Логи бота: tail -f logs/bot.log"
echo "   - Логи мониторинга: tail -f logs/monitor.log"
echo "   - Остановка: ./stop-production.sh"

echo ""
echo "🎉 Бот запущен в режиме высокой нагрузки!"
echo "💡 Для остановки используйте: ./stop-production.sh"
