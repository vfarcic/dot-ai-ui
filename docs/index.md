# DevOps AI Toolkit Web UI

**Web UI visualization companion for the DevOps AI Toolkit MCP server - renders rich visualizations for MCP tool responses that text-based terminals cannot display.**

---

## What is DevOps AI Toolkit Web UI?

DevOps AI Toolkit Web UI is a visualization companion to your MCP client. It renders Mermaid diagrams, card grids, code blocks, and tables for MCP tool responses that text-based terminals cannot display effectively.

Users continue chatting in their preferred MCP client. When MCP responses include visualization URLs, users open them in a browser to see rich visual representations of their data.

## How It Works

```text
1. User in MCP client: "show me resources in production namespace"

2. MCP server responds with visualization URL:
   "Here are the resources in production:
   View visualization: https://ui.example.com/v/session-abc123"

3. User opens URL in browser

4. Web UI renders:
   - Tab 1: "Topology" - Mermaid diagram showing resource relationships
   - Tab 2: "Resources" - Cards showing each resource
   - Insights panel: AI-generated observations

5. User returns to MCP client to continue conversation
```

## Key Features

### Mermaid Diagrams
Interactive diagrams with zoom (25%-300%), pan (click and drag), and fullscreen mode. Perfect for visualizing Kubernetes resource topology, deployment flows, and system relationships.

### Card Grids
Visual cards displaying deployment options, resources, or patterns. Each card shows title, description, and tags for quick comparison.

### Code Blocks
Syntax-highlighted code blocks for YAML manifests, commands, and configuration files. Supports copy-to-clipboard functionality.

### Tables
Clean, formatted tables for tabular data and comparisons.

### AI Insights Panel
Collapsible panel showing AI-generated observations and recommendations based on the visualization context.

### Tabbed Interface
Multiple visualizations displayed as switchable tabs, maximizing screen space while keeping all views accessible.

## Quick Start

### Prerequisites

- Kubernetes cluster with [dot-ai MCP server](https://devopstoolkit.ai/docs/mcp/setup/kubernetes-setup/) deployed
- Helm 3.x installed

### Deploy Web UI

```bash
# Set the version from https://github.com/vfarcic/dot-ai-ui/releases
export DOT_AI_UI_VERSION="..."

# Use the same auth token as your dot-ai MCP server
export DOT_AI_AUTH_TOKEN="your-dot-ai-auth-token"

helm install dot-ai-ui \
  oci://ghcr.io/vfarcic/dot-ai-ui/charts/dot-ai-ui:$DOT_AI_UI_VERSION \
  --set dotAi.url="http://dot-ai:3456" \
  --set dotAi.auth.token="$DOT_AI_AUTH_TOKEN" \
  --set ingress.enabled=true \
  --set ingress.host="dot-ai-ui.127.0.0.1.nip.io" \
  --namespace dot-ai \
  --wait
```

### Configure dot-ai MCP Server

Update your dot-ai MCP server to include visualization URLs in responses:

```bash
helm upgrade dot-ai-mcp oci://ghcr.io/vfarcic/dot-ai/charts/dot-ai:$DOT_AI_VERSION \
  --set webUi.baseUrl="http://dot-ai-ui.127.0.0.1.nip.io" \
  --namespace dot-ai \
  --reuse-values
```

[Full Kubernetes Setup Guide](setup/kubernetes-setup.md)

## Documentation

- **[Kubernetes Setup](setup/kubernetes-setup.md)** - Complete Helm installation guide with TLS and Gateway API options

## Support

- **GitHub Issues**: [Bug reports and feature requests](https://github.com/vfarcic/dot-ai-ui/issues)

## Related Projects

- **[dot-ai](https://github.com/vfarcic/dot-ai)** - DevOps AI Toolkit MCP server
- **[dot-ai-controller](https://github.com/vfarcic/dot-ai-controller)** - Kubernetes controller for autonomous operations

---

**DevOps AI Toolkit Web UI** - Rich visualizations for AI-powered DevOps workflows.
