const WS_URL = 'wss://ws.trade.polariumbroker.com/echo/websocket'; 
let sdk;
let isBuscando = false;
let configSolicitada = { timeframe: 'M1', mercado: 'OTC', analysis_mode: 'trend' };

// --- MATEMÁTICA DOS INDICADORES ---
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

function analisarGraficoComEstrategias(candles, modo) {
    const closes = candles.map(c => c.close);
    const atual = candles[candles.length - 1];
    const anterior = candles[candles.length - 2];
    const rsi = calcularRSI(closes);

    if (modo === 'trend') {
        const ema9 = calcularEMA(closes, 9);
        const ema21 = calcularEMA(closes, 21);
        if (ema9 > ema21 && atual.close > atual.open && rsi > 50) return "CALL";
        if (ema9 < ema21 && atual.close < atual.open && rsi < 50) return "PUT";
    }
    
    // Estratégia de Reversão (RSI + Pavio) - Padrão do seu projeto
    const corpo = Math.abs(atual.close - atual.open);
    const pavioSuperior = atual.max - Math.max(atual.open, atual.close);
    const pavioInferior = Math.min(atual.open, atual.close) - atual.min;

    if (rsi < 40 && pavioInferior > corpo) return "CALL";
    if (rsi > 60 && pavioSuperior > corpo) return "PUT";

    return null;
}

// --- EXECUÇÃO AUTOMÁTICA ---
async function iniciarBotServidor(window, tokenSsid, config) {
    if (!tokenSsid) return console.error("❌ Token não configurado.");
    configSolicitada = config;
    
    console.log("⏳ Iniciando SDK no servidor...");
    try {
        const sdkModule = await import('@quadcode-tech/client-sdk-js');
        const { ClientSdk, SsidAuthMethod, BinaryOptionsDirection } = sdkModule;
        sdk = await ClientSdk.create(WS_URL, 82, new SsidAuthMethod(tokenSsid));
        global.BinaryOptionsDirection = BinaryOptionsDirection;

        console.log("✅ SDK inicializado! Robô em modo AUTOMÁTICO.");

        setInterval(async () => {
            if (!isBuscando && global.buscando) {
                await buscarEExecutar();
            }
        }, 10000); // Busca a cada 10 segundos

    } catch (error) {
        console.error("❌ Erro ao conectar no servidor:", error.message);
    }
}

async function buscarEExecutar() {
    if (!sdk || !global.buscando) return;
    isBuscando = true;

    try {
        const binaryOptions = await sdk.binaryOptions();
        const actives = binaryOptions.getActives();
        const now = sdk.currentTime();

        // Filtra ativos
        let ativosFiltrados = actives.filter(a => {
            const mercadoOk = configSolicitada.mercado === 'OTC' ? a.ticker.includes('-OTC') : !a.ticker.includes('-OTC');
            return mercadoOk && a.canBeBoughtAt(now);
        });

        for (let ativo of ativosFiltrados) {
            if (!global.buscando) break;

            const seconds = configSolicitada.timeframe === 'M5' ? 300 : 60;
            const layer = await sdk.realTimeChartDataLayer(ativo.id, seconds);
            const candles = await layer.fetchAllCandles(Math.floor(Date.now() / 1000) - (30 * seconds));

            if (!candles || candles.length < 20) continue;

            const direcao = analisarGraficoComEstrategias(candles, configSolicitada.analysis_mode);

            if (direcao) {
                // AQUI ELE EXECUTA A ORDEM
                console.log(`🚀 [AUTOPILOT] Sinal de ${direcao} em ${ativo.ticker}. Executando ordem...`);
                
                try {
                    const active = binaryOptions.getActive(ativo.id);
                    await binaryOptions.buy(
                        active, 
                        direcao, 
                        60, // Expiração em 60 segundos
                        configSolicitada.entry_amount, 
                        global.BinaryOptionsDirection[direcao]
                    );
                    console.log(`✅ ORDEM EXECUTADA: ${ativo.ticker} | ${direcao} | Valor: $${configSolicitada.entry_amount}`);
                    
                    // Para de buscar após executar uma ordem (ou pode continuar, se preferir)
                    global.buscando = false; 
                    
                } catch (err) {
                    console.error("❌ Erro ao executar ordem:", err.message);
                }
                break; // Sai do loop de ativos
            }
        }
    } catch (error) {
        console.error("❌ Erro na varredura:", error.message);
    } finally {
        isBuscando = false;
    }
}

module.exports = { iniciarBotServidor };