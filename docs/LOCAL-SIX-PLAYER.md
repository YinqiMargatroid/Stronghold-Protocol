# Community six-player rules on upstream 0.2.6

Part of [DESIGN.md](DESIGN.md) for this isolated community fork branch. It is not an upstream release or a claim about official Arknights rules. The code is GPL-3.0-or-later; game assets are excluded from that license and from Git. The fork's full [release bundle](https://github.com/YinqiMargatroid/Stronghold-Protocol-Six-Player/releases) carries prepared art/audio for non-commercial use; do not commit extracted or downloaded assets.

This branch began at [upstream 0.2.5 commit `cf7a9400`](https://github.com/sganggs/Stronghold-Protocol/commit/cf7a9400) and now includes [upstream 0.2.6 commit `488db49f`](https://github.com/sganggs/Stronghold-Protocol/commit/488db49f). It ports the rules directly related to larger rooms from [Stronghold-Protocol-Rhine's multiplayer notes](https://github.com/YUYUYUYUYUYUYUTOUA/Stronghold-Protocol-Rhine/blob/codex/rhine-upstream-021/docs/MULTIPLAYER.md). Rhine's new bonds, operators, items, and scenario content are outside this overlay. The inherited upstream 0.2.6 rules and data apply otherwise. The twofold co-op pool baseline follows [upstream PR #477](https://github.com/sganggs/Stronghold-Protocol/pull/477); the round-10-only beacon supply and five-seat 1.5× boss pool are local choices, not official findings.

| Rule | Local implementation |
|---|---|
| Seats | Co-op rooms hold 1–6 people and AI teammates. Solo remains one. The room, team panel, strategy draft, battle result protocol, and statistics preserve all six rows. |
| BAN | The configured four-seat counts stay unchanged. Five starting seats reduce only the core BAN draw by one; six reduce it by two, floored at zero. The add-on count is unchanged. Human and AI starting seats count; leaving or elimination does not change the draw. |
| Shared operator pool | The upstream 0.2.6 `economy.coopPoolMultiplier` remains 2 for every co-op size. Six seats share the same limited pool, with no per-seat multiplier and no change to generated `data/config.json`. |
| Boss rounds | Five surviving players form 2+2+1 fields, six form 2+2+2. A match that started with five seats has a shared boss pool equal to 1.5 times the equivalent four-seat pool; six starting seats use 2 times. Compare at the same number alive, capped at four. The multiplier is fixed by the starting roster through eliminations and applied once when creating each Final Assault or Hidden Core shared pool, never once per field. |
| Bounty draft | Five- and six-seat co-op rooms offer the original six cards plus three distinct existing kill bounties of tiers I/II/II, paying 1/2/2. The extra cards use the existing card and enemy data; other draft families retain six cards. The browser shows all nine choices, the wire protocol accepts indices 0–8, and on short screens the card grid scrolls. |
| Beacon supply | Enabled by default: in a match that started with five or six seats, every surviving player receives one normal 信标 at the start of round 10 only. Four-seat rooms do not get the fixed supply. The server operator can disable this rule with `--no-round10-beacon` or `SP_SIX_PLAYER_ROUND10_BEACON=0`; `--round10-beacon` enables it. The environment variable retains its original name for compatibility. The choice is fixed when each match starts. This reward is separate from the finite shared item shop stock; disabling it does not remove ordinary 信标 from the shop. Like an ordinary purchased 信标, it transfers the replaced operator to the selected teammate at the next prep. Full inventories use the existing overflow rules. |

The core paths are `shared/constants.js`, `shared/protocol.js`, `server/match/gamedata.js`, `server/match/choices.js`, `server/match/beaconSupply.js`, `server/match/finalAssault.js`, `server/match/pool.js`, `server/match/audit.js`, `public/js/ui/gameLogic/draft.js`, `public/js/ui/choiceOverlay.js`, and `server/sim/spec.js`. The focused verification is `test/match/six-player-local.test.js` and the UI choice tests.

Pass `--no-round10-beacon` to the tracked root `start-server.cmd`, `scripts/start-windows.bat`, or `scripts/start.sh` to omit the fixed supply; `--round10-beacon` turns it on explicitly. The root Windows launcher defaults to `--asset-source=mirror --no-open`, forwards additional flags, and leaves scene checks and extraction enabled. It ships in both release bundles. The beacon flags are handled by `scripts/launch.mjs` and passed to the server, not to asset setup; start a new server process for a changed launch flag to take effect. The direct `node server/index.js` path accepts the environment variable above.

Fork revision on 2026-10-13: the server-start option lets hosts choose whether to use the fork's extra R10 reward. A later local fix restored the three extra bounty cards that the browser previously clipped to six, raised the `g.choice` protocol limit from index 5 to 8, and extended the default R10 supply to five-seat starts. These are community rules, not claims about the official mode.

After merging upstream 0.2.6, the five-seat boss-pool rule changed from the unscaled five-player pool to 1.5 times the corresponding four-seat baseline. The six-seat 2× rule and the round-10-only beacon choice remain unchanged. The running four-player installation is separate from this development checkout.

The nine-card client path follows Rhine's [draft normalizer](https://github.com/YUYUYUYUYUYUYUTOUA/Stronghold-Protocol-Rhine/blob/codex/rhine-upstream-021/public/js/ui/gameLogic/draft.js), [wire validator](https://github.com/YUYUYUYUYUYUYUTOUA/Stronghold-Protocol-Rhine/blob/codex/rhine-upstream-021/shared/protocol.js), and [scrollable card grid](https://github.com/YUYUYUYUYUYUYUTOUA/Stronghold-Protocol-Rhine/blob/codex/rhine-upstream-021/public/css/screens/game-panels.css). Rhine's six-seat rounds 10/12/14 beacon schedule is not used here; this fork keeps the previously chosen round-10-only schedule and now includes five-seat starts.

## Verification and limits

- `node --test --test-concurrency=1`: 6,353 passed, 0 failed, 21 skipped. Windows directory links used a junction in the asset-index test; serial file execution avoids timing noise in the rate-limit tests. The smoke step was omitted to avoid starting another game server.
- `npm run ci -- --only setup,lint,imports,typecheck`: all selected steps passed; lint reported 0 errors.
- `node --test test/package.test.js test/package-player.test.js test/docs-consistency.test.js test/docs-paths.test.js test/asset-index.test.js test/match/six-player-local.test.js`: 72 passed, 0 failed, including the root launcher in full and lite bundle plans, the five/six-seat boss pool and the nine-card wire path.
- `npm run golden`: 287 scenarios match, with no golden files changed. Browser E2E and a full six-human playthrough were not run.
- Git source excludes `public/assets/`, `data/local-assets.json`, caches, dependencies, and local extraction results. The fork's full release bundle includes checked assets and scenes; the lite bundle prepares assets at first start. Upstream release archives are four-seat builds and are not compatible updates for this fork.

## Following upstream

The fork's `master` is the six-player main branch, separate from upstream `master`; upstream changes are not applied automatically. On a separate development clone of the fork (not a running server), use:

```bash
git remote add upstream https://github.com/sganggs/Stronghold-Protocol.git  # once, if absent
git fetch upstream master
git switch master
git merge upstream/master
```

Resolve conflicts against the six-player rules above. Recheck changes to room limits, pool copies, BAN counts, boss pairing and HP, bounty drafts, beacon supply, protocol sizes, and the client UI. Keep the tracked root `start-server.cmd`, its README instructions and its package allowlist entry in every future fork version. Update the version and history notes, then run the focused tests, `npm run ci`, and `npm run golden` before pushing to the fork. A merge does not update a deployed server until its operator chooses to restart it. This branch does not open a pull request against upstream.
