/**
 * PLAYER DASHBOARD
 * ----------------------------------------------------------------
 * Players see their own character (editable) + read-only summaries
 * of the rest of the party, current scene, maps marked as visible,
 * and active quests. Pull-to-refresh on mobile.
 *
 * Players don't have a real "claim" mechanism here — for the simple
 * version, the first player card without a linked playerId becomes
 * theirs on first load. In the Firebase version, you'd link the
 * authenticated UID to a player doc.
 */

import { dataLayer } from '../data.js';
import { auth } from '../auth.js';
import { $, $$, el, toast, attachHpDrag, hpClass, debounce, attachPullToRefresh, openLightbox } from '../ui.js';
import { HUMANITY_LABELS, QUEST_STATUSES } from '../constants.js';

await auth.init();
let user = auth.getCurrentUser();
if (!user || user.role !== 'player') {
  location.href = '../index.html';
}
$('#myName').textContent = user.name;
await dataLayer.init();

// ── State ──
let players = [], quests = [], maps = [];
let myPlayerId = localStorage.getItem('ds_my_player_id_' + user.uid) || null;
let scene = { title: '', desc: '' };

// ── Load All Data (Replaces auto-refresh) ──
async function loadAll() {
  const [p, q, m, s] = await Promise.all([
    dataLayer.list('players'),
    dataLayer.list('quests'),
    dataLayer.list('maps'),
    dataLayer.list('scenes'),
  ]);
  players = p;
  quests = q.filter(x => x.status !== 'secret');
  maps = m.filter(x => x.visibleToPlayers);
  const sc = s.find(d => d.id === 'current');
  if (sc) {
    scene = sc;
    $('#sceneTitle').textContent = sc.title || 'Untitled scene';
    $('#sceneDesc').textContent  = sc.desc  || '';
  }
  renderMe();
  renderParty();
  renderQuests();
  renderMaps();
}

await loadAll();

// ── Pick or create my player ──
function autoLinkMyPlayer() {
  if (myPlayerId && players.find(p => p.id === myPlayerId)) return;
  // Try to find a player whose name matches
  const byName = players.find(p => (p.name || '').trim().toLowerCase() === user.name.toLowerCase());
  if (byName) {
    myPlayerId = byName.id;
    localStorage.setItem('ds_my_player_id_' + user.uid, myPlayerId);
  }
}

// ============================================================
// MY CHARACTER
// ============================================================

