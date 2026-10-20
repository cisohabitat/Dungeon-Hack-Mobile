// A device-local Easter egg, not an authentication boundary or a gameplay aid.
const KEY = 'deepdelve.wayfarer';
let taps = 0;
export const wayfarerOpen = () => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
};
export function wayfarerTap() {
  if (wayfarerOpen()) return true;
  if (++taps < 5) return false;
  taps = 0;
  try { localStorage.setItem(KEY, '1'); return true; } catch { return false; }
}
export const visibleClasses = table => Object.keys(table).filter(id => !table[id].hidden || wayfarerOpen());
