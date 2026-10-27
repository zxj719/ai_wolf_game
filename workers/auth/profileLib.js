const LIMITS = { displayName: 30, bio: 160, location: 50, website: 200 };
export const AVATAR_COLORS = ["clay", "sage", "slate", "plum", "ochre"];

export function validatePublicProfile(body) {
  const profile = {};
  for (const [key, limit] of Object.entries(LIMITS)) {
    if (!Object.hasOwn(body, key)) continue;
    if (typeof body[key] !== "string" || body[key].trim().length > limit) {
      throw new Error(`${key} must be text with at most ${limit} characters`);
    }
    profile[key] = body[key].trim();
  }
  if (profile.website) {
    let url;
    try {
      url = new URL(profile.website);
    } catch {
      throw new Error("个人链接需要完整的 https:// 或 http:// 地址");
    }
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("个人链接仅支持 https:// 或 http:// 地址");
  }
  if (Object.hasOwn(body, "avatarColor")) {
    if (!AVATAR_COLORS.includes(body.avatarColor))
      throw new Error("Invalid avatar color");
    profile.avatarColor = body.avatarColor;
  }
  return profile;
}
