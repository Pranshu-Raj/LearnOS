const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const yaml = require('js-yaml');

const vaultPath = path.join(__dirname, '../TestVault');
const topicsPath = path.join(vaultPath, 'Topics');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 340,
    height: 460,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
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
  app.quit();
});

// IPC Handlers

ipcMain.handle('get-vault-topics', () => {
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
          const bodyContent = content.replace(/^---\n[\s\S]*?\n---/, '');
          const taskLines = [];
          const lines = bodyContent.split(/\r?\n/);
          lines.forEach(l => {
            const taskMatch = l.match(/^\s*-\s*\[([ xX])\]\s*(.*)$/);
            if (taskMatch) {
              taskLines.push({
                done: taskMatch[1] !== ' ',
                text: taskMatch[2].trim()
              });
            }
          });

          topics.push({
            filename: file,
            fm,
            tasks: taskLines
          });
        }
      } catch (e) {
        console.error('YAML parse error in file:', file, e);
      }
    }
  }
  return topics;
});

ipcMain.handle('update-topic-frontmatter', (event, { filename, updates }) => {
  const filePath = path.join(topicsPath, filename);
  if (!fs.existsSync(filePath)) return false;

  let content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);

  if (match) {
    try {
      const fm = yaml.load(match[1]) || {};
      const updatedFm = { ...fm, ...updates };
      const newYamlStr = yaml.dump(updatedFm);
      content = content.replace(/^---\n([\s\S]*?)\n---/, `---\n${newYamlStr}---`);
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch (e) {
      console.error('Failed to update frontmatter:', e);
    }
  }
  return false;
});

ipcMain.handle('trigger-replan', () => {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '../scripts/replan.py');
    const projectRoot = path.join(__dirname, '..');
    exec(`python "${scriptPath}" TestVault`, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        console.error('Re-plan execution error:', error, stderr);
        resolve({ status: 'error', error: stderr || error.message });
      } else {
        resolve({ status: 'success', output: stdout });
      }
    });
  });
});

ipcMain.handle('parse-planner-image', (event, imagePath) => {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '../scripts/cli_vision.py');
    const projectRoot = path.join(__dirname, '..');
    exec(`python "${scriptPath}" "${imagePath}" TestVault`, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        console.error('Vision parsing error:', error, stderr);
        resolve({ status: 'error', error: stderr || error.message });
      } else {
        resolve({ status: 'success', output: stdout });
      }
    });
  });
});

ipcMain.handle('close-app', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('minimize-app', () => {
  if (mainWindow) mainWindow.minimize();
});
