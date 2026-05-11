/**
 * DM DASHBOARD CONTROLLER
 * ----------------------------------------------------------------
 * Orchestrates rendering and interactions across all sections.
 * Reads/writes through dataLayer (currently localStorage adapter).
 */

import { dataLayer } from '../data.js';
import { auth } from '../auth.js';
import { $, $$, el, toast, openModal, closeModal, attachHpDrag, hpClass, debounce, openLightbox } from '../ui.js';
import { MODS, ENEMY_STATUSES, HUMANITY_LABELS, QUEST_STATUSES, makeNewPlayer, makeNewEnemy, makeNewQuest, makeNewMap } from '../constants.js';

// ── Auth gate ──
await auth.init();
let user = auth.getCurrentUser();
if (!user || user.role !== 'dm') {
  location.href = '../index.html';
}
await dataLayer.init();

// ── State ──
let players = [], enemies = [], quests = [], maps = [];
let dmNotes = '', currentScene = { title: '', desc: '' };

// ── Subscriptions ──
dataLayer.subscribe('players', docs => { players = docs; renderPlayers(); updateStatus(); });
dataLayer.subscribe('enemies', docs => { enemies = docs; renderEnemies(); updateStatus(); });
dataLayer.subscribe('quests',  docs => { quests = docs;  renderQuests();  updateStatus(); });
dataLayer.subscribe('maps',    docs => { maps = docs;    renderMaps(); });
dataLayer.subscribe('notes', async docs => {
  const dmNote = docs.find(d => d.id === 'dm');
  dmNotes = dmNote?.body || '';
  if ($('#dmNotes').value !== dmNotes) $('#dmNotes').value = dmNotes;
});
dataLayer.subscribe('scenes', async docs => {
  const scene = docs.find(d => d.id === 'current') || { title: '', desc: '' };
  currentScene = scene;
  if ($('#sceneTitle').value !== scene.title) $('#sceneTitle').value = scene.title || '';
  if ($('#sceneDesc').value !== scene.desc)   $('#sceneDesc').value  = scene.desc  || '';
});

// ── Status ──
function updateStatus() {
  $('#sbPlayers').textContent = players.length;
  $('#sbEnemies').textContent = enemies.length;
  $('#sbQuests').textContent = quests.filter(q => q.status === 'active').length;
  $('#sbHp').textContent = players.length
    ? Math.round(players.reduce((s, p) => s + (p.hp || 0), 0) / players.length)
    : '—';
  $('#playerCount').textContent = players.length;
  $('#enemyCount').textContent = enemies.length;
  $('#questCount').textContent = quests.length;
}

// ============================================================
// PLAYERS
// ============================================================

$('#addPlayer').addEventListener('click', async () => {
  const id = dataLayer.uid();
  await dataLayer.set('players', id, makeNewPlayer());
  toast('Player added', 'ok');
});

function renderPlayers() {
  const grid = $('#playerGrid');
  $('#emptyPlayers').style.display = players.length ? 'none' : 'block';
  grid.innerHTML = '';
  players.forEach(p => grid.appendChild(buildPlayerCard(p)));
}

