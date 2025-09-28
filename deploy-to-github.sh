#!/bin/bash

echo "🚀 Подготовка к деплою на GitHub"
echo "==============================="

# Проверка Git
if ! command -v git &> /dev/null; then
    echo "❌ Git не найден. Установите Git"
    exit 1
fi

# Инициализация Git (если не инициализирован)
if [ ! -d ".git" ]; then
    echo "📁 Инициализация Git репозитория..."
    git init
fi

# Создание .gitignore если не существует
if [ ! -f ".gitignore" ]; then
    echo "📝 Создание .gitignore..."
    cat > .gitignore << EOF
node_modules/
.env
temp/
logs/
*.pid
*.log
.DS_Store
*.swp
*.swo
EOF
fi

# Добавление файлов
echo "📦 Добавление файлов в Git..."
git add .

# Проверка статуса
echo "📊 Статус Git:"
git status

echo ""
echo "✅ Готово к коммиту!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Сделайте коммит: git commit -m 'Deploy to production'"
echo "2. Создайте репозиторий на GitHub"
echo "3. Подключите репозиторий: git remote add origin https://github.com/YOUR_USERNAME/archetypal-cards-bot.git"
echo "4. Запушьте: git push -u origin main"
echo "5. Деплойте на Railway.app или Render.com"
echo ""
echo "📖 Подробная инструкция в файле DEPLOYMENT.md"
