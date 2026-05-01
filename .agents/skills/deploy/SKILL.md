---
name: deploy
description: Build, release, and verify this wolfgame site. Use when the user asks to deploy, publish, go online, push a UI/static-site change, update Cloudflare Workers/Assets, or decide whether Aliyun ECS/PM2 also needs changes.
---

# Deploy

Use this for the normal release path of this repo. Keep it practical: verify first, deploy only a fresh build, then prove production has the new asset.

## Decide The Release Surface

Before running deploy commands, inspect the diff and classify the change:

```powershell
git status --short --branch
git diff --stat
```

- `public/`, `src/`, `index.html`, CSS, React UI, static Thinking Library pages: build and deploy Cloudflare Assets. Aliyun ECS does not need a PM2 restart.
- `workers/`, `wrangler.toml`, migrations, auth/API Worker code: build/deploy Cloudflare Worker and verify `/api/health`.
- `server/`, `ecosystem.config.cjs`, server `package*.json`, novel/Codex backend, werewolf session backend: sync to Aliyun ECS, install dependencies if needed, restart PM2 with `--update-env`, then deploy Cloudflare if frontend/Worker assets also changed.
- docs-only changes: commit/push only unless the user explicitly wants Cloudflare redeployed.

If the change touches both frontend and backend, do backend/ECS first, then Cloudflare Assets.

## Local Verification

Run the checks that match the risk. For normal UI/frontend releases, run the full test suite and build:

```powershell
npm.cmd test
npm.cmd run build
```

For tiny static HTML/CSS/JS-only edits, at minimum run:

```powershell
node --check public/site/assets/content.js
node --check public/site/assets/script.js
git diff --check
npm.cmd run build
```

Never deploy after a failed build. `wrangler deploy` will otherwise redeploy the previous `dist`.

## Commit And Push

Stage only intended files. Never stage `.env`, logs, live API keys, Cloudflare tokens, or passwords.

```powershell
git add <intended-files>
git diff --cached --stat
git diff --cached --check
git diff --cached | rg "sk-cp-t_|sk-api-|cfat_|cr_[A-Za-z0-9]|123456|api[_-]?key|token|password" -i
git commit -m "type: concise summary"
git push origin main
```

If the secret scan exits with `1` and no output, that means `rg` found nothing. Treat real matches as blockers and inspect before committing.

## Cloudflare Deploy

Deploy from the freshly built `dist`:

```powershell
npm.cmd run deploy
```

Equivalent command:

```powershell
npm exec -- wrangler deploy --assets ./dist
```

Expected output includes:

```text
Uploaded wolfgame
Deployed wolfgame triggers
Current Version ID: ...
```

For this project, Worker bindings should normally remain:

```text
env.ECS_BT_URL ("https://novel-origin.zhaxiaoji.com")
env.ECS_NOVEL_URL ("https://novel-origin.zhaxiaoji.com")
```

If Wrangler opens OAuth or reports missing `xdg-open`, the shell is missing `CLOUDFLARE_API_TOKEN`; restore the environment token before deploying.

## Aliyun ECS Path

Only use this section when server-side code or PM2 environment must change.

```bash
cd /var/www/wolfgame
git status --short
git pull --ff-only
npm install
npm install --prefix server
pm2 restart ecosystem.config.cjs --update-env
pm2 save
```

If ECS has local edits, do not reset them. Stash first:

```bash
git stash push -u -m "ecs backup before deploy $(date +%F-%H%M%S)"
git pull --ff-only
```

Useful ECS checks:

```bash
curl --noproxy '*' -i http://127.0.0.1:3001/health
curl --noproxy '*' -i https://novel-origin.zhaxiaoji.com/health
pm2 env 0 | grep -E "NOVEL|CODEX|CLAUDE|MINIMAX|PROXY|NO_PROXY|PORT"
```

Static-only releases do not require ECS changes. The production site is served by Cloudflare Assets after `wrangler deploy --assets ./dist`.

## Production Verification

Always verify production with a marker from the change:

```powershell
curl.exe -s -L "https://zhaxiaoji.com/api/health"
curl.exe -s -L "https://zhaxiaoji.com/site/index.html?v=<commit>" | Select-String -Pattern "<known marker>"
curl.exe -s -L "https://zhaxiaoji.com/site/assets/content.js?v=<commit>" | Select-String -Pattern "<known marker>"
```

For bundled React assets, find the built file and grep the deployed copy:

```powershell
Get-ChildItem dist/assets | Where-Object Name -match "^NovelWorkspace-.*\.js$"
curl.exe -s "https://zhaxiaoji.com/assets/<asset-name>" | Select-String -Pattern "Codex conversation"
```

If production contains the marker but the browser still looks old, ask for hard refresh, DevTools Disable cache, or an incognito window.

## Common Failure Modes

- `git pull` on ECS updates code only; it does not update Cloudflare pages.
- `wrangler deploy` after failed build publishes stale `dist`.
- PM2 keeps old env unless restarted with `--update-env`.
- Local `curl` may be routed through proxy env vars; use `--noproxy '*'` for localhost/origin checks.
- `525` usually means Cloudflare cannot complete TLS with origin; verify `https://novel-origin.zhaxiaoji.com/health`.
- `520` or timeout on proxied backend routes usually needs origin logs, Worker bindings, and ECS security group checks.
