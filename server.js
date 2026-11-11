app.post('/api/autopilot/activate', (req, res) => {
    if (!tokenAtual) return res.status(400).json({ error: "Token não configurado." });
    global.buscando = true;
    console.log("🤖 AutoPilot ATIVADO. O robô vai operar automaticamente.");
    
    // Inicia o robô com as configurações salvas
    const { iniciarBotServidor } = require('./backend/bot_servidor');
    iniciarBotServidor(null, tokenAtual, configuracaoAtual); 
    
    res.json({ success: true, enabled: true });
});