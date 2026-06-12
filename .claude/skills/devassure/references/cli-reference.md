# DevAssure CLI — Complete Reference

Package and install details: [@devassure/cli on npm](https://www.npmjs.com/package/@devassure/cli).

## Table of Contents
1. [All Commands](#all-commands)
2. [Run Tests Options](#run-tests-options)
3. [Config File Formats](#config-file-formats)
4. [Actions](#actions)
5. [Tools](#tools)
6. [Library Tools](#library-tools)
7. [Filtering Examples](#filtering-examples)
8. [Report Commands](#report-commands)
9. [FAQ](#faq)

---

## All Commands

### Authentication
| Command | Description |
|---------|-------------|
| `devassure login` | Login via OAuth2 (opens browser) |
| `devassure logout` | Logout and clear stored tokens |
| `devassure add-token <token>` | Add and validate an auth token (CI/CD) |

### Configuration
| Command | Description |
|---------|-------------|
| `devassure init` | Initialize `.devassure/` config in current directory |

### Running Tests
| Command | Description |
|---------|-------------|
| `devassure run-tests` (alias: `run`) | Run tests from current directory |
| `devassure test` | Run tests scoped to git code changes |
| `devassure resume --last` | Resume last test session |
| `devassure resume --session-id <id>` | Resume specific session |
| `devassure resume --id <id>` | Alias for `--session-id <id>` |

### Reports & Statistics
| Command | Description |
|---------|-------------|
| `devassure open-report --last` | Open report for last session |
| `devassure open-report --session-id <id>` | Open report for specific session |
| `devassure open-report --archive <path>` | Open report from archived zip |
| `devassure archive-report --output-dir <dir> --last` | Archive last session report to zip |
| `devassure summary --last` | Print summary for last session |
| `devassure summary --last --json` | Print summary as JSON |
| `devassure stats` | Show session count, scenario count, storage |

Notes:
- `devassure open-report` requires one of `--archive`, `--session-id`, or `--last`.
- `devassure archive-report` requires `--output-dir` and one of `--session-id` or `--last`.
- `devassure summary` requires one of `--session-id` or `--last` (and `--json` is optional).

### Maintenance
| Command | Description |
|---------|-------------|
| `devassure cleanup --retain-days <N>` | Keep sessions from last N days |
| `devassure cleanup --retain-sessions <N>` | Keep last N sessions |
| `devassure cleanup` | Prompt to delete all sessions |

### Utility
| Command | Description |
|---------|-------------|
| `devassure version` | Show CLI version |
| `devassure help` | Show help |

**Global option:** `--verbose` enables verbose logging for all commands.

---

## Run Tests Options

| Flag | Description |
|------|-------------|
| `--path <path>` | Project path (default: current directory) |
| `--csv <path>` | Path to CSV file with test cases (supports relative paths; relative order: current directory, `.devassure`. File must exist and end with `.csv`) |
| `--tag <tags>` / `--tags` | Comma-separated tags (e.g. `--tag=smoke,regression`) |
| `--priority <values>` / `--priorities` | Comma-separated priorities (e.g. `--priority=P0,P1`) |
| `--folder <paths>` / `--folders` | Comma-separated folder paths |
| `--query <string>` / `--queries` | Search query string |
| `--filter <string>` / `--filters` | Raw filter string (overrides tag/priority/folder/query) |
| `--archive <folder>` | Archive folder path; after run, test reports are written as `devassure-results-<session-id>.zip` into this folder (relative paths resolved from current directory) |
| `--environment <env>` | Environment key from test_data.yaml |

**Filter string syntax:** `--filter="tag = tag1,tag2 && priority = P0"`
**Keyword search:** `--filter="query = dashboard"`

If `--filter` is provided, all other filter flags are ignored.

### Git Code Changes Options (`devassure test`)
`devassure test` runs scenarios focused on git differences (branch comparison or a specific commit), while using the same test discovery as `run-tests` (YAML under the project directory).

| Flag | Description |
|------|-------------|
| `--path <path>` | Project path (default: current directory) |
| `--head <branch>` | Source branch (forwarded to the agent as `--source`) |
| `--base <branch>` | Target/baseline branch (forwarded to the agent as `--target`) |
| `--commit <sha>` | Commit to test (forwarded as `--commit-id`) |
| `--archive <folder>` | Archive folder path for report zip output |
| `--environment <env>` | Environment name (e.g. staging, production) |
| `--url <url>` | Override default test URL (`test_data.default.url`) |
| `--headless <true|false>` | Run the browser headless (omit to use project default) |

Branch vs commit:
- If you pass `--head`/`--base` or `--commit`, that mode is enabled.
- If you omit all of `--head`, `--base`, and `--commit`, the agent uses the current branch as the source and the repository default branch as the target.

---

## Config File Formats

All files live under `.devassure/`.

### app.yaml
```yaml
description: >
  About my application
  in multi-line format
rules:
  - User can't create more than 3 projects
  - Any data deleted can't be restored
```

### test_data.yaml
```yaml
default:
  url: 'http://localhost:3000'
  users:
    default:
      user_name: 'user@test.com'
      password: 12345678
    admin:
      user_name: 'admin@test.com'
      password: 12345678
  custom_data_key: value
uat:
  url: 'http://uat.myapp.com'
  users:
    default:
      user_name: 'user@uat.com'
      password: 12345678
```
If a key is missing for a specific environment, the `default` value is used.

### personas.yaml
```yaml
normal_user:
  description: No admin access, can do all other operations
  age_group: 18-30
  gender: M
  region: USA
admin:
  description: Admin can add or delete users and manage privileges
deactivated_user:
  description: Login is deactivated by admin
```

### preferences.yaml
```yaml
browsers:
  default:
    browser: chromium   # chromium | chrome | edge
    resolution: 1920 x 1200
    headless: true
workers: 2
```

### agent_instructions.yaml
```yaml
instructions:
  - Reload the app and retry if app shows warning server is busy
  - Sign up a new user and proceed if any of the given logins are not working
```

### csv_mapping.yaml
```yaml
summary: Summary
steps: Steps
priority: Priority
tags: Tags
```

### Test Case YAML (in `.devassure/tests/`)
```yaml
summary: Login and verify dashboard
steps:
  - Open the application url
  - Log in with admin credentials from test data
  - Verify dashboard loads and shows admin menu
priority: P0
tags:
  - smoke
  - login
```
**Required fields:** `summary`, `steps`. **Optional:** `priority`, `tags`.

---

## Actions

Actions are reusable step sequences defined in `.devassure/actions/`.

**Action file format:**
```yaml
name: login_as_admin
description: Login to the app as admin using Google
steps:
  - Open admin portal url
  - Click on Google login button
  - Enter admin email and password
  - If MFA is asked, enter the authenticator OTP
```

**Using actions in tests:** Reference by `name` as a step:
```yaml
steps:
  - login_as_admin
  - Open users list page
  - Verify if the manager user is listed
```

---

## Tools

Custom commands/scripts invoked by the agent during test execution. Configured in `.devassure/tools/index.yaml`.

### Mandatory fields per tool
| Field | Description |
|-------|-------------|
| `name` | Unique identifier |
| `description` | What the tool does |
| `exec` | Command to run. Supports `${argName}` substitution |

### Optional fields
| Field | Description |
|-------|-------------|
| `cwd` | Working directory (relative to `.devassure/tools/`, or absolute) |
| `args` | List of `{name, type, optional?}`. Types: `string`, `number`, `boolean`, `object` |
| `timeoutSec` | Max execution time in seconds |
| `output.start` / `output.end` | Stdout markers — only content between these is captured |
| `env` | List of `KEY: value` environment variables |
| `ignore_failure` | If `true`, failure doesn't fail the run |

### Top-level optional config
- **`settings`**: Defaults applied to all tools and setup steps (env is merged, other fields are fallback).
- **`setup`**: Steps run once per session before tests (e.g., `npm install`).

### Full example
```yaml
settings:
  timeoutSec: 10
  output:
    start: "__TOOL_OUTPUT_START__"
    end: "__TOOL_OUTPUT_END__"
  env:
    - BUILD_ENV: "dev"
  ignore_failure: false
setup:
  - name: "Install dependencies"
    cwd: "api-tools"
    exec: "npm install"
tools:
  - name: "getProjectDetails"
    description: "Get project details from API"
    cwd: "api-tools"
    args:
      - name: projectId
        type: string
      - name: projectName
        type: string
        optional: true
    exec: |
      npm run warmupTestingProcess
      npm run getProjectDetails ${projectId} "${projectName}"
      npm run cleanupTestingProcess
```

---

## Library Tools

Built-in tools enabled via `.devassure/library.yaml`:

```yaml
tools:
  - 'authenticator'
  - 'faker:*'
```

### faker
| Tool-key | Description |
|----------|-------------|
| `*first_name*` | Random first name |
| `*last_name*` | Random last name |
| `*full_name*` | Random full name |
| `*email*` | Random email |
| `*phone*` | Random phone number |

### authenticator
| Tool-key | Description |
|----------|-------------|
| `get_authenticator_otp` | Generate TOTP code from authenticator secret |

---

## Filtering Examples

```bash
# E2E test from git code changes
devassure test
devassure test --head feature/login --base main
devassure test --commit abc1234567890

# By tags
devassure run-tests --tag=smoke,regression

# By priority
devassure run-tests --priority=P0,P1

# By folder
devassure run-tests --folder=admin/users,project/integration

# By search query
devassure run-tests --query="login flow"

# Combined
devassure run-tests --tag=smoke --priority=P0 --folder=admin/users

# Raw filter (overrides all other filters)
devassure run-tests --filter="tag = tag1,tag2 && priority = P0"

# Keyword search via filter
devassure run-tests --filter="query = dashboard"

# From CSV
devassure run-tests --csv=sample-tests.csv

# With archive
devassure run-tests --archive=./reports
```

---

## Report Commands

```bash
# Open last session report in browser
devassure open-report --last

# Archive report to zip
devassure archive-report --output-dir=./reports --last

# Open from archived zip
devassure open-report --archive=./reports/devassure-results-<session-id>.zip

# JSON summary (useful for CI)
devassure summary --last --json
# Returns: session_id, environment, scenarios, score, grouped_failures,
#          passed_validations, duration_ms, duration_string

# Session statistics
devassure stats
```

---

## FAQ

**How to add new test cases?**
Add YAML files under `.devassure/tests/`, or use CSV with `--csv` and `csv_mapping.yaml`.

**Can I use CSV only (no YAML)?**
Yes. Use `devassure run-tests --csv=<path>` with `csv_mapping.yaml` to map columns.

**What are mandatory test case fields?**
`summary` and `steps`. `priority` and `tags` are optional.

**How to add a new environment?**
Add a top-level key in `test_data.yaml` and run with `--environment=<key>`.

**Supported browsers?**
Chromium (default), Chrome, Edge. Set in `preferences.yaml`.

**How to run headless?**
Set `browsers.default.headless: true` in `preferences.yaml`. (For `devassure test`, you can also override with `--headless true|false`.)

**CI/CD setup?**
Use `devassure add-token <token>` for auth, then `devassure run-tests` with desired flags. Use `--archive` to save reports and `devassure summary --last --json` for machine-readable results.

**Proxy support?**
Set `HTTP_PROXY` or `HTTPS_PROXY` environment variables.
