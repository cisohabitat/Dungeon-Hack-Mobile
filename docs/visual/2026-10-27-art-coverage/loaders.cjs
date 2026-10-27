'use strict';
// Native loader inventory, not gameplay/action screenshots. No asset overrides.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(root + '/node_modules/playwright');
const { serve } = require(root + '/test/server');
const { watchForErrors } = require(root + '/test/browser/helpers');
const inventory = JSON.parse(fs.readFileSync(path.join(__dirname, 'inventory.json')));
(async () => {
  const server = http.createServer(serve);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }), errors = watchForErrors(page);
    await page.addInitScript(() => { for (const key of ['sound', 'samples', 'prelude']) localStorage.setItem('deepdelve.' + key, 'off'); });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.Assets && Assets.painting() === 0, null, { timeout: 60000 });
    await page.evaluate(async inventory => {
      const { PAINTED } = await import('/js/paintedcatalog.js');
      const world = await import('/js/paintedworld.js'), creature = await import('/js/paintedcreatures.js');
      const entries = [];
      for (const row of inventory.creatureRoutes) {
        const base = row.elite ? Assets.sprites[row.base].elite[row.elite] : Assets.sprites[row.base];
        for (const pose of row.poses) {
          const sprite = pose === 'idle' ? base : base?.[pose];
          if (!sprite) throw Error('Missing native sprite ' + row.id + '/' + pose);
          entries.push({ label: row.id + '/' + pose, sprite, variant: '' });
        }
      }
      for (const variant of inventory.variants) {
        const base = variant === 'mimic_barrel' ? 'mimic' : variant.startsWith('heartforged') ? 'heartforged' : 'warlord';
        const row = inventory.creatureRoutes.find(r => r.id === base);
        for (const pose of row.poses) entries.push({ label: variant + '/' + pose, sprite: pose === 'idle' ? Assets.sprites[base] : Assets.sprites[base][pose], variant });
      }
      for (const entry of entries) creature.paintedCreature(entry.sprite, entry.variant);
      for (const key of Object.keys(PAINTED.static)) void Assets.sprites[key].url;
      for (const meta of Object.values(PAINTED.held)) world.paintedHeld(meta.id, meta.pose, meta.cls, meta.two, meta.lit);
      for (const meta of Object.values(PAINTED.carried)) world.paintedCarried(meta.id, meta.cls);
      for (const family of ['fire', 'frost']) world.paintedImpact(family, 0);
      for (const [index, theme] of Object.entries(PAINTED.themes)) for (const key of Object.keys(theme)) {
        const native = Assets.themes[index];
        if (/^floor\d?$/.test(key)) native.floorOf(Number(key.slice(5)) || 0);
        else if (/^(ceiling|ceil\d)$/.test(key)) native.ceilOf(Number(key.slice(4)) || 0);
        else if (key.startsWith('decor')) void native.decor;
        else if (key.startsWith('torch')) void native.torchFrames;
        else void native[key];
      }
      window.__coverage = { entries, PAINTED, world, creature };
    }, inventory);
    await page.waitForFunction(() => {
      const { entries, PAINTED, world, creature } = window.__coverage;
      return entries.every(e => creature.paintedCreature(e.sprite, e.variant) !== e.sprite)
        && Object.values(world.paintedWorldState()).every(state => state === 'ready')
        && Object.values(PAINTED.held).every(m => !!world.paintedHeld(m.id, m.pose, m.cls, m.two, m.lit))
        && Object.values(PAINTED.carried).every(m => !!world.paintedCarried(m.id, m.cls));
    }, null, { timeout: 120000, polling: 200 });
    const result = await page.evaluate(() => {
      const { entries, PAINTED, world, creature } = window.__coverage;
      const galleries = [];
      const groups = [
        ['creatures', entries.filter(e => e.label.endsWith('/idle') || e.label === 'mender/heal').map(e => [e.label, creature.paintedCreature(e.sprite, e.variant).levels[0]])],
        ['world', Object.keys(PAINTED.static).filter(k => !/^(relic|legend|mythic)_/.test(k)).map(k => [k, Assets.sprites[k].levels[0]])],
      ];
      for (const [name, images] of groups) for (let start = 0; start < images.length; start += 64) {
        const batch = images.slice(start, start + 64), c = document.createElement('canvas'); c.width = 1024; c.height = Math.ceil(batch.length / 8) * 150;
        const ctx = c.getContext('2d'); ctx.fillStyle = '#24212a'; ctx.fillRect(0, 0, c.width, c.height); ctx.font = '10px sans-serif';
        batch.forEach(([label, image], n) => { const x = n % 8 * 128, y = Math.floor(n / 8) * 150; ctx.drawImage(image, x, y, 128, 128); ctx.fillStyle = '#fff'; ctx.fillText(label, x + 2, y + 140, 124); });
        galleries.push({ name: name + '-' + start + '.png', data: c.toDataURL() });
      }
      return { creaturePoseRoutes: entries.length, worldBindings: Object.keys(PAINTED.static).length, heldStates: Object.keys(PAINTED.held).length, carriedStates: Object.keys(PAINTED.carried).length, loadedImages: Object.keys(world.paintedWorldState()).length, failed: Object.entries(world.paintedWorldState()).filter(([,state]) => state !== 'ready'), galleries };
    });
    for (const { name, data } of result.galleries) fs.writeFileSync(path.join(__dirname, name), Buffer.from(data.split(',')[1], 'base64'));
    result.galleries = result.galleries.map(g => g.name);
    result.scope = 'Cold Chromium native loader objects on the title screen; complete declared creature pose and world/equipment request inventory. Contact sheets compose current native cached pictures; not game scenes, animation transitions, physical Safari or offline evidence.';
    result.errors = errors;
    fs.writeFileSync(path.join(__dirname, 'loaders.json'), JSON.stringify(result, null, 2) + '\n');
    if (errors.length || result.failed.length) throw Error(JSON.stringify({ errors, failed: result.failed }));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
