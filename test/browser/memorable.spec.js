'use strict';
const { test, expect } = require('@playwright/test');
const { startGame, selectJournalTab, watchForErrors } = require('./helpers');

async function openJournal(page, tab) {
  await page.click('[data-open="journal"]');
  await selectJournalTab(page, tab);
}

test('@mobile places stay hidden until entered, then appear in the map and recap without changing the run', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'remember-places' });
  await page.click('[data-open="journal"]');
  const result = await page.evaluate(async () => {
    const { knownLandmarks } = await import('/js/maplandmarks.js');
    const { recapView, questsView } = await import('/js/delveguide.js');
    const { visitedPlace } = await import('/js/rooms.js');
    const L = Game.level(), G = Game.state(), p = Game.player();
    L.monsters = []; L.npcs = []; L.piece = { kind: 'cistern', variant: 'brimming', room: 42, props: [] };
    const i = p.y * L.w + p.x;
    L.roomId.fill(-1); L.roomId[i] = 42; L.explored.fill(0); L.explored[i] = 1;
    L.roomId[i + 1] = 42; // Unexplored even though the room is visited.
    const hidden = !visitedPlace(L) && !recapView().includes('overflowing') && !questsView().includes('overflowing') && !knownLandmarks().some(r => r.type === 'place');
    L.piece.seen = true;
    const before = JSON.stringify(G), rooms = knownLandmarks().filter(r => r.type === 'place');
    const visible = recapView().includes('The overflowing cistern') && questsView().includes('The overflowing cistern');
    return { hidden, visible, pure: before === JSON.stringify(G), rooms, x: p.x, y: p.y };
  });
  expect(result.hidden).toBe(true); expect(result.visible).toBe(true); expect(result.pure).toBe(true);
  expect(result.rooms).toHaveLength(1); expect(result.rooms[0]).toMatchObject({ x: result.x, y: result.y, name: 'The overflowing cistern' });
  await selectJournalTab(page, 'recap'); await expect(page.locator('#journal-list')).toContainText('Places visited');
  await page.keyboard.press('Escape');
  await expect(page.locator('#floor-card-name')).toHaveText('The overflowing cistern');
  await page.click('[data-open="map"]'); await page.locator('#map-landmarks summary').click();
  await page.getByRole('button', { name: /The overflowing cistern/ }).click();
  await expect(page.getByRole('button', { name: /The overflowing cistern/ })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => [Game.player().x, Game.player().y])).toEqual([result.x, result.y]);
  expect(errors).toEqual([]);
});

test('@mobile companion reactions and milestones use all six identities and preserve state and dice', async ({ page }) => {
  const errors = watchForErrors(page); await startGame(page, { seed: 'remember-friends' });
  await page.click('[data-open="journal"]');
  const rows = await page.evaluate(async () => {
    const { companionCard } = await import('/js/companionsview.js');
    const { COMPANION_REACTIONS } = await import('/js/data.js');
    const { Dice, Odds } = await import('/js/rng.js');
    const G = Game.state(), L = Game.level(); L.monsters = [];
    return Object.keys(COMPANION_REACTIONS).map(kind => {
      G.companion = { kind, name: '<Brindle>', hp: 20, maxHp: 20, depth: G.depth, joined: 1, mode: 'follow', floors: 2, x: G.player.x, y: G.player.y, nextAct: 1e9 };
      const before = JSON.stringify(G), dice = [Dice.s, Odds.s], card = companionCard(G);
      const pure = JSON.stringify(G) === before && Dice.s === dice[0] && Odds.s === dice[1];
      G.status = 'won'; const won = companionCard(G).includes(COMPANION_REACTIONS[kind].won); G.status = 'playing';
      L.piece = { kind: 'shrine', variant: 'kept', room: 42, props: [], seen: true }; L.roomId[G.player.y * L.w + G.player.x] = 42;
      const place = companionCard(G).includes(COMPANION_REACTIONS[kind].place);
      G.companion.hp = 1; const danger = companionCard(G).includes(COMPANION_REACTIONS[kind].danger);
      G.companion.fallen = G.depth; const fallen = !companionCard(G).includes('companion-reaction');
      delete G.companion.fallen; G.companion.depth++; const absent = !companionCard(G).includes('companion-reaction');
      G.companion.depth = G.depth; G.companion.hp = 20; G.companion.floors = 4;
      return { pure, won, place, danger, fallen, absent, escaped: card.includes('&lt;Brindle&gt;'), learned: (card.match(/companion-milestone learned/g) || []).length, veteran: (companionCard(G).match(/companion-milestone learned/g) || []).length };
    });
  });
  for (const row of rows) expect(row).toEqual({ pure: true, won: true, place: true, danger: true, fallen: true, absent: true, escaped: true, learned: 1, veteran: 2 });
  await selectJournalTab(page, 'companions'); await expect(page.locator('.companion-card')).toContainText('Travelling together');
  await expect(page.locator('.companion-milestone.learned')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('@mobile field notes and the next-delve goal stay readable at double text', async ({ page }) => {
  const Axe = require('@axe-core/playwright').default;
  const errors = watchForErrors(page);
  await page.addInitScript(() => localStorage.setItem('deepdelve.textSize', '4'));
  await startGame(page, { seed: 'remember-next' });
  await page.evaluate(() => { Game.level().monsters = []; });
  await openJournal(page, 'quests'); await page.locator('.field-notes summary').click();
  await expect(page.locator('.field-notes')).toContainText('marked leader');
  const audit = async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const r = await new Axe({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(r.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
  };
  await audit();
  await page.evaluate(() => { const G = Game.state(), p = G.player; G.companion = { kind: 'hound', name: 'Brindle', hp: 12, maxHp: 20, depth: G.depth, joined: 1, mode: 'follow', floors: 2, x: p.x, y: p.y, nextAct: 1e9 }; });
  await selectJournalTab(page, 'companions'); await audit();
  await page.locator('.companion-history summary').click(); await audit();
  await page.keyboard.press('Escape');
  await page.evaluate(() => Game.hurtPlayer(99999, 'The next-delve check'));
  await expect(page.locator('#screen-end')).toBeVisible(); await expect(page.locator('#end-goal')).toContainText('One more delve');
  await expect(page.locator('#end-goal')).toContainText('Reach floor 3'); await audit();
  await page.click('#end-new'); await expect(page.locator('#screen-create')).toBeVisible();
  expect(errors).toEqual([]);
});
