'use strict';
// Bootstrap and main loop.

(function () {
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
          const a = (rs.fx.shakeUntil - now) / 220 * 4;
          view.style.transform = `translate(${(Math.random() * 2 - 1) * a}px, ${(Math.random() * 2 - 1) * a}px)`;
        } else if (view.style.transform) view.style.transform = '';
        UI.refreshMinimap(now);
      }
      UI.refreshHud();
      UI.refreshLog();
      UI.handleEvents();
      if (G.status === 'playing') {
        Sound.setAmbience(G.escaping ? 1 : 0);
        Sound.heartbeat(G.player.hp / G.player.maxHp, now);
      } else Sound.stopAmbience();
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener('load', () => {
    Assets.init();
    Renderer.init(document.getElementById('title-art'));
    UI.init();
    requestAnimationFrame(loop);
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  });
})();
