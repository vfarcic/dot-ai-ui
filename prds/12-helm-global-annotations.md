# PRD: Global Annotations Support in Helm Chart

**Issue**: [#12](https://github.com/vfarcic/dot-ai-ui/issues/12)
**Status**: Draft
**Priority**: Low
**Created**: 2026-01-21

---

## Problem Statement

The Helm chart doesn't support custom annotations on all Kubernetes resources. Users cannot:

1. Use tools like [Reloader](https://github.com/stakater/Reloader) to trigger rolling updates when ConfigMaps/Secrets change
2. Add audit/compliance annotations required by organizational policies
3. Integrate with external-secrets-operator, sealed-secrets, or similar tools
4. Apply consistent metadata across all deployed resources

Currently, only some resources (Ingress, Gateway) support annotations, while core resources like Deployment, Service, and Secret do not.

## Solution Overview

Add a single global `annotations` entry in `values.yaml` that applies to **all** rendered Kubernetes resources. When a resource already has its own annotations (like `ingress.annotations`), the global annotations are merged with the resource-specific ones, with resource-specific annotations taking precedence.

### Values Configuration

```yaml
# Global annotations applied to ALL resources
annotations: {}
  # Example: Reloader integration
  # reloader.stakater.com/auto: "true"
  # Example: Compliance
  # company.com/managed-by: "platform-team"
```

### Merge Behavior

For resources with existing annotation support (Ingress, Gateway):
- Global annotations are applied first
- Resource-specific annotations override global ones if there's a key conflict

```yaml
# Example values.yaml
annotations:
  global-key: "global-value"
  shared-key: "from-global"

ingress:
  enabled: true
  annotations:
    shared-key: "from-ingress"  # This wins
    ingress-only: "specific"
```

Results in Ingress annotations:
```yaml
annotations:
  global-key: "global-value"      # From global
  shared-key: "from-ingress"      # Resource-specific wins
  ingress-only: "specific"        # From ingress
```

## Technical Design

### Template Helper Function

Create a helper function in `_helpers.tpl` to merge global and resource-specific annotations:

```yaml
{{/*
Merge global annotations with resource-specific annotations.
Resource-specific annotations take precedence over global annotations.
*/}}
{{- define "dot-ai-ui.annotations" -}}
{{- $merged := dict -}}
{{- if .global -}}
  {{- $merged = merge $merged .global -}}
{{- end -}}
{{- if .local -}}
  {{- $merged = merge $merged .local -}}
{{- end -}}
{{- if $merged -}}
  {{- toYaml $merged -}}
{{- end -}}
{{- end -}}
```

### Resources to Update

All templates rendering Kubernetes resources:

| Template | Resource(s) | Notes |
|----------|------------|-------|
| `deployment.yaml` | Deployment, Pod template | Pod annotations critical for Reloader |
| `service.yaml` | Service | |
| `secret.yaml` | Secret | |
| `httproute.yaml` | HTTPRoute | |
| `ingress.yaml` | Ingress | Merge with existing `ingress.annotations` |
| `gateway.yaml` | Gateway | Merge with existing `gateway.annotations` |

## Success Criteria

1. **Global Application**: Setting `annotations` in values.yaml applies annotations to all rendered resources
2. **Merge Behavior**: Resource-specific annotations override global ones on key conflict
3. **No Breaking Changes**: Existing configurations continue to work without modification
4. **Pod Annotations**: Reloader use case works (pod template annotations applied)
5. **Empty by Default**: `annotations: {}` produces no annotations (clean default output)

## Out of Scope

- Per-resource annotation overrides beyond what already exists (ingress, gateway)
- Label management (this PRD focuses on annotations only)
- Annotation validation

## Applicability

This PRD follows the same pattern as the dot-ai MCP server Helm chart (PRD #336) for consistency across all dot-ai projects.

---

## Milestones

- [ ] Create helper function for annotation merging in `_helpers.tpl`
- [ ] Add `annotations: {}` to `values.yaml` with documentation comments
- [ ] Update all templates to include global annotations
- [ ] Add unit tests for annotation rendering
- [ ] Update chart documentation with examples
