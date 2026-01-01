# Kubernetes Setup Guide

**Deploy DevOps AI Toolkit Web UI to Kubernetes using Helm chart.**

## Prerequisites

- Kubernetes cluster (1.19+) with kubectl access
- Helm 3.x installed
- [dot-ai MCP server](https://devopstoolkit.ai/docs/mcp/setup/kubernetes-setup/) deployed and accessible
- Auth token for the dot-ai MCP server

## Quick Start

### Step 1: Set Environment Variables

```bash
# Set the version from https://github.com/vfarcic/dot-ai-ui/pkgs/container/dot-ai-ui%2Fcharts%2Fdot-ai-ui
export DOT_AI_UI_VERSION="..."

# Use the same auth token as your dot-ai MCP server
export DOT_AI_AUTH_TOKEN="your-dot-ai-auth-token"

# Ingress class - change to match your ingress controller (traefik, haproxy, etc.)
export INGRESS_CLASS_NAME="nginx"
```

### Step 2: Install the Web UI

```bash
helm install dot-ai-ui \
  oci://ghcr.io/vfarcic/dot-ai-ui/charts/dot-ai-ui:$DOT_AI_UI_VERSION \
  --set dotAi.url="http://dot-ai:3456" \
  --set dotAi.auth.token="$DOT_AI_AUTH_TOKEN" \
  --set ingress.enabled=true \
  --set ingress.className="$INGRESS_CLASS_NAME" \
  --set ingress.host="dot-ai-ui.127.0.0.1.nip.io" \
  --namespace dot-ai \
  --wait
```

**Notes**:
- Replace `dot-ai-ui.127.0.0.1.nip.io` with your desired hostname.
- The `dotAi.url` should point to your dot-ai MCP server service. If deployed in the same namespace with default settings, `http://dot-ai:3456` works.
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
| `image.repository` | Container image repository | `ghcr.io/vfarcic/dot-ai-ui` |
| `image.tag` | Container image tag | Chart appVersion |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `dotAi.url` | URL of the dot-ai MCP server | `http://dot-ai:3456` |
| `dotAi.auth.existingSecret` | Name of existing secret with auth token | `""` |
| `dotAi.auth.existingSecretKey` | Key in existing secret | `auth-token` |
| `dotAi.auth.token` | Auth token (if not using existing secret) | `""` |
| `ingress.enabled` | Enable Ingress resource | `false` |
| `ingress.className` | Ingress class name | `nginx` |
| `ingress.host` | Ingress hostname | `dot-ai-ui.127.0.0.1.nip.io` |
| `ingress.annotations` | Additional ingress annotations | `{}` |
| `ingress.tls.enabled` | Enable TLS | `false` |
| `ingress.tls.secretName` | TLS secret name | `""` |
| `ingress.tls.clusterIssuer` | cert-manager ClusterIssuer | `""` |
| `resources.requests.memory` | Memory request | `128Mi` |
| `resources.requests.cpu` | CPU request | `50m` |
| `resources.limits.memory` | Memory limit | `256Mi` |
| `resources.limits.cpu` | CPU limit | `200m` |

## Using Existing Secret

For production, reference an existing secret instead of passing the token directly:

```bash
helm install dot-ai-ui \
  oci://ghcr.io/vfarcic/dot-ai-ui/charts/dot-ai-ui:$DOT_AI_UI_VERSION \
  --set dotAi.url="http://dot-ai:3456" \
  --set dotAi.auth.existingSecret="dot-ai-secrets" \
  --set dotAi.auth.existingSecretKey="auth-token" \
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
  --set dotAi.auth.existingSecret="dot-ai-secrets" \
  --set ingress.enabled=true \
  --set ingress.className="$INGRESS_CLASS_NAME" \
  --set ingress.host="dot-ai-ui.example.com" \
  --set ingress.tls.enabled=true \
  --set ingress.tls.clusterIssuer="letsencrypt" \
  --namespace dot-ai \
  --wait
```

Then update your `.mcp.json` URL to use `https://`.

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
  --set dotAi.auth.existingSecret="dot-ai-secrets" \
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
