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

async function runBot() {
    console.log('⚡ Bot Centinela MODO ULTRA-SPEED Activado.');

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

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 }
    });

    // --- ELIMINAMOS EL BLOQUEO DE CSS ---
    // Solo bloqueamos imágenes y fuentes para no romper la visibilidad pero mantener velocidad
    await context.route('**/*.{png,jpg,jpeg,gif,svg,woff,pdf,ico}', route => route.abort());

    const page = await context.newPage();

    // Capturar cierres inesperados
    const cleanup = async () => {
        console.log('\n🧹 Limpiando y cerrando navegador...');
        try {
            await browser.close();
        } catch (e) { }
        process.exit();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    async function login() {
        console.log(`[${new Date().toLocaleTimeString()}] 🔑 Iniciando sesión en Flety...`);
        try {
            // Si ya estamos en una página autenticada, no naveguemos
            const currentUrl = page.url();
            if (currentUrl.includes('partner_incoming_requests') || currentUrl.includes('partner_providers')) {
                console.log('✅ Sesión ya activa, sin necesidad de login.');
                return true;
            }

            await page.goto('https://flety.io/partner_login', { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Si el server nos redirigió (sesión viva), detectarlo de inmediato
            if (page.url().includes('partner_incoming_requests') || page.url().includes('partner_providers')) {
                console.log('✅ Sesión detectada activa por redirección.');
                return true;
            }

            // Llenar formulario de login
            await page.waitForSelector('#email', { timeout: 5000 }).catch(() => { });
            if (await page.isVisible('#email')) {
                await page.fill('#email', process.env.FLETY_USER);
                await page.fill('#Password', process.env.FLETY_PASS);
                await page.click('button:has-text("Acceso")');

                // Esperamos cambio de URL en vez de timeout fijo
                try {
                    await page.waitForURL(url => !url.includes('login'), { timeout: 8000 });
                } catch (e) {
                    console.warn('⚠️ Redirección lenta, verificando...');
                }
            }

            const finalUrl = page.url();
            if (finalUrl.includes('partner_incoming_requests') || finalUrl.includes('partner_providers') || finalUrl.includes('dashboard')) {
                console.log('✅ Acceso concedido.');
                return true;
            } else {
                console.error('❌ Login fallido o bloqueado.');
                sendStepScreenshot(page, "ERROR_LOGIN"); // No bloqueante
                return false;
            }
        } catch (err) {
            console.error('❌ Error crítico en login:', err.message);
            return false;
        }
    }

    console.log('--- 🏹 Iniciando Vigilancia por Ciclos de Sesión Limpia (1s - 15s) ---');

    while (true) {
        try {
            // 1. LOGIN
            if (!(await login())) {
                console.log('⏳ Error en login, reintentando en 30s...');
                await page.waitForTimeout(30000);
                continue;
            }

            // 2. REVISIÓN DE VIAJES (solo navegar si no estamos ya ahí)
            console.log(`[${new Date().toLocaleTimeString()}] 🔎 Revisando viajes...`);
            if (!page.url().includes('partner_incoming_requests')) {
                await page.goto('https://flety.io/partner_incoming_requests', { waitUntil: 'domcontentloaded', timeout: 30000 });
            }

            const selectorCaza = 'div.trip-action:has-text("Programar"), a:has-text("Programar"), button:has-text("Programar")';

            // Damos un margen de 2.5 segundos para que los viajes aparezcan en la tabla
            let hayViaje = false;
            try {
                await page.waitForSelector(selectorCaza, { timeout: 10000 });
                hayViaje = true;
            } catch (e) {
                hayViaje = false;
            }

            if (hayViaje) {
                console.log('⚡ ¡FLETE DETECTADO!');
                await page.click(selectorCaza);

                // Esperar a que el modal cargue reactivamente
                const dropCat = 'button[data-id="available_vehicles"]';
                await page.waitForSelector(dropCat, { timeout: 5000 });
                // sendStepScreenshot(page, "MODAL ABIERTO"); // Comentado para velocidad

                // 1. SELECCIONAR CATEGORÍA (abrir dropdown y elegir A31AY2M)
                try {
                    if (await page.isVisible(dropCat)) {
                        await page.click(dropCat);
                        await page.waitForSelector('li a span.text:has-text("A31AY2M")', { timeout: 2000 });
                        await page.click('li a span.text:has-text("A31AY2M")');
                        console.log('✅ Categoría A31AY2M seleccionada.');
                    } else {
                        const selCat = 'text="Seleccionar una Categoría"';
                        if (await page.isVisible(selCat)) {
                            await page.click(selCat);
                            await page.waitForSelector('li a span.text:has-text("A31AY2M")', { timeout: 2000 });
                            await page.click('li a span.text:has-text("A31AY2M")');
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Error seleccionando categoría:', e.message);
                }

                // 2. SELECCIONAR CHOFER (abrir dropdown y elegir Jhonny Correa)
                try {
                    const dropChofer = 'button[data-id="available_drivers"]';
                    if (await page.isVisible(dropChofer)) {
                        await page.click(dropChofer);
                        await page.waitForSelector('li a span.text:has-text("Jhonny")', { timeout: 2000 });
                        await page.click('li a span.text:has-text("Jhonny")');
                        console.log('✅ Chofer Jhonny Correa seleccionado.');
                    } else {
                        const selChofer = 'text="Selecciona un chofer"';
                        if (await page.isVisible(selChofer)) {
                            await page.click(selChofer);
                            await page.waitForSelector('li a span.text:has-text("Jhonny")', { timeout: 2000 });
                            await page.click('li a span.text:has-text("Jhonny")');
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Error seleccionando chofer:', e.message);
                }

                // 3. CONFIRMAR
                const btnFinal = '#show_trip_book_details_btn';
                try {
                    await page.waitForSelector(btnFinal, { timeout: 3000 });
                    await page.click(btnFinal);
                    console.log('✅ Paso 1: Confirmar completado.');

                    // 4. RESERVAR (paso final ultra-rápido)
                    const btnReservar = '#check_pay_btn';
                    await page.waitForSelector(btnReservar, { timeout: 5000 });
                    await page.click(btnReservar);
                    console.log('🎉 ¡VIAJE RESERVADO CON ÉXITO!');

                    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, '🎉🚛 VIAJE RESERVADO CON EXITO!');
                    sendStepScreenshot(page, "VIAJE RESERVADO");
                } catch (e) {
                    console.warn('⚠️ Error en confirmación/reserva:', e.message);
                    sendStepScreenshot(page, "ERROR EN CONFIRMACION");
                }

                // Navegar fuera para cerrar cualquier modal abierto
                await page.goto('https://flety.io/partner_incoming_requests', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { });
            } else {
                console.log('📭 No hay viajes disponibles.');
            }

            // 3. CERRAR SESIÓN (ESPECÍFICO)
            console.log('🚪 Cerrando sesión para mantener frescura...');
            try {
                const logoutSelector = 'a[href="/partner_sign_out"]';
                if (await page.isVisible(logoutSelector)) {
                    await page.click(logoutSelector);
                    console.log('✅ Logout exitoso via clic.');
                } else {
                    console.log('⚠️ Botón de logout no visible, usando navegación directa...');
                    await page.goto('https://flety.io/partner_sign_out').catch(() => { });
                }
                await page.waitForTimeout(2000);
            } catch (err) {
                console.log('⚠️ Error al cerrar sesión, limpiando cookies...');
                await context.clearCookies().catch(() => { });
            }

            // 4. ESPERA ALEATORIA (Entre 1 y 15 segundos)
            const waitTime = Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000;
            console.log(`😴 Esperando ${Math.floor(waitTime / 1000)} segundos para el próximo ciclo...`);
            await page.waitForTimeout(waitTime);

        } catch (error) {
            console.error(`\n❌ Error en ciclo: ${error.message}`);
            if (error.message.includes('browser has been closed') || error.message.includes('Target page')) {
                console.error('💀 Browser cerrado. Terminando bot.');
                break;
            }
            await context.clearCookies().catch(() => { });
            await page.waitForTimeout(10000);
        }
    }
}

console.log('🚀 Lanzando sistema de caza...');
runBot().catch(err => console.error('💥 Error Fatal:', err));