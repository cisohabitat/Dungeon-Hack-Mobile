// The published release and stamped commit, shared by the title and opt-in reports.
// Generated with npm run release:prepare; keep package/lock versions, build
// and offline cache together. See README.md for automatic release rules.
export const RELEASE_VERSION = '0.9.37';
// Internal offline readiness counter; players identify a deployment by commit.
export const BUILD_NUMBER = 52;
const sha = typeof document === 'undefined' ? '' : document.querySelector('meta[name="commit"]')?.getAttribute('content') || '';
export const COMMIT_ID = /^[a-f0-9]{40}$/.test(sha) ? sha.slice(0, 7) : 'local';
export const VERSION_ID = `${RELEASE_VERSION} (${COMMIT_ID})`;
// Recording compatibility is shared with the headless replay harness.
export const BUILD_ID = `${RELEASE_VERSION} (build ${BUILD_NUMBER})`;
