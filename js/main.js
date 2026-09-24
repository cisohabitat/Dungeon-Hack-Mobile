// Entry point. This is the only script the page loads; everything else arrives
// through imports, so load order is described by the code rather than by the
// order of tags in the document.
import { Assets } from './assets.js';
import { Renderer } from './renderer.js';
import { Sound } from './sound.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import * as Data from './data.js';
import { Dungeon } from './dungeon.js';

// Modules keep their names to themselves, which is usually what you want. This
// game is a single-player offline page, and having the pieces reachable from
// the console is worth more here than hiding them: it is how the browser tests
// drive the game, and how you poke at a dungeon while working on one.
function exposeForTesting() {
  Object.assign(window, {
    Game, Dungeon, Renderer, Assets, Sound, UI,
    ITEMS: Data.ITEMS, MONSTERS: Data.MONSTERS, CLASSES: Data.CLASSES,
    SPELLS: Data.SPELLS, THEMES: Data.THEMES, SPRITES: Data.SPRITES,
    XP_TABLE: Data.XP_TABLE, MAX_LEVEL: Data.MAX_LEVEL, STAT_NAMES: Data.STAT_NAMES,
    KEY_COLORS: Data.KEY_COLORS, BACKGROUNDS: Data.BACKGROUNDS, JOURNAL: Data.JOURNAL,
    BOONS: Data.BOONS, PROLOGUE: Data.PROLOGUE, ELITES: Data.ELITES,
  });
}

// A phone may kill a backgrounded tab without warning, and the only saves
// were on the stairs: keep the run whenever the page is put away.
function saveOnHide() {
  const G = Game.state();
  if (G && G.status === 'playing' && UI.isPlaying()) Game.save(true);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) saveOnHide(); });
window.addEventListener('pagehide', saveOnHide);

let last = 0;
function loop(now) {
  const dt = last ? Math.min(100, now - last) : 0;
  last = now;

  if (UI.isTitle()) { UI.renderTitle(now); Sound.stopAmbience(); }
  const G = Game.state();
  if (G && UI.isPlaying()) {
    if (G.status === 'playing' && !UI.paused()) {
      UI.pumpHeld();
      Game.update(now, dt);
    } else {
      Game.tick(now);
    }
    if (G.status === 'playing' || G.status === 'dead' || G.status === 'won') {
      const rs = Game.renderState(now);
      Renderer.render(rs.level, rs.cam, rs.sprites, rs.fx, now);
      const view = document.getElementById('view');
      if (now < rs.fx.shakeUntil) {
        const a = (rs.fx.shakeUntil - now) / (rs.fx.shakeMs || 220) * (rs.fx.shakeAmp || 4);
        view.style.transform = `translate(${(Math.random() * 2 - 1) * a}px, ${(Math.random() * 2 - 1) * a}px)`;
      } else if (view.style.transform) view.style.transform = '';
      UI.refreshMinimap(now);
    }
    UI.refreshHud();
    UI.refreshLog();
    UI.handleEvents();
    if (G.status === 'playing') {
      Sound.setAmbience(Game.bossAwake() ? 1 : 0);
      Sound.heartbeat(G.player.hp / G.player.maxHp, now);
    } else Sound.stopAmbience();
  }
  requestAnimationFrame(loop);
}

function boot() {
  exposeForTesting();
  Assets.init();
  Renderer.init(document.getElementById('title-art'));
  UI.init();
  requestAnimationFrame(loop);
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// A module script is deferred, so the document is already parsed by now.
boot();
