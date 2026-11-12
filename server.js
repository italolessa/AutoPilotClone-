const express = require('express');
const cors = require('cors');
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

    if (!wsClient) {
        wsClient = new WebSocket('ws://localhost:8080');
        wsClient.on('open', () => console.log("🔗 Conectado ao Cérebro."));
        wsClient.on('error', (e) => console.error("❌ Erro WS:", e.message));
    }

    const { iniciarBotServidor } = require('./backend/bot_servidor');
    iniciarBotServidor(null, tokenAtual, configuracaoAtual);
    res.json({ success: true, enabled: true });
});

app.post('/api/autopilot/deactivate', (req, res) => {
    autopilotActive = false;
    global.buscando = false;
    console.log("🛑 AutoPilot DESATIVADO.");
    res.json({ success: true });
});

app.post('/api/sinal', (req, res) => {
    const sinal = req.body;
    if (!sinal?.ativo || !sinal?.direcao) return res.status(400).json({ error: "Sinal inválido" });

    console.log(`📡 Sinal do Frontend: ${sinal.direcao} em ${sinal.ativo}`);

    if (autopilotActive && wsClient?.readyState === WebSocket.OPEN) {
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

app.listen(port, () => console.log(`✅ Servidor API rodando na porta ${port}`));