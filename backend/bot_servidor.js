const WS_URL = 'wss://ws.trade.polariumbroker.com/echo/websocket';
let sdk;
let isBuscando = false;
let configSolicitada = { timeframe: 'M1', mercado: 'OTC', analysis_mode: 'trend', entry_amount: 5 };

// --- TRAVAS DE SEGURANÇA ---
let ultimaEntradaTs = 0;
let operacaoEmAndamento = false;
let timeoutLiberacao = null;
let sinalJaExecutado = null;
const INTERVALO_ENTRE_ENTRADAS_MS = 5 * 60 * 1000; // 5 minutos

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
    const fechadas = candles.slice(0, -1); // ignora vela em formação
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
    configSolicitada = config || configSolicitada;

    if (sdk) return console.log("✅ SDK já está inicializado.");

    console.log("⏳ Iniciando SDK no servidor...");
    try {
        const sdkModule = await import('@quadcode-tech/client-sdk-js');
        const { ClientSdk, SsidAuthMethod, BinaryOptionsDirection } = sdkModule;
        sdk = await ClientSdk.create(WS_URL, 82, new SsidAuthMethod(tokenSsid));
        global.BinaryOptionsDirection = BinaryOptionsDirection;
        console.log("✅ SDK inicializado! Robô em modo AUTOMÁTICO.");

        // Loop de análise: roda a cada 15 segundos
        setInterval(async () => {
            if (!isBuscando && global.buscando) {
                await buscarEExecutar();
            }
        }, 15000);

    } catch (error) {
        console.error("❌ Erro ao conectar SDK:", error.message);
    }
}

// --- BUSCA E EXECUÇÃO ---
async function buscarEExecutar() {
    if (!sdk || !global.buscando) return;
    if (isBuscando) return;
    isBuscando = true;

    try {
        // Trava 1: Posição aberta na Polarium
        const positions = await sdk.positions();
        const posicoesAbertas = positions.getAllPositions();
        if (posicoesAbertas.length > 0 || operacaoEmAndamento) {
            return;
        }

        // Trava 2: Cooldown de 5 minutos
        const agora = Date.now();
        if ((agora - ultimaEntradaTs) < INTERVALO_ENTRE_ENTRADAS_MS) {
            return;
        }

        const binaryOptions = await sdk.binaryOptions();
        const actives = binaryOptions.getActives();
        const now = sdk.currentTime();

        const ativosFiltrados = actives.filter(a => {
            const mercadoOk = configSolicitada.mercado === 'OTC' ? a.ticker.includes('-OTC') : !a.ticker.includes('-OTC');
            return mercadoOk && a.canBeBoughtAt(now);
        });

        if (ativosFiltrados.length === 0) return;

        for (let ativo of ativosFiltrados) {
            if (!global.buscando) break;

            const seconds = configSolicitada.timeframe === 'M5' ? 300 : 60;
            const layer = await sdk.realTimeChartDataLayer(ativo.id, seconds);
            const candles = await layer.fetchAllCandles(Math.floor(Date.now() / 1000) - (30 * seconds));

            if (!candles || candles.length < 20) continue;

            const direcao = analisarGrafico(candles, configSolicitada.analysis_mode);

            if (direcao) {
                // Trava 3: Sinal já executado nesta vela
                const signalKey = `${ativo.id}-${candles[candles.length - 2].time}-${direcao}`;
                if (sinalJaExecutado === signalKey) {
                    console.log(`⏳ Sinal já executado nesta vela. Aguardando próxima.`);
                    continue;
                }

                console.log(`🚀 [AUTOPILOT] Sinal de ${direcao} em ${ativo.ticker} (${configSolicitada.timeframe}). Executando...`);

                try {
                    const firstActiveInstruments = await ativo.instruments();
                    const availableInstruments = firstActiveInstruments.getAvailableForBuyAt(sdk.currentTime());
                    const instrumentoCorreto = availableInstruments.find(inst => inst.duration === seconds);

                    if (!instrumentoCorreto) {
                        console.log(`⚠️ Instrumento de ${seconds}s não encontrado.`);
                        continue;
                    }

                    const balances = await sdk.balances();
                    const demoBalance = balances.getBalances().find(b => b.type === 'demo');
                    if (!demoBalance) {
                        console.log("❌ Saldo Demo não encontrado.");
                        continue;
                    }

                    // Trava 4: Bloqueio total antes de comprar
                    operacaoEmAndamento = true;
                    ultimaEntradaTs = Date.now();
                    sinalJaExecutado = signalKey;

                    await binaryOptions.buy(
                        instrumentoCorreto,
                        direcao === "CALL" ? global.BinaryOptionsDirection.Call : global.BinaryOptionsDirection.Put,
                        configSolicitada.entry_amount,
                        demoBalance
                    );

                    console.log(`✅ ORDEM EXECUTADA: ${ativo.ticker} | ${direcao} | $${configSolicitada.entry_amount} | Exp: ${seconds}s`);
                    console.log(`⏳ Robô travado por 5 minutos para garantir 1 entrada por vez.`);

                    // Trava 5: Libera após 5 minutos
                    if (timeoutLiberacao) clearTimeout(timeoutLiberacao);
                    timeoutLiberacao = setTimeout(() => {
                        operacaoEmAndamento = false;
                        sinalJaExecutado = null;
                        console.log(`🔄 Ciclo de 5 minutos finalizado. Robô liberado.`);
                    }, 300000);

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

// Mantém a função processarSinal para o server.js (caso queira enviar sinal manual)
async function processarSinal(signal) {
    if (operacaoEmAndamento) return console.log("⏳ Operação em andamento. Ignorando sinal manual.");
    console.log(`📡 Sinal manual recebido: ${signal.direcao} em ${signal.ativo}`);
    // Aqui você pode agendar a execução manual se quiser
}

module.exports = { iniciarBotServidor, processarSinal };