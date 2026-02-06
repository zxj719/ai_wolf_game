---
name: deploy
description: 构建并部署到 Cloudflare Workers（wrangler）。
---

## 步骤

1. 构建前端
2. 部署到 Cloudflare Workers

PowerShell 推荐（避免 `&&`）：

```powershell
npm.cmd run build
npm.cmd run deploy
```

部署后检查：
- 站点是否可访问
- Workers API 是否正常响应

