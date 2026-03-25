const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const logOutput = document.getElementById('log-output');
const statusText = document.getElementById('status-text');
const statusDisplay = document.getElementById('status-display');
const tripCount = document.getElementById('trip-count');
const lastCycle = document.getElementById('last-cycle');
const clearLogBtn = document.getElementById('clear-log');
const logoArea = document.querySelector('.logo-area');

let trips = 0;

function addLog(message, type = '') {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    const time = new Date().toLocaleTimeString();
    line.textContent = `[${time}] ${message}`;
    logOutput.appendChild(line);
    logOutput.scrollTop = logOutput.scrollHeight;
}

const isElectron = typeof require !== 'undefined' && require('electron');
const ipc = isElectron ? require('electron').ipcRenderer : null;

async function sendCommand(cmd) {
    if (ipc) {
        ipc.send(cmd === 'start' ? 'start-bot' : 'stop-bot');
    } else {
        await fetch(`/${cmd}`).catch(() => {});
    }
}

startBtn.addEventListener('click', async () => {
    await sendCommand('start');
    startBtn.disabled = true;
    stopBtn.disabled = false;
    logoArea.classList.add('status-online');
    statusText.textContent = 'EN LÍNEA';
    statusDisplay.textContent = 'Vigilando...';
    addLog('Iniciando sistema...', 'system');
});

stopBtn.addEventListener('click', async () => {
    await sendCommand('stop');
    startBtn.disabled = false;
    stopBtn.disabled = true;
    logoArea.classList.remove('status-online');
    statusText.textContent = 'DESCONECTADO';
    statusDisplay.textContent = 'Inactivo';
    addLog('Deteniendo bot...', 'warning');
});

clearLogBtn.addEventListener('click', () => {
    logOutput.innerHTML = '';
    addLog('Registro limpiado.', 'system');
});

if (ipc) {
    ipc.on('bot-log', (event, { message, type }) => {
        addLog(message, type);
        if (message.includes('VIAJE RESERVADO')) {
            trips++;
            tripCount.textContent = trips;
        }
        if (message.includes('Revisando viajes')) {
            lastCycle.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    });

    ipc.on('bot-error', (event, message) => {
        addLog(message, 'error');
    });
}
