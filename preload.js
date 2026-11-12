const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Funções de Login
    verificarLoginSalvo: (callback) => {
        ipcRenderer.send('verificar-login-salvo');
        ipcRenderer.on('status-login-salvo', (_event, temLogin) => callback(temLogin));
    },
    iniciarLogin: (dados) => ipcRenderer.send('iniciar-login', dados),
    fazerLoginSalvo: () => ipcRenderer.send('login-automatico'),
    fazerLogout: () => ipcRenderer.send('fazer-logout'),

    // Funções do AutoPilot
    salvarAutopilot: (config) => ipcRenderer.send('salvar-autopilot', config),
    onAutopilotSalvo: (callback) => ipcRenderer.on('autopilot-salvo-sucesso', callback),
    ativarAutopilot: () => ipcRenderer.send('ativar-autopilot'),
    desativarAutopilot: () => ipcRenderer.send('desativar-autopilot')
});