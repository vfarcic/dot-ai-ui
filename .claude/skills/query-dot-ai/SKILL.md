---
name: query-dot-ai
description: Query sibling dot-ai project codebases to find API details, types, implementations, and patterns. Use when you need information about the MCP server, controller, or other dot-ai projects.
context: fork
agent: Explore
allowed-tools:
  - Read
  - Glob
  - Grep
---

# Query dot-ai Projects

Explore the dot-ai ecosystem codebases to find the requested information.

## Project Locations

All projects at `/Users/viktorfarcic/code/`:

- **dot-ai** - Main MCP server (API endpoints, tools, handlers)
- **dot-ai-ui** - Web UI for visualizations and dashboard
- **dot-ai-controller** - Kubernetes controller
- **dot-ai-stack** - Stack deployment configs
- **dot-ai-website** - Documentation website

Default to **dot-ai** (MCP server) if the target project is unclear.

**Important:** Do NOT use this skill to query the project you're currently working in. Use local tools (Read, Grep, Glob) instead.

## Excluded

**dot-ai-infra** - Production infrastructure. Only query if user explicitly requests it.
