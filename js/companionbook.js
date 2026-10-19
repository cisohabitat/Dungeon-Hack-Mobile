// Companion discoveries outlast a run, just as the bestiary does.
export const COMPANIONS = {
  hound: { name: 'Hound', sprite: 'dog', lore: 'A scruffy brown hound with a frayed red collar. A meal and a little kindness can win its trust.', role: 'A sturdy fighting companion. With experience it learns Hamstring and Pack Hunter.' },
  wolf: { name: 'Wolf', sprite: 'wolf', lore: 'A lean grey wolf with amber eyes. In delves without a hound, it comes to a druid at the first stair.', role: 'A swift hunter that learns Pack Hunter and Savage as it travels beside you.' },
  goblin: { name: 'Goblin', sprite: 'scrag', lore: 'Freed from a cage, this sharp-eyed goblin offers clever fingers and a quieter step.', role: 'Picks locks, makes traps safe and helps with Dexterity checks. Learns Backstab and Scrounger.' },
  sellsword: { name: 'Sellsword', sprite: 'sellsword', lore: 'A scarred mercenary in a kettle hat, blue-grey brigandine and a red sash. Their loyalty has a price.', role: 'Armoured and hard-hitting. Learns Guard and Second Wind; asks for wages deep in a Long Delve.' },
  mender: { name: 'Mender', sprite: 'mender', lore: 'A tired healer in a grey-green hood, carrying herbs, bandages and an ash staff. Their last party went on without them.', role: 'Tends wounds between fights from a limited supply of herbs each floor. Learns Poultice and Field Dressing.' },
  renegade: { name: 'Renegade', sprite: 'renegade', lore: 'An amber-eyed dark elf cast out of the halls, wearing weathered leather and a grey-green cloak.', role: 'Fights with two blades and arrives blooded. Knows Sleep Poison and grows into a Kinslayer.' },
};
export const COMPANION_ENCOUNTERS = { stray: 'hound', caged: 'goblin', hire: 'sellsword', stray_healer: 'mender', exile: 'renegade' };
const KEY = 'deepdelve.companions';
const valid = id => typeof id === 'string' && Object.hasOwn(COMPANIONS, id);
/** Only known kind IDs are retained; saved content is never rendered as HTML. */
export function companionBook() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && valid(id)))] : [];
  } catch { return []; }
}
export function meetCompanion(id) {
  if (!valid(id)) return;
  const known = companionBook();
  if (known.includes(id)) return;
  try { localStorage.setItem(KEY, JSON.stringify([...known, id])); } catch { /* private browsing */ }
}
/** Recover evidence from older saves, without treating generated encounters as met. */
export function recoverCompanions(state) {
  if (!state) return;
  if (state.companion) meetCompanion(state.companion.kind || 'hound');
  if (Array.isArray(state.metEncounters)) for (const id of state.metEncounters) {
    if (typeof id === 'string' && Object.hasOwn(COMPANION_ENCOUNTERS, id)) meetCompanion(COMPANION_ENCOUNTERS[id]);
  }
}
