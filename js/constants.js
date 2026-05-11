/**
 * Shared constants — mod catalogue, status types, etc.
 */

export const MODS = [
  { name: "Bone Lace",           type: "bio",   desc: "+armor vs blunt" },
  { name: "Adrenal Graft",       type: "bio",   desc: "Re-roll Body/Reflex" },
  { name: "Toxin Filter",        type: "bio",   desc: "Poison immunity" },
  { name: "Muscle Weave",        type: "bio",   desc: "+Body rolls" },
  { name: "Night Eye",           type: "cyber", desc: "Dark/thermal vision" },
  { name: "Subdermal Plate",     type: "cyber", desc: "Ignore damage" },
  { name: "Adrenaline Injector", type: "cyber", desc: "Act first" },
  { name: "Signal Tap",          type: "cyber", desc: "Intercept signals" },
];

export const ENEMY_STATUSES = ['BLEEDING', 'STUNNED', 'WEAKENED', 'ENRAGED', 'ARMORED'];

export const HUMANITY_LABELS = [
  'FULLY HUMAN', 'FULLY HUMAN', 'FULLY HUMAN',
  'STARTING TO CHANGE', 'STARTING TO CHANGE',
  'VISIBLY ALTERED', 'VISIBLY ALTERED',
  'PEOPLE ARE AFRAID', 'PEOPLE ARE AFRAID',
  'SOMETHING ELSE', 'GONE',
];

export const QUEST_STATUSES = [
  { value: 'active',    label: 'ACTIVE',    badge: 'badge--amber' },
  { value: 'secret',    label: 'SECRET',    badge: 'badge--purple' },
  { value: 'completed', label: 'DONE',      badge: 'badge--green' },
  { value: 'failed',    label: 'FAILED',    badge: 'badge--red' },
];

export function makeNewPlayer() {
  return {
    name: '',
    hp: 20, maxHp: 20,
    inf: 0, hum: 0,
    mods: [null, null, null],
    tiers: [1, 1, 1],
    primaries: [{ t: '', img: '' }, { t: '', img: '' }, { t: '', img: '' }],
    items: [],
    notes: '',
    publicNotes: '', // visible to all players
    createdAt: Date.now(),
  };
}

export function makeNewEnemy() {
  return {
    name: '',
    hp: 30, maxHp: 30,
    tier: 'normal',
    sts: [],
    notes: '',
    dead: false,
    createdAt: Date.now(),
  };
}

export function makeNewQuest(title, status = 'active') {
  return {
    title,
    desc: '',
    status,
    createdAt: Date.now(),
  };
}

export function makeNewMap(title, imageUrl) {
  return {
    title,
    imageUrl,
    description: '',
    visibleToPlayers: false,
    createdAt: Date.now(),
  };
}

export function makeNewSummary(sessionTitle) {
  return {
    title: sessionTitle,
    body: '',
    sessionDate: new Date().toISOString().slice(0, 10),
    createdAt: Date.now(),
  };
}
