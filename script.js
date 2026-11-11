// Variáveis de Estado
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

// Funções de seleção visual
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

// Cálculo do Martingale
function calcularEscala() {
    const gales = parseInt(document.getElementById('gales').value) || 0;
    const mult = parseFloat(document.getElementById('multiplicador').value) || 1;
    const entrada = parseFloat(document.getElementById('entry_amount').value) || 5;
    let html = `<span class="pill">G0 $ ${entrada.toFixed(2).replace('.', ',')}</span>`;
    let currentValue = entrada;
    for (let i = 1; i <= gales; i++) {
        currentValue = currentValue * mult;
        html += ` <i class="fa-solid fa-arrow-right text-muted small"></i> <span class="pill">G${i} $ ${currentValue.toFixed(2).replace('.', ',')}</span>`;
    }
    document.getElementById('scale-values').innerHTML = html;
}

// SALVAR CONFIGURAÇÕES
function salvarConfiguracoes() {
    config.entry_amount = parseFloat(document.getElementById('entry_amount').value);
    config.daily_goal = parseFloat(document.getElementById('daily_goal').value);
    config.daily_stop_loss = parseFloat(document.getElementById('daily_stop_loss').value);
    config.max_ops_per_day = parseInt(document.getElementById('max_ops').value);
    config.martingale_auto_levels = parseInt(document.getElementById('gales').value);
    config.martingale_auto_multiplier = parseFloat(document.getElementById('multiplicador').value);

    if (window.api && window.api.salvarAutopilot) {
        window.api.salvarAutopilot(config);
        alert("✅ Configurações salvas na nuvem!");
    } else {
        alert("❌ Erro de comunicação. Verifique o console (F12).");
    }
}

// --- LÓGICA DO MODAL E BOTÃO DE ATIVAÇÃO ---

// 1. Abrir o Modal
function abrirModalAtivar() {
    if (roboAtivo) {
        pararPiloto();
    } else {
        document.getElementById('modal-ativar').classList.add('active');
    }
}

// 2. Fechar o Modal
function fecharModal() {
    document.getElementById('modal-ativar').classList.remove('active');
}

// 3. Confirmar Ativação
function confirmarAtivacao() {
    fecharModal();
    roboAtivo = true;

    // Atualiza o Visual do Botão (Fica vermelho)
    const btn = document.getElementById('btn-pilot');
    btn.className = 'btn-start-pilot ativo';
    btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pausar análise dos AutoPilot';
    document.getElementById('pilot-help-text').innerText = "Confirme a ativação/desativação para continuar";

    // Atualiza o Holograma
    document.getElementById('status-title').innerText = "Monitorando o mercado em tempo real";
    document.getElementById('status-subtitle').innerText = "MERCADO";

    if (window.api && window.api.ativarAutopilot) {
        window.api.ativarAutopilot();
    }
}

// 4. Parar o Piloto
function pararPiloto() {
    if (confirm("Deseja pausar a análise do AutoPilot?")) {
        roboAtivo = false;
        const btn = document.getElementById('btn-pilot');
        btn.className = 'btn-start-pilot';
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Ativar análise dos AutoPilot';
        document.getElementById('pilot-help-text').innerText = "Salve as alterações antes de ativar";
        document.getElementById('status-title').innerText = "Sistema pronto para iniciar";
        document.getElementById('status-subtitle').innerText = "MERCADO";

        if (window.api && window.api.desativarAutopilot) {
            window.api.desativarAutopilot();
        }
    }
}

function descartar() { if(confirm("Descartar alterações?")) location.reload(); }
function escolherAtivos() { alert("Em breve"); }

window.onload = () => { calcularEscala(); };