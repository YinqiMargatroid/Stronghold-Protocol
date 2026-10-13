import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SEATS, PHASE } from '../../shared/constants.js';
import { RESULT_LIMITS, validateC2S } from '../../shared/protocol.js';
import { GameData } from '../../server/match/gamedata.js';
import { generateDraft } from '../../server/match/choices.js';
import { createRng } from '../../server/sim/rng.js';
import { buildBattleSpec, compactResult, createBattleFromSpec, fitResult } from '../../server/sim/spec.js';
import { validateClientResult } from '../../server/match/fields.js';
import { normalizeSeats } from '../../public/js/screens/room.js';
import { DATA, give, legalTileFor, makeMatch } from './harness.js';

const BEACON = 'chess_item_5_04_e_a';
const MODE = 'mode_multi_hard';
const ids = Array.from({ length: 6 }, (_, i) => `p_${i}`);
const beacons = (ps) => [...ps.hand, ...ps.temp].filter((p) => p?.id === BEACON);

test('six room seats and six battle result rows survive the wire path', () => {
  assert.equal(MAX_SEATS, 6);
  assert.equal(RESULT_LIMITS.players, 6);
  assert.equal(normalizeSeats({ mode: 'coop', seats: [] }).length, 6);
  assert.equal(normalizeSeats({ mode: 'solo', seats: [] }).length, 1);
  const spec = buildBattleSpec({
    battleId: 'six-player-upload', fieldId: 'n:six', kind: 'normal', seed: 6, round: 1,
    stageId: Object.keys(DATA.stages)[0], timeLimit: 1, content: 'full',
    players: ids.map((playerId) => ({ playerId, side: 'L', units: [] })),
    spawns: ids.map((ownerPlayerId) => ({ enemyKey: 'enemy_1007_slime', ownerPlayerId, time: 0, count: 1 })),
    flags: { layerGainsEnabled: true },
  });
  const result = compactResult(createBattleFromSpec(spec, DATA, { recordEvents: false, quiet: true }).runToEnd(2));
  assert.deepEqual(Object.keys(result.perPlayer), ids);
  assert.ok(result.perPlayer.p_5.total > 0);
  assert.equal(validateC2S({ t: 'b.result', battleId: spec.battleId, result }), null);
  assert.equal(validateClientResult(spec, result).ok, true);
  assert.deepEqual(Object.keys(fitResult(result, { budget: 1 }).perPlayer), ids);
});

test('five and six seats adjust only core BANs; shared chess pool remains the 0.2.5 twofold pool', () => {
  const four = new GameData(DATA, MODE, 4);
  for (const count of [1, 2, 3, 4, 5, 6]) {
    const gd = new GameData(DATA, MODE, count);
    assert.deepEqual(gd.bans('HARD'), { core: 3 - (count === 6 ? 2 : count === 5 ? 1 : 0), addon: 4 });
    for (const id of four.visibleChess.slice(0, 20)) assert.equal(gd.poolCopies(id), four.poolCopies(id));
  }
  const solo = new GameData(DATA, 'mode_single_hard', 1);
  for (const id of four.visibleChess.slice(0, 20)) assert.equal(four.poolCopies(id), solo.poolCopies(id) * 2);
  assert.deepEqual(new GameData(DATA, 'mode_multi_funny', 6).bans('FUNNY'), { core: 0, addon: 1 });
  assert.deepEqual(new GameData(DATA, 'mode_single_training', 1).bans('TRAINING'), { core: 0, addon: 0 });
});

test('six starting seats double the equivalent four-seat boss pool through eliminations', () => {
  for (const modeId of ['mode_multi_funny', 'mode_multi_normal', 'mode_multi_hard', 'mode_multi_abyss']) {
    const four = new GameData(DATA, modeId, 4);
    const five = new GameData(DATA, modeId, 5);
    const six = new GameData(DATA, modeId, 6);
    for (const bossId of Object.keys(DATA.bosses)) for (const alive of [1, 2, 4, 5, 6]) {
      assert.equal(five.bossPoolHp(bossId, alive), four.bossPoolHp(bossId, alive));
      assert.equal(six.bossPoolHp(bossId, alive), four.bossPoolHp(bossId, alive) * 2);
    }
  }
});

test('five and six surviving seats enter 2+2+1 and 2+2+2 boss fields', () => {
  for (const count of [5, 6]) {
    const h = makeMatch({ humans: count, difficulty: 'HARD', fake: true, seed: 159, clientCombat: true, clients: false });
    try {
      const m = h.m;
      m.round = m.gd.bossRound;
      for (const ps of m.order) ps.lp = 100;
      m.startFinalAssault(false);
      assert.deepEqual(m.fields.map((f) => f.players.length).sort(), count === 5 ? [1, 2, 2] : [2, 2, 2]);
      assert.equal(new Set(m.fields.flatMap((f) => f.players)).size, count);
      const four = new GameData(DATA, m.modeId, 4);
      assert.equal(m.bossPool.maxHp, four.bossPoolHp(m.bossId, count) * (count === 6 ? 2 : 1));
      assert.ok(m.fields.every((f) => f.spec.boss.poolMax === m.bossPool.maxHp));
    } finally { h.m.dispose(); }
  }
});

