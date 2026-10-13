import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SEATS, PHASE } from '../../shared/constants.js';
import { RESULT_LIMITS, validateC2S } from '../../shared/protocol.js';
import { GameData } from '../../server/match/gamedata.js';
import { generateDraft } from '../../server/match/choices.js';
import { createRng } from '../../server/sim/rng.js';
import { buildBattleSpec, compactResult, createBattleFromSpec, fitResult } from '../../server/sim/spec.js';
import { validateClientResult } from '../../server/match/fields.js';
import { attachAudit } from '../../server/match/audit.js';
import { normalizeSeats } from '../../public/js/screens/room.js';
import { parseArgs as parseLaunchArgs } from '../../scripts/launch.mjs';
import { normalizeSp } from '../../public/js/ui/gameLogic/draft.js';
import { DATA, give, legalTileFor, makeMatch } from './harness.js';

const BEACON = 'chess_item_5_04_e_a';
const MODE = 'mode_multi_hard';
const ids = Array.from({ length: 6 }, (_, i) => `p_${i}`);
const beacons = (ps) => [...ps.hand, ...ps.temp].filter((p) => p?.id === BEACON);

test('round-10 beacon launch flags stay out of asset setup arguments', () => {
  const off = parseLaunchArgs(['--no-round10-beacon', '--asset-source=mirror']);
  assert.equal(off.round10Beacon, false);
  assert.deepEqual(off.setupArgs, ['--asset-source=mirror']);
  assert.equal(parseLaunchArgs(['--no-round10-beacon', '--round10-beacon']).round10Beacon, true);
});

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

