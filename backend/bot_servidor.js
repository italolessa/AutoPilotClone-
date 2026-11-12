async function buscarEExecutar() {
    if (!sdk || !global.buscando) return;
    isBuscando = true;

    try {
        const binaryOptions = await sdk.binaryOptions();
        const actives = binaryOptions.getActives();
        const now = sdk.currentTime();

        let ativosFiltrados = actives.filter(a => {
            const mercadoOk = configSolicitada.mercado === 'OTC' ? a.ticker.includes('-OTC') : !a.ticker.includes('-OTC');
            const estaAberto = a.canBeBoughtAt(now);
            const jaOperado = ativosOperados.includes(a.ticker);
            return mercadoOk && estaAberto && !jaOperado;
        });

        if (ativosFiltrados.length === 0) {
            ativosOperados = [];
            return;
        }

        for (let ativo of ativosFiltrados) {
            if (!global.buscando) break;

            // Trava anti-duplicidade
            const positions = await sdk.positions();
            const posicoesAtivas = positions.getPositions();
            const jaTemPosicao = posicoesAtivas.some(p => p.activeId === ativo.id);

            if (jaTemPosicao) {
                console.log(`⚠️ Já existe posição aberta em ${ativo.ticker}. Pulando.`);
                continue;
            }

            const seconds = configSolicitada.timeframe_mode === 'M5' ? 300 : 60;
            const layer = await sdk.realTimeChartDataLayer(ativo.id, seconds);
            const candles = await layer.fetchAllCandles(Math.floor(Date.now() / 1000) - (30 * seconds));

            if (!candles || candles.length < 20) continue;

            const direcao = analisarGraficoComEstrategias(candles, configSolicitada.analysis_mode);

            if (direcao) {
                console.log(`🚀 [AUTOPILOT] Sinal de ${direcao} em ${ativo.ticker} (${configSolicitada.timeframe_mode}). Buscando instrumento de ${seconds}s...`);
                
                try {
                    const firstActiveInstruments = await ativo.instruments();
                    const availableInstruments = firstActiveInstruments.getAvailableForBuyAt(sdk.currentTime());
                    
                    // --- CORREÇÃO AQUI: Filtrar o instrumento com o tempo exato ---
                    // O SDK retorna a duração em segundos. Vamos procurar o que bate com o nosso timeframe.
                    const instrumentoCorreto = availableInstruments.find(inst => inst.duration === seconds);
                    
                    if (!instrumentoCorreto) {
                        console.log(`⚠️ Nenhum instrumento com expiração de ${seconds}s para ${ativo.ticker}. Pulando.`);
                        continue;
                    }
                    
                    const balances = await sdk.balances();
                    const demoBalance = balances.getBalances().find(b => b.type === 'demo');
                    
                    if (!demoBalance) continue;

                    // Executa a ordem com o instrumento de tempo correto
                    await binaryOptions.buy(
                        instrumentoCorreto, 
                        direcao === "CALL" ? global.BinaryOptionsDirection.Call : global.BinaryOptionsDirection.Put, 
                        configSolicitada.entry_amount, 
                        demoBalance
                    );
                    
                    console.log(`✅ ORDEM EXECUTADA: ${ativo.ticker} | ${direcao} | Valor: $${configSolicitada.entry_amount} | Expiração: ${seconds}s`);
                    
                    ativosOperados.push(ativo.ticker);
                    break; 
                    
                } catch (err) {
                    console.error("❌ Erro ao executar ordem:", err.message);
                }
            }
        }
    } catch (error) {
        console.error("❌ Erro na varredura:", error.message);
    } finally {
        isBuscando = false;
    }
}