function buildPlayerCard(p) {
  const pct = p.maxHp > 0 ? (p.hp / p.maxHp) * 100 : 0;
  const hc = hpClass(p.hp, p.maxHp);

  const card = el('div', { class: 'pcard', 'data-id': p.id });
  card.innerHTML = `
    <div class="pcard__head">
      <input class="pcard__name" placeholder="PLAYER NAME" value="${escapeHtml(p.name || '')}">
      <button class="btn btn--icon btn--ghost btn--accent-red" data-action="delete">×</button>
    </div>

    <div class="hp-block">
      <div class="label">HIT POINTS</div>
      <div class="hp-row">
        <div class="hp-num ${hc ? 'hp-num--' + hc : ''}">${p.hp}</div>
        <div class="hp-bar"><div class="hp-bar__fill ${hc ? 'hp-bar__fill--' + hc : ''}" style="width:${pct}%"></div></div>
        <button class="btn btn--icon btn--accent-red" data-action="hp-minus">−</button>
        <button class="btn btn--icon" data-action="hp-plus">+</button>
      </div>
      <div style="margin-top:8px;display:flex;align-items:center;gap:8px">
        <span class="label" style="margin:0">MAX</span>
        <input class="input input--inline" type="number" value="${p.maxHp}" data-field="maxHp" style="width:60px;text-align:center;font-family:var(--font-mono)">
      </div>
    </div>

    <div class="card-section">
      <div class="label">INFECTION <span style="font-size:8px">— DM TRACKS</span></div>
      <div class="pip-row" data-pips="inf">${pipsHtml(p.inf, 'r')}<span class="pip-count">${p.inf}/10</span></div>
    </div>

    <div class="card-section">
      <div class="label">HUMANITY</div>
      <div class="pip-row" data-pips="hum">${pipsHtml(p.hum, 'b')}<span class="pip-count">${p.hum}/10</span></div>
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--muted);margin-top:6px;letter-spacing:0.1em">${HUMANITY_LABELS[p.hum] || ''}</div>
    </div>

    <div class="card-section">
      <div class="label">UPGRADES — TAP TO ASSIGN, DOTS = TIER</div>
      <div class="mods-grid">${modsHtml(p)}</div>
    </div>

    <div class="card-section">
      <div class="label">PRIMARY ITEMS</div>
      <div class="primary-grid">${primariesHtml(p)}</div>
    </div>

    <div class="card-section">
      <div class="label">ITEMS & GEAR</div>
      <div class="items">${itemsHtml(p)}</div>
      <button class="add-item-btn" data-action="add-item">+ ADD ITEM</button>
    </div>

    <div class="card-section">
      <div class="label">PRIVATE NOTES (DM)</div>
      <textarea class="textarea" data-field="notes" placeholder="Hidden ability, secrets…">${escapeHtml(p.notes || '')}</textarea>
    </div>

    <div class="card-section">
      <div class="label">PUBLIC NOTES (visible to player)</div>
      <textarea class="textarea" data-field="publicNotes" placeholder="Backstory, role-play info, gear description…">${escapeHtml(p.publicNotes || '')}</textarea>
    </div>
  `;

  attachPlayerCardEvents(card, p);
  return card;
}

