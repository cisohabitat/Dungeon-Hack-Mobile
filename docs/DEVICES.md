# Device matrix

Deepdelve is played on phones, most of them older and slower than the machines
it is built on. This page says which devices it is checked on, how often, and
what is checked. Tick the table at the bottom after each monthly round.

## What runs by itself

These run in CI on every push to `main` (`.github/workflows/test.yml`):

| Check | Stands for | Where |
|---|---|---|
| Browser tests, `phone` project | Pixel 5, 393×851, Chromium | `npx playwright test --project=phone` |
| `small` project: the interface, the core loop, portraits, melee and elemental feedback and the accessibility scan | iPhone SE, 375×667, in Chromium | `npx playwright test --project=small` |
| `safari` project: first-tap theme music, mute preferences, map fog, class portraits, touch controls and save/resume | iPhone SE viewport, Playwright WebKit on Linux | `npx playwright test --project=safari` |
| `layout.spec.js` in the `phone` project: a tablet held sideways and upright, a Steam Deck, a desktop window | 1024×768, 768×1024, 1280×800, 1440×900 | `npx playwright test --project=phone test/browser/layout.spec.js` |
| Frame-rate budget, processor slowed 4× | an old Android, Pixel 3 class | `PERF=1 npx playwright test --project=perf --workers=1` |

The `small` project catches layout faults in Chromium. The `safari` project
runs the tests tagged `@mobile` in WebKit, the engine Safari uses; CI installs
it in its own job. The default `npm run test:browser` stays on Chromium, which
is preinstalled locally. Run the Safari project separately where WebKit is
already available; do not install browsers in the local container.

Playwright WebKit on Linux is not Safari on iOS. These checks cannot establish
speaker output, real background/resume behaviour, OS process eviction, Home
Screen installation or Safari's storage eviction policy. The real-device round
below remains required. An empty rounds table means no physical-device result
has been recorded.

## The monthly round on real devices

Two devices, real ones or from a device farm (BrowserStack, LambdaTest and
Sauce Labs all have both):

- **Old Android**: a Pixel 3 or 3a, or a Samsung A-series of 2019 to 2020, on
  Chrome. The slow processor and small memory most players have.
- **Small iPhone**: an iPhone SE (2nd or 3rd generation), on Safari. The
  narrowest screen in common use, and Safari's own ways with audio, storage and
  the home-screen app.

Open the live site (or a preview deployment of the change being checked), then
work down the list. Note anything wrong in the table with the device and the
release and build shown at the bottom of the main page, plus the OS and browser version.

### Current local performance clearance

The 20 October presentation work passes functional browser checks after targeted
reruns, but its 4× CPU budget remains below target on this runner. The unchanged
production revision also fails. The unchanged budget passed on GitHub Actions
for the release code; see the [comparison and CI clearance](PERFORMANCE-2026-10-20.md).
This does not fill a physical-device round.

### Checklist

1. **Title.** It answers a tap within two seconds of the page appearing. The
   last run's line and the news line fit without overlapping.
2. **Install.** Add to Home Screen; the app opens full screen from the icon,
   with the right icon and name.
3. **New game.** Pick all six class cards; each has its own backstory. Tap each
   portrait to expand and collapse it; changing class resets the expansion.
   Check at Double text too. Begin is reachable without scrolling past the keyboard.
4. **First minute.** Through the prologue to the first floor. Walk, turn and
   sidestep by buttons and by swipe. The view keeps up (no visible stutter for
   more than a moment once the first floor is reached).
5. **First fight.** The coached fight plays out; blows sound; the warning mark
   is readable; the big numbers do not cover the monster.
6. **Overlays.** Open the Map, Pack, Spells, Hero and Journal, and the Menu.
   Each fits the screen, scrolls where it is long, and closes by its ✕ and by
   the phone's back gesture.
7. **Sound.** On a clean visit, dismiss News with the first tap: the theme starts
   without a second tap. Reload and dismiss the fun fact: the theme starts there
   too. Repeat with Sound off, then Music off: neither dismissal overrides the
   saved choice. Check narration hands over to floor music. Sound stops when the
   app is put away and comes back when it returns.
8. **Saving.** Put the app away mid-floor, close it from the app switcher,
   reopen: Continue resumes on the same floor.
9. **A heavy floor.** With the testing tools, go to floor 7 and turn on Show
   every monster; walk into a room of several. The view stays playable.
10. **Landscape.** Turn the phone; the layout changes and every control can be
    reached.
11. **Offline.** With the app opened once, turn on flight mode, close and
    reopen it: it loads and a new game starts.
12. **Reports.** Turn on Send reports in the Menu, die on the first floor, and
    check the dashboard counts the run within a few minutes. Turn it off again.
13. **Map fog.** Both maps stay hidden during the opening passage. On arrival,
    only the visible area is mapped; distant rooms and squares behind walls stay
    hidden. Check a dark floor too: its mapped range is shorter.

## Rounds

| Month | Device | Build | Result | Notes |
|---|---|---|---|---|
| | | | | |

## Polish round pending (20 October 2026)

The optional setup, Journal grouping, attack readiness, Pack type and map key
need the physical round above on the next release. No Android or iOS device or
device-farm session is attached to this development environment. This is a pending
check, not a physical pass; leave the rounds table blank until performed.

In addition to the standard checklist, check these in Normal and Double text:

- Start each class with Customise closed; expand it, change a background and seed,
  fold it and verify the selected choices in the prologue and dungeon.
- Open Quests, expand Stories & collections, visit each collection, then close
  the Journal with the phone's Back gesture and resume moving.
- Watch Attack change from Recovering to Ready during a fight; check that ordinary
  and special enemy marks stay readable against pale and dark walls.
- Read long item names with a full Pack. Scroll its last row and open/close details.
- Expand Map symbols, read its key, fold it, and rotate with known landmarks shown.
- Put the app away during a fight and during narration, reopen it, then repeat
  offline. Record speaker output, audio resume, responsiveness and any lost save.
