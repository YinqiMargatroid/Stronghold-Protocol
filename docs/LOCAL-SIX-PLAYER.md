# Local six-player rules on upstream 0.2.5

Part of [DESIGN.md](DESIGN.md) for this isolated local checkout.

This isolated checkout begins at upstream commit `cf7a9400` (0.2.5). It ports the rules directly related to larger rooms from [Stronghold-Protocol-Rhine's multiplayer notes](https://github.com/YUYUYUYUYUYUYUTOUA/Stronghold-Protocol-Rhine/blob/codex/rhine-upstream-021/docs/MULTIPLAYER.md). Rhine's new bonds, operators, items, and scenario content are outside this overlay. The inherited official 0.2.5 rules and data apply otherwise.

| Rule | Local implementation |
|---|---|
| Seats | Co-op rooms hold 1–6 people and AI teammates. Solo remains one. The room, team panel, strategy draft, battle result protocol, and statistics preserve all six rows. |
| BAN | The configured four-seat counts stay unchanged. Five starting seats reduce only the core BAN draw by one; six reduce it by two, floored at zero. The add-on count is unchanged. Human and AI starting seats count; leaving or elimination does not change the draw. |
| Shared operator pool | The 0.2.5 `economy.coopPoolMultiplier` remains 2 for every co-op size. Six seats share the same limited pool, with no per-seat multiplier and no change to generated `data/config.json`. |
| Boss rounds | Five surviving players form 2+2+1 fields, six form 2+2+2. A match that started with six seats has a shared boss pool equal to twice the equivalent four-seat pool for the same number alive (capped at four for that comparison). The multiplier applies once to Final Assault and Hidden Core, and is fixed by the starting roster. |
| Bounty draft | Five- and six-seat co-op rooms offer the original six cards plus three distinct existing kill bounties of tiers I/II/II, paying 1/2/2. The extra cards use the existing card and enemy data; other draft families retain six cards. |
| Beacon supply | In a match that started with six seats, every surviving player receives one normal 信标 at the start of rounds 10, 12, and 14. These fixed rewards are separate from the finite shared item shop stock. The round-14 reward immediately transfers the replaced operator to the selected teammate; earlier rewards and ordinary purchased 信标 retain the next-prep timing. Full inventories use the existing overflow rules. |

The core paths are `shared/constants.js`, `server/match/gamedata.js`, `server/match/choices.js`, `server/match/beaconSupply.js`, `server/match/finalAssault.js`, `server/match/pool.js`, and `server/sim/spec.js`. The focused verification is `test/match/six-player-local.test.js`.
