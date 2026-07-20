## Reject forged JWTs at the auth verification endpoint

`GET /api/v1/auth/verify` no longer trusts unsigned or forged JWTs. Previously any bearer token shaped like a JWT (containing a `.`) was accepted without signature or expiry verification, letting a forged `alg:none` (or empty-signature) token spoof the UI's authentication state. The endpoint now validates the presented token against the configured bearer token and returns `401` for anything else. Data access was never affected — the dot-ai backend already re-verifies tokens on every proxied request.
