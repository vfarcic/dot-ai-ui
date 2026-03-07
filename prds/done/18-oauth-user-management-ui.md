# PRD: OAuth Browser Login & User Management Admin UI

**GitHub Issue:** [#18](https://github.com/vfarcic/dot-ai-ui/issues/18)
**Priority:** High
**Status:** Complete
**Created:** 2026-03-03
**Related:** [dot-ai PRD #380](https://github.com/vfarcic/dot-ai/issues/380) — Gateway Auth RBAC (parent)

## Problem Statement

The Web UI currently uses a shared bearer token (`DOT_AI_UI_AUTH_TOKEN`) for access. The dot-ai server now supports OAuth via Dex (PRD #380), providing individual user identity and enterprise IdP integration. Without OAuth support in the UI:

- All UI users share one token — no individual identity or audit trail
- No way to use enterprise SSO (Google, GitHub, LDAP) from the UI
- Admins cannot manage users (create/list/delete) through the UI — only via REST API or CLI
- The login page shows a token input field instead of a familiar SSO login experience

## Solution Overview

Add OAuth browser login alongside the existing bearer token auth, and add a user management admin page:

```
Login Page
├── "Login with SSO" button → Redirect to Dex → User authenticates → Callback with token
└── "Login with Token" (existing) → Token input field → Bearer token auth

User Management Page (new)
├── List users (table with email, actions)
├── Create user (form: email, password)
└── Delete user (confirmation dialog)
```

## User Experience

### OAuth Login Flow

1. User navigates to the UI → sees login page
2. User clicks "Login with SSO" → browser redirects to Dex login page
3. User authenticates (static user, Google, GitHub, LDAP — depends on Dex config)
4. Dex redirects back to UI with authorization code
5. UI exchanges code for access token via the Express backend
6. User sees dashboard with their identity displayed (email in header/sidebar)

### Token Login Flow (Existing — Preserved)

1. User navigates to the UI → sees login page
2. User clicks "Login with Token" tab/section
3. User enters bearer token → clicks Login
4. Same flow as today

### User Management

1. Authenticated admin navigates to "Users" page (sidebar link)
2. Sees list of current Dex static users (email list)
3. Can create new user (email + password form)
4. Can delete existing user (with confirmation dialog)
5. Changes take effect immediately (Dex gRPC API)

## Architecture

### Frontend Changes

**LoginPage updates:**
- Two login modes: "SSO" (default) and "Token" (tab/toggle)
- SSO mode: single "Login with SSO" button that redirects to Express backend OAuth endpoint
- Token mode: existing password input field (preserved as-is)

**AuthContext updates:**
- Support both OAuth tokens (JWT from server) and bearer tokens (static)
- Store auth mode (`oauth` | `token`) in session
- Display user identity (email) for OAuth users in the UI header

**New UserManagementPage:**
- Route: `/users`
- Components: UserList (table), CreateUserForm (modal/dialog), DeleteUserConfirm (dialog)
- API calls to Express backend → proxied to dot-ai server (`/api/v1/users`)

### Backend Changes (Express)

**OAuth proxy routes:**
- `GET /auth/login` — redirects to dot-ai server's `/authorize` endpoint with PKCE
- `GET /auth/callback` — receives authorization code, exchanges for token at `/token`, sets session
- `GET /auth/logout` — clears session, redirects to login page

**User management proxy:**
- `POST /api/v1/users` → proxied to dot-ai server (already proxied for other endpoints)
- `GET /api/v1/users` → proxied to dot-ai server
- `DELETE /api/v1/users/:email` → proxied to dot-ai server

The Express backend acts as an OAuth client (confidential client) — it holds the client secret and exchanges codes server-side, keeping tokens out of the browser URL.

### Auth Flow Diagram

```
Browser                     Express Backend              dot-ai Server         Dex
  │                              │                           │                  │
  │ Click "Login with SSO"       │                           │                  │
  │─────────────────────────────>│                           │                  │
  │                              │ GET /authorize (PKCE)     │                  │
  │                              │──────────────────────────>│                  │
  │                              │                           │ Redirect to Dex  │
  │<─────────────────────────────│<──────────────────────────│────────────────->│
  │ (browser follows redirects to Dex login page)            │                  │
  │                              │                           │                  │
  │ User logs in at Dex          │                           │                  │
  │─────────────────────────────────────────────────────────────────────────────>│
  │                              │                           │  Callback        │
  │                              │                           │<─────────────────│
  │                              │   Callback with code      │                  │
  │                              │<──────────────────────────│                  │
  │  /auth/callback?code=...     │                           │                  │
  │─────────────────────────────>│ POST /token (code+PKCE)   │                  │
  │                              │──────────────────────────>│                  │
  │                              │ JWT access token           │                  │
  │                              │<──────────────────────────│                  │
  │ Set session + redirect home  │                           │                  │
  │<─────────────────────────────│                           │                  │
```

## Design Decisions

### 2026-03-06: Remove Express-local OAuth validation, use pass-through proxy

**Decision**: Remove the Express-local OAuth JWT validation strategy. Instead, the Express backend should forward the JWT to the dot-ai server on every proxied request and let the dot-ai server validate it — the same approach used by the CLI.

**Rationale**:
- The Express `oauth.ts` strategy decodes JWTs without signature verification — insecure
- The dot-ai server is the authority on token validity (it issued the token, it should validate it)
- Having two places that validate tokens (Express + dot-ai server) creates divergence and bugs
- The CLI already does it correctly: get a token, send it on every request, let the server decide
- Single source of truth is simpler and more secure

**What the Express backend should do for OAuth**:
- Handle the OAuth browser flow (`/auth/login` → `/authorize`, `/auth/callback` → `/token`) — browsers need server-side PKCE
- Store the JWT from the token exchange and pass it to the frontend
- Forward the JWT on all proxied `/api/v1/*` requests to the dot-ai server
- NOT validate JWTs locally

**What to remove (dead code cleanup)**:
- `server/auth/strategies/oauth.ts` — Express-local JWT validation strategy
- OAuth JWT validation logic in `server/auth/index.ts` (`authMiddleware` OAuth branch, `verifyHandler` OAuth branch)
- `decodeJwtPayload` in `server/auth/oauth-client.ts` (only used by the removed oauth strategy)
- Frontend `validateToken` call to `/api/v1/auth/verify` for OAuth tokens — the token is trusted because it came from the server-side code exchange

**Bearer token path**: Unaffected. The static `DOT_AI_UI_AUTH_TOKEN` bearer strategy remains for legacy/fallback use.

**E2E test impact**: Tests should exercise the OAuth login flow through the mock server's OAuth endpoints (`/authorize` → `/token`) instead of the Express-local bearer auth. This matches the CLI's test approach and tests the real production path.

## Milestones

### Milestone 1: OAuth Login

- [x] Express backend: `/auth/login` (redirect to dot-ai `/authorize`), `/auth/callback` (exchange code for token), `/auth/logout`
- [x] Dynamic client registration with dot-ai server on startup (RFC 7591)
- [x] LoginPage: add "Login with SSO" button alongside existing token input
- [x] AuthContext: support OAuth tokens (JWT), store auth mode, extract user identity
- [x] Display user email in UI header/sidebar for OAuth users
- [x] E2E tests: OAuth login flow (mock Dex callback)

### Milestone 1b: Auth Architecture Fix

- [x] Remove `server/auth/strategies/oauth.ts` (Express-local JWT validation)
- [x] Remove OAuth JWT validation branches from `authMiddleware` and `verifyHandler` in `server/auth/index.ts`
- [x] Remove `decodeJwtPayload` from `server/auth/oauth-client.ts`
- [x] Update `authMiddleware` to forward OAuth JWTs as-is to dot-ai server (pass-through proxy)
- [x] Update frontend `AuthContext` to trust OAuth tokens from callback without calling `/api/v1/auth/verify`
- [x] Update E2E tests to use OAuth login flow through mock server's `/authorize` and `/token` endpoints
- [x] Remove any other dead code from the old Express-local OAuth validation approach

### Milestone 2: User Management Page

- [x] New `/users` route with UserManagementPage component
- [x] User list table (fetches `GET /api/v1/users`)
- [x] Create user form/dialog (calls `POST /api/v1/users` with email + password)
- [x] Delete user confirmation dialog (calls `DELETE /api/v1/users/:email`)
- [x] Sidebar navigation link to Users page
- [x] E2E tests: user CRUD flows

### Milestone 3: Feature Request to dot-ai

- [x] Send feature request to `dot-ai` project: update `docs/ai-engine/setup/authentication.md` to link to UI-specific user management page (`https://devopstoolkit.ai/docs/ui/#user-management`)

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| dot-ai OAuth endpoints (PRD #380) | Complete | Server serves OAuth metadata, authorize, token, register |
| User management REST API | Complete | `POST/GET /api/v1/users`, `DELETE /api/v1/users/:email` |
| Dex as OIDC provider | Complete | Ships as Helm subchart with dot-ai |
| Express proxy to dot-ai | Complete | Already proxies `/api/v1/*` requests |

## Success Criteria

- Users can login via "Login with SSO" button → Dex authentication → access dashboard
- User email displayed in UI header for OAuth-authenticated users
- Token login continues to work unchanged (existing flow preserved)
- Admins can create, list, and delete Dex static users from the Users page
- E2E tests cover OAuth login flow and user management CRUD
- Documentation in dot-ai updated to link to UI user management page
