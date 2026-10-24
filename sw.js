// Minimal offline cache so the game works without a connection once loaded.
const CACHE = 'deepdelve-v110';
const ASSETS = [
  './img/held/cleric-mace-rest.png',
  './img/held/cleric-mace-drawback.png',
  './img/held/cleric-mace-windup.png',
  './img/held/cleric-mace-strike.png',
  './img/held/cleric-mace-cut.png',
  './img/held/cleric-mace-sweep.png',
  './img/held/cleric-mace-through.png',
  './img/held/cleric-mace-recover.png',
  './img/held/cleric-mace-return.png',
  './img/held/thief-shortsword-rest.png',
  './img/held/thief-shortsword-drawback.png',
  './img/held/thief-shortsword-windup.png',
  './img/held/thief-shortsword-strike.png',
  './img/held/thief-shortsword-cut.png',
  './img/held/thief-shortsword-sweep.png',
  './img/held/thief-shortsword-through.png',
  './img/held/thief-shortsword-recover.png',
  './img/held/thief-shortsword-return.png',
  './img/held/ranger-shortbow-rest.png',
  './img/held/ranger-shortbow-bowdraw.png',
  './img/held/ranger-shortbow-bowfull.png',
  './img/held/druid-spear-rest.png',
  './img/held/druid-spear-drive.png',
  './img/held/thief-dagger-rest.png',
  './img/held/thief-dagger-drawback.png',
  './img/held/thief-dagger-windup.png',
  './img/held/thief-dagger-strike.png',
  './img/held/thief-dagger-cut.png',
  './img/held/thief-dagger-sweep.png',
  './img/held/thief-dagger-through.png',
  './img/held/thief-dagger-recover.png',
  './img/held/thief-dagger-return.png',
  './img/held/fighter-battleaxe-rest.png',
  './img/held/fighter-battleaxe-drawback.png',
  './img/held/fighter-battleaxe-windup.png',
  './img/held/fighter-battleaxe-strike.png',
  './img/held/fighter-battleaxe-cut.png',
  './img/held/fighter-battleaxe-sweep.png',
  './img/held/fighter-battleaxe-through.png',
  './img/held/fighter-battleaxe-recover.png',
  './img/held/fighter-battleaxe-return.png',
  './img/held/cleric-hammer-rest.png',
  './img/held/cleric-hammer-drawback.png',
  './img/held/cleric-hammer-windup.png',
  './img/held/cleric-hammer-strike.png',
  './img/held/cleric-hammer-cut.png',
  './img/held/cleric-hammer-sweep.png',
  './img/held/cleric-hammer-through.png',
  './img/held/cleric-hammer-recover.png',
  './img/held/cleric-hammer-return.png',
  './img/held/fighter-greatsword-rest.png',
  './img/held/fighter-greatsword-drawback.png',
  './img/held/fighter-greatsword-windup.png',
  './img/held/fighter-greatsword-strike.png',
  './img/held/fighter-greatsword-cut.png',
  './img/held/fighter-greatsword-sweep.png',
  './img/held/fighter-greatsword-through.png',
  './img/held/fighter-greatsword-recover.png',
  './img/held/fighter-greatsword-return.png',

  './img/held/fighter-shield.png',
  './img/held/cleric-shield.png',
  './img/held/thief-buckler.png',
  './img/world/egg_clutch.webp',
  './img/world/dress_elf_shards.webp',
  './img/world/dress_flames.png',
  './img/world/dress_roots.webp',
  './img/world/merchant.webp',
  './img/world/barricade.webp',
  './img/world/cookpot.webp',
  './img/world/bones.webp',
  './img/world/pedlar.webp',
  './img/world/dress_crypt_lid.webp',
  './img/world/dwarf_forge.webp',
  './img/world/wyrmegg.webp',
  './img/world/dress_chest.webp',
  './img/world/exile.webp',
  './img/world/marshhide.webp',
  './img/world/spider_altar.webp',
  './img/world/dress_rubble.webp',
  './img/world/mapmaker.webp',
  './img/world/hireling.webp',
  './img/world/dress_remains_bones.webp',
  './img/world/runeshield.webp',
  './img/world/dress_anvil.webp',
  './img/world/dress_snare.png',
  './img/world/stray.webp',
  './img/world/dress_reed_bundle.webp',
  './img/world/bone_heap.webp',
  './img/world/kept_smith.webp',
  './img/world/wick.webp',
  './img/world/heart_dais.webp',
  './img/world/strongbox.webp',
  './img/world/dress_urn.webp',
  './img/world/shrine.webp',
  './img/world/chest.webp',
  './img/world/dress_remains_husk.webp',
  './img/world/lever_door.webp',
  './img/world/idol.webp',
  './img/world/pool.webp',
  './img/world/lastdelver.webp',
  './img/world/dwarfhammer.webp',
  './img/world/dress_remains_staves.webp',
  './img/world/prisoner.webp',
  './img/world/stray_healer.webp',
  './img/world/dress_crate.webp',
  './img/world/cage.webp',
  './img/world/handxbow.webp',
  './img/world/dress_candles.webp',
  './img/world/bookcase.webp',
  './img/world/anvil.webp',
  './img/world/fungus.webp',
  './img/world/dress_remains_shards.webp',
  './img/world/lampfolk_dark.webp',
  './img/world/forge_spirit.webp',
  './img/world/elvenchain.webp',
  './img/world/mule.webp',
  './img/world/wisp.webp',
  './img/world/dress_bones.webp',
  './img/world/runestone.webp',
  './img/world/rubble.webp',
  './img/world/ogre_sleep.webp',
  './img/world/dress_shackles.webp',
  './img/world/dress_iron_scrap.webp',
  './img/world/goblin_hurt.webp',
  './img/world/dress_barrel.webp',
  './img/world/duelist_ghost.webp',
  './img/world/dress_ripple.png',
  './img/world/dress_mushrooms.webp',
  './img/world/dwarfplate.webp',
  './img/world/mirror.webp',
  './img/world/heartwell.webp',
  './img/world/goblin_toll.webp',
  './img/world/silk_larder.webp',
  './img/world/well.webp',
  './img/world/dress_oilcask.webp',
  './img/world/statue.webp',
  './img/materials/halls_torch0.png',
  './img/materials/old_forges_wall.png',
  './img/materials/halls_stairsDown.png',
  './img/materials/crimson_crypts_ceiling.png',
  './img/materials/sunless_marsh_wall.png',
  './img/materials/halls_fountain.png',
  './img/materials/mossy_depths_ceiling.png',
  './img/materials/sunless_marsh_floor.png',
  './img/materials/grey_hold_floor.png',
  './img/materials/halls_ceil3.png',
  './img/materials/halls_torch1.png',
  './img/materials/halls_floor2.png',
  './img/materials/drowned_halls_wall.png',
  './img/materials/obsidian_sanctum_wall.png',
  './img/materials/warrens_floor.png',
  './img/materials/obsidian_sanctum_floor.png',
  './img/materials/halls_fallen.png',
  './img/materials/halls_floor5.png',
  './img/materials/blue_vaults_ceiling.png',
  './img/materials/halls_torch2.png',
  './img/materials/drowned_halls_ceiling.png',
  './img/materials/halls_ceil1.png',
  './img/materials/crimson_crypts_floor.png',
  './img/materials/halls_wallCracked.png',
  './img/materials/brown_catacombs_floor.png',
  './img/materials/grey_hold_wall.png',
  './img/materials/halls_floor3.png',
  './img/materials/brown_catacombs_wall.png',
  './img/materials/dark_elf_halls_ceiling.png',
  './img/materials/blue_vaults_wall.png',
  './img/materials/halls_wallDamp.png',
  './img/materials/mossy_depths_wall.png',
  './img/materials/ossuary_wall.png',
  './img/materials/grey_halls_floor.png',
  './img/materials/mossy_depths_floor.png',
  './img/materials/drowned_halls_floor.png',
  './img/materials/halls_door.png',
  './img/materials/ossuary_ceiling.png',
  './img/materials/halls_fountainDry.png',
  './img/materials/halls_ceil2.png',
  './img/materials/grey_hold_ceiling.png',
  './img/materials/warrens_ceiling.png',
  './img/materials/grey_halls_ceiling.png',
  './img/materials/obsidian_sanctum_ceiling.png',
  './img/materials/halls_floor1.png',
  './img/materials/dark_elf_halls_floor.png',
  './img/materials/halls_rockPillar.png',
  './img/materials/halls_stairsUpBack.png',
  './img/materials/old_forges_floor.png',
  './img/materials/dark_elf_halls_wall.png',
  './img/materials/warrens_wall.png',
  './img/materials/brown_catacombs_ceiling.png',
  './img/materials/halls_floor6.png',
  './img/materials/crimson_crypts_wall.png',
  './img/materials/sunless_marsh_ceiling.png',
  './img/materials/halls_floor4.png',
  './img/materials/ossuary_floor.png',
  './img/materials/halls_wallB.png',
  './img/materials/halls_rock.png',
  './img/materials/halls_stairsUp.png',
  './img/materials/halls_stairsDownBack.png',
  './img/materials/halls_pillar.png',
  './img/materials/grey_halls_wall.png',
  './img/materials/old_forges_ceiling.png',
  './img/materials/halls_cellDoor.png',
  './img/materials/blue_vaults_floor.png',
  './img/held/fighter-longsword-drawback.png',
  './img/held/fighter-longsword-windup.png',
  './img/held/fighter-longsword-cut.png',
  './img/held/runeshield-fighter.png',
  './img/held/ranger-longbow-rest.png',
  './img/held/fighter-longsword-through.png',
  './img/held/ranger-longbow-bowdraw.png',
  './img/held/fighter-longsword-rest.png',
  './img/held/fighter-longsword-sweep.png',
  './img/held/mage-staff-rest-two.png',
  './img/held/runeshield-cleric.png',
  './img/held/fighter-longsword-recover.png',
  './img/held/ranger-longbow-bowfull.png',
  './img/held/mage-staff-channel-one.png',
  './img/held/fighter-longsword-return.png',
  './img/held/mage-staff-drive-two.png',
  './img/held/mage-staff-rest-one.png',
  './img/held/fighter-longsword-strike.png',
  './img/effects/fire_1.png',
  './img/effects/frost_0.png',
  './img/effects/frost_2.png',
  './img/effects/fire_2.png',
  './img/effects/fire_3.png',
  './img/effects/frost_1.png',
  './img/effects/frost_3.png',
  './img/effects/fire_0.png',
  './js/paintedcatalog.js',
  './js/paintedworld.js',
  './img/creatures/shade_spellblade.webp',
  './img/creatures/shade_thief.webp',
  './img/creatures/shade_mage.webp',
  './img/creatures/shade_cleric.webp',
  './img/creatures/shade_ranger.webp',
  './img/creatures/shade_druid.webp',
  './img/creatures/dog.webp',
  './img/creatures/wolf.webp',
  './img/creatures/scrag.webp',
  './img/creatures/sellsword.webp',
  './img/creatures/mender.webp',
  './img/creatures/renegade.webp',
  './img/creatures/mimic_barrel.webp',
  './img/creatures/heartforged_open.webp',
  './img/creatures/heartforged_whitehot.webp',
  './img/creatures/warlord_throne.webp',
  './img/creatures/warlord_spear.webp',
  './img/creatures/mender-heal.webp',

  './img/creatures/troll.webp',
  './img/creatures/minotaur.webp',
  './img/creatures/kobold.webp',
  './img/creatures/archer.webp',
  './img/creatures/basilisk.webp',
  './img/creatures/acolyte.webp',
  './img/creatures/moth.webp',
  './img/creatures/thornhog.webp',
  './img/creatures/imp.webp',
  './img/creatures/cutpurse.webp', './img/creatures/lookout.webp', './img/creatures/hexer.webp', './img/creatures/pikeman.webp', './img/creatures/quillback.webp', './img/creatures/drowned.webp', './img/creatures/emberling.webp', './img/creatures/mimic.webp', './img/creatures/lich.webp', './img/creatures/heartforged.webp', './img/creatures/warlord.webp',
  './img/creatures/shade.webp',
  './img/creatures/grisk.webp',
  './img/creatures/vessra.webp',
  './img/creatures/ushgar.webp',
  './img/creatures/morrow.webp',
  './img/creatures/orla.webp',
  './img/creatures/gorrum.webp',
  './img/creatures/vaelith.webp',
  './img/creatures/hissra.webp',
  './img/creatures/durgrim.webp',
  './img/creatures/rat.webp',
  './img/creatures/bat.webp',
  './img/creatures/spider.webp',
  './img/creatures/goblin.webp',
  './img/creatures/skeleton.webp',
  './img/creatures/zombie.webp',
  './img/creatures/orc.webp',
  './img/creatures/ghoul.webp',
  './img/creatures/wraith.webp',
  './img/creatures/ogre.webp',
  './img/creatures/hound.webp',
  './img/creatures/wyrm.webp',
  './img/creatures/lizardfolk.webp',
  './img/creatures/dwarf_arbalest.webp',
  './img/creatures/slime.webp',
  './img/creatures/rustmaw.webp',
  './img/creatures/skarrow.webp',
  './img/creatures/drow_mage.webp',
  './img/creatures/grey_dwarf.webp',
  './img/creatures/lizard_shaman.webp',
  './img/creatures/eyeless.webp',
  './img/creatures/puffcap.webp',

  './js/paintedcreatures.js', './img/creatures/drow_warrior.webp',
  './js/heldview.js', './js/collectionview.js',
  './js/hiddenhero.js', './js/spellblade.js', './img/portraits/spellblade.webp',
  './js/packmemory.js', './js/geartools.js', './js/settracker.js', './js/delveguide.js', './js/maplandmarks.js',
  './js/itemdisplay.js',
  './js/relicart.js',
  './img/relics/last_gate.webp',
  './img/relics/mercys_oath.webp',
  './img/relics/bloodstar.webp',
  './img/relics/nightglass.webp',
  './img/relics/horizon.webp',
  './img/relics/elderseed.webp',
  './img/relics/grimtooth.webp',
  './img/relics/whisper.webp',
  './img/relics/thirst.webp',
  './img/relics/dawnbringer.webp',
  './img/relics/penitent.webp',
  './img/relics/ogres_toll.webp',
  './img/relics/ninth_circle.webp',
  './img/relics/emberwood.webp',
  './img/relics/vashti.webp',
  './img/relics/heartseeker.webp',
  './img/relics/rustwarden.webp',
  './img/relics/shadowskin.webp',
  './img/relics/briarcoat.webp',
  './img/relics/kests_bulwark.webp',
  './img/relics/sisters_buckler.webp',
  './img/relics/hearthwool.webp',
  './img/relics/archivist.webp',
  './img/relics/midnight_folio.webp',
  './img/relics/sparkglass.webp',
  './img/relics/boarspear.webp',
  './img/relics/galewind.webp',
  './img/relics/sextons_locket.webp',
  './img/relics/oakheart.webp',
  './img/relics/mossmantle.webp',
  './img/relics/cinder_ring.webp',
  './img/relics/spider_pendant.webp',
  './img/relics/thane_ring.webp',
  './img/relics/hissra_tooth.webp',
  './img/relics/warchiefs_knuckle.webp',
  './img/relics/bastion.webp',
  './img/relics/red_harvest.webp',
  './img/relics/sunhammer.webp',
  './img/relics/lantern_mercy.webp',
  './img/relics/cinderheart.webp',
  './img/relics/rimebound.webp',
  './img/relics/last_word.webp',
  './img/relics/motley.webp',
  './img/relics/farstrider.webp',
  './img/relics/thornbinder.webp',
  './img/relics/moonbound.webp',
  './img/relics/heartroot.webp',

  './js/companionbook.js', './js/companionsview.js',
  './img/companions/hound.webp', './img/companions/wolf.webp', './img/companions/goblin.webp', './img/companions/sellsword.webp', './img/companions/mender.webp', './img/companions/renegade.webp',
  './js/heroart.js', './js/creatureidentity.js',
  './js/regionart.js', './js/regionalprops.js', './js/arcanefx.js',
  './js/puzzles.js', './js/puzzledata.js', './js/puzzleview.js',
  './replay.html', './js/recording.js', './js/replayview.js', './js/replaycontrols.js',
  './js/release.js', './js/savecheck.js', './js/offline.js',
  './js/bestiaryart.js',
  './img/bestiary/rat.webp', './img/bestiary/bat.webp', './img/bestiary/slime.webp', './img/bestiary/spider.webp',
  './img/bestiary/goblin.webp', './img/bestiary/skeleton.webp', './img/bestiary/zombie.webp', './img/bestiary/orc.webp',
  './img/bestiary/ghoul.webp', './img/bestiary/wraith.webp', './img/bestiary/ogre.webp', './img/bestiary/troll.webp',
  './img/bestiary/minotaur.webp', './img/bestiary/kobold.webp', './img/bestiary/archer.webp', './img/bestiary/basilisk.webp',
  './img/bestiary/rustmaw.webp', './img/bestiary/acolyte.webp', './img/bestiary/moth.webp', './img/bestiary/thornhog.webp',
  './img/bestiary/imp.webp', './img/bestiary/cutpurse.webp', './img/bestiary/lookout.webp', './img/bestiary/hexer.webp',
  './img/bestiary/pikeman.webp', './img/bestiary/hound.webp', './img/bestiary/quillback.webp', './img/bestiary/wyrm.webp',
  './img/bestiary/drowned.webp', './img/bestiary/eyeless.webp', './img/bestiary/drow_warrior.webp', './img/bestiary/drow_mage.webp',
  './img/bestiary/grey_dwarf.webp', './img/bestiary/dwarf_arbalest.webp', './img/bestiary/lizardfolk.webp', './img/bestiary/lizard_shaman.webp',
  './img/bestiary/emberling.webp', './img/bestiary/mimic.webp', './img/bestiary/puffcap.webp', './img/bestiary/shade.webp',
  './img/bestiary/grisk.webp', './img/bestiary/vessra.webp', './img/bestiary/ushgar.webp', './img/bestiary/morrow.webp',
  './img/bestiary/orla.webp', './img/bestiary/gorrum.webp', './img/bestiary/skarrow.webp', './img/bestiary/vaelith.webp',
  './img/bestiary/hissra.webp', './img/bestiary/durgrim.webp',
  './', './index.html', './css/style.css', './manifest.json', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './img/keyart-portrait.webp', './img/keyart-landscape.webp', './sound/index.json',
  './js/package.json', './js/portraits.js', './js/bossart.js', './js/meleeview.js', './js/elementfx.js',
  './img/bosses/lich.webp', './img/bosses/warlord.webp', './img/bosses/heartforged.webp',
  './img/portraits/fighter.webp', './img/portraits/thief.webp', './img/portraits/mage.webp', './img/portraits/cleric.webp', './img/portraits/ranger.webp', './img/portraits/druid.webp',
  './js/narration.js', './js/storyvoice.js', './js/voicelines.js', './sound/narration/catalog.json',
  './js/rng.js', './js/data.js', './js/parts.js', './js/painter.js', './js/creatures.js', './js/folk.js', './js/props.js', './js/champions.js', './js/itemart.js', './js/namedart.js', './js/dressing.js', './js/heldart.js', './js/encounters.js', './js/relics.js', './js/mythicdata.js', './js/mythics.js', './js/rooms.js', './js/looks.js', './js/prelude.js', './js/progress.js', './js/daily.js', './js/walldecor.js', './js/assets.js', './js/dungeon.js', './js/spellfx.js', './js/overlay.js', './js/renderer.js', './js/samples.js', './js/sound.js', './js/music.js', './js/foes.js', './js/bosses.js', './js/trader.js', './js/companion.js', './js/bounty.js', './js/wild.js', './js/elements.js', './js/meet.js', './js/testing.js', './js/savecode.js', './js/saving.js', './js/chronicle.js', './js/powers.js', './js/pacing.js', './js/motion.js', './js/combat.js', './js/items.js', './js/scenes.js', './js/curses.js', './js/fallen.js', './js/paths.js', './js/legends.js', './js/combos.js', './js/lairs.js', './js/threads.js', './js/telemetry.js', './js/game.js', './js/uikit.js', './js/sharecard.js', './js/hall.js', './js/pagesview.js', './js/tips.js', './js/pad.js', './js/access.js', './js/weekly.js', './js/titlescene.js', './js/shopview.js', './js/choices.js', './js/pack.js', './js/mapview.js', './js/endscreen.js', './js/herosheet.js', './js/createextras.js', './js/titlemenu.js', './js/createview.js', './js/ui.js', './js/main.js',
];
// Core installation must finish before any optional recording is fetched.
// A message event keeps downloads alive without holding activation or play.
const VOICE_READY = './sound/narration/offline-ready';
const ownCache = name => /^deepdelve-v\d+$/.test(name);
let voiceJob = null;
let offlineState = { type: 'offline-state', build: 0, voice: 'pending', done: 0, total: 0 };
async function announce() {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) client.postMessage({ ...offlineState });
}
async function tidyCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== CACHE && ownCache(k)).map(k => caches.delete(k)));
}
async function cacheVoices() {
  const c = await caches.open(CACHE);
  try {
    const release = await c.match('./js/release.js');
    offlineState.build = Number((await release.text()).match(/BUILD_NUMBER = (\d+);/)[1]);
    const manifest = await c.match('./sound/narration/catalog.json');
    const { clips } = await manifest.json();
    const paths = Object.keys(clips).filter(id => /^(?:line-[a-f0-9]{8}|prologue)$/.test(id))
      .sort((a, b) => a === 'prologue' ? -1 : b === 'prologue' ? 1 : a.localeCompare(b))
      .flatMap(id => ['ogg', 'm4a'].map(ext => `./sound/narration/${id}.${ext}`));
    offlineState.total = paths.length;
    if (!paths.length) throw new Error('No recordings listed');
    if (!(await c.match(VOICE_READY))) {
      const missing = [];
      for (const path of paths) if (!(await c.match(path))) missing.push(path);
      offlineState.done = paths.length - missing.length;
      offlineState.voice = 'downloading'; await announce();
      // Resume only missing files, including after a tab or worker was closed.
      // A failed batch leaves its successful files intact for the next attempt.
      for (let i = 0; i < missing.length; i += 4) {
        const batch = await Promise.allSettled(missing.slice(i, i + 4).map(async path => {
          const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 15000);
          try {
            const response = await fetch(path, { signal: abort.signal });
            if (response.status !== 200 || response.redirected) throw new Error('Recording unavailable');
            await c.put(path, response); offlineState.done++;
          } finally { clearTimeout(timer); }
        }));
        await announce();
        if (batch.some(r => r.status === 'rejected')) throw new Error('Recording download paused');
      }
      await c.put(VOICE_READY, new Response('ready'));
    }
    offlineState.done = paths.length; offlineState.voice = 'ready';
    await announce();
    // Keep the previous recordings available until the new copy is complete.
    await tidyCaches().catch(() => {});
  } catch {
    offlineState.voice = 'paused'; await announce();
  }
}
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('message', e => {
  if (e.data?.type !== 'offline-prepare' || !e.source?.id) return;
  if (!voiceJob) voiceJob = cacheVoices().finally(() => { voiceJob = null; });
  e.waitUntil(Promise.all([voiceJob, announce()]));
});
// Phone media players ask for parts of a recording, even on their first play.
// Serve those parts from the installed copy instead of downloading it again.
async function recordedVoice(request) {
  const cache = await caches.open(CACHE);
  let cached = await cache.match(request);
  if (!cached) {
    const older = (await caches.keys()).filter(k => k !== CACHE && ownCache(k)).reverse();
    for (const name of older) {
      cached = await (await caches.open(name)).match(request);
      if (cached) break;
    }
  }
  if (!cached) {
    const response = await fetch(request);
    if (response.status === 200 && !response.redirected) cache.put(request, response.clone()).catch(() => {});
    return response;
  }
  const range = request.headers.get('Range');
  if (!range) return cached;
  const bytes = await cached.arrayBuffer(), size = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const start = match && match[1] ? Number(match[1]) : match && match[2] ? Math.max(0, size - Number(match[2])) : size;
  const end = match && match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  const headers = new Headers(cached.headers);
  headers.delete('Content-Encoding');
  headers.set('Accept-Ranges', 'bytes'); headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // the sound pack's sounds are kept as they are heard, but never its masters,
  // nor what its listening page (sound/listen.html) fetches to be tried
  const url = new URL(e.request.url), path = url.pathname;
  // Reports and live statistics keep the server's own privacy/cache policy.
  if (url.origin !== self.location.origin || /^\/api(?:\/|$)/.test(path)) return;
  if (path.startsWith('/sound/masters/') || path.startsWith('/sound/listen') || /\/sound\/listen/.test(e.request.referrer || '')) return;
  if (/\/sound\/narration\/(?:line-[a-f0-9]{8}|prologue)\.(?:ogg|m4a)$/.test(path)) {
    e.respondWith(recordedVoice(e.request)); return;
  }
  e.respondWith(
    fetch(e.request).then(res => {
      // only a good answer is kept: a server's error page saved over the game
      // would be all there was offline, and a redirected one (the host sends
      // /index.html on to /) is refused by the browser as a page
      if (res.ok && !res.redirected) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); }
      return res;
    // offline, a page asked for by any address (a query, /index.html) is the game's own root
    }).catch(async () => {
      const cache = await caches.open(CACHE), r = await cache.match(e.request);
      return r && !r.redirected ? r : e.request.mode === 'navigate' ? cache.match('./') : r;
    })
  );
});
