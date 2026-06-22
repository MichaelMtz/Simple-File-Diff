'use strict';

// Folder comparison view: recursive tree keyed by relative path.
const FolderView = (() => {
  let head, tree;
  let onOpenFile = null; // callback(leftPath, rightPath, rel)

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const BADGE = {
    added: 'added',
    removed: 'removed',
    modified: 'modified',
    identical: 'same',
  };

  function depthIndent(rel) {
    const depth = (rel.match(/\//g) || []).length;
    return '<span class="findent">' + '·   '.repeat(depth) + '</span>';
  }

  function baseName(rel) {
    const i = rel.lastIndexOf('/');
    return i === -1 ? rel : rel.slice(i + 1);
  }

  function render(result) {
    const c = result.counts;
    head.innerHTML =
      `Comparing <b>${escapeHtml(result.leftRoot)}</b> ⇄ <b>${escapeHtml(result.rightRoot)}</b> &nbsp;·&nbsp; ` +
      `${c.added} added · ${c.removed} removed · ${c.modified} changed · ${c.identical} unchanged`;

    const html = result.rows
      .map((r) => {
        const indent = depthIndent(r.rel);
        const name = escapeHtml(baseName(r.rel)) + (r.isDir ? '/' : '');
        if (r.isDir) {
          return `<div class="frow dir"><span class="badge identical">dir</span>${indent}<span class="fname">${name}</span></div>`;
        }
        const clickable = r.status === 'modified';
        const badge = `<span class="badge ${r.status}">${r.status}</span>`;
        return (
          `<div class="frow ${r.status}${clickable ? ' clickable' : ''}" data-rel="${escapeHtml(r.rel)}" data-status="${r.status}">` +
          `${badge}${indent}<span class="fname">${name}</span></div>`
        );
      })
      .join('');

    tree.innerHTML = html || '<div class="frow dir"><span class="fname">No files found.</span></div>';

    tree.querySelectorAll('.frow.clickable').forEach((el) => {
      el.addEventListener('click', async () => {
        const rel = el.getAttribute('data-rel');
        if (onOpenFile) onOpenFile(result.leftRoot, result.rightRoot, rel);
      });
    });
  }

  function reset(message) {
    if (head) head.textContent = message || 'Choose two folders to compare their contents recursively.';
    if (tree) tree.innerHTML = '';
  }

  function init(openFileCb) {
    head = document.getElementById('folderHead');
    tree = document.getElementById('folderTree');
    onOpenFile = openFileCb;
  }

  return { init, render, reset };
})();

if (typeof window !== 'undefined') window.FolderView = FolderView;
