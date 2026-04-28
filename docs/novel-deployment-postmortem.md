# 小说工作台部署排障复盘报告

日期：2026-04-28  
项目：`wolfgame` 前端 / Cloudflare Worker / 阿里云 ECS / `meta_writing` 小说工作区

## 1. 背景

本次目标是把本地 `meta_writing` 小说生成工作流接入现有网站，提供一个与 AI 狼人杀平级的「小说工作台」入口。用户登录后可以查看自己的小说项目、章节列表、章节内容、Story Bible，并通过 Codex 生成下一章。

最终链路涉及多个组件：

```text
浏览器
-> https://zhaxiaoji.com/novel
-> Cloudflare Worker: /api/novel/*
-> ECS Node/Express: /novel/*
-> /var/www/novel_generator/meta_writing
-> Codex CLI
```

其中真正困难的部分不是应用代码，而是公网回源链路：Cloudflare Worker 如何稳定、安全地访问部署在阿里云 ECS 上的小说后端。

## 2. 最终稳定方案

最终推荐并收束的稳定架构是使用 Cloudflare Tunnel，让 ECS 主动连出到 Cloudflare，避免 Worker 直接回源 ECS 公网 IP 或未备案域名。

```text
浏览器
-> https://zhaxiaoji.com/api/novel/projects
-> Cloudflare Worker 鉴权
-> https://novel-origin.zhaxiaoji.com
-> Cloudflare Tunnel
-> ECS localhost:3001
-> Express /novel/projects
```

这个方案绕开了以下问题：

- 阿里云对未备案 Host 的 `Beaver / Non-compliance ICP Filing` 拦截。
- Cloudflare Worker 不能直接 fetch IP literal 导致的 `error code: 1003`。
- Cloudflare Worker 对非标准端口或动态 DNS 回源不稳定导致的 `520`。
- Cloudflare 到同一 Cloudflare 代理域名回源时可能出现的 `525 SSL handshake failed`。

最终 Worker 变量应固定为类似：

```toml
[vars]
ECS_BT_URL = "https://novel-origin.zhaxiaoji.com"
ECS_NOVEL_URL = "https://novel-origin.zhaxiaoji.com"
```

Tunnel Public Hostname 指向：

```text
novel-origin.zhaxiaoji.com -> http://localhost:3001
```

## 3. 应用侧实现概览

本次集成新增了三层能力。

前端：

- 新增 `/novel` 路由。
- 新增小说工作台 UI：项目列表、章节列表、章节详情、Story Bible、Guidance、Learned Rules。
- 通过现有登录态调用 `/api/novel/*`。

Cloudflare Worker：

- 新增 `/api/novel/*` 代理。
- 先验证 JWT。
- 再把请求转发到 ECS 小说服务。

ECS Node/Express：

- 新增 `/novel/projects`。
- 新增 `/novel/projects/:project`。
- 新增 `/novel/projects/:project/chapters/:chapter`。
- 新增 `/novel/projects/:project/generate`。
- 新增 `/novel/jobs/:jobId`。
- 读取 `NOVEL_WORKSPACE_DIR=/var/www/novel_generator/meta_writing`。
- 生成章节时启动 Codex CLI。

一个关键修正是 Worker 小说代理不应把浏览器原始请求头整包转发到 ECS，而应只转发必要的干净头：

```js
const headers = new Headers();
const contentType = request.headers.get('Content-Type');
if (contentType) headers.set('Content-Type', contentType);
headers.set('Accept', 'application/json');
headers.set('X-Zhaxiaoji-User-Id', String(user.sub));
headers.set('X-Zhaxiaoji-Username', user.username || '');
```

原因是原始请求头里可能包含 `cf-*`、`Host`、`Authorization`、浏览器缓存和代理相关头，转发到上游会让 Cloudflare 子请求和 ECS 回源之间出现难以解释的 520/异常响应。

## 4. 试错时间线与结论

### 4.1 Shell 环境变量写法错误

一开始在 Linux 服务器上执行了 PowerShell 写法：

