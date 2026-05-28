'use strict';

const DEFAULT_HOTKEYS = {
  switchAccount: 'F9',
  toggleAutomation: 'F10',
  followBoard: ',',
  followAction: 'Z',
  boardAction: 'Alt+6'
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

function mapMonsterForGuide(monster) {
  return {
    id: monster.id,
    lv: monster.level,
    name: monster.name?.en || 'Unknown',
    rank: monster.rank || '',
    area: monster.area || '',
    element: monster.element || ''
  };
}

module.exports = {
  DEFAULT_HOTKEYS,
  normalizeHotkeys,
  parseConfiguredBinding,
  mapMonsterForGuide
};
