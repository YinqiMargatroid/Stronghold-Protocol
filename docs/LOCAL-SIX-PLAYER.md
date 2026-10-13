# Community six-player rules on upstream 0.2.5

Part of [DESIGN.md](DESIGN.md) for this isolated community fork branch. It is not an upstream release or a claim about official Arknights rules. The code is GPL-3.0-or-later, and game assets are excluded; keep the project non-commercial and do not commit extracted or downloaded art/audio.

This branch begins at [upstream commit `cf7a9400`](https://github.com/sganggs/Stronghold-Protocol/commit/cf7a9400) (0.2.5). It ports the rules directly related to larger rooms from [Stronghold-Protocol-Rhine's multiplayer notes](https://github.com/YUYUYUYUYUYUYUTOUA/Stronghold-Protocol-Rhine/blob/codex/rhine-upstream-021/docs/MULTIPLAYER.md). Rhine's new bonds, operators, items, and scenario content are outside this overlay. The inherited upstream 0.2.5 rules and data apply otherwise. The twofold co-op pool baseline follows [upstream PR #477](https://github.com/sganggs/Stronghold-Protocol/pull/477); the round-10-only beacon supply is a local choice made on 2026-10-12, not an official finding.

| Rule | Local implementation |
|---|---|
| Seats | Co-op rooms hold 1–6 people and AI teammates. Solo remains one. The room, team panel, strategy draft, battle result protocol, and statistics preserve all six rows. |
| BAN | The configured four-seat counts stay unchanged. Five starting seats reduce only the core BAN draw by one; six reduce it by two, floored at zero. The add-on count is unchanged. Human and AI starting seats count; leaving or elimination does not change the draw. |
| Shared operator pool | The 0.2.5 `economy.coopPoolMultiplier` remains 2 for every co-op size. Six seats share the same limited pool, with no per-seat multiplier and no change to generated `data/config.json`. |
| Boss rounds | Five surviving players form 2+2+1 fields, six form 2+2+2. A match that started with six seats has a shared boss pool equal to twice the equivalent four-seat pool for the same number alive (capped at four for that comparison). The multiplier applies once to Final Assault and Hidden Core, and is fixed by the starting roster. |
| Bounty draft | Five- and six-seat co-op rooms offer the original six cards plus three distinct existing kill bounties of tiers I/II/II, paying 1/2/2. The extra cards use the existing card and enemy data; other draft families retain six cards. |
| Beacon supply | Enabled by default: in a match that started with six seats, every surviving player receives one normal 信标 at the start of round 10 only. The server operator can disable this rule with `--no-round10-beacon` or `SP_SIX_PLAYER_ROUND10_BEACON=0`; `--round10-beacon` enables it. The choice is fixed when each match starts. This reward is separate from the finite shared item shop stock; disabling it does not remove ordinary 信标 from the shop. Like an ordinary purchased 信标, it transfers the replaced operator to the selected teammate at the next prep. Full inventories use the existing overflow rules. |

The core paths are `shared/constants.js`, `server/match/gamedata.js`, `server/match/choices.js`, `server/match/beaconSupply.js`, `server/match/finalAssault.js`, `server/match/pool.js`, and `server/sim/spec.js`. The focused verification is `test/match/six-player-local.test.js`.

Pass `--no-round10-beacon` to `scripts/start-windows.bat`, `scripts/start.sh`, or a local wrapper that forwards arguments (for example, a deployment-specific `start-server.cmd`) to omit the fixed supply; `--round10-beacon` turns it on explicitly. The default remains on. The flags are handled by `scripts/launch.mjs` and passed to the server, not to asset setup; start a new server process for a changed launch flag to take effect. The direct `node server/index.js` path accepts the environment variable above.

Fork revision on 2026-10-13: this server-start option was added so hosts can choose whether to use the fork's extra R10 reward. The default game state and golden scenarios are unchanged; the option is not a claim about the official rules.

## Verification and limits

- `node --test test/match/six-player-local.test.js test/match/feedback3-gift.test.js`: 14 passed, 0 failed, including the startup flags and disabled reward.
- `node --test test/docs-consistency.test.js test/docs-paths.test.js`: 32 passed, 0 failed.
- `npm run lint`: 0 errors; `npm run typecheck`: passed. The full `npm run ci` passed on the six-player baseline before this option and was not rerun for this local change.
- `npm run golden`: 287 scenarios match, with no golden files changed. Browser E2E and a full six-human playthrough were not run.
- Source only: `public/assets/`, `data/local-assets.json`, caches, dependencies, and local extraction results are not committed. Each installation prepares its own assets. The upstream release archives are four-seat builds.

## Following upstream

The fork's `master` is the six-player main branch, separate from upstream `master`; upstream changes are not applied automatically. On a separate development clone of the fork (not a running server), use:

```bash
git remote add upstream https://github.com/sganggs/Stronghold-Protocol.git  # once, if absent
git fetch upstream master
git switch master
git merge upstream/master
```

Resolve conflicts against the six-player rules above. Recheck changes to room limits, pool copies, BAN counts, boss pairing and HP, bounty drafts, beacon supply, protocol sizes, and the client UI. Update the version and history notes, then run the focused tests, `npm run ci`, and `npm run golden` before pushing to the fork. A merge does not update a deployed server until its operator chooses to restart it. This branch does not open a pull request against upstream.
