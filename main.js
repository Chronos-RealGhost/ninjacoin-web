const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// Inicia o servidor Node.js/Express internamente 
require('./server');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#0b0c10',
        icon: path.join(__dirname, 'public', 'logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Abre o console de desenvolvedor automaticamente para debugar erros na tela
    mainWindow.webContents.openDevTools();

    // Remove a barra de menus feia do Windows
    Menu.setApplicationMenu(null);

    // Limpa o cache para garantir que as atualizações apareçam
    const { session } = require('electron');
    session.defaultSession.clearCache();
    session.defaultSession.clearStorageData();

    // Carrega a interface com um pequeno delay para o Express estabilizar
    setTimeout(() => {
        mainWindow.loadURL('http://127.0.0.1:3000').catch(err => {
            console.error("Falha ao carregar a URL do servidor local:", err);
            // Tenta recarregar uma vez após 2 segundos se falhar
            setTimeout(() => {
                mainWindow.loadURL('http://127.0.0.1:3000');
            }, 2000);
        });
    }, 2000);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
        process.exit(0);
    }
});
