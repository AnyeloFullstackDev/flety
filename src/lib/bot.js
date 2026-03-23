const { chromium } = require('playwright');
const TelegramBot = require('node-telegram-bot-api');

class SentinelBot {
    constructor() {
        this.isRunning = false;
        this.browser = null;
        this.bot = null;
        this.logs = [];
        this.tripCount = 0;
        //this.lastCycleTime = '--:--';
    }

    addLog(msg) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${msg}`;
        console.log(logEntry);
        this.logs.push(logEntry);
        if (this.logs.length > 50) this.logs.shift();
    }

    async sendStepScreenshot(page, stepName) {
        const path = `step_${Date.now()}.png`;
        try {
            await page.screenshot({ path });
            if (this.bot) {
                await this.bot.sendPhoto(process.env.TELEGRAM_CHAT_ID, path, {
                    caption: `📸 PASO: ${stepName}`
                });
            }
            this.addLog(`Captura enviada: ${stepName}`);
        } catch (err) {
            this.addLog(`Error en captura ${stepName}: ${err.message}`);
        }
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.addLog('⚡ Bot Centinela MODO ULTRA-SPEED Activado.');

        try {
            this.bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });

            this.browser = await chromium.launch({
                headless: true,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu'
                ]
            });

            const context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                viewport: { width: 1366, height: 768 }
            });

            await context.route('**/*.{png,jpg,jpeg,gif,svg,woff,pdf,ico}', route => route.abort());
            const page = await context.newPage();

            const login = async () => {
                this.addLog('🔑 Iniciando sesión en Flety...');
                try {
                    const currentUrl = page.url();
                    if (currentUrl.includes('partner_incoming_requests') || currentUrl.includes('partner_providers')) {
                        return true;
                    }

                    await page.goto('https://flety.io/partner_login', { waitUntil: 'domcontentloaded', timeout: 30000 });

                    if (page.url().includes('partner_incoming_requests') || page.url().includes('partner_providers')) {
                        return true;
                    }

                    await page.waitForSelector('#email', { timeout: 5000 }).catch(() => { });
                    if (await page.isVisible('#email')) {
                        await page.fill('#email', process.env.FLETY_USER);
                        await page.fill('#Password', process.env.FLETY_PASS);
                        await page.click('button:has-text("Acceso")');
                        try {
                            await page.waitForURL(url => !url.includes('login'), { timeout: 8000 });
                        } catch (e) { }
                    }

                    const finalUrl = page.url();
                    return finalUrl.includes('partner_incoming_requests') || finalUrl.includes('partner_providers') || finalUrl.includes('dashboard');
                } catch (err) {
                    this.addLog(`Error crítico en login: ${err.message}`);
                    return false;
                }
            };

            while (this.isRunning) {
                try {
                    if (!(await login())) {
                        this.addLog('⏳ Error en login, reintentando en 30s...');
                        await page.waitForTimeout(30000);
                        continue;
                    }

                    this.addLog('🔎 Revisando viajes...');
                    if (!page.url().includes('partner_incoming_requests')) {
                        await page.goto('https://flety.io/partner_incoming_requests', { waitUntil: 'domcontentloaded', timeout: 30000 });
                    }

                    const selectorCaza = 'div.trip-action:has-text("Programar"), a:has-text("Programar"), button:has-text("Programar")';
                    let hayViaje = false;
                    try {
                        await page.waitForSelector(selectorCaza, { timeout: 10000 });
                        hayViaje = true;
                    } catch (e) { }

                    if (hayViaje) {
                        this.addLog('⚡ ¡FLETE DETECTADO!');
                        await page.click(selectorCaza);

                        const dropCat = 'button[data-id="available_vehicles"]';
                        await page.waitForSelector(dropCat, { timeout: 5000 });

                        // Seleccionar categoría
                        try {
                            if (await page.isVisible(dropCat)) {
                                await page.click(dropCat);
                                await page.waitForSelector(`li a span.text:has-text(${process.env.PLACA_VEHICULO})`, { timeout: 2000 });
                                await page.click(`li a span.text:has-text(${process.env.PLACA_VEHICULO})`);
                            }
                        } catch (e) { }

                        // Seleccionar chofer
                        try {
                            const dropChofer = 'button[data-id="available_drivers"]';
                            await page.waitForSelector(dropChofer, { timeout: 2000 });
                            await page.click(dropChofer);
                            await page.waitForSelector(`li a span.text:has-text(${process.env.CONDUCTOR_VEHICULO})`, { timeout: 2000 });
                            await page.click(`li a span.text:has-text(${process.env.CONDUCTOR_VEHICULO})`);
                        } catch (e) { }

                        // Confirmar y Reservar
                        const btnFinal = '#show_trip_book_details_btn';
                        try {
                            await page.waitForSelector(btnFinal, { timeout: 3000 });
                            await page.click(btnFinal);
                            const btnReservar = '#check_pay_btn';
                            await page.waitForSelector(btnReservar, { timeout: 5000 });
                            await page.click(btnReservar);
                            this.tripCount++;
                            this.addLog('🎉 ¡VIAJE RESERVADO CON ÉXITO!');
                            if (this.bot) await this.bot.sendMessage(process.env.TELEGRAM_CHAT_ID, '🎉🚛 VIAJE RESERVADO CON EXITO!');
                        } catch (e) { }

                        await page.goto('https://flety.io/partner_incoming_requests', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { });
                    }

                    // Logout y espera
                    try {
                        const logoutSelector = 'a[href="/partner_sign_out"]';
                        if (await page.isVisible(logoutSelector)) {
                            await page.click(logoutSelector);
                        } else {
                            await page.goto('https://flety.io/partner_sign_out').catch(() => { });
                        }
                        await page.waitForTimeout(2000);
                    } catch (err) {
                        await context.clearCookies().catch(() => { });
                    }

                    const waitTime = Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000;
                    this.addLog(`😴 Esperando ${Math.floor(waitTime / 1000)} segundos...`);
                    this.lastCycleTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    await page.waitForTimeout(waitTime);

                } catch (error) {
                    this.addLog(`Error en ciclo: ${error.message}`);
                    if (error.message.includes('browser has been closed')) break;
                    await page.waitForTimeout(10000);
                }
            }
        } catch (err) {
            this.addLog(`Falló el inicio del bot: ${err.message}`);
            this.isRunning = false;
        } finally {
            if (this.browser) {
                await this.browser.close().catch(() => { });
                this.browser = null;
            }
            this.isRunning = false;
            this.addLog('🧹 Bot detenido.');
        }
    }

    async stop() {
        this.isRunning = false;
        this.addLog('🛑 Solicitando detención del bot...');
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            logs: this.logs,
            tripCount: this.tripCount,
            lastCycleTime: this.lastCycleTime
        };
    }
}

// Persistencia en desarrollo
if (!global.sentinelBot) {
    global.sentinelBot = new SentinelBot();
}

module.exports = global.sentinelBot;
