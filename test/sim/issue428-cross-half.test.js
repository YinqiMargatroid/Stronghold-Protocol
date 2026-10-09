// GitHub #428: a shared 联防 / boss field has two players' units in one simulation.
// Keep automatic skill activation separate from what a running skill can reach.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec, checkInvariants } from '../helpers/battleHarness.js';

const LEMUEN = 'chess_char_6_01_a';
const EYJA = 'chess_char_6_20_a';
const FARTOOTH = 'chess_char_4_20_a';
const defs = {
  chess: {
    t_laterano: chessRec({ id: 't_laterano', profession: 'SNIPER', bonds: ['lateranoShip'],
      stats: { atk: 0 }, rangeGrid: [[0, 0], [0, 1]], skill: null }),
    t_patient: chessRec({ id: 't_patient', stats: { maxHp: 100000, atk: 0 }, skill: null }),
  },
  enemies: {
    t_elite: enemyRec({ key: 't_elite', rank: 'ELITE', hp: 1e8, speed: 0, atk: 0 }),
    t_decoy: enemyRec({ key: 't_decoy', hp: 1e8, speed: 0, atk: 0 }),
  },
};

const op = (uid, chessId, col, carryState = null) => ({
  uid, kind: 'chess', chessId, row: 10, col, dir: 'RIGHT', ...(carryState ? { carryState } : {}),
});

function shared(kind, left, right, enemies = []) {
  return makeBattle({ kind, defs, autoFinish: false, timeLimit: 40, hooks: ['skillStart', 'ammoUsed', 'damaged', 'heal'], captureNoisy: true,
    players: [
      { playerId: 'left', seat: 0, side: 'L', colOffset: 0, units: left },
      { playerId: 'right', seat: 1, side: kind === 'boss' ? 'R' : 'L', colOffset: 8, units: right },
    ],
    enemies,
  });
}

for (const kind of ['unite', 'boss']) {
  const row = kind === 'boss' ? 3 : 10;
  const farCol = kind === 'boss' ? 14 : 16;
  const rightCol = kind === 'boss' ? 5 : 7;

  test(`#428 ${kind}: a wanted elite on the teammate's half starts 蕾缪安 S3, spends ammo and takes bombardment`, () => {
    const h = shared(kind,
      [op(1, LEMUEN, 3, { sp: 99 })],
      [op(2, 't_laterano', rightCol)],
      [{ key: 't_elite', pos: [row, farCol] }]);
    const u = h.unit(1);
    h.step();
    const e = h.enemies()[0];
    assert.ok(u && e);
    assert.equal(u.skill.id, 'skchr_lemuen_3');
    assert.ok(!u.baseRangeKeys.includes(row * 21 + farCol), 'the elite is outside her own range');
    assert.ok(!h.b.onOwnBoard(u.player, row, farCol), 'the elite stands on the teammate half');
    assert.ok(h.runUntil(() => !!e.findBuff('lemuen:wanted'), 10), 'the teammate Laterano range marks it');
    assert.ok(h.runUntil(() => u.skill.activations > 0, 2), 'S3 opens on the wanted elite');
    assert.ok(h.runUntil(() => h.hooksOf('ammoUsed').some((c) => c.unit === u), 2), 'S3 locks and spends a bullet');
    assert.ok(h.runUntil(() => h.hooksOf('damaged').some((c) => c.source === u && c.target === e && c.dmg?.tags?.includes('bombard')), 10),
      'a shell lands on the enemy across the field');
    checkInvariants(h.b);
  });

  test(`${kind}: 纯烬艾雅法拉 S3 starts for and heals an injured teammate on the other half`, () => {
    const h = shared(kind, [op(1, EYJA, 3, { sp: 99 })], [op(2, 't_patient', rightCol)]);
    const u = h.unit(1), patient = h.unit(2);
    h.step();
    assert.ok(u && patient);
    assert.equal(u.skill.id, 'skchr_agoat2_3');
    assert.equal(u.skill.activations, 0, 'no injured ally yet');
    assert.ok(!u.baseRangeKeys.includes(patient.tileR * 21 + patient.tileC), 'patient is outside her own range');
    patient.hp = patient.s.maxHp / 4;
    assert.ok(h.runUntil(() => u.skill.activations > 0, 3), 'the cross-half injury opens S3');
    assert.ok(h.runUntil(() => h.hooksOf('heal').some((c) => c.source === u && c.target === patient), 5),
      'S3 heals the teammate across the field');
    assert.ok(h.runUntil(() => !!patient.findBuff('agoat2:ash'), 2), 'S3 extends the talent aura to that teammate');
    assert.ok(patient.s.maxHp > patient.base.maxHp, 'the cross-half talent aura raises max HP');
    checkInvariants(h.b);
  });

  test(`${kind}: 远牙 S3 reaches an enemy on the other half once a nearer enemy opens the skill`, () => {
    const h = shared(kind, [op(1, FARTOOTH, 3, { sp: 99 })], [], [{ key: 't_elite', pos: [row, farCol] }]);
    const u = h.unit(1);
    h.step();
    const far = h.enemies()[0];
    assert.ok(u && far);
    assert.equal(u.skill.id, 'skchr_fartth_3');
    assert.equal(u.skill.rule, 'CUSTOM_RANGE');
    h.run(1);
    assert.equal(u.skill.activations, 0, 'the far enemy alone does not satisfy the finite automatic trigger grid');
    const decoy = h.spawn('t_decoy', { pos: [row, 8] });
    assert.ok(h.runUntil(() => u.skill.active, 2), 'a nearer enemy automatically opens S3');
    h.b.kill(decoy);
    assert.ok(h.runUntil(() => h.hooksOf('damaged').some((c) => c.source === u && c.target === far && c.dmg?.isAttack), 5),
      'the running skill shoots across the teammate half');
    checkInvariants(h.b);
  });
}

