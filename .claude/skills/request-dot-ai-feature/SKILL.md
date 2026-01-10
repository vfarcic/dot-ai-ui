---
name: request-dot-ai-feature
description: Generate a feature request prompt for another dot-ai project. Use when you need a feature implemented in a sibling project (MCP server, controller, etc.) to unblock work in the current project.
allowed-tools:
  - Grep
  - Bash(grep:*)
---

# Request Feature in dot-ai Project

Generate a prompt that the user can copy/paste to the Claude agent in another dot-ai project.

## Projects

- **dot-ai** - Main MCP server (API endpoints, tools, handlers)
- **dot-ai-ui** - Web UI for visualizations and dashboard
- **dot-ai-controller** - Kubernetes controller
- **dot-ai-stack** - Stack deployment configs
- **dot-ai-website** - Documentation website

**Important:** Do NOT use this skill to request features in the project you're currently working in. Just implement them directly.

## Output Format

Generate output in this exact format:

```
## Feature Request for [PROJECT_NAME]

Copy the prompt below and paste it into the Claude agent running in:
📁 /Users/viktorfarcic/code/[project-directory]

---

### Prompt to copy:

**Request from [CURRENT_PROJECT]:**

[DESCRIPTION OF WHAT WE NEED AND WHY]

**Our suggestion** (you decide the best approach):
- [Suggested approach or implementation idea]

**What we're trying to accomplish:**
[Context about what this unblocks in our project]

Note: You're the expert on this codebase. Feel free to implement this differently if there's a better approach, or push back if this doesn't make sense.

---

After the feature is implemented, return here and continue with the integration.
```

## Guidelines

1. Describe what you need and why, not how to implement it
2. Suggestions are just suggestions - the receiving agent decides the approach
3. The receiving agent is the authority on their codebase
4. Keep the request focused on the problem, not the solution
