'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_HOTKEYS,
  normalizeHotkeys,
  parseConfiguredBinding,
  mapMonsterForGuide
} = require('../src/flyff-data.js');

test('normalizeHotkeys preserves saved values and fills new defaults', () => {
  const result = normalizeHotkeys({ followBoard: 'F8' });
  assert.equal(result.followBoard, 'F8');
  assert.equal(result.followAction, DEFAULT_HOTKEYS.followAction);
  assert.equal(result.boardAction, DEFAULT_HOTKEYS.boardAction);
});

test('parseConfiguredBinding handles modifier chords', () => {
  const result = parseConfiguredBinding('Alt+6');
  assert.deepEqual(result, {
    keyCode: '6',
    modifiers: ['alt'],
    char: '6'
  });
});

test('mapMonsterForGuide uses API level and english name', () => {
  const result = mapMonsterForGuide({
    id: 23,
    level: 40,
    name: { en: 'Grand Master of the Violet Magician Troupe' },
    rank: 'giant',
    area: 'normal',
    element: 'none'
  });

  assert.deepEqual(result, {
    id: 23,
    lv: 40,
    name: 'Grand Master of the Violet Magician Troupe',
    rank: 'giant',
    area: 'normal',
    element: 'none',
    icon: '',
    resistFire: null,
    resistWater: null,
    resistWind: null,
    resistEarth: null,
    resistElectricity: null,
    weakTo: '',
    strongAgainst: ''
  });
});
