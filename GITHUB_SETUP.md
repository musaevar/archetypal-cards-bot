# 🚀 Настройка GitHub репозитория

## 📋 Пошаговая инструкция

### 1. Создайте репозиторий на GitHub

1. Перейдите на [github.com](https://github.com)
2. Нажмите зеленую кнопку "New" или "+" → "New repository"
3. Заполните форму:
   - **Repository name**: `archetypal-cards-bot`
   - **Description**: `Telegram bot for generating archetypal cards with GPT-4.1, emojis, and optimized UX`
   - **Visibility**: Public ✅
   - **Initialize**: НЕ ставьте галочки (у нас уже есть код)
4. Нажмите "Create repository"

### 2. Подключите локальный репозиторий

После создания репозитория GitHub покажет инструкции. Выполните:

```bash
# Подключите удаленный репозиторий
git remote add origin https://github.com/albertmusaev/archetypal-cards-bot.git

# Запушьте код
git push -u origin main
```

### 3. Проверьте результат

После пуша ваш код будет доступен по адресу:
https://github.com/albertmusaev/archetypal-cards-bot

## 🎯 Готово к деплою!

После создания репозитория вы сможете:

1. **Деплоить на Railway.app**:
   - Перейти на [railway.app](https://railway.app)
   - Войти через GitHub
   - Выбрать ваш репозиторий
   - Добавить переменные окружения
   - Деплоить!

2. **Деплоить на Render.com**:
   - Перейти на [render.com](https://render.com)
   - Войти через GitHub
   - Создать Web Service
   - Подключить репозиторий
   - Настроить и деплоить!

## 📖 Документация

- `README.md` - основная документация
- `DEPLOYMENT.md` - подробная инструкция по деплою
- `QUICK_DEPLOY.md` - быстрый старт

## 🔧 Файлы для деплоя

Все необходимые файлы уже готовы:
- ✅ `Procfile` - для Heroku/Railway
- ✅ `railway.json` - для Railway
- ✅ `Dockerfile` - для Docker
- ✅ `ecosystem.config.js` - для PM2
- ✅ `package.json` - с правильными скриптами

## 🎉 Результат

После деплоя ваш бот будет:
- 🔄 Работать 24/7 на сервере
- 🚀 Автоматически перезапускаться при сбоях
- 📊 Логировать все действия
- 💰 Работать бесплатно (на Railway.app)
- 🌍 Быть доступным пользователям по всему миру

**Удачи с деплоем! 🚀**