function pipsHtml(value, color) {
  let html = '';
  for (let i = 1; i <= 10; i++) {
    html += `<div class="pip ${i <= value ? 'pip--' + color : ''}" data-pip="${i}"></div>`;
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
        dots += `<div class="tier-dot ${j <= tier ? 'tier-dot--' + cls : ''}" data-tier="${j}" data-slot="${i}"></div>`;
      }
      html += `<div class="mslot mslot--${cls}" data-mod-slot="${i}">
        <div class="mslot__type mslot__type--${cls}">${m.type.toUpperCase()}</div>
        <div class="mslot__name">${escapeHtml(m.name)}</div>
        <div class="tier-dots">${dots}</div>
      </div>`;
    } else {
      html += `<div class="mslot" data-mod-slot="${i}"><div class="mslot__empty">SLOT ${i+1}<br>EMPTY</div></div>`;
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
    const hasImg = item.img && item.img.length > 0;
    html += `<div class="pslot ${hasImg ? 'pslot--has-img' : ''}" data-primary-slot="${i}">
      ${hasImg ? `<img class="pslot__img" src="${item.img}" alt="">` : ''}
      ${hasImg ? `<button class="pslot__clear" data-action="clear-primary-img">×</button>` : ''}
      <div class="pslot__tag">PRIMARY ${i+1}</div>
      <textarea class="pslot__input" placeholder="weapon, gear, key item…" data-primary-text="${i}">${escapeHtml(item.t || '')}</textarea>
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

function attachPlayerCardEvents(card, p) {
  // Name
  card.querySelector('.pcard__name').addEventListener('input', debounce((e) => {
    dataLayer.update('players', p.id, { name: e.target.value });
  }, 250));

  // Delete player
  card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    if (!confirm(`Remove ${p.name || 'this player'}?`)) return;
    await dataLayer.remove('players', p.id);
    toast('Player removed');
  });

  // HP +/-
  card.querySelector('[data-action="hp-minus"]').addEventListener('click', () => {
    dataLayer.update('players', p.id, { hp: Math.max(0, p.hp - 1) });
  });
  card.querySelector('[data-action="hp-plus"]').addEventListener('click', () => {
    dataLayer.update('players', p.id, { hp: Math.min(p.maxHp, p.hp + 1) });
  });

  // HP bar drag
  const bar = card.querySelector('.hp-bar');
  let dragHp = p.hp;
  attachHpDrag(bar, {
    getValue: () => p.hp,
    getMax: () => p.maxHp,
    onChange: (v) => {
      dragHp = v;
      const fill = bar.querySelector('.hp-bar__fill');
      const num = card.querySelector('.hp-num');
      const pct = (v / p.maxHp) * 100;
      const hc = hpClass(v, p.maxHp);
      fill.style.width = pct + '%';
      fill.className = 'hp-bar__fill' + (hc ? ' hp-bar__fill--' + hc : '');
      num.textContent = v;
      num.className = 'hp-num' + (hc ? ' hp-num--' + hc : '');
    },
    onCommit: () => dataLayer.update('players', p.id, { hp: dragHp }),
  });

  // Max HP
  card.querySelector('[data-field="maxHp"]').addEventListener('change', (e) => {
    const v = parseInt(e.target.value) || 1;
    dataLayer.update('players', p.id, { maxHp: v, hp: Math.min(p.hp, v) });
  });

  // Pip rows (infection / humanity)
  $$('[data-pips]', card).forEach(row => {
    const field = row.getAttribute('data-pips');
    row.querySelectorAll('.pip').forEach(pipEl => {
      pipEl.addEventListener('click', () => {
        const v = parseInt(pipEl.getAttribute('data-pip'));
        const current = p[field] || 0;
        const newVal = current === v ? v - 1 : v;
        dataLayer.update('players', p.id, { [field]: newVal });
      });
    });
  });

  // Mod slots
  $$('[data-mod-slot]', card).forEach(slotEl => {
    const slot = parseInt(slotEl.getAttribute('data-mod-slot'));
    slotEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('tier-dot')) return; // handled below
      openModPicker(p, slot);
    });
  });

  $$('.tier-dot', card).forEach(dotEl => {
    dotEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const slot = parseInt(dotEl.getAttribute('data-slot'));
      const tier = parseInt(dotEl.getAttribute('data-tier'));
      const tiers = [...(p.tiers || [1,1,1])];
      tiers[slot] = tiers[slot] === tier ? Math.max(1, tier - 1) : tier;
      dataLayer.update('players', p.id, { tiers });
    });
  });

  // Primary slots
  $$('[data-primary-slot]', card).forEach(slotEl => {
    const idx = parseInt(slotEl.getAttribute('data-primary-slot'));

    slotEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      slotEl.classList.add('pslot--dragover');
    });
    slotEl.addEventListener('dragleave', () => slotEl.classList.remove('pslot--dragover'));
    slotEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      slotEl.classList.remove('pslot--dragover');
      const file = e.dataTransfer?.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      const url = await dataLayer.uploadImage(file);
      const primaries = clonePrimaries(p);
      primaries[idx].img = url;
      dataLayer.update('players', p.id, { primaries });
    });

    slotEl.addEventListener('dblclick', () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = await dataLayer.uploadImage(file);
        const primaries = clonePrimaries(p);
        primaries[idx].img = url;
        dataLayer.update('players', p.id, { primaries });
      };
      inp.click();
    });

    const clearBtn = slotEl.querySelector('[data-action="clear-primary-img"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const primaries = clonePrimaries(p);
        primaries[idx].img = '';
        dataLayer.update('players', p.id, { primaries });
      });
    }
  });

  $$('[data-primary-text]', card).forEach(txt => {
    const idx = parseInt(txt.getAttribute('data-primary-text'));
    txt.addEventListener('input', debounce((e) => {
      const primaries = clonePrimaries(p);
      primaries[idx].t = e.target.value;
      dataLayer.update('players', p.id, { primaries });
    }, 300));
  });

  // Items
  $$('[data-item-idx]', card).forEach(row => {
    const idx = parseInt(row.getAttribute('data-item-idx'));
    row.querySelectorAll('[data-item-field]').forEach(inp => {
      const field = inp.getAttribute('data-item-field');
      inp.addEventListener('input', debounce(() => {
        const items = [...(p.items || [])];
        items[idx] = { ...items[idx], [field]: field === 'q' ? (parseInt(inp.value) || 1) : inp.value };
        dataLayer.update('players', p.id, { items });
      }, 300));
    });
    row.querySelector('[data-action="del-item"]').addEventListener('click', () => {
      const items = (p.items || []).filter((_, i) => i !== idx);
      dataLayer.update('players', p.id, { items });
    });
  });

  card.querySelector('[data-action="add-item"]').addEventListener('click', () => {
    const items = [...(p.items || []), { t: '', q: 1 }];
    dataLayer.update('players', p.id, { items });
  });

  // Notes (private + public)
  card.querySelector('[data-field="notes"]').addEventListener('input', debounce((e) => {
    dataLayer.update('players', p.id, { notes: e.target.value });
  }, 400));
  card.querySelector('[data-field="publicNotes"]').addEventListener('input', debounce((e) => {
    dataLayer.update('players', p.id, { publicNotes: e.target.value });
  }, 400));
}

function clonePrimaries(p) {
  return (p.primaries || [{t:'',img:''},{t:'',img:''},{t:'',img:''}]).map(it => {
    if (typeof it === 'string') return { t: it, img: '' };
    return { ...it };
  });
}

function openModPicker(p, slot) {
  const buttons = MODS.map(m => `
    <button class="mod-btn" data-mod="${m.name}">
      <span class="mt mt--${m.type}">${m.type.toUpperCase()}</span>
      ${m.name}
      <small>${m.desc}</small>
    </button>
  `).join('');
  const removeBtn = p.mods?.[slot]
    ? `<button class="mod-btn" data-mod="" style="grid-column:1/-1;color:var(--red)">REMOVE — clear this slot</button>`
    : '';

  const { close } = openModal(`
    <h3>Choose a mod</h3>
    <div class="mod-grid">${buttons}${removeBtn}</div>
    <button class="btn btn--ghost" data-action="cancel" style="margin-top:8px">Cancel</button>
  `, {
    onMount(modal) {
      modal.querySelectorAll('[data-mod]').forEach(btn => {
        btn.addEventListener('click', () => {
          const name = btn.getAttribute('data-mod');
          const mods = [...(p.mods || [null,null,null])];
          const tiers = [...(p.tiers || [1,1,1])];
          if (!name) {
            mods[slot] = null;
            tiers[slot] = 1;
            dataLayer.update('players', p.id, { mods, tiers });
          } else {
            const mod = MODS.find(m => m.name === name);
            mods[slot] = mod;
            tiers[slot] = 1;
            const newHum = Math.min(10, (p.hum || 0) + 1);
            dataLayer.update('players', p.id, { mods, tiers, hum: newHum });
          }
          close();
        });
      });
      modal.querySelector('[data-action="cancel"]').addEventListener('click', close);
    },
  });
}

// ============================================================
// ENEMIES
// ============================================================

$('#addEnemy').addEventListener('click', async () => {
  await dataLayer.set('enemies', dataLayer.uid(), makeNewEnemy());
  toast('Bad guy added', 'ok');
});

function renderEnemies() {
  const grid = $('#enemyGrid');
  $('#emptyEnemies').style.display = enemies.length ? 'none' : 'block';
  grid.innerHTML = '';
  enemies.forEach(e => grid.appendChild(buildEnemyCard(e)));
}

function buildEnemyCard(e) {
  const pct = e.maxHp > 0 ? (e.hp / e.maxHp) * 100 : 0;
  const hc = hpClass(e.hp, e.maxHp);
  const tierCls = e.tier === 'boss' ? 'ecard--boss' : e.tier === 'elite' ? 'ecard--elite' : '';

  const card = el('div', { class: 'ecard ' + tierCls, 'data-id': e.id });
  card.innerHTML = `
    <div class="card-header">
      <input class="pcard__name" style="font-size:18px" placeholder="ENEMY NAME" value="${escapeHtml(e.name || '')}">
      <select class="select" data-field="tier" style="width:auto;min-height:32px;font-size:10px;padding:4px 8px">
        <option value="normal" ${e.tier === 'normal' ? 'selected' : ''}>NORMAL</option>
        <option value="elite"  ${e.tier === 'elite'  ? 'selected' : ''}>ELITE</option>
        <option value="boss"   ${e.tier === 'boss'   ? 'selected' : ''}>BOSS</option>
      </select>
      <button class="btn btn--icon btn--ghost btn--accent-red" data-action="delete">×</button>
    </div>

    <div class="hp-block">
      <div class="label" style="display:flex;justify-content:space-between">HP <span>MAX <input class="input input--inline" type="number" min="1" value="${e.maxHp}" data-field="maxHp" style="width:50px;text-align:center;font-family:var(--font-mono);font-size:10px"></span></div>
      <div class="hp-row">
        <div class="hp-num ${hc ? 'hp-num--' + hc : ''}">${e.hp}</div>
        <div class="hp-bar"><div class="hp-bar__fill ${hc ? 'hp-bar__fill--' + hc : ''}" style="width:${pct}%"></div></div>
        <button class="btn btn--icon btn--accent-red" data-action="hp-minus">−</button>
        <button class="btn btn--icon" data-action="hp-plus">+</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;align-items:center">
        <input class="input" type="number" min="0" placeholder="DMG" data-field="dmg" style="width:80px;text-align:center;font-family:var(--font-mono)">
        <button class="btn btn--sm btn--accent-red" data-action="apply-dmg">Apply</button>
      </div>
    </div>

    <div class="card-section">
      <div class="label">STATUS</div>
      <div class="status-row">
        ${ENEMY_STATUSES.map(s => `<span class="status-badge ${s.toLowerCase()} ${e.sts?.includes(s) ? 'on' : ''}" data-status="${s}">${s}</span>`).join('')}
      </div>
    </div>

    <div class="card-section">
      <div class="label">NOTES / ABILITIES</div>
      <textarea class="textarea" data-field="notes" placeholder="abilities, weaknesses, loot…">${escapeHtml(e.notes || '')}</textarea>
    </div>

    ${e.dead ? `<div class="dead-overlay" data-action="revive">DEAD<small>tap to revive</small></div>` : ''}
  `;

  attachEnemyCardEvents(card, e);
  return card;
}

function attachEnemyCardEvents(card, e) {
  card.querySelector('.pcard__name').addEventListener('input', debounce((ev) => {
    dataLayer.update('enemies', e.id, { name: ev.target.value });
  }, 250));

  card.querySelector('[data-field="tier"]').addEventListener('change', (ev) => {
    dataLayer.update('enemies', e.id, { tier: ev.target.value });
  });

  card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    if (!confirm('Remove this enemy?')) return;
    await dataLayer.remove('enemies', e.id);
  });

  card.querySelector('[data-action="hp-minus"]').addEventListener('click', () => {
    const newHp = Math.max(0, e.hp - 1);
    dataLayer.update('enemies', e.id, { hp: newHp, dead: newHp === 0 });
  });
  card.querySelector('[data-action="hp-plus"]').addEventListener('click', () => {
    const newHp = Math.min(e.maxHp, e.hp + 1);
    dataLayer.update('enemies', e.id, { hp: newHp, dead: false });
  });

  card.querySelector('[data-field="maxHp"]').addEventListener('change', (ev) => {
    const v = parseInt(ev.target.value) || 1;
    dataLayer.update('enemies', e.id, { maxHp: v, hp: Math.min(e.hp, v) });
  });

  // HP drag
  const bar = card.querySelector('.hp-bar');
  let dragHp = e.hp;
  attachHpDrag(bar, {
    getValue: () => e.hp,
    getMax: () => e.maxHp,
    onChange: (v) => {
      dragHp = v;
      const fill = bar.querySelector('.hp-bar__fill');
      const num = card.querySelector('.hp-num');
      fill.style.width = (v / e.maxHp) * 100 + '%';
      num.textContent = v;
    },
    onCommit: () => dataLayer.update('enemies', e.id, { hp: dragHp, dead: dragHp === 0 ? true : (dragHp > 0 ? false : e.dead) }),
  });

  // Damage apply
  const dmgInput = card.querySelector('[data-field="dmg"]');
  card.querySelector('[data-action="apply-dmg"]').addEventListener('click', () => {
    const v = parseInt(dmgInput.value) || 0;
    if (!v) return;
    const newHp = Math.max(0, e.hp - v);
    dataLayer.update('enemies', e.id, { hp: newHp, dead: newHp === 0 });
    dmgInput.value = '';
  });

  // Status
  card.querySelectorAll('[data-status]').forEach(badge => {
    badge.addEventListener('click', () => {
      const s = badge.getAttribute('data-status');
      const sts = [...(e.sts || [])];
      const idx = sts.indexOf(s);
      if (idx >= 0) sts.splice(idx, 1); else sts.push(s);
      dataLayer.update('enemies', e.id, { sts });
    });
  });

  card.querySelector('[data-field="notes"]').addEventListener('input', debounce((ev) => {
    dataLayer.update('enemies', e.id, { notes: ev.target.value });
  }, 400));

  const reviveBtn = card.querySelector('[data-action="revive"]');
  if (reviveBtn) reviveBtn.addEventListener('click', () => {
    dataLayer.update('enemies', e.id, { dead: false, hp: e.maxHp });
  });
}

// ============================================================
// QUESTS
// ============================================================

$('#addQuest').addEventListener('click', addQuest);
$('#questInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addQuest();
});

async function addQuest() {
  const title = $('#questInput').value.trim();
  if (!title) return;
  const status = $('#questType').value;
  await dataLayer.set('quests', dataLayer.uid(), makeNewQuest(title, status));
  $('#questInput').value = '';
}

function renderQuests() {
  const list = $('#questList');
  list.innerHTML = '';
  if (!quests.length) {
    list.innerHTML = '<p class="label" style="text-align:center;padding:16px 0">No quests yet</p>';
    return;
  }
  quests.forEach(q => list.appendChild(buildQuestItem(q)));
}

function buildQuestItem(q) {
  const done = q.status === 'completed';
  const statusDef = QUEST_STATUSES.find(s => s.value === q.status) || QUEST_STATUSES[0];
  const item = el('div', { class: 'quest-item quest-item--' + q.status, 'data-id': q.id });
  item.innerHTML = `
    <div class="qcheck ${done ? 'done' : ''}" data-action="toggle">${done ? '✓' : ''}</div>
    <div style="flex:1">
      <input class="input input--inline" value="${escapeHtml(q.title)}" data-field="title" style="font-size:14px;font-weight:500">
      <textarea class="textarea" placeholder="Notes, clues, details…" data-field="desc" rows="1" style="font-size:12px;min-height:30px;border:none;background:transparent;padding:0;color:var(--muted);margin-top:4px">${escapeHtml(q.desc || '')}</textarea>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
        <span class="badge ${statusDef.badge}">${statusDef.label}</span>
        <select class="select" data-field="status" style="font-size:9px;padding:2px 6px;min-height:24px;width:auto">
          ${QUEST_STATUSES.map(s => `<option value="${s.value}" ${s.value === q.status ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <button class="btn btn--icon btn--ghost btn--accent-red" data-action="delete">×</button>
  `;

  item.querySelector('[data-action="toggle"]').addEventListener('click', () => {
    dataLayer.update('quests', q.id, {
      status: q.status === 'completed' ? 'active' : 'completed',
    });
  });
  item.querySelector('[data-action="delete"]').addEventListener('click', () => {
    dataLayer.remove('quests', q.id);
  });
  item.querySelector('[data-field="title"]').addEventListener('input', debounce((e) => {
    dataLayer.update('quests', q.id, { title: e.target.value });
  }, 300));
  item.querySelector('[data-field="desc"]').addEventListener('input', debounce((e) => {
    dataLayer.update('quests', q.id, { desc: e.target.value });
  }, 300));
  item.querySelector('[data-field="status"]').addEventListener('change', (e) => {
    dataLayer.update('quests', q.id, { status: e.target.value });
  });

  return item;
}

// ============================================================
// MAPS / GALLERY
// ============================================================

const uploadInput = $('#uploadInput');
const uploadZone = $('#uploadZone');

uploadZone.addEventListener('click', () => uploadInput.click());
uploadInput.addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const url = await dataLayer.uploadImage(file);
      await dataLayer.set('maps', dataLayer.uid(), {
        ...makeNewMap(file.name.replace(/\.[^.]+$/, ''), url),
        visibleToPlayers: false,
      });
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  uploadInput.value = '';
  toast('Uploaded', 'ok');
});

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  for (const file of e.dataTransfer.files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const url = await dataLayer.uploadImage(file);
      await dataLayer.set('maps', dataLayer.uid(), {
        ...makeNewMap(file.name.replace(/\.[^.]+$/, ''), url),
        visibleToPlayers: false,
      });
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  toast('Uploaded', 'ok');
});

