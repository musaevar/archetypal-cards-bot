/**
 * Конфигурация для высокой нагрузки
 */

module.exports = {
    // Основные настройки
    MAX_CONCURRENT_REQUESTS: process.env.MAX_CONCURRENT_REQUESTS || 10,
    RATE_LIMIT_PER_USER: process.env.RATE_LIMIT_PER_USER || 2,
    IMAGE_CACHE_TTL: process.env.IMAGE_CACHE_TTL || 3600000, // 1 час
    MAX_SESSION_SIZE: process.env.MAX_SESSION_SIZE || 1000,
    CLEANUP_INTERVAL: process.env.CLEANUP_INTERVAL || 300000, // 5 минут
    
    // Таймауты
    WORKER_TIMEOUT: process.env.WORKER_TIMEOUT || 30000,
    IMAGE_DOWNLOAD_TIMEOUT: process.env.IMAGE_DOWNLOAD_TIMEOUT || 30000,
    OPENAI_TIMEOUT: process.env.OPENAI_TIMEOUT || 60000,
    
    // Повторные попытки
    RETRY_ATTEMPTS: process.env.RETRY_ATTEMPTS || 3,
    RETRY_DELAY: process.env.RETRY_DELAY || 1000,
    
    // Telegram настройки
    TELEGRAM_POLLING_INTERVAL: process.env.TELEGRAM_POLLING_INTERVAL || 1000,
    TELEGRAM_TIMEOUT: process.env.TELEGRAM_TIMEOUT || 10,
    
    // Мониторинг
    METRICS_INTERVAL: process.env.METRICS_INTERVAL || 60000,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    
    // Кластеризация
    ENABLE_CLUSTERING: process.env.ENABLE_CLUSTERING === 'true',
    WORKER_COUNT: process.env.WORKER_COUNT || require('os').cpus().length,
    
    // Кэширование
    ENABLE_IMAGE_CACHE: process.env.ENABLE_IMAGE_CACHE !== 'false',
    ENABLE_TEXT_CACHE: process.env.ENABLE_TEXT_CACHE !== 'false',
    
    // Очереди
    QUEUE_PRIORITY_HIGH: 2,
    QUEUE_PRIORITY_NORMAL: 1,
    QUEUE_PRIORITY_LOW: 0,
    
    // Лимиты памяти
    MAX_MEMORY_USAGE: process.env.MAX_MEMORY_USAGE || 0.8, // 80% от доступной памяти
    FORCE_GC_INTERVAL: process.env.FORCE_GC_INTERVAL || 300000, // 5 минут
};
