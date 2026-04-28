---
name: novel-deploy-debug
description: Use when the novel workspace, meta_writing integration, Cloudflare Worker /api/novel proxy, Aliyun ECS origin, nginx, PM2, Codex CLI, Cloudflare Tunnel, Mihomo proxy, or deployment environment returns 401, 520, 525, 1003, empty reply, timeout, OAuth xdg-open, missing token, or origin routing errors.
---

# Novel Deploy Debug

## Overview

Use this skill to debug the novel workspace deployment as a layered system. Do not guess from one curl result; prove where the request stops: browser auth, Worker route, Worker origin fetch, Cloudflare/Aliyun network, nginx, PM2/Node, filesystem, or Codex CLI.

Full context and historical notes live in [docs/novel-deployment-postmortem.md](../../../docs/novel-deployment-postmortem.md). Load that report only when the short workflow below is not enough.

## Golden Path

Prefer this stable production route:

```text
Browser
-> https://zhaxiaoji.com/api/novel/*
-> Cloudflare Worker JWT auth
-> https://novel-origin.zhaxiaoji.com
-> Cloudflare Tunnel
-> ECS localhost:3001
-> Express /novel/*
-> /var/www/novel_generator/meta_writing
```

Set Worker vars to the Tunnel hostname:

```toml
ECS_BT_URL = "https://novel-origin.zhaxiaoji.com"
ECS_NOVEL_URL = "https://novel-origin.zhaxiaoji.com"
```

Avoid long-term Worker origins that use:

- `https://bt.zhaxiaoji.com` or another Cloudflare-proxied site origin.
- Bare ECS IP such as `http://47.111.227.91:3001`.
- `origin-bt.zhaxiaoji.com` if Aliyun returns `Server: Beaver` / ICP blocking externally.
- `nip.io` / unusual ports as the final architecture unless Tunnel is unavailable.

## First Checks

Always start by checking the concrete layer that failed.

```bash
cd /var/www/wolfgame

pm2 logs bt-server --lines 80
ss -lntp | grep -E '3001|8080|80|443'
curl --noproxy '*' -i http://127.0.0.1:3001/health
curl --noproxy '*' -i http://127.0.0.1:3001/novel/projects

grep -nE "ECS_BT_URL|ECS_NOVEL_URL" wrangler.toml
npm exec -- wrangler whoami
```

If proxy variables exist, bypass them for local and own-domain tests:

```bash
curl --noproxy '*' -i https://zhaxiaoji.com/api/health
export NO_PROXY="127.0.0.1,localhost,::1,zhaxiaoji.com,.zhaxiaoji.com"
export no_proxy="$NO_PROXY"
```

## Error Map

| Symptom | Meaning | Next action |
|---|---|---|
| `401 No token provided` | Worker route is alive; Authorization header is missing | Re-login, check token length, use a one-shot login test script |
| `525 SSL handshake failed` | Cloudflare cannot complete TLS to origin | Do not assume ECS curl proves public success; check external curl and prefer Tunnel |
| `error code: 1003` | Cloudflare rejected bare IP origin | Use a hostname or Tunnel |
| `520` from `campaign=<origin>` | Cloudflare origin fetch failed or received invalid upstream response | Use `tcpdump`; if no packet reaches ECS, fix Worker origin path or use Tunnel |
| `Empty reply from server` | Often proxy pollution or crashing backend | Use `--noproxy`, PM2 logs, and `ss` |
| `xdg-open` during deploy | Wrangler has no API token and tries OAuth | Export `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` |
| `Cannot find package better-sqlite3` | server dependencies missing | `npm install --prefix server`, then restart PM2 |
| Vite HTML from `/novel/projects` | nginx SPA fallback caught backend path | Add a `/novel/` proxy location |

## Worker Proxy Rules

Do not forward browser headers wholesale to ECS. Use clean headers:

