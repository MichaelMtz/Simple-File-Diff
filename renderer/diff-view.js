'use strict';

// Side-by-side diff renderer built on jsdiff (global `Diff`).
const DiffView = (() => {
  let bodyLeft, bodyRight, headLeft, headRight, emptyState;
  let syncing = false;
  let hunkStarts = []; // row indices where each change hunk begins
  let cursorHunk = -1;

  function escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Split a jsdiff chunk value into lines, dropping the trailing newline's empty tail.
  function splitLines(value) {
    const lines = value.split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  // Intraline word diff → [leftHtml, rightHtml] with <mark> on the changed words.
  function wordDiff(oldLine, newLine) {
    const parts = Diff.diffWordsWithSpace(oldLine, newLine);
    let l = '';
    let r = '';
    for (const p of parts) {
      const esc = escapeHtml(p.value);
      if (p.added) r += `<mark>${esc}</mark>`;
      else if (p.removed) l += `<mark>${esc}</mark>`;
      else {
        l += esc;
        r += esc;
      }
    }
    return [l, r];
  }

  function row(cls, ln, inner, isHtml) {
    const num = ln == null ? '' : ln;
    const tx = isHtml ? inner : escapeHtml(inner);
    return `<div class="row ${cls}"><span class="ln">${num}</span><span class="tx">${tx}</span></div>`;
  }

  // Build the aligned row model from two texts.
  function build(leftText, rightText, options) {
    const ignore = options && options.ignoreWhitespace;
    const parts = Diff.diffLines(leftText, rightText, {
      ignoreWhitespace: !!ignore,
      newlineIsToken: false,
    });

    const left = [];
    const right = [];
    const stats = { added: 0, removed: 0, changed: 0, same: 0 };
    let lnL = 0;
    let lnR = 0;

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];

      if (!p.added && !p.removed) {
        for (const line of splitLines(p.value)) {
          lnL++;
          lnR++;
          left.push(row('eq', lnL, line, false));
          right.push(row('eq', lnR, line, false));
          stats.same++;
        }
        continue;
      }

      // removed immediately followed by added → pair as a "changed" block
      if (p.removed && i + 1 < parts.length && parts[i + 1].added) {
        const dels = splitLines(p.value);
        const adds = splitLines(parts[i + 1].value);
        const n = Math.max(dels.length, adds.length);
        for (let k = 0; k < n; k++) {
          const o = dels[k];
          const w = adds[k];
          if (o !== undefined && w !== undefined) {
            const [lh, rh] = wordDiff(o, w);
            lnL++;
            lnR++;
            left.push(row('chg l', lnL, lh, true));
            right.push(row('chg r', lnR, rh, true));
            stats.changed++;
          } else if (o !== undefined) {
            lnL++;
            left.push(row('del', lnL, o, false));
            right.push(row('fill', null, '', false));
            stats.removed++;
          } else {
            left.push(row('fill', null, '', false));
            lnR++;
            right.push(row('add', lnR, w, false));
            stats.added++;
          }
        }
        i++; // consumed the paired added chunk
        continue;
      }

      if (p.removed) {
        for (const line of splitLines(p.value)) {
          lnL++;
          left.push(row('del', lnL, line, false));
          right.push(row('fill', null, '', false));
          stats.removed++;
        }
      } else {
        // added
        for (const line of splitLines(p.value)) {
          left.push(row('fill', null, '', false));
          lnR++;
          right.push(row('add', lnR, line, false));
          stats.added++;
        }
      }
    }

    return { left, right, stats };
  }

  // Find the first row index of each maximal run of changed rows.
  function computeHunks(leftHtmlRows) {
    const starts = [];
    let prevChange = false;
    for (let i = 0; i < leftHtmlRows.length; i++) {
      const isChange = !/\brow eq\b/.test(leftHtmlRows[i]);
      if (isChange && !prevChange) starts.push(i);
      prevChange = isChange;
    }
    return starts;
  }

  function render(leftText, rightText, options, names) {
    const model = build(leftText, rightText, options);
    bodyLeft.innerHTML = model.left.join('');
    bodyRight.innerHTML = model.right.join('');
    hunkStarts = computeHunks(model.left);
    cursorHunk = -1;
    if (names) {
      headLeft.textContent = names.left || 'Left';
      headRight.textContent = names.right || 'Right';
      headLeft.title = names.left || '';
      headRight.title = names.right || '';
    }
    if (emptyState) emptyState.classList.add('is-hidden');
    // reset scroll to top
    bodyLeft.scrollTop = 0;
    bodyRight.scrollTop = 0;
    return model.stats;
  }

  function clear() {
    if (bodyLeft) bodyLeft.innerHTML = '';
    if (bodyRight) bodyRight.innerHTML = '';
    hunkStarts = [];
    cursorHunk = -1;
    if (emptyState) emptyState.classList.remove('is-hidden');
  }

  function markCursor(idx) {
    bodyLeft.querySelectorAll('.row.cursor').forEach((el) => el.classList.remove('cursor'));
    bodyRight.querySelectorAll('.row.cursor').forEach((el) => el.classList.remove('cursor'));
    const lrow = bodyLeft.children[idx];
    const rrow = bodyRight.children[idx];
    if (lrow) {
      lrow.classList.add('cursor');
      const top = lrow.offsetTop - bodyLeft.clientHeight / 3;
      bodyLeft.scrollTop = Math.max(0, top);
      bodyRight.scrollTop = bodyLeft.scrollTop;
    }
    if (rrow) rrow.classList.add('cursor');
  }

  function next() {
    if (!hunkStarts.length) return;
    cursorHunk = (cursorHunk + 1) % hunkStarts.length;
    markCursor(hunkStarts[cursorHunk]);
  }

  function prev() {
    if (!hunkStarts.length) return;
    cursorHunk = cursorHunk <= 0 ? hunkStarts.length - 1 : cursorHunk - 1;
    markCursor(hunkStarts[cursorHunk]);
  }

  function init() {
    bodyLeft = document.getElementById('bodyLeft');
    bodyRight = document.getElementById('bodyRight');
    headLeft = document.getElementById('headLeft');
    headRight = document.getElementById('headRight');
    emptyState = document.getElementById('emptyState');

    // synchronized scrolling, both axes
    const link = (a, b) => {
      a.addEventListener('scroll', () => {
        if (syncing) return;
        syncing = true;
        b.scrollTop = a.scrollTop;
        b.scrollLeft = a.scrollLeft;
        syncing = false;
      });
    };
    link(bodyLeft, bodyRight);
    link(bodyRight, bodyLeft);
  }

  return { init, render, clear, next, prev };
})();

if (typeof window !== 'undefined') window.DiffView = DiffView;
