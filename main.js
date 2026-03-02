const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Intentar cargar la versión protegida si existe, si no la normal
let botCore;
try {
    if (fs.existsSync(path.join(__dirname, 'bot-core-protected.js'))) {
        botCore = require('./bot-core-protected.js');
    } else {
        botCore = require('./bot-core.js');
    }
} catch (e) {
    botCore = require('./bot-core.js');
}
const { runBotLogic, stopBotLogic } = botCore;

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 700,
        backgroundColor: '#0a0b10',
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        resizable: false,
        icon: path.join(__dirname, 'icon.ico') // Opcional
    });

    mainWindow.loadFile('ui/index.html');

    // Quitar menú por defecto
    mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Eventos IPC
ipcMain.on('start-bot', async () => {
    console.log('Main: Iniciando bot...');
    runBotLogic(mainWindow);
});

ipcMain.on('stop-bot', () => {
    console.log('Main: Deteniendo bot...');
    stopBotLogic();
});
