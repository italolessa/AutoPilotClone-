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
                console.log(`🚀 [AUTOPILOT] Sinal de ${direcao} em ${ativo.ticker}. Executando ordem...`);
                
                try {
                    // --- AQUI ESTÁ A CORREÇÃO BASEADA NA DOCUMENTAÇÃO ---
                    // 1. Pegamos o instrumento do ativo (não usamos o ativo direto)
                    const instruments = await ativo.instruments();
                    
                    // 2. Pegamos a lista de instrumentos disponíveis para compra AGORA
                    const availableInstruments = instruments.getAvailableForBuyAt(sdk.currentTime());
                    
                    if (availableInstruments.length === 0) {
                        console.log(`⚠️ Nenhum instrumento disponível para ${ativo.ticker} agora.`);
                        continue;
                    }
                    
                    // 3. Escolhemos o primeiro instrumento disponível (que tem o tempo de expiração correto)
                    const instrument = availableInstruments[0];
                    
                    // 4. Encontramos o saldo da conta Demo para debitar
                    const balances = await sdk.balances();
                    const demoBalance = balances.getBalances().find(b => b.type === 'demo');
                    
                    if (!demoBalance) {
                        console.log("❌ Saldo Demo não encontrado.");
                        continue;
                    }

                    // 5. Executamos a compra passando o INSTRUMENTO, a direção, o valor e o saldo
                    await binaryOptions.buy(
                        instrument, 
                        direcao === "CALL" ? global.BinaryOptionsDirection.Call : global.BinaryOptionsDirection.Put, 
                        configSolicitada.entry_amount, 
                        demoBalance
                    );
                    
                    console.log(`✅ ORDEM EXECUTADA: ${ativo.ticker} | ${direcao} | Valor: $${configSolicitada.entry_amount}`);
                    global.buscando = false; 
                    
                } catch (err) {
                    console.error("❌ Erro ao executar ordem:", err.message);
                }
                break;
            }
        }
    } catch (error) {
        console.error("❌ Erro na varredura:", error.message);
    } finally {
        isBuscando = false;
    }
}