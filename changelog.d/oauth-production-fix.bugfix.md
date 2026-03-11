## OAuth Login in Production

OAuth login now works correctly behind load balancers and gateways. Previously, the OAuth callback URL was hardcoded to `http://localhost:3000` at startup, causing login redirects to fail in production deployments.

The callback URL is now derived from the actual request's protocol and host headers, eliminating the need for the `PUBLIC_BASE_URL` environment variable. Express `trust proxy` is enabled in production so `X-Forwarded-Proto` and `X-Forwarded-Host` from load balancers are respected. When the dot-ai server restarts and forgets registered OAuth clients, the UI automatically re-registers instead of requiring a pod restart.