function renderMe() {
  autoLinkMyPlayer();
  const container = $('#myCard');
  const me = players.find(p => p.id === myPlayerId);

  if (!me) {
    container.innerHTML = `
      <div class="card">
        <div class="card-section" style="text-align:center;padding:32px">
          <p class="label" style="margin-bottom:12px">Waiting for the DM…</p>
          <p style="font-size:13px;color:var(--text-dim);margin-bottom:16px">Ask Mark to add a player named <b style="color:var(--text)">${escapeHtml(user.name)}</b></p>
          <button class="btn btn--ghost btn--sm" id="forceRefresh">Refresh</button>
        </div>
      </div>`;
    $('#forceRefresh')?.addEventListener('click', () => location.reload());
    return;
  }

  const pct = me.maxHp > 0 ? (me.hp / me.maxHp) * 100 : 0;
  const hc = hpClass(me.hp, me.maxHp);

  container.innerHTML = '';
  const card = el('div', { class: 'pcard' });
  card.innerHTML = `
    <div class="pcard__head">
      <div class="pcard__name" style="cursor:default">${escapeHtml(me.name || user.name)}</div>
    </div>

    <div class="hp-block">
      <div class="label">HIT POINTS</div>
      <div class="hp-row">
        <div class="hp-num ${hc ? 'hp-num--' + hc : ''}">${me.hp}</div>
        <div class="hp-bar"><div class="hp-bar__fill ${hc ? 'hp-bar__fill--' + hc : ''}" style="width:${pct}%"></div></div>
        <button class="btn btn--icon btn--accent-red" data-action="hp-minus">−</button>
        <button class="btn btn--icon" data-action="hp-plus">+</button>
      </div>
      <p class="label" style="margin-top:8px;color:var(--muted)">drag the bar to set HP · MAX: ${me.maxHp}</p>
    </div>

    <div class="card-section">
      <div class="label">HUMANITY</div>
      <div class="pip-row">${pipsHtml(me.hum, 'b')}<span class="pip-count">${me.hum}/10</span></div>
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);margin-top:6px;letter-spacing:0.1em">${HUMANITY_LABELS[me.hum] || ''}</div>
    </div>

    <div class="card-section">
      <div class="label">UPGRADES</div>
      <div class="mods-grid">${modsHtml(me)}</div>
    </div>

    <div class="card-section">
      <div class="label">PRIMARY ITEMS</div>
      <div class="primary-grid">${primariesHtml(me)}</div>
    </div>

    <div class="card-section">
      <div class="label">ITEMS & GEAR</div>
      <div class="items">${itemsHtml(me)}</div>
      <button class="add-item-btn" data-action="add-item">+ ADD ITEM</button>
    </div>

    ${me.publicNotes ? `
    <div class="card-section">
      <div class="label">NOTES FROM YOUR DM</div>
      <p style="font-size:14px;line-height:1.6;color:var(--text-dim);white-space:pre-wrap">${escapeHtml(me.publicNotes)}</p>
    </div>` : ''}
  `;

  // HP +/-
  card.querySelector('[data-action="hp-minus"]').addEventListener('click', () => {
    me.hp = Math.max(0, me.hp - 1);
    dataLayer.update('players', me.id, { hp: me.hp });
    renderMe();
  });
  card.querySelector('[data-action="hp-plus"]').addEventListener('click', () => {
    me.hp = Math.min(me.maxHp, me.hp + 1);
    dataLayer.update('players', me.id, { hp: me.hp });
    renderMe();
  });

  // Drag HP
  const bar = card.querySelector('.hp-bar');
  let dragHp = me.hp;
  attachHpDrag(bar, {
    getValue: () => me.hp,
    getMax: () => me.maxHp,
    onChange: (v) => {
      dragHp = v;
      const fill = bar.querySelector('.hp-bar__fill');
      const num = card.querySelector('.hp-num');
      const pct = (v / me.maxHp) * 100;
      const hc = hpClass(v, me.maxHp);
      fill.style.width = pct + '%';
      fill.className = 'hp-bar__fill' + (hc ? ' hp-bar__fill--' + hc : '');
      num.textContent = v;
      num.className = 'hp-num' + (hc ? ' hp-num--' + hc : '');
    },
    onCommit: () => {
      me.hp = dragHp;
      dataLayer.update('players', me.id, { hp: dragHp });
    },
  });

  // Items add/edit/delete
  card.querySelectorAll('[data-item-idx]').forEach(row => {
    const idx = parseInt(row.getAttribute('data-item-idx'));
    row.querySelectorAll('[data-item-field]').forEach(inp => {
      const field = inp.getAttribute('data-item-field');
      inp.addEventListener('input', debounce(() => {
        me.items = [...(me.items || [])];
        me.items[idx] = { ...me.items[idx], [field]: field === 'q' ? (parseInt(inp.value) || 1) : inp.value };
        dataLayer.update('players', me.id, { items: me.items });
      }, 300));
    });
    row.querySelector('[data-action="del-item"]').addEventListener('click', () => {
      me.items = (me.items || []).filter((_, i) => i !== idx);
      dataLayer.update('players', me.id, { items: me.items });
      renderMe();
    });
  });
  card.querySelector('[data-action="add-item"]').addEventListener('click', () => {
    me.items = [...(me.items || []), { t: '', q: 1 }];
    dataLayer.update('players', me.id, { items: me.items });
    renderMe();
  });

  // Primary items text
  card.querySelectorAll('[data-primary-text]').forEach(txt => {
    const idx = parseInt(txt.getAttribute('data-primary-text'));
    txt.addEventListener('input', debounce((e) => {
      me.primaries = clonePrimaries(me);
      me.primaries[idx].t = e.target.value;
      dataLayer.update('players', me.id, { primaries: me.primaries });
    }, 300));
  });

  container.appendChild(card);
}

function pipsHtml(value, color, size = null) {
  let html = '';
  const style = size ? ` style="width:${size}px;height:${size}px"` : '';
  for (let i = 1; i <= 10; i++) {
    html += `<div class="pip ${i <= value ? 'pip--' + color : ''}"${style}></div>`;
  }
  return html;
}

