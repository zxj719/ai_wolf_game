# 部署项目

执行以下步骤部署到 Cloudflare：

1. 构建前端
2. 部署到 Cloudflare Workers

```bash
npm run build && npm run deploy
```

部署完成后检查：
- 网站是否正常访问
- API 是否正常响应
- **统一域名**：前端 `VITE_AUTH_API_URL` 必须指向 `https://zhaxiaoji.com`，避免指向任何 `*.workers.dev`
- **数据库唯一**：所有后端 API 必须走 `zhaxiaoji.com/api/*`，确保 D1 绑定唯一且明确
