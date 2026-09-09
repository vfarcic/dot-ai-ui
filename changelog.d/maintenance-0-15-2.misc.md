## Dependency, security, and test-infrastructure maintenance

A maintenance release with no user-facing behavior changes.

**Security.** Several npm audit advisories were cleared, including patched versions of `qs`, `@humanfs/node`, `shell-quote`, and `js-yaml` (GHSA-2883-xcg3-v3hh). `npm audit` is clean as of this release. Security scanning also moved into its own workflow with both push and scheduled triggers, so advisories are caught on a cadence rather than only on pull requests.

**Test infrastructure.** A Vitest unit-test layer was added alongside the existing Playwright E2E suite, with coverage from both plus the Express server merged into a single report and gated by a threshold in CI.

**Dependencies.** Routine updates across the toolchain, most notably the Vitest monorepo to v5.
