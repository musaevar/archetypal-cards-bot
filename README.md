# 🎭 Telegram Bot for Archetypal Cards

A professional Telegram bot that generates archetypal cards based on user's psychological state using OpenAI's GPT-4.1 and DALL-E 3.

## ✨ Features

- 🤖 **GPT-4.1** for high-quality text generation
- 🎨 **DALL-E 3** for beautiful archetypal images
- 📝 **Rules of editing by Maxim Ilyakhov** for clear and understandable text
- 😊 **Emojis** in key moments for better UX
- 🔘 **Inline buttons** for convenient interaction
- 🎭 **Unified style** of images (oil painting, tarot cards)
- 🌉 **Three cards**: State, Resource, Transition
- 💡 **Practical recommendations** from CBT
- 🏥 **Link to psychotherapist**
- ⚡ **Optimized for high load**

## 🚀 Quick Deploy

### Option 1: Railway.app (Recommended)
1. Fork this repository
2. Go to [railway.app](https://railway.app)
3. Sign in with GitHub
4. Click "New Project" → "Deploy from GitHub repo"
5. Select your forked repository
6. Add environment variables:
   - `TELEGRAM_BOT_TOKEN` = your bot token
   - `OPENAI_API_KEY` = your OpenAI API key
7. Deploy! 🎉

### Option 2: Render.com
1. Fork this repository
2. Go to [render.com](https://render.com)
3. Sign in with GitHub
4. Click "New Web Service"
5. Connect your repository
6. Settings:
   - Build Command: `npm install`
   - Start Command: `node src/bot-with-emojis.js`
7. Add environment variables
8. Deploy! 🎉

## 🔧 Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/albertmusaev/archetypal-cards-bot.git
   cd archetypal-cards-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   OPENAI_API_KEY=your_openai_api_key
   ```

4. Run the bot:
   ```bash
   npm start
   ```

## 📖 Usage

1. Send `/start` to the bot
2. Describe your current state in one word or phrase
3. Get three archetypal cards:
   - **State Card** - your current psychological state
   - **Resource Card** - your inner resources
   - **Transition Card** - the bridge between them
4. Receive practical recommendations and analysis

## 🎯 Bot Scenario

1. **Greeting**: Simple and welcoming
2. **State Input**: One word or phrase about feelings
3. **Card 1 - State**: Metaphorical description of current state
4. **Card 2 - Resource**: Inner resources for transition
5. **Card 3 - Transition**: Bridge between state and resource
6. **Summary**: Key insights and practical action

## 🛠️ Technical Details

- **Node.js** with Telegram Bot API
- **OpenAI GPT-4.1** for text generation
- **DALL-E 3** for image generation
- **Optimized prompts** for consistent image style
- **Error handling** and logging
- **Session management** for user interactions
- **Memory optimization** for high load

## 📊 Monitoring

- Automatic restart on failures
- Detailed logging
- Performance metrics
- Error tracking

## 💰 Cost

- **Railway.app**: Free (500 hours/month)
- **Render.com**: Free (with limitations)
- **OpenAI API**: Pay per use (~$0.01-0.05 per session)

## 📞 Support

- Detailed deployment guide: `DEPLOYMENT.md`
- Quick start guide: `QUICK_DEPLOY.md`
- Issues and questions: GitHub Issues

## 🎨 Image Style

All images are generated in a unified style:
- Traditional oil painting on canvas
- Archetypal and metaphorical illustrations
- Foggy, mystical landscapes
- Muted earthy colors (grays, browns, pale greens)
- Tarot-style card composition
- Calm, contemplative atmosphere

## 🔒 Security

- Environment variables for sensitive data
- No hardcoded tokens
- Secure API communication
- Rate limiting and error handling

---

**Made with ❤️ for psychological well-being**