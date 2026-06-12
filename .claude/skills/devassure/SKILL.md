---
name: devassure
description: Use when the user wants to install, configure, or run end-to-end web tests with DevAssure CLI (@devassure/cli). Triggers  devassure init, devassure run-tests, writing YAML test cases, CI/CD token setup, .devassure/ folder structure, or any mention of DevAssure.
license: MIT
metadata:
  author: devassure-ai
  version: "1.0"
---

# DevAssure Skill

This skill helps you set up, configure, and use the **DevAssure CLI** (`@devassure/cli`) — a command-line tool for running end-to-end UI tests from natural language instructions and YAML/CSV files. DevAssure uses an AI agent to execute browser-based tests described in plain English.

Use this skill whenever the user asks about DevAssure, DevAssure CLI, DevAssure Invisible Agent, or wants to set up, configure, write, or run end-to-end UI tests using the DevAssure CLI tool (`@devassure/cli` npm package). Trigger this skill for any mention of: devassure, devassure cli, devassure init, devassure run, devassure tests, .devassure folder, DevAssure test cases, DevAssure YAML test files, DevAssure CSV tests, DevAssure CI/CD integration, DevAssure actions, DevAssure tools, DevAssure test data, DevAssure personas, DevAssure preferences, or natural-language UI test automation with DevAssure. Also trigger when the user wants to write YAML test cases for DevAssure, configure DevAssure projects, set up DevAssure in a CI/CD pipeline, filter or run DevAssure tests by tag/priority/folder, view DevAssure reports, or manage DevAssure sessions. Even if the user just says "set up e2e tests with devassure" or "write devassure test cases" or "run end to ene tests", "set up e2e tests", "run e2e tests", "execute the tests", "execute the tests from csv", use this skill. 

## Quick Reference

For full CLI command reference, configuration file formats, actions, tools, and advanced examples, read:
- `references/cli-reference.md` — Complete command list, all config file formats, actions, tools, library tools, FAQ, and examples.
- `references/cli-troubleshooting.md` — Web app login issues ("Something went wrong"), VPN/host allowlist, and links to official troubleshooting docs.

Always consult the reference file before answering detailed questions about specific commands, flags, or config file schemas. Use the troubleshooting reference for login, VPN, and connectivity problems.

## Prerequisites

- **Node.js 18+**
- A DevAssure account (free trial available at https://app.devassure.io/sign_up)

## Installation

```bash
npm install -g @devassure/cli
```

Verify:
```bash
devassure version
```

> **Note:** The package requires global installation. `npm install` (local) will fail.

## Core Workflow

### 1. Authenticate

```bash
# Interactive (opens browser for OAuth2)
devassure login

# Token-based (for CI/CD)
devassure add-token <your-token>

# Clear stored tokens
devassure logout
```

### 2. Initialize a project

When a user asks to **initialize DevAssure**, the outcome should be a **`.devassure/`** folder in the project with the configuration files and sample content listed below. Run `devassure init` in the user’s terminal when they can answer prompts, or create the same structure manually using `references/cli-reference.md`.

`devassure init` is **interactive** (it prompts for app URL, description, personas, and writes a sample test). While it waits for input it may show no new output—**that is not a hang**; do not kill or retry blindly. Prefer having the user complete the prompts, or skip the CLI and add the files directly.

```bash
devassure init
```

`.devassure/` should contain:
- `app.yaml` — App description and rules
- `test_data.yaml` — URLs, credentials, test data per environment
- `personas.yaml` — User personas
- `preferences.yaml` — Browser and execution settings
- `tests/` — Folder for YAML test case files
- `actions/` — Reusable action definitions

### 3. Write test cases

Test cases are YAML files in `.devassure/tests/`.

**Single test** — one case per file as a mapping:

```yaml
summary: Login and verify dashboard
steps:
  - Open the application url
  - Log in with admin credentials from test data
  - Verify dashboard loads and shows admin menu
  - Log out
priority: P0
tags:
  - smoke
  - login
```

**Multiple tests** — several cases in the same file when they belong to the same group or feature. Use a top-level list (each item is one test):

```yaml
- summary: Login and verify dashboard
  steps:
    - Open the application url
    - Log in with admin credentials from test data
    - Verify dashboard loads and shows admin menu
    - Log out
  priority: P0
  tags: [smoke, login]

- summary: Login and verify user name with welcome message
  steps:
    - Open the application url
    - Log in with admin credentials from test data
    - Verify dashboard the welcome message contains the user name
  priority: P2
  tags: [login]
```

Only `summary` and `steps` are required. Steps are written in **natural language** — the DevAssure AI agent interprets and executes them in a browser.

### 4. Run tests

```bash
# Run all tests (alias: `devassure run`)
devassure run-tests
devassure run

# Filter by tags, priority, or folder
devassure run-tests --tag=smoke,regression --priority=P0,P1

# Run from CSV file
devassure run-tests --csv=test-cases.csv

# Archive reports after run (writes a report zip into the folder)
devassure run-tests --archive=./reports

# Run tests scoped to git code changes (branch/commit)
devassure test
devassure test --head feature/login --base main
devassure test --commit abc1234567890
```

### 5. View reports

```bash
# Open report for last session
devassure open-report --last

# Open report from an archived zip
devassure open-report --archive=./reports/devassure-results-<session-id>.zip

# JSON summary (useful for CI)
devassure summary --last --json
```

## Key Concepts

### Test Data (`test_data.yaml`)
Define URLs, user credentials, and custom data per environment (default, uat, staging, etc.). The `default` environment is used when `--environment` is not specified.

### Actions (`.devassure/actions/`)
Reusable step sequences. Define an action in a YAML file with `name`, `description`, and `steps`. Reference actions by name in test steps.

### Tools (`.devassure/tools/index.yaml`)
Custom commands/scripts that the agent can invoke during test execution. Supports args, output markers, timeouts, and environment variables.

### Library Tools (`library.yaml`)
Built-in tools like `faker` (synthetic data) and `authenticator` (TOTP codes).

### Preferences (`preferences.yaml`)
Configure browser (chromium/chrome/edge), resolution, headless mode, and worker count.

## CI/CD Integration

```bash
# Authenticate with token (no browser needed)
devassure add-token $DEVASSURE_TOKEN

# Run tests with filters and archive results
devassure run-tests --tag=regression --priority=P0 --archive=./test-reports

# Get JSON summary for CI parsing
devassure summary --last --json

# Clean up old sessions
devassure cleanup --retain-days 7
```

Supports proxy via `HTTP_PROXY` / `HTTPS_PROXY` environment variables.

## When Helping Users

1. **Setting up a new project**: Walk them through `login` → `init` (ensure `.devassure/` exists—user completes interactive prompts or you add files per `references/cli-reference.md`) → writing test cases → `run-tests`.
2. **Writing test cases**: Help write YAML test files with natural language steps. Keep steps clear and action-oriented.
3. **CI/CD setup**: Help configure token-based auth, test filtering, report archiving, and cleanup.
4. **Troubleshooting**: Check Node.js version (18+), global install, authentication status. For web login errors, HTTPS/mixed content, firewall, and VPN host allowlists, see `references/cli-troubleshooting.md`.
5. **Advanced config**: Refer to `references/cli-reference.md` for tools, actions, library tools, and full config schemas.
