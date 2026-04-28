# 本地修改同步到 GitHub、阿里云 ECS 与 Cloudflare 的部署手册

本文档用于本项目的日常发布：在本地修改代码，提交到 GitHub，再同步到阿里云 ECS，最后部署 Cloudflare Worker 与静态资源。

核心原则：

- 本地是唯一长期编辑入口。服务器上的手动热修只能用于临时恢复，之后必须回写到本地、提交、推送。
- `git pull` 只更新 ECS 代码，不会更新 Cloudflare 上的前端页面。前端变更必须 `npm run build` 后再 `wrangler deploy --assets ./dist`。
- 构建失败必须停止。不要在旧 `dist` 上继续部署。
- 任何真实 token、密码、API key 都不能写入仓库。

## 1. 本地修改与验证

在 Windows 本机仓库：

```powershell
cd C:\Users\xingj\Documents\agent\wolfgame
git status --short
```

修改代码后先检查差异：

```powershell
git diff
git diff --stat
```

运行验证：

```powershell
npm.cmd test
npm.cmd run build
```

如果只改了文档，可以不跑完整构建，但如果改了以下路径，必须构建：

- `src/**`
- `workers/**`
- `server/**`
- `package.json`
- `wrangler.toml`
- `ecosystem.config.cjs`

提交前扫一遍 staged diff，避免密钥进入仓库：

```powershell
git diff --cached | rg "cr_[A-Za-z0-9]+|cfat_[A-Za-z0-9]+|123456|api[_-]?key|token|password" -i
```

这条命令可能会扫到占位符或变量名。发现真实密钥时必须先移除再提交。

## 2. 提交并推送 GitHub

只 stage 本次相关文件，避免把 `.env`、日志、临时文件带进去：

```powershell
git add <file1> <file2>
git status --short
git diff --cached --stat
git commit -m "feat: describe the change"
git push origin main
```

推送后确认：

```powershell
git log --oneline -3
```

## 3. 阿里云 ECS 拉取 GitHub 正式版本

登录 ECS 后：

```bash
cd /var/www/wolfgame
git status --short
```

如果工作区干净：

```bash
git pull --ff-only
```

如果有服务器热修挡住 `git pull`：

```bash
git stash push -u -m "ecs hotfix backup before deploy $(date +%F-%H%M%S)"
git pull --ff-only
git stash list | head
```

不要直接 `git reset --hard`，除非你明确确认服务器上的改动已经不需要。

拉取后确认版本：

```bash
git log --oneline -3
git status --short
```

## 4. 安装依赖

常规执行：

```bash
npm install
npm install --prefix server
```

如果只改了文档，可以跳过依赖安装。如果改了 `package.json` 或 `server/package.json`，不要跳过。

## 5. 重启 ECS 后端

PM2 配置应使用这些关键环境：

```bash
NOVEL_WORKSPACE_DIR=/var/www/novel_generator/meta_writing
CODEX_HOME=/root/.codex
NOVEL_CODEX_ARGS="exec --full-auto --skip-git-repo-check"
NO_PROXY="127.0.0.1,localhost,::1,zhaxiaoji.com,.zhaxiaoji.com"
```

重启：

```bash
pm2 restart ecosystem.config.cjs --update-env
pm2 save
pm2 env 0 | grep -E "NOVEL|CODEX|PROXY|NO_PROXY|PORT"
```

健康检查：

```bash
curl --noproxy '*' -i http://127.0.0.1:3001/health
curl --noproxy '*' -i http://127.0.0.1:3001/novel/projects
curl --noproxy '*' -i https://novel-origin.zhaxiaoji.com/health
curl --noproxy '*' -i https://novel-origin.zhaxiaoji.com/novel/projects
```

## 6. 构建前端

前端改动必须重新构建：

```bash
cd /var/www/wolfgame
npm run build || exit 1
```

如果出现：

```text
/var/www/wolfgame/node_modules/.bin/vite: Permission denied
```

修复可执行权限：

```bash
chmod +x node_modules/.bin/vite
chmod +x node_modules/vite/bin/vite.js
npm run build || exit 1
```

仍然不行时绕过 `.bin`：

