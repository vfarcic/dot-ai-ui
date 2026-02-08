## Ingress and Gateway API Timeout Defaults

Ingress and Gateway API HTTPRoute resources now include timeout defaults (10 minutes) to prevent 504 errors during long-running AI operations such as query, remediate, operate, and recommend.

The Ingress template defaults to nginx timeout annotations (`proxy-read-timeout` and `proxy-send-timeout`). For other ingress controllers (Traefik, HAProxy, AWS ALB), override `ingress.annotations` with the appropriate controller-specific settings — examples are documented in values.yaml and the setup guide. Gateway API HTTPRoutes now include `timeouts.request` and `timeouts.backendRequest` fields, configurable via `gateway.timeouts.request` and `gateway.timeouts.backendRequest` Helm values.

See the [Kubernetes Setup Guide](https://devopstoolkit.ai/docs/ui/setup/kubernetes-setup) for controller-specific timeout configuration examples.
