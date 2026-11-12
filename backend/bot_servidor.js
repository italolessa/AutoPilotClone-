const WS_URL = 'wss://ws.trade.polariumbroker.com/echo/websocket';
let sdk;
let isBuscando = false;
let configSolicitada = { timeframe: 'M1', mercado: 'OTC', analysis_mode: 'trend', entry_amount: 5, martingale_auto_levels: 1, martingale_auto_multiplier: 2 };

// --- TRAVAS DE SEGURANÇA ---
let ultimaEntradaTs = 0;
let operacaoEmAndamento = false;
let operacaoAtual = null;
let sinalJaExecutado = null;
let nivelMartingale = 0;
const INTERVALO_ENTRE_ENTRADAS_MS = 5 * 60 * 1000; // 5 minutos de respiro após WIN

// --- INDICADORES ---
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

// --- INICIALIZAÇÃO ---
async function iniciarBotServidor(window, tokenSsid, config) {
    if (!tokenSsid) return console.error("❌ Token não configurado.");
    
    if (config) {
        configSolicitada = { ...configSolicitada, ...config };
        if (!configSolicitada.timeframe_mode) {
            configSolicitada.timeframe_mode = configSolicitada.timeframe || 'M1';
        }
    }
    
    if (sdk) return console.log("✅ SDK já está inicializado.");
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
        }, 15000);

        setInterval(async () => {
            if (global.buscando && operacaoAtual) {
                await verificarResultado();
            }
        }, 5000);

    } catch (error) {
        console.error("❌ Erro ao conectar SDK:", error.message);
    }
}

// --- VERIFICAR RESULTADO E MARTINGALE ---
async function verificarResultado() {
    if (!operacaoAtual) return;
    const agora = Date.now();
    const seconds = configSolicitada.timeframe_mode === 'M5' ? 300 : 60;
    const tempoExpiracao = seconds * 1000;

    if (agora < operacaoAtual.horarioEntradaTs + tempoExpiracao + 5000) return;
    if (operacaoAtual.resultadoChecado) return;

    try {
        const layer = await sdk.realTimeChartDataLayer(operacaoAtual.ativoId, seconds);
        const candles = await layer.fetchAllCandles(Math.floor(Date.now() / 1000) - (3 * seconds));
        if (!candles || candles.length < 2) return;

        const velaResultado = candles[candles.length - 2];
        let resultado = "EMPATE";

        if (operacaoAtual.direcao === "CALL") {
            if (velaResultado.close > velaResultado.open) resultado = "WIN";
            else if (velaResultado.close < velaResultado.open) resultado = "LOSS";
        } else if (operacaoAtual.direcao === "PUT") {
            if (velaResultado.close < velaResultado.open) resultado = "WIN";
            else if (velaResultado.close > velaResultado.open) resultado = "LOSS";
        }

        operacaoAtual.resultadoChecado = true;
        console.log(`📊 [RESULTADO] ${operacaoAtual.ativo} | ${operacaoAtual.direcao} | ${resultado} (G${nivelMartingale})`);

        if (resultado === "WIN") {
            console.log(`✅ WIN! Voltando ao G0 e aguardando 5 minutos de respiro.`);
            nivelMartingale = 0;
            operacaoAtual = null;
            operacaoEmAndamento = false;
            ultimaEntradaTs = Date.now();
        } else if (resultado === "LOSS") {
            const galesPermitidos = configSolicitada.martingale_auto_levels || 1;
            if (nivelMartingale < galesPermitidos) {
                nivelMartingale++;
                console.log(`❌ LOSS! Aplicando Martingale G${nivelMartingale}. Aguardando próxima vela para entrar.`);
                operacaoAtual = null;
                operacaoEmAndamento = false;
                ultimaEntradaTs = 0;
            } else {
                console.log(`❌ LOSS no último gale (G${nivelMartingale}). Resetando ciclo.`);
                nivelMartingale = 0;
                operacaoAtual = null;
                operacaoEmAndamento = false;
                ultimaEntradaTs = Date.now();
            }
        } else {
            console.log(`⚖️ Empate. Resetando ciclo.`);
            nivelMartingale = 0;
            operacaoAtual = null;
            operacaoEmAndamento = false;
            ultimaEntradaTs = Date.now();
        }
    } catch (err) {
        console.error("❌ Erro ao verificar resultado:", err.message);
        operacaoEmAndamento = false;
        operacaoAtual = null;
    }
}

