/**
 * 邮件服务模块 - 使用 Resend API
 */

/**
 * 生成随机验证令牌
 * @param {number} length - 令牌长度
 * @returns {string} 随机令牌
 */
export function generateToken(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    token += chars[randomValues[i] % chars.length];
  }
  return token;
}

/**
 * 发送邮件（使用 Resend API）
 * @param {Object} env - 环境变量
 * @param {Object} options - 邮件选项
 * @param {string} options.to - 收件人
 * @param {string} options.subject - 主题
 * @param {string} options.html - HTML内容
 */
export async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || 'Battle Web <noreply@resend.dev>',
        to: [to],
        subject,
        html
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', result);
      return { success: false, error: result.message || 'Failed to send email' };
    }

    return { success: true, id: result.id };
  } catch (error) {
    console.error('Send email error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 发送邮箱验证邮件
 */
export async function sendVerificationEmail(env, { email, username, token }) {
  const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">欢迎加入 Battle Web！</h2>
      <p>你好 ${username}，</p>
      <p>请点击下面的按钮验证你的邮箱地址：</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verifyUrl}"
           style="background-color: #f59e0b; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 6px; display: inline-block;">
          验证邮箱
        </a>
      </div>
      <p>或者复制以下链接到浏览器：</p>
      <p style="color: #666; word-break: break-all;">${verifyUrl}</p>
      <p style="color: #999; font-size: 12px;">此链接24小时内有效。如果你没有注册账户，请忽略此邮件。</p>
    </div>
  `;

  return sendEmail(env, {
    to: email,
    subject: '验证你的 Battle Web 邮箱',
    html
  });
}

/**
 * 发送密码重置邮件
 */
export async function sendPasswordResetEmail(env, { email, username, token }) {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">重置密码</h2>
      <p>你好 ${username}，</p>
      <p>我们收到了你的密码重置请求。点击下面的按钮设置新密码：</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}"
           style="background-color: #f59e0b; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 6px; display: inline-block;">
          重置密码
        </a>
      </div>
      <p>或者复制以下链接到浏览器：</p>
      <p style="color: #666; word-break: break-all;">${resetUrl}</p>
      <p style="color: #999; font-size: 12px;">此链接1小时内有效。如果你没有请求重置密码，请忽略此邮件。</p>
    </div>
  `;

  return sendEmail(env, {
    to: email,
    subject: '重置你的 Battle Web 密码',
    html
  });
}
