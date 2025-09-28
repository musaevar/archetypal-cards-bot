#!/bin/bash

echo "🔧 Установка Telegram-бота как системного сервиса"
echo "================================================"

# Проверка прав администратора
if [ "$EUID" -ne 0 ]; then
    echo "❌ Запустите скрипт с правами администратора: sudo ./install-service.sh"
    exit 1
fi

# Путь к проекту
PROJECT_PATH="/Users/albertmusaev/курсор бот"
SERVICE_NAME="archetypal-bot"

echo "📁 Путь к проекту: $PROJECT_PATH"

# Проверка существования проекта
if [ ! -d "$PROJECT_PATH" ]; then
    echo "❌ Директория проекта не найдена: $PROJECT_PATH"
    exit 1
fi

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен"
    exit 1
fi

echo "✅ Node.js найден: $(node --version)"

# Создание пользователя для сервиса (если не существует)
if ! id "archetypal-bot" &>/dev/null; then
    echo "👤 Создаю пользователя для сервиса..."
    useradd -r -s /bin/false -d "$PROJECT_PATH" archetypal-bot
fi

# Установка прав на директорию
echo "🔐 Настройка прав доступа..."
chown -R archetypal-bot:archetypal-bot "$PROJECT_PATH"
chmod +x "$PROJECT_PATH/src/bot-autonomous.js"

# Копирование сервисного файла
echo "📋 Установка сервисного файла..."
cp "$PROJECT_PATH/archetypal-bot.service" /etc/systemd/system/

# Обновление пути в сервисном файле
sed -i "s|/Users/albertmusaev/курсор бот|$PROJECT_PATH|g" /etc/systemd/system/archetypal-bot.service

# Перезагрузка systemd
echo "🔄 Перезагрузка systemd..."
systemctl daemon-reload

# Включение автозапуска
echo "🚀 Включение автозапуска..."
systemctl enable archetypal-bot

# Запуск сервиса
echo "▶️  Запуск сервиса..."
systemctl start archetypal-bot

# Проверка статуса
echo "📊 Проверка статуса..."
sleep 3
systemctl status archetypal-bot --no-pager

echo ""
echo "✅ Установка завершена!"
echo ""
echo "🔧 Управление сервисом:"
echo "   - Статус: sudo systemctl status archetypal-bot"
echo "   - Остановка: sudo systemctl stop archetypal-bot"
echo "   - Запуск: sudo systemctl start archetypal-bot"
echo "   - Перезапуск: sudo systemctl restart archetypal-bot"
echo "   - Логи: sudo journalctl -u archetypal-bot -f"
echo ""
echo "🎉 Бот запущен и будет автоматически перезапускаться при перезагрузке системы!"
