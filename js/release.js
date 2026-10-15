// The published release and its build, shared by the title and opt-in reports.
// Keep the release version in step with package.json; increment the build for
// each published build, even when the release version stays the same.
export const RELEASE_VERSION = '1.0.0';
export const BUILD_NUMBER = 3;
export const BUILD_ID = `${RELEASE_VERSION} (build ${BUILD_NUMBER})`;