test('#428: sleep after wanted tracking starts delays target selection but does not erase the mark', () => {
  const h = shared('unite', [op(1, LEMUEN, 3, { sp: 99 })], [op(2, 't_laterano', 7)],
    [{ key: 't_elite', pos: [10, 16] }]);
  const u = h.unit(1);
  h.step();
  const e = h.enemies()[0];
  h.run(1);
  assert.ok(h.b.applyStatus(e, 'sleep', { duration: 8 }), 'enemy falls asleep after entering the Laterano range');
  assert.ok(h.runUntil(() => !!e.findBuff('lemuen:wanted'), 10), 'wanted timer continues while it remains in range');
  assert.ok(e.s.flags.sleep, 'the mark appears before the enemy wakes');
  assert.equal(u.skill.activations, 0, 'an asleep enemy cannot open the skill');
  assert.ok(h.runUntil(() => !e.s.flags.sleep, 5), 'enemy wakes');
  assert.ok(h.runUntil(() => h.hooksOf('ammoUsed').some((c) => c.unit === u), 2),
    'the already marked enemy opens S3 and takes a lock after waking');
  checkInvariants(h.b);
});

test('#428: an already active S3 waits for a sleeping wanted target and locks it after wake', () => {
  const h = shared('unite', [op(1, LEMUEN, 3, { sp: 99 })], [op(2, 't_laterano', 7)],
    [{ key: 't_decoy', pos: [10, 5] }, { key: 't_elite', pos: [10, 16] }]);
  const u = h.unit(1);
  h.step();
  const [decoy, elite] = h.enemies();
  assert.ok(u && decoy && elite);
  assert.ok(h.runUntil(() => u.skill.active, 2), 'near enemy opens S3 before the far elite is wanted');
  h.b.kill(decoy);
  h.run(1); // the far elite is selectable in the Laterano range before sleep starts
  const ammo = u.skill.ammoLeft;
  assert.ok(ammo > 0, 'S3 still has a bullet after the nearer target leaves');
  assert.ok(h.b.applyStatus(elite, 'sleep', { duration: 12 }));
  assert.ok(h.runUntil(() => !!elite.findBuff('lemuen:wanted'), 10), 'the far elite becomes wanted while asleep');
  assert.ok(elite.s.flags.sleep);
  assert.equal(u.skill.ammoLeft, ammo, 'the active skill waits without spending on an unselectable target');
  assert.ok(h.runUntil(() => !elite.s.flags.sleep, 8));
  assert.ok(h.runUntil(() => u.skill.ammoLeft < ammo, 2), 'S3 locks the wanted elite after wake');
  checkInvariants(h.b);
});

for (const [skillIndex, skillId] of [[0, 'skchr_lemuen_1'], [1, 'skchr_lemuen_2']]) {
  test(`#428: 蕾缪安 ${skillId} also opens on a wanted enemy outside her initial range`, () => {
    const h = shared('unite', [{ ...op(1, LEMUEN, 3, { sp: 99 }), skillIndex }], [op(2, 't_laterano', 7)],
      [{ key: 't_elite', pos: [10, 16] }]);
    const u = h.unit(1);
    h.step();
    const e = h.enemies()[0];
    assert.equal(u.skill.id, skillId);
    assert.ok(h.runUntil(() => !!e.findBuff('lemuen:wanted'), 10));
    assert.ok(h.runUntil(() => u.skill.activations > 0, 2), 'the wanted enemy opens the skill');
    assert.ok(h.runUntil(() => h.hooksOf('ammoUsed').some((c) => c.unit === u), 3), 'a bullet is spent on the enemy');
    checkInvariants(h.b);
  });
}

test('#428: wanted-target automatic activation waits for 蕾缪安\'s next attack check', () => {
  const h = shared('unite', [op(1, LEMUEN, 3)], [op(2, 't_laterano', 7)],
    [{ key: 't_elite', pos: [10, 16] }]);
  const u = h.unit(1);
  h.step();
  const e = h.enemies()[0];
  assert.ok(h.runUntil(() => !!e.findBuff('lemuen:wanted'), 10));
  assert.ok(h.runUntil(() => u.stats.attacks > 0, 2), 'she begins a normal attack on the distant wanted enemy');
  assert.ok(u.atkCd > 0);
  u.skill.gainSp(u.skill.spCost, 'test');
  h.run(Math.min(0.2, u.atkCd / 2));
  assert.equal(u.skill.activations, 0, 'a ready DEFAULT skill waits while the attack interval is still running');
  assert.ok(h.runUntil(() => u.skill.activations > 0, 3), 'the next attack check opens the skill');
  checkInvariants(h.b);
});
