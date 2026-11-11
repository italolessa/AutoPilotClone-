const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 10000; 

app.use(cors());
app.use(express.json());

let tokenAtual = process.env.POLARIUM_TOKEN || ''; 
let autopilotSettings = {}; 
let autopilotActive = false;
let operationsHistory = []; 

// Importa o Cérebro (que está na pasta backend)
const { iniciarBotServidor } = require('./backend/bot_servidor');

// --- ROTAS DO TOKEN ---
app.post('/api/atualizar-token', (req, res) => {
    const novoToken = req.body.token;
    if (novoToken === tokenAtual) return res.json({ success: true, message: "Token já ativo" });
    tokenAtual = novoToken;
    console.log("🔄 Novo Token recebido.");
    res.json({ success: true });
});

// --- ROTAS DO AUTOPILOT ---
app.put('/api/autopilot/settings', (req, res) => {
    autopilotSettings = req.body;
    console.log("⚙️ Configurações salvas:", autopilotSettings);
    res.json({ success: true });
});

app.post('/api/autopilot/activate', (req, res) => {
    if (!tokenAtual) return res.status(400).json({ error: "Token não configurado." });
    autopilotActive = true;
    console.log("🤖 AutoPilot ATIVADO.");
    
    // CHAMA O CÉREBRO PASSANDO AS CONFIGURAÇÕES
    iniciarBotServidor(null, tokenAtual, autopilotSettings); 
    
    res.json({ success: true, enabled: true });
});

app.post('/api/autopilot/deactivate', (req, res) => {
    autopilotActive = false;
    console.log("🛑 AutoPilot DESATIVADO.");
    res.json({ success: true });
});

// ESTA É A ROTA QUE ESTAVA FALTANDO
app.get('/api/autopilot/status', (req, res) => {
    res.json({ 
        success: true, 
        active: autopilotActive,
        settings: autopilotSettings 
    });
});

app.get('/api/autopilot/operations', (req, res) => {
    res.json({ success: true, operations: operationsHistory });
});

app.listen(port, () => {
    console.log(`✅ Servidor API rodando na porta ${port}`);
});
