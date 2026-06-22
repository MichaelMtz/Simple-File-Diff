'use strict';

// Headless verification: loads the real renderer, drives the file diff, and writes
// samples/diff-screenshot.png. (Folder view: see screenshot-folder.js.)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

setTimeout(() => { console.log('TIMEOUT'); app.exit(0); }, 12000); // hard safety

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const errors = [];
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) errors.push(message);
  });

  await win.loadFile(path.join(ROOT, 'renderer', 'index.html'));
  await wait(500); // let DOMContentLoaded main() run

  const L = fs.readFileSync(path.join(ROOT, 'samples/left/app.js'), 'utf8');
  const R = fs.readFileSync(path.join(ROOT, 'samples/right/app.js'), 'utf8');

  const stats = await win.webContents.executeJavaScript(
    `(() => {
      const s = window.DiffView.render(${JSON.stringify(L)}, ${JSON.stringify(R)},
        { ignoreWhitespace: false }, { left: 'samples/left/app.js', right: 'samples/right/app.js' });
      document.getElementById('statAdded').textContent = s.added;
      document.getElementById('statRemoved').textContent = s.removed;
      document.getElementById('statChanged').textContent = s.changed;
      document.getElementById('statSame').textContent = s.same;
      document.getElementById('statReady').textContent = 'samples/left/app.js ⇄ samples/right/app.js';
      return s;
    })()`
  );

  await wait(250);
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ROOT, 'samples', 'diff-screenshot.png'), img.toPNG());

  console.log('FILE_STATS', JSON.stringify(stats));
  console.log('CONSOLE_ERRORS', JSON.stringify(errors));
  app.exit(0);
});
