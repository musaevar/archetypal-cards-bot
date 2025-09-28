# 🚀 Быстрый деплой бота на сервер

## ⚡ Самый простой способ (Railway.app)

### 1. Создайте репозиторий на GitHub
```bash
# Коммит и пуш
git commit -m "Deploy to production"
git remote add origin https://github.com/YOUR_USERNAME/archetypal-cards-bot.git
git push -u origin main
```

### 2. Деплой на Railway.app
1. Перейдите на [railway.app](https://railway.app)
2. Войдите через GitHub
3. Нажмите "New Project" → "Deploy from GitHub repo"
4. Выберите ваш репозиторий
5. Добавьте переменные окружения:
   - `TELEGRAM_BOT_TOKEN` = ваш токен
   - `OPENAI_API_KEY` = ваш ключ OpenAI
6. Готово! Бот запустится автоматически

## 🔧 Альтернативы

### Render.com
1. [render.com](https://render.com) → "New Web Service"
2. Подключите GitHub репозиторий
3. Настройки:
   - Build Command: `npm install`
   - Start Command: `node src/bot-with-emojis.js`
4. Добавьте переменные окружения

### DigitalOcean App Platform
1. [DigitalOcean](https://cloud.digitalocean.com/apps) → "Create App"
2. Подключите GitHub
3. Настройки по умолчанию
4. Добавьте переменные окружения

## 📊 Мониторинг

После деплоя:
- Логи доступны в веб-интерфейсе платформы
- Автоматический рестарт при сбоях
- Уведомления о проблемах

## 💰 Стоимость

- **Railway.app**: Бесплатно (500 часов/месяц)
- **Render.com**: Бесплатно (с ограничениями)
- **DigitalOcean**: $5/месяц

## 🆘 Если что-то не работает

1. Проверьте логи в веб-интерфейсе
2. Убедитесь, что переменные окружения установлены
3. Проверьте, что бот работает локально
4. Обратитесь к документации платформы

## 📞 Поддержка

Подробная инструкция в файле `DEPLOYMENT.md`
