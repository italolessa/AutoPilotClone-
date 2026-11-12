const WS_URL = 'wss://ws.trade.polariumbroker.com/echo/websocket'; 
let sdk;
let BinaryOptionsDirectionGlobal;

// Função para conectar o SDK no app desktop (usado para executar ordens)
async function iniciarBot(window, tokenSsid) {
    if (!tokenSsid) return console.error("❌ Token não fornecido para o bot local.");
    try {
        const sdkModule = await import('@quadcode-tech/client-sdk-js');
        const { ClientSdk, SsidAuthMethod, BinaryOptionsDirection } = sdkModule;
        BinaryOptionsDirectionGlobal = BinaryOptionsDirection;
        sdk = await ClientSdk.create(WS_URL, 82, new SsidAuthMethod(tokenSsid));
        console.log("✅ SDK local inicializado para execução de ordens!");
    } catch (error) {
        console.error("❌ Erro ao conectar SDK local:", error.message);
    }
}

// Esta é a função que será chamada pelo botão "Enviar para Corretora"
async function executarOrdemReal(dados) {
    if (!sdk) {
        console.log("❌ SDK local não inicializado. Não é possível enviar ordem.");
        return;
    }
    try {
        console.log(`🚀 [REAL] Enviando ordem: ${dados.ativo} | ${dados.direcao} | TF: ${dados.timeframe}`);
        
        const binaryOptions = await sdk.binaryOptions();
        const actives = binaryOptions.getActives();
        
        // Converte o nome do ativo para o ticker do SDK
        const tickerBase = dados.ativo.replace("/", "").replace(" (OTC)", "");
        const active = actives.find(a => a.ticker === tickerBase || a.ticker === tickerBase + "-OTC");
        
        if (!active) return console.log(`❌ Ativo não encontrado no SDK: ${tickerBase}`);

        const now = sdk.currentTime();
        const duracaoDesejada = dados.timeframe === 'M5' ? 300 : 60; // AQUI ESTÁ A CORREÇÃO M1/M5

        const instruments = await active.instruments();
        const availableInstruments = instruments.getAvailableForBuyAt(now);
        
        const instrument = availableInstruments.find(inst => {
            const diffSegundos = (inst.expiration - now) / 1000;
            return Math.abs(diffSegundos - duracaoDesejada) <= 2;
        });

        if (!instrument) {
            console.log(`❌ Nenhum instrumento de ${duracaoDesejada}s disponível agora para ${tickerBase}.`);
            return;
        }

        const balances = await sdk.balances();
        const balance = balances.getBalances().find(b => b.type === 'demo') || balances.getBalances()[0];
        if (!balance) return console.log("❌ Saldo não encontrado.");

        const direction = dados.direcao === "PUT" ? BinaryOptionsDirectionGlobal.Put : BinaryOptionsDirectionGlobal.Call;
        
        const option = await binaryOptions.buy(instrument, direction, 5, balance);
        console.log(`✅ [REAL] ORDEM ENVIADA COM SUCESSO! ID: ${option.id}`);

    } catch (error) {
        console.error("❌ Falha na execução da ordem real:", error.message);
    }
}

module.exports = { iniciarBot, executarOrdemReal };