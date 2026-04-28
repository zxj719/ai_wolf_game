---
name: sync-deploy
description: Use when local changes must be published through GitHub, Aliyun ECS, PM2, and Cloudflare Workers/Assets, especially when frontend updates, novel workspace changes, wrangler deploys, dirty ECS worktrees, stale dist assets, or PM2 environment refreshes are involved.
---

# Sync Deploy

## Purpose

Use this skill for end-to-end release work in this repo: local edits -> GitHub -> Aliyun ECS -> PM2 backend -> Cloudflare Worker/Assets.

Full human-facing guide: [docs/local-github-aliyun-cloudflare-sync.md](../../../docs/local-github-aliyun-cloudflare-sync.md).

## Local Before Push

```powershell
cd C:\Users\xingj\Documents\agent\wolfgame
git status --short
git diff --stat
npm.cmd test
npm.cmd run build
git add <changed-files>
git diff --cached --stat
git diff --cached | rg "cr_[A-Za-z0-9]+|cfat_[A-Za-z0-9]+|123456|api[_-]?key|token|password" -i
git commit -m "type: concise summary"
git push origin main
```

Never stage `.env`, logs, live API keys, Cloudflare tokens, or website passwords.

## ECS Pull

```bash
cd /var/www/wolfgame
git status --short
git pull --ff-only
```

If pull is blocked by local ECS edits:

```bash
git stash push -u -m "ecs hotfix backup before deploy $(date +%F-%H%M%S)"
git pull --ff-only
```

Do not use `git reset --hard` unless the user explicitly approves discarding ECS changes.

## Backend Deploy

```bash
npm install
npm install --prefix server

pm2 restart ecosystem.config.cjs --update-env
pm2 save
pm2 env 0 | grep -E "NOVEL|CODEX|PROXY|NO_PROXY|PORT"
```

Expected novel env:

```text
NOVEL_WORKSPACE_DIR=/var/www/novel_generator/meta_writing
CODEX_HOME=/root/.codex
NOVEL_CODEX_ARGS=exec --full-auto --skip-git-repo-check
```

Verify backend and Tunnel:

```bash
curl --noproxy '*' -i http://127.0.0.1:3001/health
curl --noproxy '*' -i http://127.0.0.1:3001/novel/projects
curl --noproxy '*' -i https://novel-origin.zhaxiaoji.com/health
```

## Frontend And Cloudflare Deploy

Build must pass before deploying assets:

```bash
npm run build || exit 1
npm exec -- wrangler deploy --assets ./dist
```

Cloudflare output should show:

```text
env.ECS_BT_URL ("https://novel-origin.zhaxiaoji.com")
env.ECS_NOVEL_URL ("https://novel-origin.zhaxiaoji.com")
Uploaded wolfgame
Deployed wolfgame triggers
```

If `npm run build` reports `node_modules/.bin/vite: Permission denied`:

```bash
chmod +x node_modules/.bin/vite
chmod +x node_modules/vite/bin/vite.js
npm run build || node node_modules/vite/bin/vite.js build
```

## Post-Deploy Checks

```bash
curl --noproxy '*' -i https://zhaxiaoji.com/api/health
novel-projects-test
```

For UI changes, verify the built and deployed asset contains a known marker:

```bash
grep -R "Codex conversation" dist/assets
NOVEL_ASSET="$(ls dist/assets | grep '^NovelWorkspace-.*\.js$' | head -n 1)"
curl -s "https://zhaxiaoji.com/assets/$NOVEL_ASSET" | grep "Codex conversation"
```

If online asset contains the marker but the browser does not, instruct a hard refresh, DevTools Disable cache, or an incognito window.

## Common Traps

- `git pull` updates ECS only. It does not deploy Cloudflare Assets.
- `wrangler deploy` after a failed build redeploys old `dist`.
- PM2 keeps old env until restarted with `--update-env`.
- Worker vars must use the Tunnel origin: `https://novel-origin.zhaxiaoji.com`.
- Local curl tests should use `--noproxy '*'` when proxy env vars are set.
