// =====================================================
// LÓGICA DO MODAL E BOTÃO DE ATIVAÇÃO
// =====================================================
function abrirModalAtivar() {
    if (roboAtivo) {
        // Se já está ativo, o clique serve para PAUSAR
        pararPiloto();
    } else {
        // Se não está ativo, abre o modal
        const modal = document.getElementById('modal-ativar');
        if (modal) modal.classList.add('active');
    }
}

function fecharModal() {
    const modal = document.getElementById('modal-ativar');
    if (modal) modal.classList.remove('active');
}

function confirmarAtivacao() {
    fecharModal();
    roboAtivo = true;

    // Atualiza o Visual do Botão (Fica vermelho)
    const btn = document.getElementById('btn-pilot');
    if (btn) {
        btn.className = 'btn-start-pilot ativo';
        btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pausar análise dos AutoPilot';
    }

    // Atualiza o Holograma
    const statusTitle = document.getElementById('status-title');
    const statusSubtitle = document.getElementById('status-subtitle');
    if (statusTitle) statusTitle.innerText = "Monitorando o mercado em tempo real";
    if (statusSubtitle) statusSubtitle.innerText = "MERCADO";

    // Envia o comando para o Render via Electron
    if (window.api && window.api.ativarAutopilot) {
        window.api.ativarAutopilot();
        alert("🚀 AutoPilot ativado! O robô está operando na nuvem.");
    }
}

function pararPiloto() {
    if (confirm("Deseja pausar a análise do AutoPilot?")) {
        roboAtivo = false;

        // Volta o botão ao estado original (Verde)
        const btn = document.getElementById('btn-pilot');
        if (btn) {
            btn.className = 'btn-start-pilot';
            btn.innerHTML = '<i class="fa-solid fa-play"></i> Ativar análise dos AutoPilot';
        }

        // Atualiza o Holograma para "Pronto"
        const statusTitle = document.getElementById('status-title');
        const statusSubtitle = document.getElementById('status-subtitle');
        if (statusTitle) statusTitle.innerText = "Sistema pronto para iniciar";
        if (statusSubtitle) statusSubtitle.innerText = "MERCADO";

        // Envia o comando para o Render via Electron
        if (window.api && window.api.desativarAutopilot) {
            window.api.desativarAutopilot();
            alert("🛑 AutoPilot pausado.");
        }
    }
}