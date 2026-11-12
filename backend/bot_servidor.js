const WebSocket = require('ws');
const WS_URL = 'wss://ws.trade.polariumbroker.com/echo/websocket';
let sdk;
let configSolicitada = { timeframe: 'M1', mercado: 'OTC', analysis_mode: 'trend', entry_amount: 5 };
let operacaoEmAndamento = false;
let sinaisAgendados = new Set();

function calcularEMA(dados, period) {
    if (!dados || dados.length < period) return null;
    const k = 2 / (period + 1);
    let ema = dados.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < dados.length; i++) ema = dados[i] * k + ema * (1 - k);
    return ema;
}

function calcularRSI(closes, period = 14) {
    if (!closes || closes.length <= period) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains / period, avgLoss = losses / period;
    for (let i = period + 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    }
    if (avgLoss === 0) return 100;
    return 100 - (100 / (1 + (avgGain / avgLoss)));
}

function analisarGrafico(candles, modo) {
    if (!candles || candles.length < 30) return null;
    const fechadas = candles.slice(0, -1);
    const closes = fechadas.map(c => c.close);
    const atual = fechadas[fechadas.length - 1];
    const rsi = calcularRSI(closes);

    if (modo === 'trend') {
        const ema9 = calcularEMA(closes, 9);
        const ema21 = calcularEMA(closes, 21);
        if (ema9 === null || ema21 === null) return null;
        if (ema9 > ema21 && atual.close > atual.open && rsi > 50) return "CALL";
        if (ema9 < ema21 && atual.close < atual.open && rsi < 50) return "PUT";
        return null;
    }
    const corpo = Math.abs(atual.close - atual.open);
    const pSup = atual.max - Math.max(atual.open, atual.close);
    const pInf = Math.min(atual.open, atual.close) - atual.min;
    if (rsi < 40 && pInf > corpo) return "CALL";
    if (rsi > 60 && pSup > corpo) return "PUT";
    return null;
}

async function iniciarBotServidor(window, tokenSsid, config) {
    if (!tokenSsid) return console.error("❌ Token não configurado.");
    configSolicitada = config || configSolicitada;

    console.log("⏳ Iniciando SDK no servidor...");
    try {
        const sdkModule = await import('@quadcode-tech/client-sdk-js');
        const { ClientSdk, SsidAuthMethod, BinaryOptionsDirection } = sdkModule;
        sdk = await ClientSdk.create(WS_URL, 82, new SsidAuthMethod(tokenSsid));
        global.BinaryOptionsDirection = BinaryOptionsDirection;
        console.log("✅ SDK inicializado!");

        const wss = new WebSocket.Server({ port: 8080 });
        wss.on('connection', (ws) => {
            console.log("🔗 Cérebro conectado ao server.js");
            ws.on('message', async (msg) => {
                try {
                    const data = JSON.parse(msg);
                    if (data.type === 'SIGNAL') await processarSinal(data.signal);
                } catch (e) { console.error(e.message); }
            });
        });
    } catch (error) {
        console.error("❌ Erro ao conectar SDK:", error.message);
    }
}

async function processarSinal(signal) {
    if (operacaoEmAndamento) return console.log("⏳ Operação em andamento. Ignorando.");
    if (sinaisAgendados.has(signal.id)) return console.log("⏳ Sinal já agendado.");

    console.log(`📡 Sinal recebido: ${signal.direcao} em ${signal.ativo} às ${signal.horario_entrada}`);

    const now = new Date();
    const [h, m] = signal.horario_entrada.split(':');
    const execTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(h), parseInt(m), 0);
    const delay = execTime.getTime() - now.getTime();

    if (delay < 0) return console.log("⚠️ Horário já passou.");

    sinaisAgendados.add(signal.id);
    setTimeout(async () => {
        await executarOrdem(signal);
        sinaisAgendados.delete(signal.id);
    }, delay);
}

async function executarOrdem(signal) {
    if (!sdk || operacaoEmAndamento) return;
    operacaoEmAndamento = true;

    try {
        const binaryOptions = await sdk.binaryOptions();
        const actives = binaryOptions.getActives();
        const ativo = actives.find(a => a.ticker === signal.ativo);
        if (!ativo) { operacaoEmAndamento = false; return; }

        const seconds = configSolicitada.timeframe === 'M5' ? 300 : 60;
        const instr = await ativo.instruments();
        const disp = instr.getAvailableForBuyAt(sdk.currentTime());
        const instrumento = disp.find(i => i.duration === seconds);
        if (!instrumento) { operacaoEmAndamento = false; return; }

        const balances = await sdk.balances();
        const demoBalance = balances.getBalances().find(b => b.type === 'demo');

        await binaryOptions.buy(
            instrumento,
            signal.direcao === "CALL" ? global.BinaryOptionsDirection.Call : global.BinaryOptionsDirection.Put,
            configSolicitada.entry_amount,
            demoBalance
        );

        console.log(`✅ ORDEM EXECUTADA: ${signal.ativo} | ${signal.direcao} | $${configSolicitada.entry_amount}`);

        setTimeout(() => {
            operacaoEmAndamento = false;
            console.log(`🔄 Liberado para nova operação.`);
        }, (seconds * 1000) + 5000);

    } catch (err) {
        console.error("❌ Erro ao executar:", err.message);
        operacaoEmAndamento = false;
    }
}

module.exports = { iniciarBotServidor };