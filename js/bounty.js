// Jobs from the traders. A trader offers one job for the floor below: slay
// the champion that keeps a lair there, cull its creatures, or find a
// satchel one of the Lampfolk lost there. It is for that floor only: leave
// it with the job undone and the job is lost. The next trader you meet pays
// for a job done, in gold and a flask or a scroll. Each job is chosen from the
// seed's own dice, so a floor's map and monsters never move for it. What it
// borrows from the game comes through K, as the traders' and monsters' do.
import { Rng } from './rng.js';
import { MONSTERS } from './data.js';

// what a job may pay besides the gold
const REWARDS = [['oil_fire', 3], ['oil_silver', 3], ['oil_venom', 2], ['potion_xheal', 3], ['scroll_uncurse', 1]];

/** @param {any} K */
export function makeBounty(K) {
  /**
   * The job a trader on this floor offers, or null (none for the floor that
   * holds the lich, nor below the last).
   * @param {number} depth
   * @returns {import('./types.js').Bounty|null}
   */
  function plan(depth) {
    const G = K.G, levels = G.opts.levels || 8, at = depth + 1;
    if (at >= levels) return null;
    const rng = new Rng(`${G.seed}|bounty|${depth}`);
    const named = K.namedPlan(G.seed, levels, G.route || undefined)[at];
    const kind = named ? 'slay' : rng.chance(0.5) ? 'cull' : 'fetch';
    const reward = { gold: 20 + 25 * at, t: rng.weighted(REWARDS) };
    return { kind, depth: at, from: depth, need: kind === 'cull' ? 6 + Math.floor(at / 2) : 1, got: 0, reward };
  }
  /** The job in words, for the trader's row, the Hero sheet and the log. */
  function words(b) {
    const where = `on floor ${b.depth}`;
    if (b.kind === 'slay') return b.name ? `Slay ${b.name} ${where}` : `Slay the champion that keeps a lair ${where}`;
    if (b.kind === 'cull') return `Kill ${b.need} of the creatures ${where}`;
    return `Find the satchel one of the Lampfolk lost ${where}`;
  }
  const payWords = b => `${b.reward.gold} gold and ${K.aThing(K.itemName({ t: b.reward.t, q: 1, e: 0 }).toLowerCase())}`;
  /** How far along it is, for the status line. */
  function progress(b) {
    if (b.done) return 'done: a trader will pay';
    if (b.kind === 'cull') return `${b.got} of ${b.need} slain`;
    if (b.kind === 'slay') return b.name ? `slay ${b.name}` : 'slay the champion';
    return 'find the satchel';
  }

  /** The trader's row among its services: the job, or why there is none. */
  function service() {
    const G = K.G, b = G.bounty;
    if (b && !b.done) return { id: 'bounty', label: 'A job for the floor below', detail: `You have one already: ${words(b).toLowerCase()}.`, price: 0, why: 'You have a job already.' };
    const offer = plan(G.depth);
    if (!offer) return null;
    if (G.bountyTaken && G.bountyTaken[G.depth]) return null;
    return { id: 'bounty', label: 'A job for the floor below', detail: `${words(offer)}. It pays ${payWords(offer)}, at the next trader you meet. Leave that floor with it undone and it is lost.`, price: 0, why: null };
  }
  /** Take the job this floor's trader offers. */
  function take() {
    const G = K.G, offer = plan(G.depth);
    if (!offer || (G.bounty && !G.bounty.done)) return false;
    G.bounty = offer;
    G.bountyTaken = { ...(G.bountyTaken || {}), [G.depth]: 1 };
    K.log(`"${words(offer)}, and come to one of us after. We pay what we promise."`, 'info');
    return true;
  }
  /** A trader is met: a job done is paid for. */
  function pay() {
    const G = K.G, b = G.bounty;
    if (!b || !b.done || G.depth <= b.from) return;
    const p = K.P();
    p.gold += b.reward.gold;
    const it = { t: b.reward.t, q: 1, e: 0 };
    G.known[it.t] = 1;
    const kept = K.giveItem(it);
    if (!kept) (K.lvl().items[K.key(p.x, p.y)] = K.lvl().items[K.key(p.x, p.y)] || []).push(it);
    // the satchel goes back to its own people
    p.inv = p.inv.filter(i => i.t !== 'satchel');
    G.bounty = null;
    G.stats.bounties = (G.stats.bounties || 0) + 1;
    K.log(`"The job is done, and word came down ahead of you." The trader pays ${payWords(b)}${kept ? '' : ', set down at your feet: your pack is full'}.`, 'good');
    K.emit('inv'); K.emit('stats');
  }
  /** Arriving on a floor: the job's floor begins it; any other floor with it undone loses it. */
  function arrive(L) {
    const G = K.G, b = G.bounty;
    if (!b || b.done) return;
    if (G.depth !== b.depth) { lost(); return; }
    if (b.started) return;
    b.started = true;
    if (b.kind === 'slay') {
      const champ = L.monsters.find(m => MONSTERS[m.id].named);
      if (champ) { b.target = champ.id; b.name = MONSTERS[champ.id].name; }
      else { b.kind = 'cull'; b.need = 6 + Math.floor(b.depth / 2); }
    }
    if (b.kind === 'fetch') placeSatchel(L);
    K.log(`The job the trader gave you is here: ${words(b).toLowerCase()}.`, 'info');
  }
  /** The job lost: the hero left its floor with it undone. */
  function lost() {
    const G = K.G, b = G.bounty;
    if (!b || b.done) return;
    G.bounty = null;
    K.log(`You left floor ${b.depth} with the trader's job undone. Word travels in the dark: there is no pay for it now.`, 'bad');
    K.emit('stats');
  }
  /** The satchel, where the stairs are farthest. */
  function placeSatchel(L) {
    const far = K.farthestFloor(L);
    if (far) (L.items[far] = L.items[far] || []).push({ t: 'satchel', q: 1, e: 0 });
  }
  /** Something fell on this floor. */
  function killed(m) {
    const G = K.G, b = G.bounty;
    if (!b || b.done || G.depth !== b.depth) return;
    if (b.kind === 'cull') b.got++;
    else if (b.kind === 'slay' && m.id === b.target) b.got = 1;
    else return;
    if (b.got >= b.need) finish();
    K.emit('stats');
  }
  /** The satchel was picked up. */
  function found() {
    const G = K.G, b = G.bounty;
    if (b && !b.done && b.kind === 'fetch' && G.depth === b.depth) finish();
  }
  function finish() {
    const b = K.G.bounty;
    b.done = true;
    K.log(`Job done: ${words(b).toLowerCase()}. The next trader you meet will pay ${payWords(b)}.`, 'good');
  }
  /** For the Hero sheet. */
  function note() {
    const b = K.G && K.G.bounty;
    if (!b) return '';
    return `A job from the traders: ${words(b).toLowerCase()} (${progress(b)}). It pays ${payWords(b)}.`;
  }
  /** For the status line: shown on the job's floor, and once it is done. */
  function chip() {
    const G = K.G, b = G && G.bounty;
    if (!b || (!b.done && G.depth !== b.depth)) return '';
    return `Job: ${progress(b)}`;
  }
  return { plan, words, service, take, pay, arrive, lost, killed, found, note, chip };
}
