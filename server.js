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
let sdk = null;
let loopInterval = null;

const WS_URL = 'wss://ws.trade.polariumbroker.com/echo/websocket';

// ==========================================
// ROTAS DO AUTOPILOT
// ==========================================
app.post('/api/atualizar-token', (req, res) => {
    const novoToken = req.body.token;
    if (novoToken === tokenAtual) return res.json({ success: true, message: "Token já ativo" });
    tokenAtual = novoToken;
    console.log("🔄 Novo Token recebido.");
    res.json({ success: true });
});

app.put('/api/autopilot/settings', (req, res) => {
    autopilotSettings = req.body;
    console.log("⚙️ Configurações salvas:", autopilotSettings);
    res.json({ success: true });
});

app.post('/api/autopilot/activate', (req, res) => {
    if (!tokenAtual) return res.status(400).json({ error: "Token não configurado." });
    autopilotActive = true;
    console.log("🤖 AutoPilot ATIVADO.");
    iniciarRobo(autopilotSettings); 
    res.json({ success: true, enabled: true });
});

app.post('/api/autopilot/deactivate', (req, res) => {
    autopilotActive = false;
    if (loopInterval) clearInterval(loopInterval);
    console.log("🛑 AutoPilot DESATIVADO.");
    res.json({ success: true });
});

app.get('/api/autopilot/operations', (req, res) => {
    res.json({ success: true, operations: operationsHistory });
});

// ==========================================
// INDICADORES MATEMÁTICOS
// ==========================================
function calcularEMA(dados, period) {
    if (dados.length < period) return dados[dados.length - 1];
    const k = 2 / (period + 1);
    let ema = dados.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < dados.length; i++) ema = dados[i] * k + ema * (1 - k);
    return ema;
}

function calcularRSI(closes, period = 14) {
    if (closes.length < period) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    return 100 - (100 / (1 + (avgGain / avgLoss)));
}

// ==========================================
// AS 5 ESTRATÉGIAS
// ==========================================
function analisarEstrategia(candles, modoAnalise) {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.max);
    const lows = candles.map(c => c.min);
    const atual = candles[candles.length - 1];
    const anterior = candles[candles.length - 2];
    const rsi = calcularRSI(closes);

    if (modoAnalise === 'trend') {
        const ema9 = calcularEMA(closes, 9);
        const ema21 = calcularEMA(closes, 21);
        if (ema9 > ema21 && atual.close > atual.open && rsi > 50) return "CALL";
        if (ema9 < ema21 && atual.close < atual.open && rsi < 50) return "PUT";
    }

    if (modoAnalise === 'jotta') {
        const max10 = Math.max(...highs.slice(-10));
        const min10 = Math.min(...lows.slice(-10));
        if (atual.close > max10 && rsi > 55) return "CALL";
        if (atual.close < min10 && rsi < 45) return "PUT";
    }

    if (modoAnalise === 'blitz') {
        const range = atual.max - atual.min;
        const mediaRange = (highs.slice(-10).reduce((a, b) => a + b, 0) - lows.slice(-10).reduce((a, b) => a + b, 0)) / 10;
        if (range > mediaRange * 1.5) {
            if (atual.close > atual.open) return "CALL"; 
            if (atual.close < atual.open) return "PUT";  
        }
    }

    if (modoAnalise === 'consolidation') {
        const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const desvio = Math.sqrt(closes.slice(-20).reduce((acc, val) => acc + Math.pow(val - sma20, 2), 0) / 20);
        const bandaSup = sma20 + (desvio * 2);
        const bandaInf = sma20 - (desvio * 2);
        if (atual.max > bandaSup && atual.close < bandaSup && rsi > 65) return "PUT";
        if (atual.min < bandaInf && atual.close > bandaInf && rsi < 35) return "CALL";
    }

    if (modoAnalise === 'retrace' || modoAnalise === 'live') {
        const ema50 = calcularEMA(closes, 50);
        if (anterior.close < ema50 && atual.close > ema50 && atual.close > atual.open) return "CALL";
        if (anterior.close > ema50 && atual.close < ema50 && atual.close < atual.open) return "PUT";
    }

    return null;
}