// --- BUSCA E EXECUÇÃO ---
async function buscarEExecutar() {
    if (!sdk || !global.buscando) return;
    if (isBuscando) return;
    isBuscando = true;

    try {
        const positions = await sdk.positions();
        if (positions.getAllPositions().length > 0 || operacaoEmAndamento) return;

        const agora = Date.now();
        if (nivelMartingale === 0 && (agora - ultimaEntradaTs) < INTERVALO_ENTRE_ENTRADAS_MS) return;

        const binaryOptions = await sdk.binaryOptions();
        const actives = binaryOptions.getActives();
        const now = sdk.currentTime();
        const seconds = configSolicitada.timeframe_mode === 'M5' ? 300 : 60;

        const ativosFiltrados = actives.filter(a => {
            const mercadoOk = configSolicitada.mercado === 'OTC' ? a.ticker.includes('-OTC') : !a.ticker.includes('-OTC');
            return mercadoOk && a.canBeBoughtAt(now);
        });

        if (ativosFiltrados.length === 0) return;

        for (let ativo of ativosFiltrados) {
            if (!global.buscando) break;
            const layer = await sdk.realTimeChartDataLayer(ativo.id, seconds);
            const candles = await layer.fetchAllCandles(Math.floor(Date.now() / 1000) - (30 * seconds));

            if (!candles || candles.length < 20) continue;
            const direcao = analisarGrafico(candles, configSolicitada.analysis_mode);

            if (direcao) {
                const signalKey = `${ativo.id}-${candles[candles.length - 2].time}-${direcao}`;
                if (sinalJaExecutado === signalKey) continue;

                console.log(`🚀 [AUTOPILOT] Sinal de ${direcao} em ${ativo.ticker} (${configSolicitada.timeframe_mode}). Executando G${nivelMartingale}...`);

                try {
                    const instruments = await ativo.instruments();
                    const available = instruments.getAvailableForBuyAt(sdk.currentTime());

                    if (!available || available.length === 0) {
                        continue;
                    }

                    // --- FILTRO CIRÚRGICO DE TEMPO ---
                    const nowTs = Date.now();
                    let instrumentoCorreto = available.find(inst => {
                        try {
                            const endTime = inst.purchaseEndTime();
                            const diffSeconds = Math.round((endTime.getTime() - nowTs) / 1000);
                            // Procura o tempo exato com margem de 3 segundos
                            return Math.abs(diffSeconds - seconds) <= 3;
                        } catch (e) {
                            return false;
                        }
                    });

                    // SE NÃO ENCONTRAR O TEMPO CERTO, CANCELA A OPERAÇÃO
                    if (!instrumentoCorreto) {
                        console.log(`❌ Instrumento de ${seconds}s não disponível no exato momento para ${ativo.ticker}. Abortando esta entrada.`);
                        continue;
                    }

                    const balances = await sdk.balances();
                    const demoBalance = balances.getBalances().find(b => b.type === 'demo');
                    if (!demoBalance) continue;

                    const mult = configSolicitada.martingale_auto_multiplier || 2;
                    const entryAmount = configSolicitada.entry_amount * Math.pow(mult, nivelMartingale);

                    operacaoEmAndamento = true;
                    ultimaEntradaTs = Date.now();
                    sinalJaExecutado = signalKey;

                    await binaryOptions.buy(
                        instrumentoCorreto,
                        direcao === "CALL" ? global.BinaryOptionsDirection.Call : global.BinaryOptionsDirection.Put,
                        entryAmount,
                        demoBalance
                    );

                    operacaoAtual = {
                        ativoId: ativo.id,
                        ativo: ativo.ticker,
                        direcao: direcao,
                        horarioEntradaTs: Date.now(),
                        resultadoChecado: false
                    };

                    console.log(`✅ ORDEM EXECUTADA: ${ativo.ticker} | ${direcao} | Valor: $${entryAmount.toFixed(2)} | G${nivelMartingale} | Exp: ${seconds}s`);
                    break;
                } catch (err) {
                    operacaoEmAndamento = false;
                    console.error("❌ Erro ao executar:", err.message);
                }
            }
        }
    } catch (error) {
        console.error("❌ Erro na varredura:", error.message);
    } finally {
        isBuscando = false;
    }
}

async function processarSinal(signal) {
    if (operacaoEmAndamento) return console.log("⏳ Operação em andamento.");
    console.log(`📡 Sinal manual recebido: ${signal.direcao} em ${signal.ativo}`);
}

module.exports = { iniciarBotServidor, processarSinal };