const http = require('http');
const fs = require('fs');
const path = require('path');
const { runBotLogic, stopBotLogic, getStatus } = require('./bot-core.js');

const PORT = 8000;

const server = http.createServer((req, res) => {
    const { url } = req;

    if (url === '/start') {
        runBotLogic();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'started' }));
    }

    if (url === '/stop') {
        stopBotLogic();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'stopped' }));
    }

    if (url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ running: getStatus() }));
    }

    // Serve static files
    let filePath = path.join(__dirname, 'ui', url === '/' ? 'index.html' : url);
    const ext = path.extname(filePath);
    let contentType = 'text/html';

    switch (ext) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.png': contentType = 'image/png'; break;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Servidor de control iniciado en http://localhost:${PORT}`);
});