test('five and six player bounty drafts offer nine distinct cards with I/II/II supplements', () => {
  const forced = structuredClone(DATA);
  for (const [round, cfg] of Object.entries(forced.choices.schedule[MODE].rounds)) {
    if ([3, 9, 11].includes(Number(round))) cfg.families = [{ family: 'bounty', weight: 1 }];
  }
  const cardById = new Map(DATA.choices.cards.bounty.map((c) => [c.effectId, c]));
  for (const count of [5, 6]) for (const round of [3, 9, 11]) for (const seed of [1, 7, 21, 45]) {
    const small = generateDraft(new GameData(forced, MODE, 4), createRng(seed), round);
    const large = generateDraft(new GameData(forced, MODE, count), createRng(seed), round);
    assert.equal(large.family, 'bounty');
    assert.equal(large.cards.length, 9, `R${round}, ${count} seats, seed ${seed}`);
    assert.deepEqual(large.cards.slice(0, 6), small.cards);
    assert.equal(new Set(large.cards.map((c) => c.id)).size, 9);
    assert.deepEqual(large.cards.slice(6).map((c) => c.tier), [1, 2, 2]);
    assert.deepEqual(large.cards.slice(6).map((c) => c.coin), [1, 2, 2]);
    assert.ok(large.cards.slice(6).every((c) => cardById.get(c.id)?.payout === 'kill'));
  }
});

test('six-seat R10 beacon supply is independent of item shop stock and granted once per survivor', () => {
  const h = makeMatch({ humans: 6, difficulty: 'HARD', fake: true, seed: 8643 }).start();
  try {
    h.toPrep(1);
    const shopCap = h.m.itemPool.cap(BEACON);
    const ps = h.ps('p_0');
    for (let i = 0; i < shopCap; i++) assert.ok(ps.acquireItem(BEACON));
    assert.equal(h.m.itemPool.left(BEACON), 0);
    h.m.startRound(10);
    for (const player of h.m.order) assert.equal(beacons(player).filter((p) => p.meta.sixPlayerBeaconRound === 10).length, 1);
    assert.equal(h.m.itemPool.left(BEACON), 0);
    h.m.startRound(10);
    for (const player of h.m.order) assert.equal(beacons(player).filter((p) => p.meta.sixPlayerBeaconRound === 10).length, 1);
    h.m.startRound(12);
    h.m.startRound(14);
    for (const player of h.m.order) assert.deepEqual(beacons(player).filter((p) => p.meta.sixPlayerBeaconRound).map((p) => p.meta.sixPlayerBeaconRound), [10]);
    h.invariants();
  } finally { h.m.dispose(); }
});

test('the R10 beacon gives the replaced operator to the best matching teammate next prep', () => {
  const h = makeMatch({ humans: 6, difficulty: 'HARD', fake: true, seed: 45 }).start();
  try {
    h.toPrep(10);
    const m = h.m, sender = h.ps('p_0'), receiver = h.ps('p_1');
    const core = m.gd.visibleChess.find((id) => m.gd.chess(id).tier === 6 && m.pool.left(id) > 0 && m.gd.chess(id).bonds?.length);
    assert.ok(core);
    const bond = m.gd.chess(core).bonds[0];
    const mate = m.gd.visibleChess.find((id) => id !== core && m.gd.chess(id).bonds.includes(bond) && legalTileFor(m, receiver, id));
    assert.ok(mate);
    give(m, receiver, mate, 'board', legalTileFor(m, receiver, mate));
    const target = give(m, sender, core);
    const beacon = beacons(sender).find((p) => p.meta.sixPlayerBeaconRound === 10);
    assert.ok(beacon);
    assert.deepEqual(m.handle(sender.playerId, { t: 'g.equip', itemUid: beacon.uid, targetUid: target.uid }), { ok: true });
    assert.ok(![...receiver.hand, ...receiver.temp].some((p) => p?.id === core));
    assert.ok(sender.effects.some((e) => e.id === `gift:${beacon.uid}`));
    h.toPrep(11);
    assert.ok([...receiver.hand, ...receiver.temp].some((p) => p?.id === core));
    assert.ok(!sender.effects.some((e) => e.id === `gift:${beacon.uid}`));
    h.invariants();
  } finally { h.m.dispose(); }
});
