/**
 * 密码加密模块 - 使用Web Crypto API实现bcrypt风格的密码哈希
 * 适用于Cloudflare Workers环境
 */

const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const HASH_LENGTH = 32;

/**
 * 生成随机盐值
 */
function generateSalt() {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * 将Uint8Array转换为十六进制字符串
 */
function toHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 将十六进制字符串转换为Uint8Array
 */
function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * 使用PBKDF2派生密钥
 */
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    HASH_LENGTH * 8
  );

  return new Uint8Array(derivedBits);
}

/**
 * 哈希密码
 * @param {string} password - 明文密码
 * @returns {Promise<string>} 格式: iterations$salt$hash
 */
export async function hashPassword(password) {
  const salt = generateSalt();
  const hash = await deriveKey(password, salt);

  // 返回格式: iterations$salt$hash
  return `${ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

/**
 * 验证密码
 * @param {string} password - 明文密码
 * @param {string} storedHash - 存储的哈希值
 * @returns {Promise<boolean>} 是否匹配
 */
export async function verifyPassword(password, storedHash) {
  try {
    const [iterations, saltHex, hashHex] = storedHash.split('$');

    if (!iterations || !saltHex || !hashHex) {
      return false;
    }

    const salt = fromHex(saltHex);
    const expectedHash = fromHex(hashHex);
    const actualHash = await deriveKey(password, salt);

    // 时间常量比较，防止时序攻击
    if (actualHash.length !== expectedHash.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < actualHash.length; i++) {
      result |= actualHash[i] ^ expectedHash[i];
    }

    return result === 0;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}
