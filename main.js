ipcMain.on('salvar-autopilot', async (event, config) => {
    try {
        await axios.put(`${RENDER_URL}/api/autopilot/settings`, config);
        event.reply('autopilot-salvo-sucesso');
    } catch (e) { console.log("Erro ao salvar config", e.message); }
});

ipcMain.on('ativar-autopilot', async () => {
    try { 
        // Envia o comando para o Render iniciar o robô
        await axios.post(`${RENDER_URL}/api/autopilot/activate`, { enabled: true }); 
    } catch (e) { console.log(e.message); }
});