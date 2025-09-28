#!/usr/bin/env node

/**
 * Мониторинг производительности бота
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

class BotMonitor {
    constructor() {
        this.startTime = Date.now();
        this.metrics = {
            requests: 0,
            errors: 0,
            imagesGenerated: 0,
            sessionsActive: 0,
            memoryUsage: 0,
            cpuUsage: 0
        };
        
        this.startMonitoring();
    }
    
    startMonitoring() {
        console.log('📊 Запуск мониторинга производительности...');
        
        setInterval(() => {
            this.collectMetrics();
            this.displayMetrics();
            this.checkAlerts();
        }, 30000); // каждые 30 секунд
        
        // Детальный мониторинг каждые 5 минут
        setInterval(() => {
            this.generateReport();
        }, 300000);
    }
    
    collectMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        this.metrics = {
            ...this.metrics,
            memoryUsage: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            cpuUsage: Math.round(cpuUsage.user / 1000000), // seconds
            uptime: Math.round((Date.now() - this.startTime) / 1000),
            loadAverage: os.loadavg()[0],
            freeMemory: Math.round(os.freemem() / 1024 / 1024), // MB
            totalMemory: Math.round(os.totalmem() / 1024 / 1024) // MB
        };
    }
    
    displayMetrics() {
        const { memoryUsage, cpuUsage, uptime, loadAverage, freeMemory, totalMemory } = this.metrics;
        
        console.log(`
📊 === МОНИТОРИНГ ПРОИЗВОДИТЕЛЬНОСТИ ===
⏱️  Время работы: ${Math.floor(uptime / 60)}м ${uptime % 60}с
💾 Память: ${memoryUsage}MB / ${totalMemory}MB (${Math.round(memoryUsage/totalMemory*100)}%)
🖥️  CPU: ${cpuUsage}с, Load: ${loadAverage.toFixed(2)}
🆓 Свободно памяти: ${freeMemory}MB
📈 Запросов: ${this.metrics.requests}, Ошибок: ${this.metrics.errors}
🖼️  Изображений: ${this.metrics.imagesGenerated}
👥 Активных сессий: ${this.metrics.sessionsActive}
        `);
    }
    
    checkAlerts() {
        const { memoryUsage, totalMemory, loadAverage } = this.metrics;
        
        // Предупреждение о памяти
        if (memoryUsage / totalMemory > 0.8) {
            console.log('⚠️  ВНИМАНИЕ: Высокое использование памяти!');
        }
        
        // Предупреждение о нагрузке
        if (loadAverage > os.cpus().length) {
            console.log('⚠️  ВНИМАНИЕ: Высокая нагрузка на систему!');
        }
        
        // Предупреждение о свободной памяти
        if (this.metrics.freeMemory < 100) {
            console.log('⚠️  ВНИМАНИЕ: Мало свободной памяти!');
        }
    }
    
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            uptime: this.metrics.uptime,
            memory: {
                used: this.metrics.memoryUsage,
                free: this.metrics.freeMemory,
                total: this.metrics.totalMemory,
                percentage: Math.round(this.metrics.memoryUsage/this.metrics.totalMemory*100)
            },
            performance: {
                requests: this.metrics.requests,
                errors: this.metrics.errors,
                errorRate: this.metrics.requests > 0 ? Math.round(this.metrics.errors/this.metrics.requests*100) : 0,
                imagesGenerated: this.metrics.imagesGenerated,
                sessionsActive: this.metrics.sessionsActive
            },
            system: {
                loadAverage: this.metrics.loadAverage,
                cpuCores: os.cpus().length,
                platform: os.platform(),
                nodeVersion: process.version
            }
        };
        
        // Сохраняем отчет
        const reportPath = path.join(__dirname, 'reports', `report_${Date.now()}.json`);
        const reportsDir = path.dirname(reportPath);
        
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📋 Отчет сохранен: ${reportPath}`);
        
        // Очищаем старые отчеты (старше 7 дней)
        this.cleanupOldReports(reportsDir);
    }
    
    cleanupOldReports(reportsDir) {
        try {
            const files = fs.readdirSync(reportsDir);
            const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            
            files.forEach(file => {
                const filePath = path.join(reportsDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime.getTime() < weekAgo) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️  Удален старый отчет: ${file}`);
                }
            });
        } catch (error) {
            console.error('Ошибка очистки отчетов:', error);
        }
    }
    
    // Методы для обновления метрик
    incrementRequests() {
        this.metrics.requests++;
    }
    
    incrementErrors() {
        this.metrics.errors++;
    }
    
    incrementImages() {
        this.metrics.imagesGenerated++;
    }
    
    updateSessions(count) {
        this.metrics.sessionsActive = count;
    }
}

module.exports = BotMonitor;
