# DevAssure — Troubleshooting

Concise troubleshooting for login and network issues. Official sources: [WebApp Login](https://www.devassure.io/docs/DevAssure/Troubleshooting/WebApp%20Login/) and [VPN Configuration](https://www.devassure.io/docs/DevAssure/Troubleshooting/Vpnconfiguration/).

---

## WebApp login — "Something went wrong"

If you see **"Something went wrong"** while logging in (for example at [app.devassure.io](https://app.devassure.io)), try the following.

### 1. Use HTTPS for the application URL

- Open the app using **`https://`** in the address bar, not `http://`.
- Mixed or insecure pages can break login flows; confirm the visible URL starts with `https://`.

### 2. Browser security and mixed content

- Some browsers block insecure or mixed content on HTTPS pages.
- Check the browser’s site permissions and security settings so HTTPS content can load normally.

### 3. Firewall or antivirus

- Corporate firewalls or antivirus can interfere with HTTPS or OAuth redirects.
- Temporarily disable or relax rules to see if login works; if it does, add exceptions for DevAssure and related domains (see [VPN and host allowlist](#vpn-and-host-allowlist) below).

### Still stuck?

Contact [DevAssure Support](https://www.devassure.io/) if the steps above do not resolve the issue.

---

## VPN and host allowlist

If you use a **VPN**, ensure these hosts are allowed so DevAssure (including CLI installs, auth, and services) can reach required endpoints:

| Host |
|------|
| `app.devassure.io` |
| `nodejs.org` |
| `registry.npmjs.org` |
| `googleapis.com` |
| `devassure-llm-2e2fa73b953b.herokuapp.com` |

Verify connectivity (e.g. DNS resolution and HTTPS) to these hosts from your VPN profile. Blocking any of them can cause login failures, install failures, or runtime errors.

### CLI-related note

The CLI uses Node/npm (`nodejs.org`, `registry.npmjs.org`) for installation and updates; `app.devassure.io` is used for the web app and authentication flows. If something fails only on VPN, compare behavior with VPN off or adjust the allowlist first.

---

## Related

- Full CLI commands and config: `cli-reference.md` in this folder.
- Proxy: set `HTTP_PROXY` / `HTTPS_PROXY` if your environment requires a proxy (see main skill `SKILL.md`).
