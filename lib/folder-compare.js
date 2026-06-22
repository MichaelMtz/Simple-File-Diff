'use strict';

// Pure Node (no Electron) folder comparison — shared by main.js and tests.
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const IGNORED_DIRS = new Set(['.git', 'node_modules', '.DS_Store']);

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function walkFolder(root, base = root, acc = new Map()) {
  let entries;
  try {
    entries = await fsp.readdir(base, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(base, entry.name);
    const rel = path.relative(root, full);
    if (entry.isDirectory()) {
      acc.set(rel, { isDir: true });
      await walkFolder(root, full, acc);
    } else if (entry.isFile()) {
      let size = 0;
      try {
        size = (await fsp.stat(full)).size;
      } catch {
        /* unreadable — treat as zero */
      }
      acc.set(rel, { isDir: false, size });
    }
  }
  return acc;
}

async function compareFolders(leftRoot, rightRoot) {
  const [left, right] = await Promise.all([walkFolder(leftRoot), walkFolder(rightRoot)]);
  const allKeys = new Set([...left.keys(), ...right.keys()]);
  const rows = [];
  const counts = { added: 0, removed: 0, modified: 0, identical: 0 };

  for (const rel of allKeys) {
    const l = left.get(rel);
    const r = right.get(rel);
    const isDir = (l && l.isDir) || (r && r.isDir);
    if (isDir) {
      rows.push({ rel, isDir: true, status: l && r ? 'identical' : l ? 'removed' : 'added' });
      continue;
    }

    let status;
    if (l && !r) status = 'removed';
    else if (!l && r) status = 'added';
    else if (l.size !== r.size) status = 'modified';
    else {
      try {
        const [lh, rh] = await Promise.all([
          hashFile(path.join(leftRoot, rel)),
          hashFile(path.join(rightRoot, rel)),
        ]);
        status = lh === rh ? 'identical' : 'modified';
      } catch {
        status = 'modified';
      }
    }
    rows.push({ rel, isDir: false, status });
    counts[status]++;
  }

  rows.sort((a, b) => a.rel.localeCompare(b.rel));
  return { ok: true, leftRoot, rightRoot, rows, counts };
}

module.exports = { compareFolders, walkFolder };
