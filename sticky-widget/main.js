const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

const vaultPath = path.join(__dirname, '../TestVault');
const topicsPath = path.join(vaultPath, 'Topics');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 300,
    height: 350,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers for Obsidian Vault Files
ipcMain.handle('get-topics', () => {
    if (!fs.existsSync(topicsPath)) return [];
    const files = fs.readdirSync(topicsPath).filter(f => f.endsWith('.md'));
    const topics = [];
    
    for (const file of files) {
        const filePath = path.join(topicsPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (match) {
            try {
                const fm = yaml.load(match[1]);
                if (fm && fm.topic) {
                    topics.push({ filename: file, fm: fm, rawContent: content });
                }
            } catch (e) {
                console.error("Failed to parse YAML", e);
            }
        }
    }
    return topics;
});

ipcMain.handle('update-topic', (event, { filename, newFm }) => {
    const filePath = path.join(topicsPath, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    const newYamlString = yaml.dump(newFm);
    
    const updatedContent = content.replace(/^---\n([\s\S]*?)\n---/, `---\n${newYamlString}---`);
    fs.writeFileSync(filePath, updatedContent, 'utf-8');
});