function modsHtml(p) {
  let html = '';
  for (let i = 0; i < 3; i++) {
    const m = p.mods?.[i];
    const tier = p.tiers?.[i] || 1;
    if (m) {
      const cls = m.type === 'bio' ? 'bio' : 'cyber';
      let dots = '';
      for (let j = 1; j <= 3; j++) {
        dots += `<div class="tier-dot ${j <= tier ? 'tier-dot--' + cls : ''}"></div>`;
      }
      html += `<div class="mslot mslot--${cls}">
        <div class="mslot__type mslot__type--${cls}">${m.type.toUpperCase()}</div>
        <div class="mslot__name">${escapeHtml(m.name)}</div>
        <div class="tier-dots">${dots}</div>
      </div>`;
    } else {
      html += `<div class="mslot"><div class="mslot__empty">SLOT ${i+1}<br>EMPTY</div></div>`;
    }
  }
  return html;
}

function primariesHtml(p) {
  const prim = p.primaries || [{t:'',img:''},{t:'',img:''},{t:'',img:''}];
  let html = '';
  for (let i = 0; i < 3; i++) {
    let item = prim[i];
    if (typeof item === 'string') item = { t: item, img: '' };
    if (!item) item = { t: '', img: '' };
    html += `<div class="pslot" data-primary-slot="${i}">
      <div class="pslot__tag">PRIMARY ${i+1}</div>
      <textarea class="pslot__input" placeholder="weapon, gear…" data-primary-text="${i}">${escapeHtml(item.t || '')}</textarea>
    </div>`;
  }
  return html;
}

function itemsHtml(p) {
  return (p.items || []).map((it, idx) => `
    <div class="item-row" data-item-idx="${idx}">
      <input class="input" placeholder="item…" value="${escapeHtml(it.t || '')}" data-item-field="t">
      <input class="input qty" type="number" min="0" value="${it.q || 1}" data-item-field="q">
      <button class="item-del" data-action="del-item">×</button>
    </div>
  `).join('');
}

function clonePrimaries(p) {
  return (p.primaries || [{t:'',img:''},{t:'',img:''},{t:'',img:''}]).map(it => {
    if (typeof it === 'string') return { t: it, img: '' };
    return { ...it };
  });
}

// ============================================================
// PARTY (read-only summary)
// ============================================================

function renderParty() {
  const list = $('#partyList');
  const others = players.filter(p => p.id !== myPlayerId);
  if (!others.length) {
    list.innerHTML = '<p class="label" style="text-align:center;padding:24px 0">No party members yet</p>';
    return;
  }
  list.innerHTML = '';
  others.forEach(p => {
    const pct = p.maxHp > 0 ? (p.hp / p.maxHp) * 100 : 0;
    const hc = hpClass(p.hp, p.maxHp);
    const card = el('div', { class: 'card', style: 'margin-bottom:8px' });
    card.innerHTML = `
      <div class="card-section" style="display:flex;align-items:center;gap:12px;padding:12px 16px">
        <div style="flex:1">
          <div class="h3" style="color:var(--text);margin-bottom:4px">${escapeHtml(p.name || 'Unnamed')}</div>
          <div class="hp-row" style="gap:8px">
            <div class="hp-num ${hc ? 'hp-num--' + hc : ''}" style="font-size:18px;min-width:36px">${p.hp}</div>
            <div class="hp-bar" style="height:6px"><div class="hp-bar__fill ${hc ? 'hp-bar__fill--' + hc : ''}" style="width:${pct}%"></div></div>
          </div>
          <div class="label" style="margin-top:12px;margin-bottom:4px;">HUMANITY</div>
          <div class="pip-row" style="gap:4px;">${pipsHtml(p.hum || 0, 'b', 14)}<span class="pip-count">${p.hum || 0}/10</span></div>
          <div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);margin-top:6px;letter-spacing:0.1em">${HUMANITY_LABELS[p.hum || 0] || ''}</div>
        </div>
      </div>
      ${p.publicNotes ? `<div class="card-section" style="padding:8px 16px;background:var(--bg)"><p style="font-size:12px;color:var(--text-dim);line-height:1.5">${escapeHtml(p.publicNotes)}</p></div>` : ''}
    `;
    list.appendChild(card);
  });
}

