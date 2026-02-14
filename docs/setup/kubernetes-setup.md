# Kubernetes Setup Guide

**Deploy DevOps AI Toolkit Web UI to Kubernetes using Helm chart.**

> **Recommended**: For the easiest setup, install the complete dot-ai stack which includes all components (MCP server, Web UI, and Controller). See the [Stack Installation Guide](https://devopstoolkit.ai/docs/stack).
>
> Continue below if you want to install this component individually (for non-Kubernetes setups or granular control).

## Prerequisites

- Kubernetes cluster (1.19+) with kubectl access
- Helm 3.x installed
- [dot-ai MCP server](https://devopstoolkit.ai/docs/ai-engine/setup/deployment) deployed and accessible
- Auth token for the dot-ai MCP server

## Quick Start

### Step 1: Set Environment Variables

```bash
# Set the version from https://github.com/vfarcic/dot-ai-ui/pkgs/container/dot-ai-ui%2Fcharts%2Fdot-ai-ui
export DOT_AI_UI_VERSION="..."

# Use the same auth token as your dot-ai MCP server
export DOT_AI_AUTH_TOKEN="your-dot-ai-auth-token"

# Token for UI login
export DOT_AI_UI_AUTH_TOKEN="your-ui-access-token"

# Ingress class - change to match your ingress controller (traefik, haproxy, etc.)
export INGRESS_CLASS_NAME="nginx"
```

### Step 2: Install the Web UI

```bash
helm install dot-ai-ui \
  oci://ghcr.io/vfarcic/dot-ai-ui/charts/dot-ai-ui:$DOT_AI_UI_VERSION \
  --set dotAi.url="http://dot-ai:3456" \
  --set dotAi.auth.token="$DOT_AI_AUTH_TOKEN" \
  --set uiAuth.token="$DOT_AI_UI_AUTH_TOKEN" \
  --set ingress.enabled=true \
  --set ingress.className="$INGRESS_CLASS_NAME" \
  --set ingress.host="dot-ai-ui.127.0.0.1.nip.io" \
  --namespace dot-ai \
  --wait
```

**Notes**:
- Replace `dot-ai-ui.127.0.0.1.nip.io` with your desired hostname.
- The `dotAi.url` should point to your dot-ai MCP server service. If deployed in the same namespace with default settings, `http://dot-ai:3456` works.
- The chart includes nginx timeout annotations by default (10 min). **If using a different ingress controller**, override the annotations (see [Ingress Timeout Configuration](#ingress-timeout-configuration)).
- For all available configuration options, see the [Helm values file](https://github.com/vfarcic/dot-ai-ui/blob/main/charts/values.yaml).

### Step 3: Configure dot-ai MCP Server

Update your dot-ai MCP server to include visualization URLs in responses:

```bash
helm upgrade dot-ai-mcp oci://ghcr.io/vfarcic/dot-ai/charts/dot-ai:$DOT_AI_VERSION \
  --set webUi.baseUrl="http://dot-ai-ui.127.0.0.1.nip.io" \
  --namespace dot-ai \
  --reuse-values
```

### Step 4: Verify Installation

Open your browser and navigate to the Web UI hostname. You should see the DevOps AI Toolkit Web UI home page.

## Configuration Reference

| Parameter | Description | Default |
|-----------|-------------|---------|
| `annotations` | Global annotations applied to all resources (e.g., `reloader.stakater.com/auto: "true"`) | `{}` |
| `image.repository` | Container image repository | `ghcr.io/vfarcic/dot-ai-ui` |
| `image.tag` | Container image tag | Chart appVersion |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `dotAi.url` | URL of the dot-ai MCP server | `http://dot-ai:3456` |
| `dotAi.auth.secretRef.name` | Name of existing secret with auth token | `dot-ai-secrets` |
| `dotAi.auth.secretRef.key` | Key in existing secret | `auth-token` |
| `dotAi.auth.token` | Auth token (if not using secretRef) | `""` |
| `uiAuth.secretRef.name` | Existing secret with UI auth token | `""` |
| `uiAuth.secretRef.key` | Key in existing secret | `ui-auth-token` |
| `uiAuth.token` | UI auth token (if not using secretRef) | `""` |
| `ingress.enabled` | Enable Ingress resource | `false` |
| `ingress.className` | Ingress class name | `nginx` |
| `ingress.host` | Ingress hostname | `dot-ai-ui.127.0.0.1.nip.io` |
| `ingress.annotations` | Ingress annotations (includes nginx timeouts by default) | nginx timeout annotations |
| `ingress.tls.enabled` | Enable TLS | `false` |
| `ingress.tls.secretName` | TLS secret name | `""` |
| `ingress.tls.clusterIssuer` | cert-manager ClusterIssuer | `""` |
| `resources.requests.memory` | Memory request | `128Mi` |
| `resources.requests.cpu` | CPU request | `50m` |
| `resources.limits.memory` | Memory limit | `256Mi` |
| `resources.limits.cpu` | CPU limit | `200m` |

## Using Secret Reference

For production, reference existing secrets instead of passing tokens directly:

```bash
helm install dot-ai-ui \
  oci://ghcr.io/vfarcic/dot-ai-ui/charts/dot-ai-ui:$DOT_AI_UI_VERSION \
  --set dotAi.url="http://dot-ai:3456" \
  --set dotAi.auth.secretRef.name="dot-ai-secrets" \
  --set dotAi.auth.secretRef.key="auth-token" \
  --set uiAuth.secretRef.name="dot-ai-secrets" \
  --set uiAuth.secretRef.key="ui-auth-token" \
  --set ingress.enabled=true \
  --set ingress.className="$INGRESS_CLASS_NAME" \
  --set ingress.host="dot-ai-ui.example.com" \
  --namespace dot-ai \
  --wait
```

## TLS Configuration

Enable HTTPS with cert-manager:

```bash
helm install dot-ai-ui \
  oci://ghcr.io/vfarcic/dot-ai-ui/charts/dot-ai-ui:$DOT_AI_UI_VERSION \
  --set dotAi.url="http://dot-ai:3456" \
  --set dotAi.auth.secretRef.name="dot-ai-secrets" \
  --set uiAuth.secretRef.name="dot-ai-secrets" \
  --set uiAuth.secretRef.key="ui-auth-token" \
  --set ingress.enabled=true \
  --set ingress.className="$INGRESS_CLASS_NAME" \
  --set ingress.host="dot-ai-ui.example.com" \
  --set ingress.tls.enabled=true \
  --set ingress.tls.clusterIssuer="letsencrypt" \
  --namespace dot-ai \
  --wait
```

Then update your `.mcp.json` URL to use `https://`.

## Ingress Timeout Configuration

The Web UI proxies requests to the MCP server for AI-powered operations (query, remediate, operate, recommend) that can take several minutes. The chart includes **nginx timeout annotations by default** (10 minutes). If you use a different ingress controller, override `ingress.annotations` with the appropriate settings:

### Nginx (default)

```yaml
ingress:
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
```

### Traefik

```yaml
ingress:
  className: traefik
  annotations:
    traefik.ingress.kubernetes.io/router.middlewares: dot-ai-timeout@kubernetescrd
```

> **Note**: Traefik requires a separate `Middleware` resource for timeout configuration. See the [Traefik docs](https://doc.traefik.io/traefik/middlewares/http/headers/).

### HAProxy

```yaml
ingress:
  className: haproxy
  annotations:
    haproxy.org/timeout-http-request: "600s"
```

### AWS ALB

```yaml
ingress:
  className: alb
  annotations:
    alb.ingress.kubernetes.io/target-group-attributes: idle_timeout.timeout_seconds=600
```

## Gateway API (Alternative to Ingress)

For Kubernetes 1.26+ with Gateway API support, you can use HTTPRoute instead of Ingress.

### Prerequisites

- Kubernetes 1.26+ cluster
- Gateway API CRDs installed
- Gateway controller running (Istio, Envoy Gateway, Kong, etc.)
- Existing Gateway resource

### Reference Existing Gateway

```bash
helm install dot-ai-ui \
  oci://ghcr.io/vfarcic/dot-ai-ui/charts/dot-ai-ui:$DOT_AI_UI_VERSION \
  --set dotAi.url="http://dot-ai:3456" \
  --set dotAi.auth.secretRef.name="dot-ai-secrets" \
  --set uiAuth.secretRef.name="dot-ai-secrets" \
  --set uiAuth.secretRef.key="ui-auth-token" \
  --set ingress.enabled=false \
  --set gateway.name="cluster-gateway" \
  --set gateway.namespace="gateway-system" \
  --namespace dot-ai \
  --wait
```

### Gateway Configuration Reference

| Parameter | Description | Default |
|-----------|-------------|---------|
| `gateway.name` | Existing Gateway name to reference | `""` |
| `gateway.namespace` | Gateway namespace (for cross-namespace) | `""` |
| `gateway.create` | Create new Gateway (dev/testing only) | `false` |
| `gateway.className` | GatewayClass name (when create=true) | `""` |
| `gateway.annotations` | Annotations for Gateway (when create=true) | `{}` |
| `gateway.timeouts.request` | Max time for entire request (HTTPRoute) | `"600s"` |
| `gateway.timeouts.backendRequest` | Max time waiting for backend response (HTTPRoute) | `"600s"` |
| `gateway.listeners.http.enabled` | Enable HTTP listener on port 80 | `true` |
| `gateway.listeners.http.hostname` | Hostname for HTTP listener | `""` |
| `gateway.listeners.https.enabled` | Enable HTTPS listener on port 443 | `false` |
| `gateway.listeners.https.hostname` | Hostname for HTTPS listener | `""` |
| `gateway.listeners.https.secretName` | TLS secret name for HTTPS | `""` |

### Timeout Configuration

The chart sets HTTPRoute timeouts to **10 minutes** by default (`gateway.timeouts.request` and `gateway.timeouts.backendRequest`), which accommodates AI-powered operations. You can override these values:

```bash
helm install dot-ai-ui ... \
  --set gateway.timeouts.request="1800s" \
  --set gateway.timeouts.backendRequest="1800s"
```

**Not all Gateway controllers support HTTPRoute timeouts.** For example, GKE's Gateway controller rejects them with error GWCER104. To disable HTTPRoute timeouts, set both values to empty strings:

```bash
helm install dot-ai-ui ... \
  --set gateway.timeouts.request="" \
  --set gateway.timeouts.backendRequest=""
```

### Cloud Provider Considerations

Some cloud providers require provider-specific timeout configuration instead of HTTPRoute timeouts:

- **GKE**: Does **not** support HTTPRoute timeouts (GWCER104). You must disable them (set to `""`) and use `GCPBackendPolicy` instead (see below).
- **Health check configuration**: Custom health check intervals or thresholds.
- **Security policies**: WAF rules, rate limiting at the gateway level.

**GKE Example**: Disable HTTPRoute timeouts and create a `GCPBackendPolicy` for timeout configuration:

```yaml
apiVersion: networking.gke.io/v1
kind: GCPBackendPolicy
metadata:
  name: dot-ai-ui
  namespace: dot-ai
spec:
  default:
    timeoutSec: 3600
  targetRef:
    group: ""
    kind: Service
    name: dot-ai-ui
```

Consult your cloud provider's Gateway API documentation for equivalent configurations on other platforms.

## Additional Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `extraEnv` | Additional environment variables | `[]` |