test('five and six seats adjust only core BANs; shared chess pool remains the upstream twofold pool', () => {
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

test('five and six starting seats scale the equivalent four-seat boss pool by 1.5 and 2 through eliminations', () => {
  for (const modeId of ['mode_multi_funny', 'mode_multi_normal', 'mode_multi_hard', 'mode_multi_abyss']) {
    const four = new GameData(DATA, modeId, 4);
    const five = new GameData(DATA, modeId, 5);
    const six = new GameData(DATA, modeId, 6);
    for (const bossId of Object.keys(DATA.bosses)) for (const alive of [1, 2, 3, 4, 5, 6]) {
      const fourSeatAlive = Math.min(4, alive);
      const baselineShare = four.bossPoolShare(fourSeatAlive);
      assert.equal(five.bossPoolShare(alive), baselineShare * 1.5);
      assert.equal(six.bossPoolShare(alive), baselineShare * 2);
      const boss = four.boss(bossId);
      const baseHp = boss.bloodPoint[four.difficulty] ?? Object.values(boss.bloodPoint).find(Number.isFinite) ?? 500000;
      assert.equal(five.bossPoolHp(bossId, alive), Math.max(1, Math.round(baseHp * baselineShare * 1.5)));
      assert.equal(six.bossPoolHp(bossId, alive), Math.max(1, Math.round(baseHp * baselineShare * 2)));
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
      const baselineShare = four.bossPoolShare(4);
      const boss = four.boss(m.bossId);
      const baseHp = boss.bloodPoint[four.difficulty] ?? Object.values(boss.bloodPoint).find(Number.isFinite) ?? 500000;
      assert.equal(m.bossPool.maxHp, Math.max(1, Math.round(baseHp * baselineShare * (count === 6 ? 2 : 1.5))));
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

test('nine bounty cards reach the client and the ninth card can be selected', () => {
  for (const count of [5, 6]) {
    const h = makeMatch({ humans: count, difficulty: 'HARD', fake: true, seed: 8643 }).start();
    try {
      h.toPrep(1);
      const audit = attachAudit(h.m, { invariants: false });
      h.m.round = 3; // HARD R3 is a bounty draft.
      h.m.enterSpDraft();
      const pub = h.m.publicView();
      assert.equal(pub.sp.family, 'bounty');
      assert.equal(pub.sp.cards.length, 9);
      const displayed = normalizeSp(pub.sp, pub.players);
      assert.equal(displayed.cards.length, 9);
      assert.equal(displayed.cards[8].id, pub.sp.cards[8].id);
      const picker = h.m.spTurn();
      assert.equal(validateC2S({ t: 'g.choice', idx: 8 }), null, 'the network accepts the ninth card');
      assert.notEqual(validateC2S({ t: 'g.choice', idx: 9 }), null);
      assert.deepEqual(h.m.handle(picker, { t: 'g.choice', idx: 8 }), { ok: true });
      const after = normalizeSp(h.m.publicView().sp, pub.players);
      assert.equal(after.cards[8].takenBy, picker);
      assert.ok(h.drive(() => h.m.phase === PHASE.PREP && h.m.round === 3, { ready: false }));
      assert.deepEqual(audit.violations, []);
      h.invariants();
    } finally { h.m.dispose(); }
  }
});

test('five/six-seat R10 beacon supply defaults on, leaves shop stock alone and is granted once', () => {
  for (const count of [4, 5, 6]) {
    const h = makeMatch({ humans: count, difficulty: 'HARD', fake: true, seed: 8643 }).start();
    try {
      assert.equal(h.m.round10Beacon, true);
      h.toPrep(1);
      const shopCap = h.m.itemPool.cap(BEACON);
      const ps = h.ps('p_0');
      for (let i = 0; i < shopCap; i++) assert.ok(ps.acquireItem(BEACON));
      assert.equal(h.m.itemPool.left(BEACON), 0);
      h.m.startRound(10);
      for (const player of h.m.order) assert.equal(beacons(player).filter((p) => p.meta.sixPlayerBeaconRound === 10).length, count >= 5 ? 1 : 0);
      assert.equal(h.m.itemPool.left(BEACON), 0);
      h.m.startRound(10);
      for (const player of h.m.order) assert.equal(beacons(player).filter((p) => p.meta.sixPlayerBeaconRound === 10).length, count >= 5 ? 1 : 0);
      h.m.startRound(12);
      h.m.startRound(14);
      for (const player of h.m.order) assert.deepEqual(beacons(player).filter((p) => p.meta.sixPlayerBeaconRound).map((p) => p.meta.sixPlayerBeaconRound), count >= 5 ? [10] : []);
      h.invariants();
    } finally { h.m.dispose(); }
  }
});

test('an AI opening seat keeps the five-seat beacon rule after elimination', () => {
  const h = makeMatch({ humans: 4, bots: 1, difficulty: 'HARD', fake: true, seed: 8643 }).start();
  try {
    h.toPrep(1);
    assert.equal(h.m.startingPlayerCount, 5);
    h.ps('ai_0').eliminate(1);
    assert.equal(h.m.alivePlayers().length, 4);
    h.m.startRound(10);
    for (const ps of h.m.alivePlayers()) assert.equal(beacons(ps).filter((p) => p.meta.sixPlayerBeaconRound === 10).length, 1);
    assert.equal(beacons(h.ps('ai_0')).length, 0);
    h.invariants();
  } finally { h.m.dispose(); }
});

test('disabling the R10 supply leaves ordinary beacons and shop stock unchanged', () => {
  const previous = process.env.SP_SIX_PLAYER_ROUND10_BEACON;
  process.env.SP_SIX_PLAYER_ROUND10_BEACON = '0';
  let h;
  try {
    h = makeMatch({ humans: 5, difficulty: 'HARD', fake: true, seed: 8643 }).start();
    assert.equal(h.m.round10Beacon, false);
    h.toPrep(1);
    const player = h.ps('p_0');
    const ordinary = player.acquireItem(BEACON);
    assert.ok(ordinary);
    assert.equal(ordinary.meta.sixPlayerBeaconRound, undefined);
    const stock = h.m.itemPool.left(BEACON);
    h.m.startRound(10);
    h.m.startRound(12);
    h.m.startRound(14);
    for (const ps of h.m.order) assert.equal(beacons(ps).filter((p) => p.meta.sixPlayerBeaconRound).length, 0);
    assert.ok(beacons(player).some((p) => p.uid === ordinary.uid));
    assert.equal(h.m.itemPool.left(BEACON), stock);
    h.invariants();
  } finally {
    h?.m.dispose();
    if (previous === undefined) delete process.env.SP_SIX_PLAYER_ROUND10_BEACON;
    else process.env.SP_SIX_PLAYER_ROUND10_BEACON = previous;
  }
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
