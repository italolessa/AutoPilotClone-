const TZ = 'America/Sao_Paulo';

function formatarHora(dataStr) {
    if (!dataStr) return '—';
    const d = new Date(dataStr);
    if (isNaN(d)) return '—';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

function formatarData(dataStr) {
    if (!dataStr) return '—';
    const d = new Date(dataStr);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ });
}

function calcularStats(ops) {
    let wins = 0, losses = 0, dojis = 0;
    for (const op of ops) {
        if (op.resultado === 'WIN') wins++;
        else if (op.resultado === 'LOSS') losses++;
        else if (op.resultado === 'DOJI') dojis++;
    }
    return { wins, losses, dojis, total: ops.length };
}

function formatarAtivo(ticker) {
    return ticker.replace('-OTC', ' (OTC)').replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2');
}

module.exports = { formatarHora, formatarData, calcularStats, formatarAtivo };