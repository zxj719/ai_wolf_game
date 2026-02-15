# ModelScope 令牌验证失败排查指南

## 问题现象
在一台设备上令牌验证失败，但另一台设备可以通过。

## 排查步骤

### 1. 检查浏览器控制台
打开浏览器开发者工具（F12），查看 Console 和 Network 标签：

**查找关键信息：**
```
[AuthService] Request: POST https://...
[AuthService] Response status: xxx
```

**常见错误模式：**
- `Failed to fetch` → 网络连接问题
- `CORS error` → 跨域配置问题
- `Status 401/403` → 令牌无效
- `Status 500` → 后端错误
- `请求超时` → 网络延迟或 Workers 超时

### 2. 检查网络环境

#### 2.1 测试 ModelScope API 连通性
在浏览器控制台运行：
```javascript
fetch('https://api-inference.modelscope.cn/v1/models')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

**结果分析：**
- ✅ 返回数据 → ModelScope API 可访问
- ❌ `CORS error` / `Failed to fetch` → 网络阻止了 ModelScope 域名

#### 2.2 检查代理/VPN
- 关闭 VPN 重试
- 禁用浏览器代理重试
- 切换网络（如移动热点）重试

#### 2.3 检查防火墙
某些企业网络会阻止：
- `api-inference.modelscope.cn`
- Cloudflare Workers 域名

### 3. 检查环境配置

#### 3.1 前端 API 配置
检查浏览器控制台的日志：
```
[AuthService] API_BASE: xxx
```

**正确配置应该是：**
- 生产环境：`https://zhaxiaoji.com` 或空（同源）
- 本地开发：`http://localhost:8787`

#### 3.2 创建 .env 文件（如果不存在）
```bash
# 如果使用自定义域名部署
VITE_AUTH_API_URL=https://zhaxiaoji.com

# 或留空使用同源
# VITE_AUTH_API_URL=
```

**注意：** 修改 .env 后需要重启开发服务器或重新构建！

### 4. 清除浏览器缓存

#### 4.1 清除应用数据
1. 打开开发者工具（F12）
2. Application 标签
3. Storage → Clear site data
4. 刷新页面重新登录

#### 4.2 清除浏览器缓存
- Chrome: Ctrl+Shift+Delete
- 选择"Cookies 和其他网站数据"
- 清除最近 1 小时的数据

### 5. 检查 Cloudflare Workers 日志

如果你有 Cloudflare 账号访问权限：

```bash
# 实时查看 Workers 日志
wrangler tail

# 或在 Cloudflare Dashboard 查看
# Workers & Pages → auth → Logs
```

**查找错误：**
- `Token verification failed: xxx`
- `fetch failed` → Workers 无法访问 ModelScope API
- `timeout` → API 响应超时

### 6. 尝试手动验证令牌

在浏览器控制台运行：
```javascript
// 替换 YOUR_TOKEN 为你的实际令牌
const token = 'YOUR_TOKEN';

fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'qwen/Qwen2.5-Coder-32B-Instruct',
    messages: [{ role: 'user', content: 'Hi' }],
    max_tokens: 5
  })
})
.then(r => {
  console.log('Status:', r.status);
  return r.json();
})
.then(data => console.log('Response:', data))
.catch(err => console.error('Error:', err));
```

**结果分析：**
- Status 200 + 有 choices → 令牌完全正常，问题在后端
- Status 401/403 → 令牌无效或过期
- Status 402 → 未完成阿里云绑定/实名认证
- CORS/Network error → 浏览器无法访问 ModelScope

## 常见解决方案

### 方案 1：网络问题
**症状：** 控制台显示 `network_error` 或 `Failed to fetch`

**解决：**
- 切换到其他网络（如移动热点）
- 关闭 VPN/代理
- 联系网络管理员解除对 ModelScope 的阻止

### 方案 2：API 配置问题
**症状：** 请求发往错误的 URL

**解决：**
```bash
# 创建 .env 文件
echo "VITE_AUTH_API_URL=https://zhaxiaoji.com" > .env

# 重新构建
npm run build
npm run deploy
```

### 方案 3：浏览器缓存问题
**症状：** 显示旧的令牌状态

**解决：**
- F12 → Application → Clear site data
- 重新登录并配置令牌

### 方案 4：Workers 地理位置问题
**症状：** 其他设备正常，当前设备失败

**解决：**
这可能是 Cloudflare Workers 在某些地区访问 ModelScope 不稳定。
等待几分钟后重试，或联系管理员检查 Workers 日志。

### 方案 5：令牌确实无效
**症状：** 手动验证也失败（Status 401/402）

**解决：**
1. 确认已完成阿里云绑定：https://modelscope.cn/docs/accounts/aliyun-binding-and-authorization
2. 确认已完成实名认证：https://help.aliyun.com/zh/account/account-verification-overview
3. 重新生成令牌：https://modelscope.cn/my/access/token

## 快速诊断脚本

在浏览器控制台粘贴以下代码，获取完整诊断信息：

```javascript
(async function diagnose() {
  console.group('🔍 ModelScope 令牌诊断');

  // 1. 检查环境配置
  console.log('1️⃣ 环境配置:');
  console.log('  - API Base:', import.meta.env.VITE_AUTH_API_URL || '(same-origin)');
  console.log('  - Dev Mode:', import.meta.env.DEV);

  // 2. 检查本地存储
  console.log('\n2️⃣ 本地存储:');
  console.log('  - Auth Token:', localStorage.getItem('auth_token') ? '✓ 存在' : '✗ 不存在');

  // 3. 测试 ModelScope 连通性
  console.log('\n3️⃣ ModelScope API 连通性测试:');
  try {
    const r = await fetch('https://api-inference.modelscope.cn/v1/models', {
      method: 'GET',
      mode: 'cors'
    });
    console.log('  - Status:', r.status);
    console.log('  - 结果:', r.ok ? '✅ 可访问' : '❌ 访问异常');
  } catch (e) {
    console.log('  - 结果: ❌ 无法访问');
    console.log('  - 错误:', e.message);
  }

  // 4. 检查当前认证状态
  console.log('\n4️⃣ 认证状态:');
  const authToken = localStorage.getItem('auth_token');
  if (authToken) {
    try {
      const apiBase = import.meta.env.VITE_AUTH_API_URL || '';
      const url = apiBase ? `${apiBase}/api/user/verify-modelscope-token` : '/api/user/verify-modelscope-token';
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await r.json();
      console.log('  - 令牌状态:', data);
    } catch (e) {
      console.log('  - 验证失败:', e.message);
    }
  } else {
    console.log('  - 未登录');
  }

  console.groupEnd();
  console.log('\n📋 请将以上信息截图反馈给开发者');
})();
```

## 需要更多帮助？

如果以上步骤都无法解决，请：
1. 运行快速诊断脚本并截图
2. 提供浏览器控制台的完整错误日志
3. 说明你的网络环境（家庭/企业/校园网络）
4. 提交 Issue：https://github.com/zhaxiaoji/ai-wolf-game/issues
