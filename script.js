// =====================================================
// CONFIGURAÇÕES INICIAIS E ESTADO GLOBAL
// =====================================================
let config = {
    entry_amount: 5,
    account_mode: "demo",
    analysis_mode: "trend",
    market_mode: "open",
    timeframe_mode: "M1",
    daily_goal: 100,
    daily_stop_loss: 50,
    max_ops_per_day: 100,
    protection: "martingale",
    martingale_auto_levels: 1,
    martingale_auto_multiplier: 2
};

let roboAtivo = false;
let salvando = false;

// =====================================================
// FUNÇÕES DE SELEÇÃO VISUAL (TOGGLE)
// =====================================================
function toggleActive(element, className) {
    const parent = element.parentElement;
    const siblings = parent.querySelectorAll(`.${className}`);
    siblings.forEach(s => s.classList.remove('active'));
    element.classList.add('active');
}

function setConta(mode, btn) { config.account_mode = mode; toggleActive(btn, 'btn-toggle'); }
function setLimite(mode, btn) { config.limit_mode = mode; toggleActive(btn, 'btn-toggle'); }
function setAnalysis(mode, btn) { config.analysis_mode = mode; toggleActive(btn, 'btn-box'); }
function setMarket(mode, btn) { config.market_mode = mode; toggleActive(btn, 'btn-box'); }
function setTimeframe(mode, btn) { config.timeframe_mode = mode; toggleActive(btn, 'btn-box'); }
function setProtection(mode, element) { config.protection = mode; toggleActive(element, 'protect-box'); }
function setMartingaleMode(mode, btn) { toggleActive(btn, 'btn-toggle'); }

// =====================================================
// CÁLCULO DO MARTINGALE (Corrigido)
// =====================================================
function calcularEscala() {
    const gales = parseInt(document.getElementById('gales')?.value) || 0;
    const mult = parseFloat(document.getElementById('multiplicador')?.value) || 1;
    const entrada = parseFloat(document.getElementById('entry_amount')?.value) || 5;

    let html = `<span class="pill">G0 $ ${entrada.toFixed(2).replace('.', ',')}</span>`;
    let currentValue = entrada;
    let textoDescricao = `Martingale (auto — ${gales} gale(s), ×${mult}): $ ${entrada.toFixed(2).replace('.', ',')}`;

    for (let i = 1; i <= gales; i++) {
        currentValue = currentValue * mult;
        html += ` <i class="fa-solid fa-arrow-right text-muted small"></i> <span class="pill">G${i} $ ${currentValue.toFixed(2).replace('.', ',')}</span>`;
        if (i === 1) textoDescricao += ` → $ ${currentValue.toFixed(2).replace('.', ',')}`;
    }

    textoDescricao += `. Após loss, sobe ao próximo; após win, volta ao G0.`;

    const scaleValues = document.getElementById('scale-values');
    const martingaleDesc = document.getElementById('martingale-description');

    if (scaleValues) scaleValues.innerHTML = html;
    if (martingaleDesc) martingaleDesc.innerText = textoDescricao;
}

// =====================================================
// SALVAR CONFIGURAÇÕES (Com travas anti-duplicação)
// =====================================================
function salvarConfiguracoes() {
    if (salvando) return;
    salvando = true;

    console.log("1. Botão Salvar clicado.");

    // Captura os valores
    config.entry_amount = parseFloat(document.getElementById('entry_amount').value);
    config.daily_goal = parseFloat(document.getElementById('daily_goal').value);
    config.daily_stop_loss = parseFloat(document.getElementById('daily_stop_loss').value);
    config.max_ops_per_day = parseInt(document.getElementById('max_ops').value);
    config.martingale_auto_levels = parseInt(document.getElementById('gales').value);
    config.martingale_auto_multiplier = parseFloat(document.getElementById('multiplicador').value);

    console.log("2. Payload montado:", config);

    // Envia para o Main.js (Electron)
    if (window.api && window.api.salvarAutopilot) {
        window.api.salvarAutopilot(config);
        alert("✅ Configurações salvas na nuvem!");
    } else {
        console.error("3. ERRO: window.api não encontrado.");
        alert("❌ Erro de comunicação com o sistema. Verifique o console (F12).");
    }

    setTimeout(() => { salvando = false; }, 2000);
}

// =====================================================
// ATIVAR / PAUSAR PILOTO
// =====================================================
function iniciarPiloto() {
    if (window.api && window.api.ativarAutopilot) {
        window.api.ativarAutopilot();
        
        const btn = document.getElementById('btn-pilot');
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analisando Mercado...';
            btn.style.background = '#333';
            btn.disabled = true;
        }
        alert("🚀 AutoPilot ativado! O robô está operando na nuvem.");
    } else {
        alert("❌ Erro de comunicação com o sistema.");
    }
}

function pararPiloto() {
    if (window.api && window.api.desativarAutopilot) {
        window.api.desativarAutopilot();
        
        const btn = document.getElementById('btn-pilot');
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-play"></i> Ativar análise dos AutoPilot';
            btn.style.background = 'var(--accent-gradient)';
            btn.disabled = false;
        }
        alert("🛑 AutoPilot pausado.");
    }
}

// =====================================================
// OUTRAS FUNÇÕES
// =====================================================
function descartar() {
    if (confirm("Deseja descartar as alterações?")) location.reload();
}

function escolherAtivos() {
    alert("Abrir modal de ativos (Em breve)");
}

// Inicializa os cálculos quando a página carrega
window.onload = () => {
    calcularEscala();
};