```powershell
$env:NOVEL_WORKSPACE_DIR = "/var/www/novel_generator/meta_writing"
```

Bash 返回：

```text
:NOVEL_WORKSPACE_DIR: command not found
```

结论：

Linux bash 必须使用：

```bash
export NOVEL_WORKSPACE_DIR="/var/www/novel_generator/meta_writing"
export CODEX_HOME="/root/.codex"
export NOVEL_CODEX_ARGS="exec --full-auto --skip-git-repo-check"
```

PowerShell 的 `$env:` 语法只能在 Windows PowerShell 中使用。

### 4.2 Mihomo / Clash 安装与订阅格式问题

GitHub 下载 Mihomo 时出现 0 字节、代理下载只有 9 字节、gzip 校验失败等问题：

```text
gzip: mihomo.gz: not in gzip format
```

另外，订阅链接一开始返回的是 base64 节点列表，而不是 Clash/Mihomo YAML，导致：

```text
yaml: line 6: could not find expected ':'
```

排查方式：

```bash
nl -ba /etc/mihomo/config.yaml | sed -n '1,30p'
file /etc/mihomo/config.yaml
grep -E "mixed-port|allow-lan|bind-address|mode:" /etc/mihomo/config.yaml
```

最终经验：

- Mihomo 配置必须是 YAML，包含 `proxies:`、`proxy-groups:`、`rules:` 等。
- 纯 `vmess://`、`trojan://`、`ss://`、`socks://` 列表不能直接作为 `/etc/mihomo/config.yaml`。
- 服务启动后要用 `journalctl` 和 `ss` 判断是否真正监听，不能只看 `systemctl status` 一瞬间的 active。

最终验证：

```bash
curl -I --proxy http://127.0.0.1:7890 https://www.google.com
```

返回 `HTTP/2 200` 后，说明 ECS 出站代理可用。

### 4.3 `meta_writing` Python 版本不是阻塞项

在 ECS 上安装 `meta_writing` Python 包时报错：

```text
Package 'meta-writing' requires a different Python: 3.10.12 not in '>=3.12'
```

结论：

网站后端当前主要读取文件系统中的：

```text
novels/*
chapters/*
story_data/*
```

章节生成交给 Codex CLI 手动执行。因此 Python 3.12 不是网站集成的硬性前置条件。只有需要运行 `meta_writing` Python CLI、pytest 或 Python 自动 runner 时，才必须升级 Python。

### 4.4 本地后端 `Empty reply` 与代理污染

访问本地服务时曾出现：

```text
curl: (52) Empty reply from server
```

后来发现 curl 使用了代理环境：

```text
Uses proxy env variable ALL_PROXY == 'socks5://127.0.0.1:7890'
```

这会导致访问 `127.0.0.1:3001` 也绕进代理，产生误判。

正确做法：

```bash
curl --noproxy 127.0.0.1,localhost -v http://127.0.0.1:3001/health
export NO_PROXY="127.0.0.1,localhost,::1"
export no_proxy="127.0.0.1,localhost,::1"
```

经验：

在服务器上同时配置代理和本地服务时，所有本机健康检查必须显式 bypass proxy。

### 4.5 PM2 后端依赖缺失

PM2 显示进程 online，但本地端口 initially 不通。日志显示：

```text
Cannot find package 'better-sqlite3' imported from /var/www/wolfgame/server/db.js
```

修复：

```bash
cd /var/www/wolfgame
npm install --prefix server
pm2 restart bt-server --update-env
```

经验：

PM2 `online` 不代表业务端口可用。必须同时检查：

```bash
pm2 logs bt-server --lines 80
ss -lntp | grep 3001
curl --noproxy '*' http://127.0.0.1:3001/health
```

### 4.6 nginx 缺少 `/novel/` 代理

访问：

```bash
curl -L https://bt.zhaxiaoji.com/novel/projects
```

返回了 Vite 前端 HTML，而不是小说 JSON。

原因：

nginx 只有 SPA fallback：

