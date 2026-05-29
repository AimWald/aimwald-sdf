'use strict';

const DEFAULT_HOTKEYS = {
  switchAccount: 'F9',
  toggleAutomation: 'F10',
  followBoard: ',',
  followAction: 'Z',
  boardAction: 'Alt+6'
};

const ELEMENT_ORDER = ['fire', 'water', 'electricity', 'earth', 'wind'];
const ELEMENT_RESIST_FIELDS = {
  fire: 'resistFire',
  water: 'resistWater',
  electricity: 'resistElectricity',
  earth: 'resistEarth',
  wind: 'resistWind'
};
const ELEMENT_CYCLE = {
  fire: { weakTo: 'water', strongAgainst: 'wind' },
  water: { weakTo: 'electricity', strongAgainst: 'fire' },
  electricity: { weakTo: 'earth', strongAgainst: 'water' },
  earth: { weakTo: 'wind', strongAgainst: 'electricity' },
  wind: { weakTo: 'fire', strongAgainst: 'earth' },
  none: { weakTo: '', strongAgainst: '' }
};

function normalizeHotkeys(hotkeys) {
  return {
    ...DEFAULT_HOTKEYS,
    ...(hotkeys || {})
  };
}

function normalizeBindingKey(key) {
  const raw = String(key || '').trim();
  if (!raw) return '';
  if (/^f\d{1,2}$/i.test(raw)) return raw.toUpperCase();
  if (/^(ctrl|control)$/i.test(raw)) return 'Control';
  if (/^(cmd|command|meta|super|win)$/i.test(raw)) return 'Meta';
  if (/^alt$/i.test(raw)) return 'Alt';
  if (/^shift$/i.test(raw)) return 'Shift';
  if (/^(enter|return)$/i.test(raw)) return 'Return';
  if (/^space$/i.test(raw)) return 'Space';
  return raw.length === 1 ? raw.toUpperCase() : raw;
}

function parseConfiguredBinding(binding) {
  const raw = String(binding || '').trim();
  if (!raw) return null;

  const parts = raw.split('+').map(part => part.trim()).filter(Boolean);
  const keyPart = parts.pop();
  if (!keyPart) return null;

  const modifiers = [];
  for (const part of parts) {
    if (/^(ctrl|control)$/i.test(part)) modifiers.push('control');
    else if (/^alt$/i.test(part)) modifiers.push('alt');
    else if (/^shift$/i.test(part)) modifiers.push('shift');
    else if (/^(cmd|command|meta|super|win)$/i.test(part)) modifiers.push('meta');
  }

  const keyCode = normalizeBindingKey(keyPart);
  const char = keyCode.length === 1 ? keyCode.toLowerCase() : '';
  return { keyCode, modifiers, char };
}

function normalizeElement(element) {
  const raw = String(element || '').trim().toLowerCase();
  if (!raw || raw === 'neutral') return 'none';
  if (raw === 'electric') return 'electricity';
  return raw;
}

function inferMonsterMatchups(monster) {
  let weakTo = '';
  let weakValue = 0;
  let strongAgainst = '';
  let strongValue = 0;
  let hasResistData = false;

  for (const element of ELEMENT_ORDER) {
    const value = monster[ELEMENT_RESIST_FIELDS[element]];
    if (typeof value !== 'number' || Number.isNaN(value)) continue;
    hasResistData = true;
    if (value < weakValue) {
      weakValue = value;
      weakTo = element;
    }
    if (value > strongValue) {
      strongValue = value;
      strongAgainst = element;
    }
  }

  if (hasResistData) {
    return {
      weakTo,
      strongAgainst
    };
  }

  const fallback = ELEMENT_CYCLE[normalizeElement(monster.element)] || ELEMENT_CYCLE.none;
  return {
    weakTo: fallback.weakTo,
    strongAgainst: fallback.strongAgainst
  };
}

function mapMonsterForGuide(monster) {
  const element = normalizeElement(monster.element);
  const guideMonster = {
    id: monster.id,
    lv: monster.level ?? monster.lv ?? 0,
    name: monster.name?.en || monster.name || 'Unknown',
    rank: monster.rank || '',
    area: monster.area || '',
    element,
    icon: monster.icon || '',
    resistFire: typeof monster.resistFire === 'number' ? monster.resistFire : null,
    resistWater: typeof monster.resistWater === 'number' ? monster.resistWater : null,
    resistWind: typeof monster.resistWind === 'number' ? monster.resistWind : null,
    resistEarth: typeof monster.resistEarth === 'number' ? monster.resistEarth : null,
    resistElectricity: typeof monster.resistElectricity === 'number' ? monster.resistElectricity : null
  };
  const { weakTo, strongAgainst } = inferMonsterMatchups(guideMonster);
  return {
    ...guideMonster,
    weakTo,
    strongAgainst
  };
}

module.exports = {
  DEFAULT_HOTKEYS,
  normalizeHotkeys,
  parseConfiguredBinding,
  mapMonsterForGuide
};
