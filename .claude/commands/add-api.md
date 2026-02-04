# 添加新 API 端点

添加新的后端 API 端点需要修改以下文件：

## 步骤

1. **后端处理函数** - `workers/auth/handlers.js`
   - 添加 `export async function handleXxx(request, env) { ... }`
   - 使用 `authMiddleware` 验证登录状态
   - 使用 `jsonResponse` 和 `errorResponse` 返回结果

2. **后端路由** - `workers/auth/index.js`
   - 导入新的处理函数
   - 在路由表添加对应的 URL 和方法

3. **前端服务** - `src/services/authService.js`
   - 添加调用新 API 的方法

## 示例代码模板

```javascript
// workers/auth/handlers.js
export async function handleNewFeature(request, env) {
  try {
    const { user, error } = await authMiddleware(request, env);
    if (error) {
      return errorResponse(error, 401, env, request);
    }

    // 业务逻辑...

    return jsonResponse({
      success: true,
      data: result
    }, 200, env, request);
  } catch (error) {
    return errorResponse('Failed: ' + error.message, 500, env, request);
  }
}
```
