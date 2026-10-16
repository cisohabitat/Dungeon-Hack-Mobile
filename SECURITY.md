# Security

Deepdelve is a browser game with no accounts, payments or player authentication.
The server receives optional telemetry and publishes aggregate statistics. Local
progress, saves and replay outcomes are player-controlled and are not proof of
an honest score. Save codes and browser storage are not encrypted.

## Reporting a vulnerability

Use the repository's [private vulnerability reporting option](https://github.com/cisohabitat/Dungeon-Hack-Mobile/security/advisories/new) if it is available.
Otherwise open an issue asking the maintainer for a private contact channel,
without including exploit details.
Do not post credentials, personal data or an active exploit against the live
service in a public issue. Include the affected build, reproduction steps and
expected impact, using a local copy and synthetic data where possible.

## Boundaries to preserve

- Validate imported/local save structure before changing live state. Bound both
  encoded input and decompressed output; reject dangerous prototype keys and
  unreasonable dimensions or nesting. Failed imports must preserve existing saves.
- Treat saved strings and numeric-looking fields as input when rendering. Escape
  HTML and attribute quotes; use `textContent` for plain text. Keep the CSP free
  of inline script and dynamic-code execution exceptions.
- Keep Redis tokens in server environment variables. Never ship them in files,
  browser modules, logs or API responses. Error details remain private; public
  statistics contain counts and crash signatures, including for legacy counters.
  Git and deployment exclusions cover local environment and private-key files.
- Telemetry is opt-in and unauthenticated. Field/size limits, browser-origin
  checks, rate limits and bounded retention reduce abuse; they cannot stop a
  determined distributed sender or establish that a run is genuine.
- The per-address throttle assumes Vercel overwrites `x-forwarded-for`. Another
  host must provide an equivalent trusted proxy boundary. The local development
  server binds only to loopback; do not use it as a public production server.
- API and cross-origin responses stay out of the game service worker's cache.
  Vercel excludes development tests and tools from deployment.

## Verification and operations

`npm run test:security` exercises adversarial imports, decompression, local file
boundaries and telemetry with a mocked store. Browser security tests verify
markup handling and offline API isolation. `npm audit` checks known dependency
advisories; it is a point-in-time check, not a guarantee against unknown issues.
Imported replay context is removed before persistence, so a reload cannot make
an imported recording trusted. Exported save codes omit the local recording and
its unrelated starting memories while preserving the browser's own replay.

Protect the GitHub/Vercel/Upstash accounts with MFA and least privilege. Monitor
store usage, set service spending limits, rotate credentials after suspected
exposure, and keep supported Node/browser tooling current. These account-side
settings require separate verification; passing repository tests does not prove
they are configured.

Latest source review: [16 October 2026](docs/SECURITY-2026-10-16.md).
