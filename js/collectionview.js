/** Offer an art gallery alongside complete field notes, without discovering entries.
 * @param {HTMLElement} root
 * @param {string} selector
 */
export function bindCollectionGallery(root, selector) {
  const grid = root.querySelector(selector);
  if (!grid) return;
  const toolbar = document.createElement('div');
  toolbar.className = 'collection-layout';
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', 'Collection layout');
  toolbar.innerHTML = '<button type="button" data-collection-layout="notes" aria-pressed="true">Field notes</button><button type="button" data-collection-layout="gallery" aria-pressed="false">Gallery</button>';
  grid.before(toolbar);
  for (const card of grid.children) {
    if (card.classList.contains('unmet') || card.classList.contains('unfound')) continue;
    const text = card.querySelector(':scope > div');
    const heading = text?.querySelector('h3');
    if (!text || !heading) continue;
    const notes = document.createElement('details');
    notes.className = 'collection-notes';
    notes.open = true;
    const summary = document.createElement('summary');
    summary.textContent = 'Lore & statistics';
    summary.setAttribute('aria-label', `Lore and statistics for ${heading.textContent}`);
    notes.append(summary);
    for (const node of [...text.childNodes]) if (node !== heading) notes.append(node);
    text.append(notes);
  }
  toolbar.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const gallery = target.dataset.collectionLayout === 'gallery';
    grid.classList.toggle('collection-gallery', gallery);
    for (const button of toolbar.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button === target));
    for (const notes of grid.querySelectorAll('details.collection-notes')) /** @type {HTMLDetailsElement} */ (notes).open = !gallery;
  });
}
