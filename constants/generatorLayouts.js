const GENERATOR_LAYOUTS = [
    { id: 'classic',    label: 'Painel clássico',      desc: 'Configuração e resultado no mesmo painel' },
    { id: 'radar',      label: 'Radar Operacional',    desc: 'Painel lateral com etapas e evidência' },
    { id: 'decision',   label: 'Mesa de Decisão',      desc: 'Config esquerda, iframe central, decisão direita' },
    { id: 'chart',      label: 'Chart First',          desc: 'Iframe dominante com controles superiores' },
    { id: 'laboratory', label: 'Laboratório do Sinal', desc: 'Fluxo analítico por etapas' }
];

const ANALYSIS_VISUALS = [
    { id: 'orb',     label: 'Núcleo de leitura',  desc: 'Orbital clássico com pulso' },
    { id: 'scanner', label: 'Scanner de mercado', desc: 'Candles em movimento' },
    { id: 'radar',   label: 'Radar de ativos',    desc: 'Radar circular' },
    { id: 'neural',  label: 'Rede neural',        desc: 'Nós de IA processando' }
];

const CHART_STYLES = [
    { id: 'candles', label: 'Candles técnico' },
    { id: 'area',    label: 'Fluxo de preço' },
    { id: 'hybrid',  label: 'Híbrido profissional' }
];

module.exports = { GENERATOR_LAYOUTS, ANALYSIS_VISUALS, CHART_STYLES };