// ============================================================
// QUESTS
// ============================================================

function renderQuests() {
  const list = $('#questList');
  const visible = quests; // already filtered to non-secret
  $('#emptyQuests').style.display = visible.length ? 'none' : 'block';
  list.innerHTML = '';
  visible.forEach(q => {
    const statusDef = QUEST_STATUSES.find(s => s.value === q.status) || QUEST_STATUSES[0];
    const item = el('div', { class: 'quest-item quest-item--' + q.status });
    item.innerHTML = `
      <div class="qcheck ${q.status === 'completed' ? 'done' : ''}" style="cursor:default">${q.status === 'completed' ? '✓' : ''}</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:500">${escapeHtml(q.title)}</div>
        ${q.desc ? `<p style="color:var(--muted);font-size:12px;margin-top:4px">${escapeHtml(q.desc)}</p>` : ''}
        <div style="margin-top:6px"><span class="badge ${statusDef.badge}">${statusDef.label}</span></div>
      </div>
    `;
    list.appendChild(item);
  });
}

// ============================================================
// MAPS (visible only)
// ============================================================

function renderMaps() {
  const gallery = $('#gallery');
  $('#emptyMaps').style.display = maps.length ? 'none' : 'block';
  gallery.innerHTML = '';
  maps.forEach(m => {
    const item = el('div', { class: 'gallery-item' });
    item.innerHTML = `
      <img class="gallery-img" src="${m.imageUrl}" alt="${escapeHtml(m.title)}">
      <div class="gallery-meta">
        <div class="gallery-title">${escapeHtml(m.title)}</div>
      </div>
    `;
    item.querySelector('img').addEventListener('click', () => openLightbox(m.imageUrl));
    gallery.appendChild(item);
  });
}

// ============================================================
// PULL TO REFRESH
// ============================================================

attachPullToRefresh(document.body, async () => {
  await loadAll();
  toast('Refreshed', 'ok');
});

$('#btnRefresh').addEventListener('click', async () => {
  await loadAll();
  toast('Refreshed', 'ok');
});

// ============================================================
// DICE (player has their own roller)
// ============================================================

$$('.dice-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const sides = parseInt(btn.getAttribute('data-die'));
    rollDie(sides);
  });
});

function rollDie(sides) {
  const mod = parseInt($('#statMod').value) || 0;
  const roll = Math.floor(Math.random() * sides) + 1;
  const total = roll + mod;
  const numEl = $('#diceNum');
  const lblEl = $('#diceLabel');
  numEl.classList.add('rolling');
  let count = 0;
  const interval = setInterval(() => {
    numEl.textContent = Math.floor(Math.random() * sides) + 1;
    if (++count > 8) {
      clearInterval(interval);
      numEl.classList.remove('rolling');
      numEl.textContent = total;
      const isMax = roll === sides;
      const isOne = roll === 1 && sides > 2;
      numEl.style.color = isMax ? 'var(--green-2)' : isOne ? 'var(--red)' : 'var(--text)';
      lblEl.textContent = `D${sides} rolled ${roll}${mod ? ' + ' + mod + ' = ' + total : ''}${isMax ? ' — CRITICAL' : isOne ? ' — CRIT FAIL' : ''}`;
    }
  }, 60);
}

// ============================================================
// TABBAR
// ============================================================

$$('.tabbar-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-jump');
    const section = document.querySelector(`[data-section="${target}"]`);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $$('.tabbar-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

const sectionEls = $$('[data-section]');
window.addEventListener('scroll', debounce(() => {
  const y = window.scrollY + 200;
  let active = null;
  sectionEls.forEach(s => {
    if (s.offsetTop <= y) active = s.getAttribute('data-section');
  });
  if (active) {
    $$('.tabbar-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-jump') === active);
    });
  }
}, 80));

// ============================================================
// SIGN OUT
// ============================================================

$('#btnSignOut').addEventListener('click', () => {
  if (!confirm('Leave campaign?')) return;
  auth.signOut();
  location.href = '../index.html';
});

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
