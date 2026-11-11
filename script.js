let config = {
    entry_amount: 5, account_mode: "demo", analysis_mode: "trend", market_mode: "open",
    timeframe_mode: "M1", daily_goal: 100, daily_stop_loss: 50, max_ops_per_day: 100,
    protection: "martingale", martingale_auto_levels: 1, martingale_auto_multiplier: 2
};
let roboAtivo = false;

function toggleActive(element, className) {
    const parent = element.parentElement;
    parent.querySelectorAll(`.${className}`).forEach(s => s.classList.remove('active'));
    element.classList.add('active');
}

function setConta(mode, btn) { config.account_mode = mode; toggleActive(btn, 'btn-toggle'); }
function setAnalysis(mode, btn) { config.analysis_mode = mode; toggleActive(btn, 'btn-box'); }
function setMarket(mode, btn) { config.market_mode = mode; toggleActive(btn, 'btn-box'); }
function setTimeframe(mode, btn) { config.timeframe_mode = mode; toggleActive(btn, 'btn-box'); }
function setProtection(mode, element) { config.protection = mode; toggleActive(element, 'protect-box'); }

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

function salvarConfiguracoes() {
    config.entry_amount = parseFloat(document.getElementById('entry_amount').value);
    config.daily_goal = parseFloat(document.getElementById('daily_goal').value);
    config.martingale_auto_levels = parseInt(document.getElementById('gales').value);
    config.martingale_auto_multiplier = parseFloat(document.getElementById('multiplicador').value);

    if (window.api && window.api.salvarAutopilot) {
        window.api.salvarAutopilot(config);
        alert("✅ Configurações salvas!");
    }
}

function abrirModalAtivar() {
    if (roboAtivo) { pararPiloto(); } else { document.getElementById('modal-ativar').classList.add('active'); }
}
function fecharModal() { document.getElementById('modal-ativar').classList.remove('active'); }

function confirmarAtivacao() {
    fecharModal();
    roboAtivo = true;
    const btn = document.getElementById('btn-pilot');
    btn.className = 'btn-start-pilot ativo';
    btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pausar análise dos AutoPilot';
    if (window.api && window.api.ativarAutopilot) window.api.ativarAutopilot();
}

function pararPiloto() {
    if (confirm("Deseja pausar a análise?")) {
        roboAtivo = false;
        const btn = document.getElementById('btn-pilot');
        btn.className = 'btn-start-pilot';
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Ativar análise dos AutoPilot';
        if (window.api && window.api.desativarAutopilot) window.api.desativarAutopilot();
    }
}

function descartar() { if(confirm("Descartar alterações?")) location.reload(); }
function escolherAtivos() { alert("Em breve"); }

window.onload = () => { calcularEscala(); };Variáveis de Estado
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

let roboAtivo = false; // Controla o estado do botão

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
    let textoDescricao = `Martingale (auto — ${gales} gale(s), ×${mult}): $ ${entrada.toFixed(2).replace('.', ',')}`;
    for (let i = 1; i <= gales; i++) {
        currentValue = currentValue * mult;
        html += ` <i class="fa-solid fa-arrow-right text-muted small"></i> <span class="pill">G${i} $ ${currentValue.toFixed(2).replace('.', ',')}</span>`;
        if (i === 1) textoDescricao += ` → $ ${currentValue.toFixed(2).replace('.', ',')}`;
    }
    textoDescricao += `. Após loss, sobe ao próximo; após win, volta ao G0.`;
    document.getElementById('scale-values').innerHTML = html;
    document.getElementById('martingale-description').innerText = textoDescricao;
}

// SALVAR CONFIGURAÇÕES
function salvarConfiguracoes() {
    try {
        config.entry_amount = parseFloat(document.getElementById('entry_amount').value);
        config.daily_goal = parseFloat(document.getElementById('daily_goal').value);
        config.daily_stop_loss = parseFloat(document.getElementById('daily_stop_loss').value);
        config.max_ops_per_day = parseInt(document.getElementById('max_ops').value);
        config.martingale_auto_levels = parseInt(document.getElementById('gales').value);
        config.martingale_auto_multiplier = parseFloat(document.getElementById('multiplicador').value);

        if (window.api && window.api.salvarAutopilot) {
            window.api.salvarAutopilot(config);
            alert("✅ Configurações salvas na nuvem!");
        }
    } catch (e) {
        console.error("Erro:", e);
    }
}

// --- LÓGICA DO MODAL E BOTÃO DE ATIVAÇÃO ---

// 1. Abrir o Modal
function abrirModalAtivar() {
    if (roboAtivo) {
        // Se o robô já estiver ativo, o clique no botão serve para PAUSAR.
        pararPiloto();
    } else {
        // Se estiver inativo, abre o modal de confirmação.
        document.getElementById('modal-ativar').classList.add('active');
    }
}

// 2. Fechar o Modal
function fecharModal() {
    document.getElementById('modal-ativar').classList.remove('active');
}

// 3. Confirmar Ativação
function confirmarAtivacao() {
    fecharModal(); // Fecha o modal
    roboAtivo = true;

    // Atualiza o Visual do Botão (Fica vermelho)
    const btn = document.getElementById('btn-pilot');
    btn.className = 'btn-start-pilot ativo';
    btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pausar análise dos AutoPilot';
    
    // Atualiza o texto de ajuda
    document.getElementById('pilot-help-text').innerText = "Confirme a ativação/desativação para continuar";

    // Atualiza o Holograma para "Operando"
    document.getElementById('status-title').innerText = "Monitorando o mercado em tempo real";
    document.getElementById('status-subtitle').innerText = "MERCADO";
    // (Opcional: adicionar classes para animar o holograma)

    // Envia o comando para o Render
    if (window.api && window.api.ativarAutopilot) {
        window.api.ativarAutopilot();
    }
}

// 4. Parar o Piloto
function pararPiloto() {
    if (confirm("Deseja pausar a análise do AutoPilot?")) {
        roboAtivo = false;

        // Volta o botão ao estado original (Verde)
        const btn = document.getElementById('btn-pilot');
        btn.className = 'btn-start-pilot';
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Ativar análise dos AutoPilot';

        // Volta o texto de ajuda
        document.getElementById('pilot-help-text').innerText = "Salve as alterações antes de ativar";

        // Atualiza o Holograma para "Pronto"
        document.getElementById('status-title').innerText = "Sistema pronto para iniciar";
        document.getElementById('status-subtitle').innerText = "MERCADO";

        // Envia o comando para o Render
        if (window.api && window.api.desativarAutopilot) {
            window.api.desativarAutopilot();
        }
    }
}

function descartar() {
    if(confirm("Deseja descartar as alterações?")) location.reload();
}
function escolherAtivos() { alert("Abrir modal de ativos (Em breve)"); }

window.onload = () => { calcularEscala(); };