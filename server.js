const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

let tokenAtual = process.env.POLARIUM_TOKEN || '';
let configuracaoAtual = { timeframe: 'M1', mercado: 'OTC', analysis_mode: 'trend', entry_amount: 5 };
let autopilotActive = false;
let wsClient = null;
let operationsHistory = [];

// Cria o servidor HTTP
const server = http.createServer(app);

// Anexa o WebSocket ao mesmo servidor HTTP
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log("🔗 Cérebro conectado ao server.js via WebSocket.");
    ws.on('message', async (msg) => {
        try {
            const data = JSON.parse(msg);
            if (data.type === 'SIGNAL') {
                const { processarSinal } = require('./backend/bot_servidor');
                await processarSinal(data.signal);
            }
        } catch (e) {
            console.error("Erro ao processar msg WS:", e.message);
        }
    });
});

app.post('/api/atualizar-token', (req, res) => {
    const novoToken = req.body.token;
    if (!novoToken) return res.status(400).json({ error: "Token inválido" });
    if (novoToken === tokenAtual) return res.json({ success: true, message: "Token já ativo" });
    tokenAtual = novoToken;
    console.log("🔄 Novo Token recebido.");
    if (autopilotActive) {
        const { iniciarBotServidor } = require('./backend/bot_servidor');
        iniciarBotServidor(null, tokenAtual, configuracaoAtual);
    }
    res.json({ success: true });
});

app.put('/api/autopilot/settings', (req, res) => {
    configuracaoAtual = req.body;
    console.log("⚙️ Configurações salvas:", configuracaoAtual);
    res.json({ success: true });
});

app.post('/api/autopilot/activate', (req, res) => {
    if (!tokenAtual) return res.status(400).json({ error: "Token não configurado." });
    autopilotActive = true;
    global.buscando = true;
    console.log("🤖 AutoPilot ATIVADO.");

    // Conecta ao WebSocket local (mesma porta do servidor HTTP)
    if (!wsClient || wsClient.readyState === WebSocket.CLOSED) {
        // Usa a mesma porta do processo
        wsClient = new WebSocket(`ws://127.0.0.1:${port}`);
        wsClient.on('open', () => console.log("🔗 Conectado ao Cérebro via WebSocket."));
        wsClient.on('error', (e) => console.error("❌ Erro WS:", e.message));
        wsClient.on('close', () => console.log("🔌 WebSocket fechado."));
    }

    const { iniciarBotServidor } = require('./backend/bot_servidor');
    iniciarBotServidor(null, tokenAtual, configuracaoAtual);
    res.json({ success: true, enabled: true });
});

app.post('/api/autopilot/deactivate', (req, res) => {
    autopilotActive = false;
    global.buscando = false;
    if (wsClient) wsClient.close();
    console.log("🛑 AutoPilot DESATIVADO.");
    res.json({ success: true });
});

app.post('/api/sinal', (req, res) => {
    const sinal = req.body;
    if (!sinal?.ativo || !sinal?.direcao) return res.status(400).json({ error: "Sinal inválido" });

    console.log(`📡 Sinal do Frontend: ${sinal.direcao} em ${sinal.ativo}`);

    if (autopilotActive && wsClient && wsClient.readyState === WebSocket.OPEN) {
        wsClient.send(JSON.stringify({ type: 'SIGNAL', signal: sinal }));
        res.json({ success: true });
    } else {
        res.status(400).json({ error: "AutoPilot inativo ou Cérebro desconectado." });
    }
});

app.get('/api/autopilot/status', (req, res) => {
    res.json({ success: true, active: autopilotActive, settings: configuracaoAtual });
});

app.get('/api/autopilot/operations', (req, res) => {
    res.json({ success: true, operations: operationsHistory });
});

// Importante: usar server.listen, não app.listen
server.listen(port, () => console.log(`✅ Servidor API rodando na porta ${port}`));