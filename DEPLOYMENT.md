# 🚀 Деплой Telegram-бота на сервер

## 📋 Варианты деплоя

### 1. 🆓 Бесплатные варианты

#### A) Railway.app (Рекомендуется)
- **Плюсы**: Простой деплой, бесплатный план, автоматический деплой из GitHub
- **Минусы**: Ограничения на бесплатном плане
- **Стоимость**: Бесплатно до 500 часов в месяц

#### B) Render.com
- **Плюсы**: Бесплатный план, простой деплой
- **Минусы**: Приложения "засыпают" на бесплатном плане
- **Стоимость**: Бесплатно

#### C) Heroku
- **Плюсы**: Популярная платформа
- **Минусы**: Нет бесплатного плана
- **Стоимость**: $5-7/месяц

### 2. 💰 Платные варианты

#### A) DigitalOcean App Platform
- **Плюсы**: Надежность, хорошая производительность
- **Стоимость**: $5-12/месяц

#### B) AWS EC2
- **Плюсы**: Максимальная гибкость
- **Стоимость**: $3-10/месяц

## 🛠️ Подготовка к деплою

### 1. Создание GitHub репозитория

```bash
# Инициализация Git
git init

# Создание .gitignore
echo "node_modules/
.env
temp/
logs/
*.pid
*.log" > .gitignore

# Добавление файлов
git add .

# Первый коммит
git commit -m "Initial commit: Telegram bot for archetypal cards"

# Создание репозитория на GitHub (через веб-интерфейс)
# Затем подключение
git remote add origin https://github.com/YOUR_USERNAME/archetypal-cards-bot.git
git branch -M main
git push -u origin main
```

### 2. Подготовка файлов для деплоя

Создайте файл `Procfile` (для Heroku/Railway):
```
worker: node src/bot-with-emojis.js
```

Создайте файл `railway.json` (для Railway):
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node src/bot-with-emojis.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## 🚀 Деплой на Railway.app (Рекомендуется)

### Шаг 1: Регистрация
1. Перейдите на [railway.app](https://railway.app)
2. Войдите через GitHub
3. Нажмите "New Project"
4. Выберите "Deploy from GitHub repo"
5. Выберите ваш репозиторий

### Шаг 2: Настройка переменных окружения
В настройках проекта добавьте:
- `TELEGRAM_BOT_TOKEN` = ваш токен бота
- `OPENAI_API_KEY` = ваш ключ OpenAI

### Шаг 3: Деплой
Railway автоматически:
- Установит зависимости из `package.json`
- Запустит бота
- Обеспечит автоматический рестарт при сбоях

## 🚀 Деплой на Render.com

### Шаг 1: Регистрация
1. Перейдите на [render.com](https://render.com)
2. Войдите через GitHub
3. Нажмите "New +" → "Web Service"
4. Подключите ваш репозиторий

### Шаг 2: Настройка
- **Build Command**: `npm install`
- **Start Command**: `node src/bot-with-emojis.js`
- **Environment**: Node

### Шаг 3: Переменные окружения
Добавьте в Environment Variables:
- `TELEGRAM_BOT_TOKEN`
- `OPENAI_API_KEY`

## 🚀 Деплой на DigitalOcean App Platform

### Шаг 1: Создание приложения
1. Перейдите в [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Нажмите "Create App"
3. Подключите GitHub репозиторий

### Шаг 2: Настройка
- **Source**: GitHub
- **Branch**: main
- **Build Command**: `npm install`
- **Run Command**: `node src/bot-with-emojis.js`

### Шаг 3: Переменные окружения
Добавьте переменные в настройках приложения.

## 🔧 Оптимизация для продакшена

### 1. Создайте файл `ecosystem.config.js` (для PM2)
```javascript
module.exports = {
  apps: [{
    name: 'archetypal-bot',
    script: 'src/bot-with-emojis.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
```

### 2. Обновите `package.json`
```json
{
  "scripts": {
    "start": "node src/bot-with-emojis.js",
    "dev": "nodemon src/bot-with-emojis.js",
    "pm2": "pm2 start ecosystem.config.js",
    "pm2:stop": "pm2 stop archetypal-bot",
    "pm2:restart": "pm2 restart archetypal-bot"
  }
}
```

### 3. Создайте файл `Dockerfile` (опционально)
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p temp logs

EXPOSE 3000

CMD ["node", "src/bot-with-emojis.js"]
```

## 📊 Мониторинг и логи

### Railway.app
- Логи доступны в веб-интерфейсе
- Автоматический рестарт при сбоях
- Метрики использования

### Render.com
- Логи в веб-интерфейсе
- Уведомления о сбоях
- Мониторинг производительности

### DigitalOcean
- Детальные логи
- Мониторинг ресурсов
- Алерты

## 🔒 Безопасность

### 1. Переменные окружения
- Никогда не коммитьте `.env` файл
- Используйте секреты платформы
- Регулярно ротируйте ключи

### 2. Ограничения
- Настройте rate limiting
- Мониторьте использование API
- Установите лимиты на запросы

## 💰 Сравнение стоимости

| Платформа | Бесплатно | Платно | Надежность |
|-----------|-----------|--------|------------|
| Railway.app | 500 часов/месяц | $5/месяц | ⭐⭐⭐⭐⭐ |
| Render.com | Есть (с ограничениями) | $7/месяц | ⭐⭐⭐⭐ |
| DigitalOcean | Нет | $5/месяц | ⭐⭐⭐⭐⭐ |
| Heroku | Нет | $7/месяц | ⭐⭐⭐⭐ |

## 🎯 Рекомендация

**Для начала**: Railway.app
- Простой деплой
- Бесплатный план
- Автоматический рестарт
- Хорошая документация

**Для продакшена**: DigitalOcean App Platform
- Надежность
- Хорошая производительность
- Детальный мониторинг
- Гибкость настройки

## 📞 Поддержка

Если возникнут проблемы:
1. Проверьте логи в веб-интерфейсе платформы
2. Убедитесь, что переменные окружения установлены
3. Проверьте, что бот запускается локально
4. Обратитесь к документации платформы
