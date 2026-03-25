const { chromium } = require('playwright');
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Validar que las variables de entorno existan
const requiredEnv = ['TELEGRAM_TOKEN', 'TELEGRAM_CHAT_ID', 'FLETY_USER', 'FLETY_PASS'];
for (const envVar of requiredEnv) {
    if (!process.env[envVar] || process.env[envVar].includes('tu_')) {
        console.error(`❌ ERROR: Debes configurar ${envVar} en el archivo .env`);
        process.exit(1);
    }
}

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });

async function sendStepScreenshot(page, stepName) {
    const path = `step_${Date.now()}.png`;
    try {
        await page.screenshot({ path });
        await bot.sendPhoto(process.env.TELEGRAM_CHAT_ID, path, {
            caption: `📸 PASO: ${stepName}`
        });
        console.log(`[DEBUG] Captura enviada: ${stepName}`);
    } catch (err) {
        console.error(`❌ Error en captura ${stepName}:`, err.message);
    }
}


let browserInstance = null;
let isRunning = false;

async function runBotLogic(win = null) {
    if (isRunning) return;
    isRunning = true;
    const log = (msg, type = '') => {
        console.log(msg);
        if (win) win.webContents.send('bot-log', { message: msg, type });
    };
    log('⚡ Bot Centinela MODO ULTRA-SPEED Activado.', 'system');

    const browser = await chromium.launch({
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
    browserInstance = browser;

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 }
    });

    // Solo bloqueamos imágenes y fuentes para mantener velocidad
    await context.route('**/*.{png,jpg,jpeg,gif,svg,woff,pdf,ico}', route => route.abort());

    const page = await context.newPage();

    async function login() {
        log(`[${new Date().toLocaleTimeString()}] 🔑 Iniciando sesión en Flety...`);
        try {
            const currentUrl = page.url();
            if (currentUrl.includes('partner_incoming_requests') || currentUrl.includes('partner_providers')) {
                log('✅ Sesión ya activa, sin necesidad de login.');
                return true;
            }

            await page.goto('https://flety.io/partner_login', { waitUntil: 'domcontentloaded', timeout: 30000 });

            if (page.url().includes('partner_incoming_requests') || page.url().includes('partner_providers')) {
                log('✅ Sesión detectada activa por redirección.');
                return true;
            }

            await page.waitForSelector('#email', { timeout: 5000 }).catch(() => { });
            if (await page.isVisible('#email')) {
                await page.fill('#email', process.env.FLETY_USER);
                await page.fill('#Password', process.env.FLETY_PASS);
                await page.click('button:has-text("Acceso")');

                try {
                    await page.waitForURL(url => !url.includes('login'), { timeout: 8000 });
                } catch (e) {
                    log('⚠️ Redirección lenta, verificando...', 'warning');
                }
            }

            const finalUrl = page.url();
            if (finalUrl.includes('partner_incoming_requests') || finalUrl.includes('partner_providers') || finalUrl.includes('dashboard')) {
                log('✅ Acceso concedido.');
                return true;
            } else {
                log('❌ Login fallido o bloqueado.', 'error');
                sendStepScreenshot(page, "ERROR_LOGIN");
                return false;
            }
        } catch (err) {
            log('❌ Error crítico en login: ' + err.message, 'error');
            return false;
        }
    }

    log('--- 🏹 Iniciando Vigilancia por Ciclos de Sesión Limpia ---');

    while (isRunning) {
        try {
            // 1. LOGIN
            if (!(await login())) {
                log('⏳ Error en login, reintentando en 30s...');
                await page.waitForTimeout(30000);
                continue;
            }

            // 2. REVISIÓN DE VIAJES
            log(`[${new Date().toLocaleTimeString()}] 🔎 Revisando viajes...`);
            if (!page.url().includes('partner_incoming_requests')) {
                await page.goto('https://flety.io/partner_incoming_requests', { waitUntil: 'domcontentloaded', timeout: 30000 });
            }

            const selectorCaza = 'div.trip-action:has-text("Programar"), a:has-text("Programar"), button:has-text("Programar")';

            let hayViaje = false;
            try {
                await page.waitForSelector(selectorCaza, { timeout: 10000 });
                hayViaje = true;
            } catch (e) {
                hayViaje = false;
            }

            if (hayViaje) {
                log('⚡ ¡FLETE DETECTADO!', 'success');
                await page.click(selectorCaza);
                //sendStepScreenshot(page, "FLETE_DETECTADO");
                const dropCat = 'button[data-id="available_vehicles"]';
                await page.waitForSelector(dropCat, { timeout: 5000 });

                // 1. SELECCIONAR CATEGORÍA
                try {
                    if (await page.isVisible(dropCat)) {
                        await page.click(dropCat);
                        await page.waitForSelector('li a span.text:has-text("G4JGBL")', { timeout: 2000 });
                        await page.click('li a span.text:has-text("G4JGBL")');
                        //sendStepScreenshot(page, "CATEGORIA_G4JGBL_SELECCIONADA");
                        log('✅ Categoría G4JGBL seleccionada.');
                    } else {
                        const selCat = 'text="Seleccionar una Categoría"';
                        if (await page.isVisible(selCat)) {
                            await page.click(selCat);
                            await page.waitForSelector('li a span.text:has-text("G4JGBL")', { timeout: 2000 });
                            await page.click('li a span.text:has-text("G4JGBL")');
                            //sendStepScreenshot(page, "CATEGORIA_G4JGBL_SELECCIONADA");
                        }
                    }
                } catch (e) {
                    log('⚠️ Error seleccionando categoría: ' + e.message, 'warning');
                }

                // 2. SELECCIONAR CHOFER
                try {
                    const dropChofer = 'button[data-id="available_drivers"]';
                    if (await page.isVisible(dropChofer)) {
                        await page.click(dropChofer);
                        await page.waitForSelector('li a span.text:has-text("Jhonny")', { timeout: 2000 });
                        await page.click('li a span.text:has-text("Jhonny")');
                        //sendStepScreenshot(page, "CHOFER_JHONNY_CORREA_SELECCIONADO");
                        log('✅ Chofer Jhonny Correa seleccionado.');
                    } else {
                        const selChofer = 'text="Selecciona un chofer"';
                        if (await page.isVisible(selChofer)) {
                            await page.click(selChofer);
                            await page.waitForSelector('li a span.text:has-text("Jhonny")', { timeout: 2000 });
                            await page.click('li a span.text:has-text("Jhonny")');
                            //sendStepScreenshot(page, "CHOFER_JHONNY_CORREA_SELECCIONADO");
                        }
                    }
                } catch (e) {
                    log('⚠️ Error seleccionando chofer: ' + e.message, 'warning');
                }

                // 3. CONFIRMAR + RESERVAR
                const btnFinal = '#show_trip_book_details_btn';
                try {
                    await page.waitForSelector(btnFinal, { timeout: 3000 });
                    await page.click(btnFinal);
                    //sendStepScreenshot(page, "CONFIRMAR");
                    log('✅ Paso 1: Confirmar completado.');

                    const btnReservar = '#check_pay_btn';
                    await page.waitForSelector(btnReservar, { timeout: 5000 });
                    await page.click(btnReservar);
                    //sendStepScreenshot(page, "RESERVAR");
                    log('🎉 ¡VIAJE RESERVADO CON ÉXITO!', 'success');

                    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, '🎉🚛 VIAJE RESERVADO CON EXITO!');
                    sendStepScreenshot(page, "VIAJE_RESERVADO");
                } catch (e) {
                    log('⚠️ Error en confirmación/reserva: ' + e.message, 'warning');
                    sendStepScreenshot(page, "ERROR EN CONFIRMACION");
                }

                await page.goto('https://flety.io/partner_incoming_requests', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { });
            } else {
                log('📭 No hay viajes disponibles.');
            }

            // 3. CERRAR SESIÓN
            log('🚪 Cerrando sesión para mantener frescura...');
            try {
                const logoutSelector = 'a[href="/partner_sign_out"]';
                if (await page.isVisible(logoutSelector)) {
                    await page.click(logoutSelector);
                    log('✅ Logout exitoso via clic.');
                } else {
                    log('⚠️ Botón de logout no visible, usando navegación directa...');
                    await page.goto('https://flety.io/partner_sign_out').catch(() => { });
                }
                await page.waitForTimeout(2000);
            } catch (err) {
                log('⚠️ Error al cerrar sesión, limpiando cookies...', 'warning');
                await context.clearCookies().catch(() => { });
            }

            // 4. ESPERA ALEATORIA
            const waitTime = Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000;
            log(`😴 Esperando ${Math.floor(waitTime / 1000)} segundos para el próximo ciclo...`);
            await page.waitForTimeout(waitTime);

        } catch (error) {
            log(`\n❌ Error en ciclo: ${error.message}`, 'error');
            if (error.message.includes('browser has been closed') || error.message.includes('Target page')) {
                log('💀 Browser cerrado. Terminando bot.', 'error');
                break;
            }
            await context.clearCookies().catch(() => { });
            await page.waitForTimeout(10000);
        }
    }
    isRunning = false;
}


function stopBotLogic() {
    console.log('🛑 Deteniendo bot...');
    isRunning = false;
    if (browserInstance) {
        browserInstance.close().catch(() => { });
        browserInstance = null;
    }
}

module.exports = { runBotLogic, stopBotLogic, getStatus: () => isRunning };