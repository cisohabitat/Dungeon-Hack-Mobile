// A save code: the whole saved game, squeezed and written out as plain text,
// so a hero can be carried to another phone or browser by copy and paste (or
// as a small file). A deep run is a couple of hundred kilobytes of JSON, and
// most of it is the same few tiles over and over: gzip takes it to a tenth.
// A browser that cannot squeeze writes the JSON out as it is, only longer.

const SQUEEZED = 'DD1.', PLAIN = 'DD0.';
// Check both sides of gzip: a small shared code can expand far beyond a phone's memory.
export const SAVE_BYTES = 16 * 1024 * 1024;
export const CODE_BYTES = 24 * 1024 * 1024;
const tooLarge = () => new Error('That save code is too large for this browser to open safely.');

/** Bytes to base64, a slice at a time: one call on the lot overflows the stack. */
function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(s);
}
function fromB64(text) {
  const s = atob(text), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
/** @param {Uint8Array} bytes @param {TransformStream} through */
async function pipe(bytes, through, limit = SAVE_BYTES) {
  const stream = new Blob([/** @type {BlobPart} */ (/** @type {unknown} */ (bytes))]).stream().pipeThrough(through);
  const reader = stream.getReader(), chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw tooLarge(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}

/** @param {string} json the saved game @returns {Promise<string>} */
async function encodeSave(json) {
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > SAVE_BYTES) throw tooLarge();
  if (typeof CompressionStream === 'function') return SQUEEZED + toB64(await pipe(bytes, new CompressionStream('gzip'), CODE_BYTES));
  return PLAIN + toB64(bytes);
}

/**
 * The saved game a code holds. Throws with words a player can read: what was
 * pasted is not a code at all, or is one cut short on the way.
 * @param {string} text @returns {Promise<string>}
 */
async function decodeSave(text) {
  if (typeof text !== 'string') throw new Error('That is not a Deepdelve save code.');
  if (text.length > CODE_BYTES) throw tooLarge();
  // a code pasted from a message often picks up line breaks and spaces
  const t = String(text || '').replace(/\s+/g, '');
  if (!t.startsWith(SQUEEZED) && !t.startsWith(PLAIN)) throw new Error('That is not a Deepdelve save code.');
  try {
    const bytes = fromB64(t.slice(SQUEEZED.length));
    if (t.startsWith(PLAIN)) {
      if (bytes.length > SAVE_BYTES) throw tooLarge();
      return new TextDecoder().decode(bytes);
    }
    if (typeof DecompressionStream !== 'function') throw new Error('old');
    return new TextDecoder().decode(await pipe(bytes, new DecompressionStream('gzip')));
  } catch (e) {
    if (e && e.message === tooLarge().message) throw e;
    if (e && e.message === 'old') throw new Error('This browser is too old to open that code.');
    throw new Error('That code is not whole: it may have been cut short when it was copied.');
  }
}

export { encodeSave, decodeSave };
