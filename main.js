'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fsp = require('fs/promises');
const { compareFolders } = require('./lib/folder-compare');

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB — keep the renderer responsive.

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 820,
    minHeight: 520,
    backgroundColor: '#faf8f4',
    titleBarStyle: 'hiddenInset',
    title: 'FileDiff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Cheap binary sniff: a NUL byte in the first chunk almost always means binary.
function looksBinary(buffer) {
  const len = Math.min(buffer.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

async function readTextFile(filePath) {
  const stat = await fsp.stat(filePath);
  if (stat.isDirectory()) {
    return { ok: false, error: 'That path is a folder, not a file.' };
  }
  if (stat.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `File is too large to diff (${(stat.size / 1024 / 1024).toFixed(1)} MB, max 8 MB).`,
    };
  }
  const buffer = await fsp.readFile(filePath);
  if (looksBinary(buffer)) {
    return { ok: false, error: 'File appears to be binary — text diff is not available.' };
  }
  return {
    ok: true,
    text: buffer.toString('utf8'),
    name: path.basename(filePath),
    path: filePath,
    size: stat.size,
  };
}

// ── IPC ──────────────────────────────────────────────────────────────────────

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Choose a file to compare',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Choose a folder to compare',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('fs:readFile', async (_evt, filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    return { ok: false, error: 'No file path provided.' };
  }
  try {
    return await readTextFile(filePath);
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('fs:compareFolders', async (_evt, leftRoot, rightRoot) => {
  if (!leftRoot || !rightRoot) return { ok: false, error: 'Two folders are required.' };
  try {
    return await compareFolders(leftRoot, rightRoot);
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

// Join a folder root + relative path on the main side (renderer has no path module).
ipcMain.handle('fs:join', (_evt, root, rel) => path.join(root, rel));

// ── Lifecycle ──────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
