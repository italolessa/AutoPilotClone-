const WS_URL = 'wss://ws.trade.polariumbroker.com/echo/websocket';
let sdk;
let configSolicitada = { timeframe: 'M1', mercado: 'OTC', analysis_mode: 'trend', entry_amount: 5 };

// --- TRAVAS DE SEGURANÇA ---
let operacaoEmAndamento = false;
let ultimaEntradaTs = 0;
let nivelMartingale = 0;
let operacaoAtual = null;
let sinaisAgendados = new Set();
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
    configSolicitada = config || configSolicitada;

    if (sdk) return console.log("✅ SDK já está inicializado.");

    console.log("⏳ Iniciando SDK no servidor...");
    try {
        const sdkModule = await import('@quadcode-tech/client-sdk-js');
        const { ClientSdk, SsidAuthMethod, BinaryOptionsDirection } = sdkModule;
        sdk = await ClientSdk.create(WS_URL, 82, new SsidAuthMethod(tokenSsid));
        global.BinaryOptionsDirection = BinaryOptionsDirection;
        console.log("✅ SDK inicializado! Robô em modo AUTOMÁTICO.");
    } catch (error) {
        console.error("❌ Erro ao conectar SDK:", error.message);
    }
}

// --- RECEBER SINAL E AGENDAR ---
async function processarSinal(signal) {
    if (operacaoEmAndamento) return console.log("⏳ Operação em andamento. Ignorando.");
    
    // Trava de 5 minutos (só bloqueia se estiver no G0)
    const agora = Date.now();
    if (nivelMartingale === 0 && (agora - ultimaEntradaTs) < INTERVALO_ENTRE_ENTRADAS_MS) {
        return console.log("⏳ Aguardando tempo de respiro de 5 min...");
    }

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

// --- EXECUTAR ORDEM ---
async function executarOrdem(signal) {
    if (!sdk || operacaoEmAndamento) return;
    operacaoEmAndamento = true;

    try {
        const binaryOptions = await sdk.binaryOptions();
        const actives = binaryOptions.getActives();
        
        // Remove o sufixo "(OTC)" ou espaços se houver, para achar o ticker certo
        const tickerLimpo = signal.ativo.replace(" (OTC)", "").replace("/", ""); 
        const ativo = actives.find(a => a.ticker === tickerLimpo || a.ticker === tickerLimpo + "-OTC");
        
        if (!ativo) {
            console.log(`❌ Ativo ${signal.ativo} não encontrado.`);
            operacaoEmAndamento = false;
            return;
        }

        const seconds = configSolicitada.timeframe_mode === 'M5' ? 300 : 60;
        const instr = await ativo.instruments();
        const disp = instr.getAvailableForBuyAt(sdk.currentTime());
        
        // =========================================================
        // CORREÇÃO DA VELA: Usa a propriedade 'duration' exata
        // =========================================================
        const instrumento = disp.find(i => i.duration === seconds);
        
        if (!instrumento) {
            console.log(`⚠️ Instrumento de ${seconds}s não encontrado no momento.`);
            operacaoEmAndamento = false;
            return;
        }

        const balances = await sdk.balances();
        const demoBalance = balances.getBalances().find(b => b.type === 'demo');

        const mult = configSolicitada.martingale_auto_multiplier || 2;
        const entryAmount = configSolicitada.entry_amount * Math.pow(mult, nivelMartingale);

        await binaryOptions.buy(
            instrumento,
            signal.direcao === "CALL" ? global.BinaryOptionsDirection.Call : global.BinaryOptionsDirection.Put,
            entryAmount,
            demoBalance
        );

        console.log(`✅ ORDEM EXECUTADA: ${signal.ativo} | ${signal.direcao} | Valor: $${entryAmount.toFixed(2)} | G${nivelMartingale}`);

        // Salva a operação atual para verificar o resultado depois
        operacaoAtual = {
            ativoId: ativo.id,
            ativo: ativo.ticker,
            direcao: signal.direcao,
            horarioEntradaTs: Date.now(),
            resultadoChecado: false
        };

        // Agenda a verificação do resultado para daqui a X segundos + 5s de margem
        setTimeout(async () => {
            await verificarResultado();
        }, (seconds * 1000) + 5000);

    } catch (err) {
        console.error("❌ Erro ao executar:", err.message);
        operacaoEmAndamento = false;
    }
}

// --- VERIFICAR RESULTADO E MARTINGALE ---
async function verificarResultado() {
    if (!operacaoAtual) {
        operacaoEmAndamento = false;
        return;
    }

    try {
        const seconds = configSolicitada.timeframe_mode === 'M5' ? 300 : 60;
        const layer = await sdk.realTimeChartDataLayer(operacaoAtual.ativoId, seconds);
        const candles = await layer.fetchAllCandles(Math.floor(Date.now() / 1000) - (3 * seconds));

        if (!candles || candles.length < 2) {
            operacaoEmAndamento = false;
            return;
        }

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
            console.log(`✅ WIN! Voltando ao G0. Trava de 5 minutos ativada.`);
            nivelMartingale = 0;
            operacaoAtual = null;
            operacaoEmAndamento = false;
            ultimaEntradaTs = Date.now(); // ATIVA A TRAVA DE 5 MIN
        } else if (resultado === "LOSS") {
            const galesPermitidos = configSolicitada.martingale_auto_levels || 1;
            if (nivelMartingale < galesPermitidos) {
                nivelMartingale++;
                console.log(`❌ LOSS! Aplicando Martingale G${nivelMartingale}. Aguardando próxima vela...`);
                operacaoAtual = null;
                operacaoEmAndamento = false;
                ultimaEntradaTs = 0; // ZERA A TRAVA PARA ENTRAR NO MARTINGALE NA PRÓXIMA VELA
            } else {
                console.log(`❌ LOSS no último gale (G${nivelMartingale}). Resetando ciclo. Trava de 5 min ativada.`);
                nivelMartingale = 0;
                operacaoAtual = null;
                operacaoEmAndamento = false;
                ultimaEntradaTs = Date.now(); // ATIVA A TRAVA DE 5 MIN
            }
        } else {
            console.log(`⚖️ Empate. Resetando ciclo. Trava de 5 min ativada.`);
            nivelMartingale = 0;
            operacaoAtual = null;
            operacaoEmAndamento = false;
            ultimaEntradaTs = Date.now(); // ATIVA A TRAVA DE 5 MIN
        }

    } catch (err) {
        console.error("❌ Erro ao verificar resultado:", err.message);
        operacaoEmAndamento = false;
        operacaoAtual = null;
    }
}

module.exports = { iniciarBotServidor, processarSinal };