```nginx
location / { try_files $uri $uri/ /index.html; }
```

缺少 `/novel/` 代理。

修复：

```nginx
location /novel/ {
    proxy_pass http://127.0.0.1:3001/novel/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
}
```

验证：

```bash
curl --noproxy '*' http://127.0.0.1:3001/novel/projects
curl -L https://bt.zhaxiaoji.com/novel/projects
```

### 4.7 Cloudflare Worker 未登录与 API Token 环境丢失

Linux 上运行部署时曾出现：

```text
Attempting to login via OAuth...
Missing file or directory: xdg-open
```

原因：

当前 shell 没有 `CLOUDFLARE_API_TOKEN`，Wrangler 退回浏览器 OAuth 登录。服务器没有图形界面，无法打开浏览器。

正确做法：

```bash
export CLOUDFLARE_ACCOUNT_ID="..."
export CLOUDFLARE_API_TOKEN="..."
npm exec -- wrangler whoami
npm exec -- wrangler deploy --assets ./dist
```

经验：

生产服务器应把部署环境放在 root-only 文件中，例如：

```bash
/root/.config/wolfgame/cloudflare.env
```

并在 `/root/.bashrc` 中加载，避免每次 SSH 后环境变量消失。

### 4.8 401 不一定是后端错误

多次访问：

```bash
curl -i https://zhaxiaoji.com/api/novel/projects
```

返回：

```json
{"success":false,"error":"No token provided"}
```

这在未携带 JWT 时是正确行为。后来又遇到 `$TOKEN` 在子脚本中存在，但不会回写到当前 shell 的情况，手动 curl 仍然 401。

经验：

- `401 No token provided` 说明 Worker 鉴权正常工作。
- Shell 变量不会跨 SSH 会话保存。
- 脚本内部变量不会自动保留到父 shell。
- 自动测试脚本应在内部登录并立即请求。

示例：

```bash
TOKEN="$(
  curl --noproxy '*' -sS -X POST "https://zhaxiaoji.com/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | jq -r '.token // empty'
)"
```

### 4.9 `525 SSL handshake failed`

当 Worker 指向：

```toml
ECS_NOVEL_URL = "https://origin-bt.zhaxiaoji.com"
```

浏览器/接口出现：

```text
HTTP/2 525
SSL handshake failed
```

期间做过几轮验证：

```bash
dig @1.1.1.1 +short origin-bt.zhaxiaoji.com
curl --noproxy '*' -v https://origin-bt.zhaxiaoji.com/health
openssl s_client -connect origin-bt.zhaxiaoji.com:443 -servername origin-bt.zhaxiaoji.com
```

本机 ECS 访问 HTTPS 能成功，证书也正确：

```text
subject: CN=origin-bt.zhaxiaoji.com
issuer: Let's Encrypt
SSL certificate verify ok
```

但从外部访问同一域名时出现 connection reset 或 `Server: Beaver`。

结论：

证书不是唯一问题。阿里云对带域名 Host 的公网请求存在备案/接入层拦截，导致 Cloudflare 外部回源失败。

### 4.10 Certbot HTTP-01 与 DNS-01

HTTP-01 失败：

```text
Invalid response from http://origin-bt.zhaxiaoji.com/.well-known/acme-challenge/...: 403
```

手动 `ping` 文件 200，但 certbot 临时 challenge 仍 403。后来改用 DNS-01。

DNS-01 一开始也失败：

```text
Error determining zone_id: 6003 Invalid request headers
Invalid API Token
```

排查：

```bash
curl -sS \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  https://api.cloudflare.com/client/v4/user/tokens/verify \
  | jq .
```

成功状态：

```json
{
  "success": true,
  "messages": [
    {
      "message": "This API Token is valid and active"
    }
  ]
}
```

经验：

- Certbot DNS 插件的 token 文件必须只包含纯 token。
- 不要写 `Bearer`。
- 不要写 `export CLOUDFLARE_API_TOKEN=...`。
- 不要写引号。
- Token 权限至少需要 `Zone:Read` 和 `DNS:Edit`。

