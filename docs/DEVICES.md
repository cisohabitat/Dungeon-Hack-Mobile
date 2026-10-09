# Device matrix

Deepdelve is played on phones, most of them older and slower than the machines
it is built on. This page says which devices it is checked on, how often, and
what is checked. Tick the table at the bottom after each monthly round.

## What runs by itself

These run in CI on every push to `main` (`.github/workflows/test.yml`):

| Check | Stands for | Where |
|---|---|---|
| Browser tests, `phone` project | Pixel 5, 393×851, Chromium | `npx playwright test --project=phone` |
| `small` project: the interface, the core loop and the accessibility scan | iPhone SE, 375×667, in Chromium | `npx playwright test --project=small` |
| Frame-rate budget, processor slowed 4× | an old Android, Pixel 3 class | `PERF=1 npx playwright test --project=perf --workers=1` |

The `small` project runs in Chromium because WebKit is not installed in the
containers this is built in. It catches a screen too short or too narrow, not
Safari's own faults: those are what the real iPhone below is for.

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
build (the news line's id, shown in the dashboard's crash list).

### Checklist

1. **Title.** It answers a tap within two seconds of the page appearing. The
   last run's line and the news line fit without overlapping.
2. **Install.** Add to Home Screen; the app opens full screen from the icon,
   with the right icon and name.
3. **New game.** Pick each class card; the text is readable without zoom; Begin
   is reachable without scrolling past the keyboard.
4. **First minute.** Through the prologue to the first floor. Walk, turn and
   sidestep by buttons and by swipe. The view keeps up (no visible stutter for
   more than a moment once the first floor is reached).
5. **First fight.** The coached fight plays out; blows sound; the warning mark
   is readable; the big numbers do not cover the monster.
6. **Overlays.** Open the Map, Pack, Spells, Hero and Journal, and the Menu.
   Each fits the screen, scrolls where it is long, and closes by its ✕ and by
   the phone's back gesture.
7. **Sound.** Sound and music start after the first tap; they stop when the app
   is put away and come back when it returns.
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

## Rounds

| Month | Device | Build | Result | Notes |
|---|---|---|---|---|
| | | | | |