```js
const headers = new Headers();
const contentType = request.headers.get('Content-Type');
if (contentType) headers.set('Content-Type', contentType);
headers.set('Accept', 'application/json');
headers.set('X-Zhaxiaoji-User-Id', String(user.sub));
headers.set('X-Zhaxiaoji-Username', user.username || '');
```

Check the deployed file:

```bash
grep -n "const headers" -A10 workers/auth/novel.js
```

Then deploy:

```bash
npm exec -- wrangler deploy --assets ./dist
```

Confirm output includes the intended origin:

```text
env.ECS_NOVEL_URL ("https://novel-origin.zhaxiaoji.com")
```

## Authentication Test

Use a one-shot test instead of relying on a shell `$TOKEN` that disappears across sessions:

```bash
novel-projects-test
```

Expected success:

```text
token length: 192
HTTP/2 200
{"success":true,"projects":[...]}
```

If testing manually:

```bash
TOKEN="$(curl --noproxy '*' -sS -X POST "https://zhaxiaoji.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}' | jq -r '.token // empty')"

echo "token length: ${#TOKEN}"
curl --noproxy '*' -i "https://zhaxiaoji.com/api/novel/projects" \
  -H "Authorization: Bearer ${TOKEN}"
```

## Network Proof

When Worker origin fetch behavior is unclear, prove whether traffic reaches ECS:

```bash
timeout 30 tcpdump -ni any tcp port 80
timeout 30 tcpdump -ni any tcp port 8080
```

Interpretation:

- `GET /novel/projects` plus `HTTP/1.1 200 OK`: ECS/nginx/Node responded; investigate Worker/Cloudflare response handling.
- No Cloudflare inbound packet: request did not reach ECS; investigate Worker origin, DNS, Cloudflare restrictions, or use Tunnel.
- SYNs without HTTP: connection path exists but transfer is blocked or reset.

Ignore Aliyun metadata traffic such as `100.100.100.200:80`; it is not Worker origin traffic.

## Cloudflare Tunnel Recovery

If direct public origin routing keeps producing 520/525/1003 or Aliyun `Beaver`, move to Tunnel.

1. Create a Cloudflare Tunnel named `wolfgame-novel`.
2. Install `cloudflared` on ECS.
3. Run the Cloudflare-provided `cloudflared service install <token>` command.
4. Add Public Hostname:

```text
novel-origin.zhaxiaoji.com -> HTTP localhost:3001
```

5. Verify:

```bash
systemctl status cloudflared --no-pager
curl --noproxy '*' -i https://novel-origin.zhaxiaoji.com/health
curl --noproxy '*' -i https://novel-origin.zhaxiaoji.com/novel/projects
```

6. Point Worker vars to `https://novel-origin.zhaxiaoji.com` and redeploy.

After Tunnel is stable, remove temporary public ECS security-group rules for `3001` and `8080`.

## PM2 And Codex Environment

PM2 should have:

```bash
NOVEL_WORKSPACE_DIR="/var/www/novel_generator/meta_writing"
CODEX_HOME="/root/.codex"
NOVEL_CODEX_ARGS="exec --full-auto --skip-git-repo-check"
HTTP_PROXY="http://127.0.0.1:7890"
HTTPS_PROXY="http://127.0.0.1:7890"
ALL_PROXY="socks5://127.0.0.1:7890"
NO_PROXY="127.0.0.1,localhost,::1,zhaxiaoji.com,.zhaxiaoji.com"
```

Restart and persist:

```bash
pm2 restart ecosystem.config.cjs --update-env
pm2 save
pm2 env 0 | grep -E "NOVEL|CODEX|PROXY|NO_PROXY|PORT"
```

## Security Cleanup

After the system is working:

- Rotate any Cloudflare API token or website password that appeared in terminal history or chat.
- Keep `/root/.config/wolfgame/*.env` root-only: `chmod 600`.
- Remove temporary `3001/3001` and `8080/8080` security-group rules when Tunnel is used.
- Consider an `X-Origin-Token` between Worker and ECS for defense in depth.