### 4.11 IP literal 触发 Cloudflare 1003

将 Worker 上游改成：

```toml
ECS_NOVEL_URL = "http://47.111.227.91:3001"
```

返回：

```text
error code: 1003
```

结论：

Cloudflare Worker 不适合直接 fetch IP literal 作为上游。必须使用域名，或使用 Cloudflare Tunnel。

### 4.12 `nip.io` 与非标准端口的 520

试过：

```text
http://47.111.227.91.nip.io:3001
http://47.111.227.91.nip.io:8080
http://47.111.227.91.nip.io
http://47-111-227-91.nip.io
```

普通外部 curl 可返回 200：

```text
HTTP/1.1 200 OK
Server: nginx/1.18.0
```

但 Worker 访问仍可能返回：

```text
error code: 520
```

关键证据：

```bash
timeout 30 tcpdump -ni any tcp port 80
```

抓包中没有看到 Cloudflare Worker 进来的 `/novel/projects` 请求，说明 520 发生在 Cloudflare 到 `nip.io` 的子请求阶段，并未真正进入 ECS。

经验：

- 外部普通 curl 200，不等于 Worker 子请求一定 200。
- Worker 回源受到 Cloudflare 自身的端口、DNS、IP、Host、代理策略约束。
- `tcpdump` 是判断请求有没有进 ECS 的最终证据。

### 4.13 `tcpdump` 是排障分水岭

成功进入 ECS 的抓包类似：

```text
In  IP 172.71.x.x > 172.31.x.x.8080: HTTP: GET /novel/projects HTTP/1.1
Out IP 172.31.x.x.8080 > 172.71.x.x: HTTP: HTTP/1.1 200 OK
```

这说明：

```text
Cloudflare -> ECS 已通
nginx 已响应
应用已返回
```

如果没有类似入站请求，就不能继续在 Node/nginx 里找问题，应回到 Cloudflare 回源路径。

## 5. 最终经验总结

### 5.1 不要把“服务器本机 curl 成功”当成公网成功

ECS 自己访问 `origin-bt.zhaxiaoji.com` 时，可能走本地解析、本地网络、内网路径或代理绕行。Cloudflare Worker 是从外部网络回源，路径完全不同。

公网判断至少要看：

```bash
curl --noproxy '*' -v http://域名/路径
curl --noproxy '*' -v https://域名/路径
tcpdump -ni any tcp port 80
```

### 5.2 看到 Cloudflare 错误码要先分层

本次遇到的错误码含义：

```text
401 No token provided
  Worker 鉴权正常，请求没带 JWT。

525 SSL handshake failed
  Cloudflare 到源站 TLS 握手失败，常见于证书/SNI/回源 Host/同 Cloudflare 回源/源站接入层问题。

1003
  Cloudflare 拒绝 fetch IP literal 或不允许的直接 IP 访问。

520
  Cloudflare 到源站发生未知错误；如果 tcpdump 没看到请求，说明请求未进 ECS。

52 Empty reply from server
  经常是代理或后端进程异常导致，必须结合 curl -v、PM2 logs、ss 判断。
```

### 5.3 代理环境会污染本地测试

当存在：

```bash
HTTP_PROXY
HTTPS_PROXY
ALL_PROXY
```

访问本机服务、自有域名、Cloudflare API 时都可能走代理。测试本机和自有站点时建议：

```bash
curl --noproxy '*' ...
```

或设置：

```bash
export NO_PROXY="127.0.0.1,localhost,::1,zhaxiaoji.com,.zhaxiaoji.com"
export no_proxy="$NO_PROXY"
```

### 5.4 PM2 online 不等于服务可用

必须同时验证：

```bash
pm2 logs bt-server --lines 80
ss -lntp | grep 3001
curl --noproxy '*' http://127.0.0.1:3001/health
```

### 5.5 Worker 回源要尽量简单

Worker 代理上游时，推荐：

