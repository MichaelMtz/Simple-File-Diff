'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { compareFolders } = require('../lib/folder-compare');
const ROOT = path.join(__dirname, '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

ipcMain.handle('fs:compareFolders', (_e, l, r) => compareFolders(l, r));

setTimeout(() => { console.log('TIMEOUT'); app.exit(0); }, 12000); // hard safety

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280, height: 820, show: false,
    webPreferences: { preload: path.join(ROOT, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  await win.loadFile(path.join(ROOT, 'renderer', 'index.html'));
  await wait(500);
  const counts = await win.webContents.executeJavaScript(
    `(async () => {
      document.getElementById('modeFolder').click();
      const res = await window.fileDiff.compareFolders(
        ${JSON.stringify(path.join(ROOT, 'samples/left'))},
        ${JSON.stringify(path.join(ROOT, 'samples/right'))});
      window.FolderView.render(res);
      document.getElementById('statAdded').textContent = res.counts.added;
      document.getElementById('statRemoved').textContent = res.counts.removed;
      document.getElementById('statChanged').textContent = res.counts.modified;
      document.getElementById('statSame').textContent = res.counts.identical;
      return res.counts;
    })()`
  );
  await wait(300);
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ROOT, 'samples', 'folder-screenshot.png'), img.toPNG());
  console.log('FOLDER_COUNTS', JSON.stringify(counts));
  app.exit(0);
});