```bash
node node_modules/vite/bin/vite.js build || exit 1
```

如果你刚改了某段 UI 文案，可以先确认 `dist` 确实包含新内容：

```bash
grep -R "Codex conversation" dist/assets
grep -R "manual chapter workflow" dist/assets
```

没有结果就不要部署，说明构建产物还是旧的或构建失败。

## 7. 部署 Cloudflare Worker 与 Assets

部署：

```bash
npm exec -- wrangler deploy --assets ./dist
```

输出必须包含当前生产回源：

```text
env.ECS_BT_URL ("https://novel-origin.zhaxiaoji.com")
env.ECS_NOVEL_URL ("https://novel-origin.zhaxiaoji.com")
Uploaded wolfgame
Deployed wolfgame triggers
Current Version ID: ...
```

如果 Wrangler 试图 OAuth 并报 `xdg-open`，说明当前 shell 没有 Cloudflare API token：

```bash
export CLOUDFLARE_ACCOUNT_ID="YOUR_ACCOUNT_ID"
export CLOUDFLARE_API_TOKEN="YOUR_TOKEN"
npm exec -- wrangler whoami
```

不要把真实 token 写入仓库。长期做法是放在 root-only 的服务器环境文件中，例如 `/root/.config/wolfgame/cloudflare.env`，权限 `600`，部署前 `source`。

## 8. 发布后验证

API：

```bash
curl --noproxy '*' -i https://zhaxiaoji.com/api/health
novel-projects-test
```

前端资产：

```bash
NOVEL_ASSET="$(ls dist/assets | grep '^NovelWorkspace-.*\.js$' | head -n 1)"
echo "$NOVEL_ASSET"
curl -s "https://zhaxiaoji.com/assets/$NOVEL_ASSET" | grep "Codex conversation"
```

如果线上 asset 能 grep 到新文案，但浏览器页面没变化：

- `Ctrl + F5` 强刷。
- DevTools Network 勾选 `Disable cache` 后刷新。
- 用无痕窗口打开 `https://zhaxiaoji.com/novel`。

## 9. 常见故障对照

| 现象 | 根因 | 处理 |
|---|---|---|
| `npm run build` 报 `vite: Permission denied` | `node_modules/.bin/vite` 无执行权限 | `chmod +x node_modules/.bin/vite node_modules/vite/bin/vite.js` |
| `wrangler deploy` 显示 `No updated asset files`，页面没变 | build 失败，仍在部署旧 `dist` | 先让 `npm run build` 成功，再 grep `dist/assets` |
| `git pull` 被本地改动阻止 | ECS 有热修或脏工作区 | `git stash push -u -m "..."; git pull --ff-only` |
| Codex 报 `CODEX_HOME ... does not exist` | PM2 环境指错 | `CODEX_HOME=/root/.codex` 并 `pm2 restart ... --update-env` |
| Codex 卡在 `Reading additional input from stdin...` | 后端旧代码没有关闭 stdin | 确认 `server/novelWorkspace.js` 有 `stdio: ['ignore', 'pipe', 'pipe']` |
| `/api/novel/*` 返回 525 | Worker 回源 TLS 失败 | 确认 `ECS_NOVEL_URL=https://novel-origin.zhaxiaoji.com`，并测试 Tunnel |
| `novel-origin` 200 但 `zhaxiaoji.com/api/novel` 不对 | Worker 未部署或路由未命中 | 重新 `wrangler deploy`，确认 bindings 和 `Current Version ID` |

## 10. 推荐的一次完整发布命令

在 ECS 上用于已经 `git push` 后的完整发布：

```bash
set -euo pipefail

cd /var/www/wolfgame

git status --short
git pull --ff-only

npm install
npm install --prefix server

npm run build

pm2 restart ecosystem.config.cjs --update-env
pm2 save

npm exec -- wrangler deploy --assets ./dist

curl --noproxy '*' -i http://127.0.0.1:3001/health
curl --noproxy '*' -i https://novel-origin.zhaxiaoji.com/health
curl --noproxy '*' -i https://zhaxiaoji.com/api/health
```

如果 `git pull --ff-only` 因为本地改动失败，回到第 3 节处理，不要跳过。
