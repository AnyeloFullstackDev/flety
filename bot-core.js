const { chromium } = require('playwright');
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

let isRunning = false;
let browser = null;

async function runBotLogic(window) {
    if (isRunning) return;
    isRunning = true;

    const sendLog = (message, type = '') => {
        if (window && !window.isDestroyed()) {
            window.webContents.send('bot-log', { message, type });
        }
    };

    const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });

    async function sendStepScreenshot(page, stepName) {
        const pathStr = `step_${Date.now()}.png`;
        try {
            await page.screenshot({ path: pathStr });
            await bot.sendPhoto(process.env.TELEGRAM_CHAT_ID, pathStr, {
                caption: `📸 PASO: ${stepName}`
            });
            sendLog(`Captura enviada: ${stepName}`, 'success');
        } catch (err) {
            sendLog(`Error en captura ${stepName}: ${err.message}`, 'error');
        }
    }

    try {
        sendLog('⚡ Bot Centinela MODO ULTRA-SPEED Activado.', 'system');

        browser = await chromium.launch({
            headless: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            viewport: { width: 1366, height: 768 }
        });

        await context.route('**/*.{png,jpg,jpeg,gif,svg,woff,pdf,ico}', route => route.abort());
        const page = await context.newPage();

        async function login() {
            sendLog('🔑 Iniciando sesión en Flety...');
            try {
                const currentUrl = page.url();
                if (currentUrl.includes('partner_incoming_requests') || currentUrl.includes('partner_providers')) {
                    sendLog('✅ Sesión ya activa.', 'success');
                    return true;
                }

                await page.goto('https://flety.io/partner_login', { waitUntil: 'domcontentloaded', timeout: 30000 });

                if (page.url().includes('partner_incoming_requests')) return true;

                await page.waitForSelector('#email', { timeout: 5000 });
                await page.fill('#email', process.env.FLETY_USER);
                await page.fill('#Password', process.env.FLETY_PASS);
                await page.click('button:has-text("Acceso")');

                await page.waitForURL(url => !url.href.includes('login'), { timeout: 8000 });

                if (page.url().includes('partner_incoming_requests') || page.url().includes('dashboard')) {
                    sendLog('✅ Acceso concedido.', 'success');
                    return true;
                }
                return false;
            } catch (err) {
                sendLog('❌ Error en login: ' + err.message, 'error');
                return false;
            }
        }

        while (isRunning) {
            if (!(await login())) {
                sendLog('⏳ Reintentando login en 10s...', 'warning');
                await page.waitForTimeout(10000);
                continue;
            }

            sendLog('🔎 Revisando viajes...', 'system');
            if (!page.url().includes('partner_incoming_requests')) {
                await page.goto('https://flety.io/partner_incoming_requests', { waitUntil: 'domcontentloaded' });
            }

            const selectorCaza = 'div.trip-action:has-text("Programar"), a:has-text("Programar"), button:has-text("Programar")';

            let hayViaje = false;
            try {
                await page.waitForSelector(selectorCaza, { timeout: 5000 });
                hayViaje = true;
            } catch (e) {
                hayViaje = false;
            }

            if (hayViaje) {
                sendLog('⚡ ¡FLETE DETECTADO!', 'success');
                await page.click(selectorCaza);

                const dropCat = 'button[data-id="available_vehicles"]';
                await page.waitForSelector(dropCat, { timeout: 5000 });

                try {
                    await page.click(dropCat);
                    await page.waitForSelector('li a span.text:has-text("A31AY2M")', { timeout: 2000 });
                    await page.click('li a span.text:has-text("A31AY2M")');
                    sendLog('✅ Categoría seleccionada.');

                    const dropChofer = 'button[data-id="available_drivers"]';
                    await page.click(dropChofer);
                    await page.waitForSelector('li a span.text:has-text("Jhonny")', { timeout: 2000 });
                    await page.click('li a span.text:has-text("Jhonny")');
                    sendLog('✅ Chofer seleccionado.');

                    await page.click('#show_trip_book_details_btn');
                    await page.waitForSelector('#check_pay_btn', { timeout: 5000 });
                    await page.click('#check_pay_btn');

                    sendLog('🎉 ¡VIAJE RESERVADO CON ÉXITO!', 'success');
                    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, '🎉🚛 VIAJE RESERVADO CON EXITO!');
                } catch (e) {
                    sendLog('⚠️ Error en reserva: ' + e.message, 'warning');
                }
            }

            // Logout para limpiar sesión
            await page.goto('https://flety.io/partner_sign_out').catch(() => { });
            const waitTime = Math.floor(Math.random() * 5000) + 2000;
            sendLog(`😴 Esperando ${Math.floor(waitTime / 1000)}s...`);
            await page.waitForTimeout(waitTime);
        }

    } catch (err) {
        sendLog('💥 Error Fatal: ' + err.message, 'error');
    } finally {
        if (browser) await browser.close();
        isRunning = false;
    }
}

function stopBotLogic() {
    isRunning = false;
}

module.exports = { runBotLogic, stopBotLogic };