// ==========================================
// MOTOR DE EXECUÇÃO
// ==========================================
async function iniciarRobo(config) {
    try {
        const sdkModule = await import('@quadcode-tech/client-sdk-js');
        const { ClientSdk, SsidAuthMethod, BinaryOptionsDirection } = sdkModule;
        sdk = await ClientSdk.create(WS_URL, 82, new SsidAuthMethod(tokenAtual));
        global.BinaryOptionsDirection = BinaryOptionsDirection;
        console.log("✅ SDK Conectado! Motor de Estratégias ativo.");

        loopInterval = setInterval(async () => {
            if (!autopilotActive || !sdk) return;

            const binaryOptions = await sdk.binaryOptions();
            const actives = binaryOptions.getActives();
            const now = sdk.currentTime();
            let ativosFiltrados = actives.filter(a => a.canBeBoughtAt(now));

            for (let i = 0; i < ativosFiltrados.length; i += 10) {
                if (!autopilotActive) break;
                const lote = ativosFiltrados.slice(i, i + 10);

                await Promise.all(lote.map(async (ativo) => {
                    const seconds = config.timeframe_mode === 'M5' ? 300 : 60;
                    const layer = await sdk.realTimeChartDataLayer(ativo.id, seconds);
                    const candles = await layer.fetchAllCandles(Math.floor(Date.now() / 1000) - (50 * seconds));

                    if (candles && candles.length > 20) {
                        const direcao = analisarEstrategia(candles, config.analysis_mode);
                        if (direcao) await dispararOrdem(ativo, direcao, config);
                    }
                }));
            }
        }, 60000);
    } catch (error) {
        console.error("❌ Erro no SDK:", error.message);
    }
}

async function dispararOrdem(ativo, direcao, config) {
    try {
        const binaryOptions = await sdk.binaryOptions();
        const active = binaryOptions.getActive(ativo.id);
        await binaryOptions.buy(active, direcao, config.blitz_expiration_seconds || 60, config.entry_amount, global.BinaryOptionsDirection[direcao]);

        const novaOperacao = {
            signal_id: Math.floor(Math.random() * 1000000),
            asset: ativo.ticker,
            direction: direcao,
            timeframe: config.timeframe_mode,
            amount: config.entry_amount,
            result: "PENDENTE",
            pnl: 0,
            note: "G0",
            analysis_mode: config.analysis_mode,
            id: `${Date.now()}-${Math.random()}`,
            at: new Date().toISOString()
        };
        operationsHistory.unshift(novaOperacao);
        console.log(`✅ ORDEM: ${novaOperacao.asset} | ${novaOperacao.direction} | Modo: ${config.analysis_mode}`);
    } catch (e) {
        console.error("❌ Erro ao disparar ordem:", e.message);
    }
}

app.listen(port, () => {
    console.log(`✅ Servidor API rodando na porta ${port}`);
});express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// ==========================================
// VARIÁVEIS DE ESTADO (Simulando o banco de dados)
// ==========================================
let tokenAtual = process.env.POLARIUM_TOKEN || ''; 
let autopilotSettings = {}; 
let autopilotActive = false;
let operationsHistory = []; 

// ==========================================
// ROTAS DE TOKEN (Para o App do PC enviar o token novo)
// ==========================================
app.post('/api/atualizar-token', (req, res) => {
    const novoToken = req.body.token;
    if (!novoToken) return res.status(400).json({ error: "Token inválido" });
    
    // Se for o mesmo token, não faz nada para não reiniciar
    if (novoToken === tokenAtual) {
        console.log("✅ Token já está ativo. Ignorando.");
        return res.json({ success: true, message: "Token já ativo" });
    }

    tokenAtual = novoToken;
    console.log("🔄 Novo Token recebido do App! O robô está pronto para operar.");
    res.json({ success: true, message: "Token atualizado!" });
});

// ==========================================
// ROTAS DO AUTOPILOT (Idênticas ao site original)
// ==========================================

// 1. Salvar Configurações (O PUT)
app.put('/api/autopilot/settings', (req, res) => {
    autopilotSettings = req.body;
    console.log("⚙️ Configurações salvas do Frontend:", autopilotSettings);
    res.json({ success: true });
});

// 2. Ativar Piloto (O POST /activate)
app.post('/api/autopilot/activate', (req, res) => {
    if (!tokenAtual) {
        return res.status(400).json({ error: "Token não configurado. Faça login no App." });
    }
    
    autopilotActive = true;
    console.log("🤖 AutoPilot ATIVADO pelo usuário.");
    
    res.json({ success: true, enabled: true, modules: [] });
});

// 3. Desativar Piloto (O POST /deactivate)
app.post('/api/autopilot/deactivate', (req, res) => {
    autopilotActive = false;
    console.log("🛑 AutoPilot DESATIVADO pelo usuário.");
    res.json({ success: true });
});

// 4. Status do Robô (O GET /status que o frontend fica consultando)
app.get('/api/autopilot/status', (req, res) => {
    res.json({ 
        success: true, 
        active: autopilotActive,
        settings: autopilotSettings 
    });
});

// 5. Histórico de Operações (O GET /operations)
app.get('/api/autopilot/operations', (req, res) => {
    res.json({ 
        success: true, 
        operations: operationsHistory 
    });
});

// ==========================================
// O CÉREBRO DO ROBÔ (Onde a mágica vai acontecer)
// ==========================================
async function iniciarRobo(config) {
    console.log("Iniciando loop de análise com as configurações:", config);
}

app.listen(port, () => {
    console.log(`✅ Servidor API rodando na porta ${port}`);
});
