'use strict';

// Rasterize assets/icon.svg → assets/icon.png at 1024×1024 using Electron's renderer
// (no external SVG tooling needed). From there, build the .icns:
//
//   node_modules/.bin/electron scripts/render-icon.js
//   # then: sips to an iconset + `iconutil -c icns FileDiff.iconset -o assets/icon.icns`
//   # (see the README "Regenerating the icon" section)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
setTimeout(() => app.exit(1), 15000);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1024, height: 1024, show: false, backgroundColor: '#00000000' });
  const svg = fs.readFileSync(path.join(ROOT, 'assets', 'icon.svg'), 'utf8');
  const html =
    '<!doctype html><html><head><style>html,body{margin:0;padding:0;width:1024px;height:1024px;' +
    'background:transparent}svg{width:1024px;height:1024px;display:block}</style></head><body>' +
    svg + '</body></html>';
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 400));
  const img = (await win.webContents.capturePage()).resize({ width: 1024, height: 1024 });
  fs.writeFileSync(path.join(ROOT, 'assets', 'icon.png'), img.toPNG());
  console.log('wrote assets/icon.png (1024×1024)');
  app.exit(0);
});
