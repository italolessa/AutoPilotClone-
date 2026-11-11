const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    fazerLogout: () => ipcRenderer.send('fazer-logout'),
    verificarLoginSalvo: (callback) => {
        ipcRenderer.send('verificar-login-salvo');
        ipcRenderer.on('status-login-salvo', (_event, temLogin) => callback(temLogin));
    },
    iniciarLogin: () => ipcRenderer.send('iniciar-login'),
    fazerLoginSalvo: () => ipcRenderer.send('login-automatico'),
    salvarAutopilot: (config) => ipcRenderer.send('salvar-autopilot', config),
    onAutopilotSalvo: (callback) => ipcRenderer.on('autopilot-salvo-sucesso', callback),
    ativarAutopilot: () => ipcRenderer.send('ativar-autopilot'),
    desativarAutopilot: () => ipcRenderer.send('desativar-autopilot')
});{ contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Login
    fazerLogout: () => ipcRenderer.send('fazer-logout'),
    verificarLoginSalvo: (callback) => {
        ipcRenderer.send('verificar-login-salvo');
        ipcRenderer.on('status-login-salvo', (_event, temLogin) => callback(temLogin));
    },
    iniciarLogin: () => ipcRenderer.send('iniciar-login'),
    fazerLoginSalvo: () => ipcRenderer.send('login-automatico'),

    // AutoPilot (Aqui está a ponte que estava faltando)
    salvarAutopilot: (config) => ipcRenderer.send('salvar-autopilot', config),
    onAutopilotSalvo: (callback) => ipcRenderer.on('autopilot-salvo-sucesso', callback),
    ativarAutopilot: () => ipcRenderer.send('ativar-autopilot'),
    desativarAutopilot: () => ipcRenderer.send('desativar-autopilot')
});