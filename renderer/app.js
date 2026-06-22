'use strict';

(() => {
  const api = window.fileDiff;

  const state = {
    mode: 'file', // 'file' | 'folder'
    file: { left: null, right: null }, // { path, name, text }
    folder: { left: null, right: null }, // path strings
    ignoreWs: false,
  };

  // ── element refs ───────────────────────────────────────────────
  const el = {
    modeFile: document.getElementById('modeFile'),
    modeFolder: document.getElementById('modeFolder'),
    fileView: document.getElementById('fileView'),
    folderView: document.getElementById('folderView'),
    nameLeft: document.getElementById('nameLeft'),
    nameRight: document.getElementById('nameRight'),
    slotLeft: document.getElementById('slotLeft'),
    slotRight: document.getElementById('slotRight'),
    browseLeft: document.getElementById('browseLeft'),
    browseRight: document.getElementById('browseRight'),
    swapBtn: document.getElementById('swapBtn'),
    reloadBtn: document.getElementById('reloadBtn'),
    ignoreWs: document.getElementById('ignoreWs'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    navGroup: document.getElementById('navGroup'),
    statReady: document.getElementById('statReady'),
    statAdded: document.getElementById('statAdded'),
    statRemoved: document.getElementById('statRemoved'),
    statChanged: document.getElementById('statChanged'),
    statSame: document.getElementById('statSame'),
  };

  // ── status helpers ─────────────────────────────────────────────
  function setStatus(text) {
    el.statReady.textContent = text;
    el.statReady.style.color = '';
  }
  function setError(text) {
    el.statReady.textContent = text;
    el.statReady.style.color = 'var(--accent-ink)';
  }
  function setStats(s) {
    el.statAdded.textContent = s.added;
    el.statRemoved.textContent = s.removed;
    el.statChanged.textContent = s.changed;
    el.statSame.textContent = s.same;
  }
  function zeroStats() {
    setStats({ added: 0, removed: 0, changed: 0, same: 0 });
  }

  // ── slot labels ────────────────────────────────────────────────
  function updateSlots() {
    const blank = state.mode === 'file' ? 'Drop a file or browse…' : 'Choose a folder…';
    const sides = ['left', 'right'];
    sides.forEach((side) => {
      const nameEl = side === 'left' ? el.nameLeft : el.nameRight;
      let label = blank;
      let filled = false;
      if (state.mode === 'file' && state.file[side]) {
        label = state.file[side].name;
        filled = true;
      } else if (state.mode === 'folder' && state.folder[side]) {
        label = state.folder[side];
        filled = true;
      }
      nameEl.textContent = label;
      nameEl.title = filled ? (state.mode === 'file' ? state.file[side].path : state.folder[side]) : '';
      nameEl.classList.toggle('is-empty', !filled);
    });
  }

  // ── file mode ──────────────────────────────────────────────────
  async function loadFile(side, path) {
    if (!path) return;
    setStatus('Reading…');
    const res = await api.readFile(path);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    state.file[side] = { path: res.path, name: res.name, text: res.text };
    updateSlots();
    renderDiff();
  }

  function renderDiff() {
    const L = state.file.left;
    const R = state.file.right;
    if (L && R) {
      const stats = DiffView.render(L.text, R.text, { ignoreWhitespace: state.ignoreWs }, {
        left: L.name,
        right: R.name,
      });
      setStats(stats);
      const total = stats.added + stats.removed + stats.changed;
      setStatus(total === 0 ? 'Files are identical' : `${L.name} ⇄ ${R.name}`);
    } else {
      DiffView.clear();
      zeroStats();
      setStatus(L || R ? 'Pick the other side to compare' : 'Ready');
    }
  }

  // ── folder mode ────────────────────────────────────────────────
  async function setFolder(side, path) {
    if (!path) return;
    state.folder[side] = path;
    updateSlots();
    if (state.folder.left && state.folder.right) runFolderCompare();
  }

  async function runFolderCompare() {
    setStatus('Scanning folders…');
    const res = await api.compareFolders(state.folder.left, state.folder.right);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    FolderView.render(res);
    setStats({
      added: res.counts.added,
      removed: res.counts.removed,
      changed: res.counts.modified,
      same: res.counts.identical,
    });
    setStatus('Folder comparison complete — click a changed file to diff it');
  }

  async function openPairFromFolder(leftRoot, rightRoot, rel) {
    const [lp, rp] = await Promise.all([api.join(leftRoot, rel), api.join(rightRoot, rel)]);
    const [lr, rr] = await Promise.all([api.readFile(lp), api.readFile(rp)]);
    if (!lr.ok || !rr.ok) {
      setError((lr.ok ? rr.error : lr.error) || 'Could not open file pair.');
      return;
    }
    state.file.left = { path: lr.path, name: rel, text: lr.text };
    state.file.right = { path: rr.path, name: rel, text: rr.text };
    switchMode('file');
    renderDiff();
  }

  // ── mode switch ────────────────────────────────────────────────
  function switchMode(mode) {
    state.mode = mode;
    el.modeFile.classList.toggle('is-active', mode === 'file');
    el.modeFolder.classList.toggle('is-active', mode === 'folder');
    el.fileView.classList.toggle('is-hidden', mode !== 'file');
    el.folderView.classList.toggle('is-hidden', mode !== 'folder');
    el.navGroup.style.display = mode === 'file' ? '' : 'none';
    updateSlots();
    if (mode === 'file') renderDiff();
    else if (state.folder.left && state.folder.right) runFolderCompare();
    else {
      FolderView.reset();
      zeroStats();
      setStatus('Ready');
    }
  }

  // ── actions ────────────────────────────────────────────────────
  async function browse(side) {
    if (state.mode === 'file') {
      const path = await api.openFile();
      if (path) loadFile(side, path);
    } else {
      const path = await api.openFolder();
      if (path) setFolder(side, path);
    }
  }

  function swap() {
    if (state.mode === 'file') {
      [state.file.left, state.file.right] = [state.file.right, state.file.left];
      updateSlots();
      renderDiff();
    } else {
      [state.folder.left, state.folder.right] = [state.folder.right, state.folder.left];
      updateSlots();
      if (state.folder.left && state.folder.right) runFolderCompare();
    }
  }

  async function reload() {
    if (state.mode === 'file') {
      if (state.file.left) await loadFile('left', state.file.left.path);
      if (state.file.right) await loadFile('right', state.file.right.path);
    } else if (state.folder.left && state.folder.right) {
      runFolderCompare();
    }
  }

  // ── drag & drop ────────────────────────────────────────────────
  function wireDrop(slotEl, side) {
    ['dragenter', 'dragover'].forEach((ev) =>
      slotEl.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        slotEl.classList.add('is-drop');
      })
    );
    ['dragleave', 'dragend'].forEach((ev) =>
      slotEl.addEventListener(ev, (e) => {
        e.preventDefault();
        slotEl.classList.remove('is-drop');
      })
    );
    slotEl.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      slotEl.classList.remove('is-drop');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f || !f.path) return;
      if (state.mode === 'file') loadFile(side, f.path);
      else setFolder(side, f.path);
    });
  }

  // ── wire up ────────────────────────────────────────────────────
  function main() {
    DiffView.init();
    FolderView.init(openPairFromFolder);

    el.browseLeft.addEventListener('click', () => browse('left'));
    el.browseRight.addEventListener('click', () => browse('right'));
    el.swapBtn.addEventListener('click', swap);
    el.reloadBtn.addEventListener('click', reload);
    el.prevBtn.addEventListener('click', () => DiffView.prev());
    el.nextBtn.addEventListener('click', () => DiffView.next());
    el.modeFile.addEventListener('click', () => switchMode('file'));
    el.modeFolder.addEventListener('click', () => switchMode('folder'));
    el.ignoreWs.addEventListener('change', () => {
      state.ignoreWs = el.ignoreWs.checked;
      if (state.mode === 'file') renderDiff();
    });

    wireDrop(el.slotLeft, 'left');
    wireDrop(el.slotRight, 'right');

    // keyboard niceties
    document.addEventListener('keydown', (e) => {
      if (state.mode !== 'file') return;
      if (e.key === 'ArrowDown' && (e.metaKey || e.altKey)) {
        e.preventDefault();
        DiffView.next();
      } else if (e.key === 'ArrowUp' && (e.metaKey || e.altKey)) {
        e.preventDefault();
        DiffView.prev();
      }
    });

    // swallow stray drops outside the slots so the app doesn't navigate away
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());

    updateSlots();
    setStatus('Ready');
  }

  window.addEventListener('DOMContentLoaded', main);
})();