- 不转发浏览器原始 headers。
- 不转发 `Authorization` 到 ECS，除非 ECS 明确需要。
- 用 Worker 解析后的用户信息写入内部头。
- 上游响应只回传必要 headers。

推荐请求头：

```js
const headers = new Headers();
headers.set('Accept', 'application/json');
headers.set('X-Zhaxiaoji-User-Id', String(user.sub));
headers.set('X-Zhaxiaoji-Username', user.username || '');
```

### 5.6 长期方案优先 Cloudflare Tunnel

对于中国大陆 ECS + Cloudflare Worker + 未备案/多域名/多端口回源组合，Cloudflare Tunnel 是最少坑的方案。

优点：

- 不需要公网开放 Node 端口。
- 不依赖阿里云 80/443 Host 接入层。
- 不触发 IP literal 限制。
- Cloudflare 到 Cloudflare 内部链路更稳定。
- 可以减少安全组暴露面。

## 6. 推荐的最终运维状态

### 6.1 ECS 安全组

Tunnel 跑通后，建议关闭临时开放端口：

```text
3001/3001
8080/8080
```

保留必要端口：

```text
22    SSH
80    可选，给普通 nginx/证书续期或临时调试
443   可选，给普通 nginx/证书续期或临时调试
```

如果所有公网入口都迁移到 Tunnel，80/443 也可以再评估是否收紧。

### 6.2 PM2 环境

建议固定：

```bash
NOVEL_WORKSPACE_DIR="/var/www/novel_generator/meta_writing"
CODEX_HOME="/root/.codex"
NOVEL_CODEX_ARGS="exec --full-auto --skip-git-repo-check"
HTTP_PROXY="http://127.0.0.1:7890"
HTTPS_PROXY="http://127.0.0.1:7890"
ALL_PROXY="socks5://127.0.0.1:7890"
NO_PROXY="127.0.0.1,localhost,::1,zhaxiaoji.com,.zhaxiaoji.com"
```

重启：

```bash
pm2 restart ecosystem.config.cjs --update-env
pm2 save
```

### 6.3 Wrangler 环境

避免每次 SSH 后丢失：

```bash
/root/.config/wolfgame/cloudflare.env
```

并在 `/root/.bashrc` 中加载。

### 6.4 自动测试脚本

保留一个测试脚本用于端到端验证：

```bash
novel-projects-test
```

脚本应做到：

- 自动登录。
- 打印 token length。
- 使用 `--noproxy '*'` 绕过本机代理。
- 请求 `https://zhaxiaoji.com/api/novel/projects`。

预期成功：

```text
token length: 192
HTTP/2 200
{"success":true,"projects":[...]}
```

## 7. 安全收尾建议

本次排障过程中为了推进速度，临时暴露或粘贴过敏感信息。部署稳定后建议：

1. 轮换 Cloudflare API Token。
2. 修改网站登录密码。
3. 检查 `/root/.config/wolfgame/*` 权限必须为 root-only：

```bash
chmod 700 /root/.config/wolfgame
chmod 600 /root/.config/wolfgame/*.env
```

4. 移除安全组中临时开放的 `3001`、`8080`。
5. 确认 Cloudflare Tunnel Public Hostname 没有启用会拦截 Worker 的 Zero Trust Access 登录页。
6. 后续可以给 ECS 小说后端增加内部共享密钥，例如 `X-Origin-Token`，即使 Tunnel hostname 泄露也不能被随意访问。

## 8. 一句话结论

本次排障的核心经验是：当 Cloudflare Worker、阿里云 ECS、代理、nginx、PM2、Codex 同时参与时，不能凭单点 curl 判断系统是否健康。必须逐层验证：

```text
浏览器认证
-> Worker 路由
-> Worker 回源
-> 公网/隧道链路
-> nginx
-> Node/PM2
-> 文件系统工作区
-> Codex 运行环境
```

最终稳定方案应避免公网回源的复杂组合，使用 Cloudflare Tunnel 将 ECS 本地服务安全、稳定地暴露给 Worker。
