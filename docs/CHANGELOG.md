# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

<!-- towncrier release notes start -->

## [0.11.0] - 2026-01-23

### Features

- **Global Annotations Support in Helm Chart**

  Apply custom annotations to all Kubernetes resources deployed by the Helm chart. Previously, only Ingress and Gateway resources supported annotations, making it impossible to use tools like Reloader for automatic rolling updates when ConfigMaps or Secrets change, or to add organization-wide compliance annotations.

  The new `annotations` field in `values.yaml` applies annotations to all rendered resources: Deployment, Pod template, Service, Secret, HTTPRoute, Ingress, and Gateway. For resources that already have their own annotation fields (Ingress, Gateway), global annotations merge with resource-specific ones, with resource-specific annotations taking precedence on key conflicts.

  Configure global annotations in your values file:
  ```yaml
  annotations:
    reloader.stakater.com/auto: "true"
    company.com/managed-by: "platform-team"
  ```

  See the [Kubernetes Setup Guide](https://devopstoolkit.ai/docs/ui/setup/kubernetes-setup) for the full configuration reference. ([#12](https://github.com/vfarcic/dot-ai-ui/issues/12))


## [0.10.0] - 2026-01-16

### Features

- **Kubernetes Dashboard with AI Integration**

  A new Kubernetes dashboard provides unified resource visibility and AI-powered operations in a single interface. Platform engineers, developers, and SRE teams can browse any Kubernetes resource—including Custom Resources—and trigger AI actions without switching between tools.

  The dashboard automatically discovers all resource types in the cluster via Qdrant's indexed data and displays them in a grouped sidebar (core, apps, networking, custom CRD groups). Resource list views show real-time status with color-coded indicators: green for healthy states (Running, Active), yellow for pending operations (Terminating, Pending), and red for failures (CrashLoopBackOff, Failed). Detail views include Overview, YAML (with syntax highlighting and copy), Events, and pod-specific Logs tabs with live polling.

  Four AI tools integrate directly into the dashboard. **Query** analyzes cluster health or answers natural language questions about resources. **Remediate** identifies root causes of issues and suggests fixes with one-click execution. **Operate** performs Day 2 operations (scale, update, rollback) by describing intent in plain English. **Recommend** guides deployments through a multi-stage wizard that applies organizational patterns and policies.

  Semantic search (Cmd+K or Ctrl+K) finds resources across the cluster with relevance scoring. Results are grouped by kind and filtered by a configurable minimum relevance threshold (default 50%). Search queries persist across namespace and resource type changes.

  Bearer token authentication protects the dashboard. Set `DOT_AI_UI_AUTH_TOKEN` environment variable or let the server auto-generate a random token printed at startup. Helm users configure auth via the `uiAuth` values section.

  See the [Dashboard Documentation](https://devopstoolkit.ai/docs/ui/) for screenshots and usage details. ([#7](https://github.com/vfarcic/dot-ai-ui/issues/7))

### Other Changes

- **Towncrier Release Notes Infrastructure**

  Release notes now contain meaningful descriptions of what changed and why, instead of just artifact versions. The release workflow uses towncrier to collect changelog fragments that accumulate as features merge, then combines them into rich release notes when a version is published.

  Release timing is now controlled—releases happen when maintainers push a version tag or trigger the workflow manually, not automatically on every merge to main. The release workflow supports two modes: full releases publish all artifacts with generated notes, while notes-only mode updates release descriptions without republishing artifacts. ([#towncrier-release-notes](https://github.com/vfarcic/dot-ai-ui/issues/towncrier-release-notes))
