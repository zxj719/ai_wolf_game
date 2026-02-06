---
name: add-api
description: 新增 Cloudflare Workers API 端点，并在前端封装调用。
---

目标：在后端 `workers/auth/*` 新增一个 API，并在前端 `src/services/authService.js` 增加调用封装，保持错误处理与鉴权一致。

## 步骤

1. 后端处理函数：`workers/auth/handlers.js`
   - 新增 `export async function handleXxx(request, env) { ... }`
   - 复用 `authMiddleware` 做登录校验
   - 统一用 `jsonResponse` / `errorResponse` 返回

2. 后端路由：`workers/auth/index.js`
   - import 新增的 handler
   - 在路由表里添加对应 URL 与 HTTP method

3. 前端封装：`src/services/authService.js`
   - 新增一个方法调用该 API（复用现有 token/header 逻辑）

## 参考模板

```js
// workers/auth/handlers.js
export async function handleNewFeature(request, env) {
  try {
    const { user, error } = await authMiddleware(request, env);
    if (error) return errorResponse(error, 401, env, request);

    // business logic...

    return jsonResponse({ success: true, data: result }, 200, env, request);
  } catch (err) {
    return errorResponse('Failed: ' + err.message, 500, env, request);
  }
}
```

