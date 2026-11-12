function registrarOperacao(sinal, resultado = null, pnl = null, martingaleNivel = 0) {
    return {
        id: Date.now(),
        user_id: sinal.user_id || 2766,
        broker: "polarium",
        ativo: sinal.ticker,
        direcao: sinal.direcao,
        confirmacao: sinal.confirmacao || 90.0,
        timeframe: sinal.timeframe || "M1",
        preco_entrada: sinal.preco_entrada || null,
        preco_saida: resultado === 'WIN' ? sinal.preco_saida : null,
        resultado: resultado,
        martingale_aplicado: martingaleNivel,
        chart_path: `chart_${sinal.ticker.replace('-', '_')}_${Date.now()}.png`,
        source: "gerador",
        analysis_mode: sinal.analysis_mode || "trend",
        martingale_max_config: 1,
        created_at: new Date().toISOString(),
        resultado_at: new Date().toISOString(),
        entry_amount: sinal.entry_amount || null,
        executed: resultado ? 1 : 0,
        pnl: pnl,
        result_source: resultado ? "check_win" : null,
        broker_transaction_id: sinal.transaction_id || null,
        account_mode: "demo",
        analysis_version: "trend-rsi-adx-v2",
        technical_snapshot: JSON.stringify({
            schema_version: 1,
            analysis_version: "trend-rsi-adx-v2",
            analysis_mode: "trend",
            captured_at: new Date().toISOString(),
            broker: "polarium",
            ativo: sinal.ticker,
            ativo_normalizado: sinal.ticker,
            direcao: sinal.direcao,
            timeframe: sinal.timeframe,
            confirmacao: sinal.confirmacao || 90.0,
            percentuais: sinal.percentuais || {},
            indicadores: sinal.indicadores || {},
            rules: {
                minimum_candle_confirmation: 65,
                rsi_period: 14,
                adx_period: 14,
                rsi_call_above: 50,
                rsi_put_below: 50,
                adx_minimum: 20,
                indicator_bonus_rsi: 3,
                indicator_bonus_adx: 5,
                indicator_bonus_both: 2
            }
        }),
        result_g0: martingaleNivel === 0 ? resultado : null,
        result_g1: martingaleNivel === 1 ? resultado : null,
        ativo_display: sinal.ticker.replace('-OTC', ' (OTC)').replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2')
    };
}

module.exports = { registrarOperacao };