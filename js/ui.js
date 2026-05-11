/**
 * UI HELPERS
 * ----------------------------------------------------------------
 * Reusable UI primitives shared across all pages.
 */

// ── Toast ──
let toastContainer;
function ensureToastContainer() {
  if (toastContainer) return toastContainer;
  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  document.body.appendChild(toastContainer);
  return toastContainer;
}

export function toast(message, type = '') {
  const c = ensureToastContainer();
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' toast--' + type : '');
  t.textContent = message;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(-10px)';
    t.style.transition = 'all 200ms';
    setTimeout(() => t.remove(), 250);
  }, 2400);
}

// ── Modal / Bottom Sheet ──
let activeModal = null;

export function openModal(contentHtml, options = {}) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = contentHtml;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  activeModal = overlay;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  if (options.onMount) options.onMount(modal);
  return { overlay, modal, close: closeModal };
}

export function closeModal() {
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
  }
}

// ── DOM helpers ──
export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

export function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v);
  }
  if (typeof children === 'string') e.innerHTML += children;
  else if (Array.isArray(children)) children.forEach(c => c && e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}

// ── Drag-to-change-HP ──
// Used by both player and enemy cards. Returns the new value while dragging
// and calls onCommit() when the drag ends.
export function attachHpDrag(barEl, opts) {
  const { getValue, getMax, onChange, onCommit } = opts;

  function start(e) {
    e.preventDefault();
    const isTouch = e.type === 'touchstart';
    const getX = ev => isTouch ? ev.touches[0].clientX : ev.clientX;
    const rect = barEl.getBoundingClientRect();
    const startX = getX(e);
    const startVal = getValue();
    const max = getMax();

    function move(ev) {
      ev.preventDefault();
      const dx = getX(ev) - startX;
      const valPerPx = max / rect.width;
      const newVal = Math.round(Math.max(0, Math.min(max, startVal + (dx * valPerPx))));
      onChange(newVal);
    }

    function up() {
      onCommit();
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
    }

    document.addEventListener('mousemove', move, { passive: false });
    document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
  }

  barEl.addEventListener('mousedown', start);
  barEl.addEventListener('touchstart', start, { passive: false });
}

// ── Debounce ──
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ── Pull to refresh ──
// Simple, mobile-first. Triggers callback when user pulls down from the top.
export function attachPullToRefresh(containerEl, onRefresh) {
  let startY = 0;
  let pulling = false;

  containerEl.addEventListener('touchstart', (e) => {
    if (window.scrollY > 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }, { passive: true });

  containerEl.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 80) {
      pulling = false;
      const indicator = el('div', {
        class: 'toast toast--ok',
        style: { textAlign: 'center' },
      }, 'Refreshing…');
      ensureToastContainer().appendChild(indicator);
      onRefresh().finally(() => indicator.remove());
    }
  }, { passive: true });

  containerEl.addEventListener('touchend', () => { pulling = false; });
}

// ── HP color class helper ──
export function hpClass(hp, maxHp) {
  if (hp <= maxHp * 0.25) return 'low';
  if (hp <= maxHp * 0.5) return 'mid';
  return '';
}

// ── Lightbox image viewer ──
export function openLightbox(imageSrc) {
  const overlay = el('div', { class: 'lightbox' }, [
    el('img', { src: imageSrc }),
    el('button', { class: 'lightbox-close', onclick: () => overlay.remove() }, '×'),
  ]);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

if (typeof window !== 'undefined') {
  window.toast = toast;
  window.openModal = openModal;
  window.closeModal = closeModal;
}
