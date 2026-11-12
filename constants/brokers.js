const BROKERS = {
    vorna:        { name: 'Vorna',         tradeUrl: 'https://trade.vornabroker.com/traderoom/', registerUrl: 'https://trade.vornabroker.com/register' },
    bullex:       { name: 'Bullex',        tradeUrl: 'https://trade.bull-ex.com/traderoom/',     registerUrl: 'https://trade.bull-ex.com/register' },
    exnova:       { name: 'Exnova',        tradeUrl: 'https://trade.exnova.com/traderoom/',      registerUrl: 'https://trade.exnova.com/register' },
    casatrade:    { name: 'Casa Trade',    tradeUrl: 'https://trade.casatrade.com/traderoom/',   registerUrl: 'https://trade.casatrade.com/register' },
    avalon:       { name: 'Avalon',        tradeUrl: 'https://trade.avalonbroker.com/traderoom', registerUrl: 'https://trade.avalonbroker.com/register' },
    iqoption:     { name: 'IQ Option',     tradeUrl: 'https://iqoption.com/traderoom/',          registerUrl: 'https://iqoption.com/register' },
    polarium:     { name: 'Polarium',      tradeUrl: 'https://trade.polariumbroker.com/traderoom/', registerUrl: 'https://trade.polariumbroker.com/register' },
    safirion:     { name: 'Safirion',      tradeUrl: 'https://trade.safirion.com/traderoom/',    registerUrl: 'https://trade.safirion.com/register' },
    shiverbroker: { name: 'Shiver Broker', tradeUrl: 'https://trade.shiverbroker.com/traderoom/',registerUrl: 'https://trade.shiverbroker.com/register' },
    hezilex:      { name: 'Hezilex',       tradeUrl: 'https://app.hezilex.com/traderoom',        registerUrl: 'https://bit.ly/loginhezilex' },
    codex:        { name: 'Codex',         tradeUrl: 'https://app.codexbroker.com/traderoom',    registerUrl: 'https://app.codexbroker.com/register' },
    lux7:         { name: 'Lux 7 Broker',  tradeUrl: 'https://trade.lux7broker.com/pt/traderoom',registerUrl: 'https://trade.lux7broker.com/pt/register' },
    puma:         { name: 'Puma',          tradeUrl: 'https://trade.pumabroker.com/traderoom',   registerUrl: 'https://trade.pumabroker.com/register' }
};

function getBrokerNome(slug) {
    return BROKERS[slug?.toLowerCase()]?.name || slug;
}

module.exports = { BROKERS, getBrokerNome };