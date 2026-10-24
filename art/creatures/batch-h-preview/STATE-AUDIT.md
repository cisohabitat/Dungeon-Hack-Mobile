# Batch H state and equipment audit

| State | Body / equipment to use on future integration | Evidence |
|---|---|---|
| Heartforged phase 0 | Existing closed furnace atlas | Existing loader |
| Heartforged phase 1 | `heartforged_open` | `forgeTurns`: opens furnace, spawns separate Emberlings |
| Heartforged phase 2 / direct skip | `heartforged_whitehot` | `forgeTurns`: white iron, faster fire; phase selected by index |
| Warlord phase 0 | Existing cleaver/drum atlas | Base monster has no ranged attack |
| Warlord phase 1, throne | `warlord_throne` | Bearers successfully raised; seated shot, no melee/walking |
| Warlord phase 1, no bearer spawn | Standing cleaver/drum; `warlord_spear` for shots | `raiseBearers` returning zero never sets throne; phase still grants ranged |
| Warlord phase 1, throne exit | Standing cleaver/drum; `warlord_spear` for shots | Bearers dead or 15s expiry clears throne, retains phase 1 |
| Warlord phase 2 / direct skip | Existing cleaver/drum atlas | Current phase replaces phase-1 stats; no ranged attack, frenzy doubles blows |
| Lich phase 1 / 2 | Existing cold-blue idle/casting/special cells | Teleport, raised guards, snuffed torches and rite are external effects |
| Interrupted attacks | Current state's idle/hurt/recover as actually selected | Boss phase functions clear windup and volley; never retain old weapon attack |

Sources: `js/game.js` mstatBase spreads base plus ONLY current phase;
`js/data.js` boss phase records; `js/bosses.js` bossTurns, forgeTurns,
warlordTurns, raiseBearers, leaveThrone; `js/foes.js` throne exit/adjacency/shot
branches; `js/motion.js` pose selection and later-phase procedural guard.
There is no current throne body or phase-specific painted atlas selection.
These new bodies are deliberate phase illustrations, not copies of an existing
phase-specific fallback picture. Existing legacy bodies remain the actual fallback.

H3 and H4 cannot share: phase-1 spear attacks occur while standing, and throne
states must remain seated. A whole new Lich costume/frenzy body has no demonstrated
need. Reserve cells do not authorize new moves. Future integration needs an exact
state-and-pose resolver: only standing shot cycles use spear art, melee/drum use
cleaver art; never switch an interrupted shot into a cleaver throw.

Verification: existing full rules suite passed (751 checks in 74 files). Browser
preview records actual mstat ranged/speed for all nine boss/phase combinations,
asserts the current procedural guard and warning visibility before substituting
paintings. No-bearer, timed exit, direct skips and interruption are code audits;
the preview does not claim to drive those transitions end to end.