function renderMaps() {
  const gallery = $('#gallery');
  gallery.innerHTML = '';
  maps.forEach(m => gallery.appendChild(buildMapItem(m)));
}

function buildMapItem(m) {
  const item = el('div', { class: 'gallery-item' });
  item.innerHTML = `
    <img class="gallery-img" src="${m.imageUrl}" alt="${escapeHtml(m.title)}" data-action="view">
    <div class="gallery-meta">
      <input class="input input--inline" value="${escapeHtml(m.title)}" data-field="title" style="font-family:var(--font-cond);font-size:14px;font-weight:600;flex:1">
      <div style="display:flex;gap:6px;align-items:center">
        <label style="display:flex;align-items:center;gap:4px;font-family:var(--font-mono);font-size:9px;color:${m.visibleToPlayers ? 'var(--green-2)' : 'var(--muted)'};cursor:pointer">
          <input type="checkbox" ${m.visibleToPlayers ? 'checked' : ''} data-field="visible" style="width:18px;height:18px">
          ${m.visibleToPlayers ? 'SHARED' : 'HIDDEN'}
        </label>
        <button class="btn btn--icon btn--ghost btn--accent-red" data-action="delete">×</button>
      </div>
    </div>
  `;

  item.querySelector('[data-action="view"]').addEventListener('click', () => openLightbox(m.imageUrl));
  item.querySelector('[data-field="title"]').addEventListener('input', debounce((e) => {
    dataLayer.update('maps', m.id, { title: e.target.value });
  }, 300));
  item.querySelector('[data-field="visible"]').addEventListener('change', (e) => {
    dataLayer.update('maps', m.id, { visibleToPlayers: e.target.checked });
    toast(e.target.checked ? 'Shared with players' : 'Hidden from players', 'ok');
  });
  item.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    if (!confirm('Remove this image?')) return;
    await dataLayer.remove('maps', m.id);
  });

  return item;
}

// ============================================================
// DM NOTES
// ============================================================

$('#dmNotes').addEventListener('input', debounce((e) => {
  dataLayer.set('notes', 'dm', { body: e.target.value });
}, 500));

// ============================================================
// CURRENT SCENE
// ============================================================

const sceneSave = debounce(() => {
  dataLayer.set('scenes', 'current', {
    title: $('#sceneTitle').value,
    desc:  $('#sceneDesc').value,
    updatedAt: Date.now(),
  });
}, 500);
$('#sceneTitle').addEventListener('input', sceneSave);
$('#sceneDesc').addEventListener('input', sceneSave);

// ============================================================
// DICE
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
// TABBAR (mobile quick-jump)
// ============================================================

$$('.tabbar-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-jump');
    const section = document.querySelector(`[data-section="${target}"]`);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $$('.tabbar-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  });
});

// Highlight tab on scroll
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
  if (!confirm('Sign out?')) return;
  auth.signOut();
  location.href = '../index.html';
});

// ============================================================
// HELPERS
// ============================================================

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
