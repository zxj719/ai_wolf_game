/**
 * JWT工具模块 - 使用Web Crypto API（Cloudflare Workers兼容）
 */

const ALGORITHM = 'HS256';
const TOKEN_EXPIRY_HOURS = 24;

/**
 * Base64URL编码
 */
function base64urlEncode(data) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64URL解码
 */
function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 获取签名密钥
 */
async function getSigningKey(secret) {
  const encoder = new TextEncoder();
  return await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * 生成JWT Token
 * @param {Object} payload - Token载荷
 * @param {string} secret - 签名密钥
 * @returns {Promise<string>} JWT Token
 */
export async function signToken(payload, secret) {
  const header = { alg: ALGORITHM, typ: 'JWT' };

  // 设置过期时间
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + TOKEN_EXPIRY_HOURS * 60 * 60
  };

  const encoder = new TextEncoder();
  const headerB64 = base64urlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(encoder.encode(JSON.stringify(tokenPayload)));

  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await getSigningKey(secret);

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signingInput)
  );

  const signatureB64 = base64urlEncode(signature);

  return `${signingInput}.${signatureB64}`;
}

/**
 * 验证JWT Token
 * @param {string} token - JWT Token
 * @param {string} secret - 签名密钥
 * @returns {Promise<Object|null>} 解码的载荷，无效时返回null
 */
export async function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // 验证签名
    const encoder = new TextEncoder();
    const signingInput = `${headerB64}.${payloadB64}`;
    const key = await getSigningKey(secret);
    const signature = base64urlDecode(signatureB64);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(signingInput)
    );

    if (!isValid) return null;

    // 解码载荷
    const decoder = new TextDecoder();
    const payloadBytes = base64urlDecode(payloadB64);
    const payload = JSON.parse(decoder.decode(payloadBytes));

    // 检查过期时间
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}
