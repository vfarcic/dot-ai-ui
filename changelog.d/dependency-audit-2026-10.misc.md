## Dependency audit advisories cleared and CI runners pinned to Ubuntu 26.04

**Security.** Cleared the npm audit advisories that were failing the Security workflow on `main` and on every open dependency pull request. The UI server's rate limiter now uses a patched `ip-address` (10.7.3), which fixes IPv6 subnet classification bugs that could let an address be grouped outside its real range. The rest were in development tooling only: `axios` (1.20.0), `brace-expansion` (5.0.12), and `basic-ftp` (6.2.2, via an override because the upstream `get-uri` has not moved off the unpatched 5.x line yet). `npm audit` is clean again.

**CI.** Workflows now run on `ubuntu-26.04` explicitly instead of `ubuntu-latest`, ahead of GitHub moving that label to Ubuntu 26.04 from October 19, 2026.
