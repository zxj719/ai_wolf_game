import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MapPin, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { Avatar } from "./Avatar";

export function ProfileEditor({ onClose, locale = "zh" }) {
  const { user, updateProfile } = useAuth();
  const en = locale === "en";
  const dialog = useRef(null);
  const [form, setForm] = useState(() => ({
    displayName: user?.displayName || "",
    bio: user?.bio || "",
    location: user?.location || "",
    website: user?.website || "",
    avatarColor: user?.avatarColor || "clay",
  }));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus(null);
  };
  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const result = await updateProfile(form);
      setStatus(
        result.success
          ? {
              success: true,
              text: en ? "Profile saved." : "资料已保存，下次见面也是新的你。",
            }
          : {
              text:
                result.error ||
                (en ? "Could not save. Please retry." : "保存失败，请重试。"),
            },
      );
    } catch (error) {
      setStatus({ text: error.message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current && !saving) onClose();
      }}
      className="studio-dialog"
      aria-labelledby="profile-title"
    >
      <div className="profile-panel">
        <header className="profile-heading">
          <div>
            <span className="studio-kicker">A LITTLE ABOUT YOU</span>
            <h2 id="profile-title">
              {en ? "Your personal corner" : "你的个人角落"}
            </h2>
          </div>
          <button
            type="button"
            className="studio-icon-button"
            onClick={onClose}
            aria-label={en ? "Close" : "关闭"}
          >
            <X size={20} />
          </button>
        </header>
        <form onSubmit={save} className="profile-form">
          <div className="profile-preview">
            <Avatar
              name={form.displayName || user?.username}
              color={form.avatarColor}
              size="large"
            />
            <div>
              <strong>{form.displayName || user?.username}</strong>
              <p>
                {form.bio ||
                  (en
                    ? "A little curiosity goes a long way."
                    : "写一句话，让大家认识你。")}
              </p>
              {form.location && (
                <small>
                  <MapPin size={12} />
                  {form.location}
                </small>
              )}
            </div>
          </div>
          <fieldset className="profile-colors">
            <legend>{en ? "Your color" : "选一个你的颜色"}</legend>
            {["clay", "sage", "slate", "plum", "ochre"].map((color, i) => (
              <button
                type="button"
                key={color}
                aria-label={
                  (en
                    ? ["Clay", "Sage", "Slate", "Plum", "Ochre"]
                    : ["陶土", "鼠尾草", "石蓝", "梅紫", "赭黄"])[i]
                }
                aria-pressed={form.avatarColor === color}
                className={`color-swatch avatar-${color}`}
                onClick={() => set("avatarColor", color)}
              >
                {form.avatarColor === color && <Check size={16} />}
              </button>
            ))}
          </fieldset>
          <label>
            {en ? "Display name" : "显示名称"}
            <input
              autoFocus
              value={form.displayName}
              onChange={(e) => set("displayName", e.target.value)}
              maxLength={30}
              placeholder={user?.username}
            />
            <small>
              {en
                ? "Up to 30 characters. Your account name stays the same."
                : "支持中文，最多 30 字。账号名保持不变。"}
            </small>
          </label>
          <label>
            {en ? "A few words about you" : "个性签名"}
            <textarea
              rows={3}
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              maxLength={160}
              placeholder={
                en
                  ? "What are you curious about lately?"
                  : "最近在好奇什么？或者，一句喜欢的话。"
              }
            />
            <small className="profile-counter">{form.bio.length} / 160</small>
          </label>
          <div className="profile-field-pair">
            <label>
              {en ? "Location" : "所在地"}
              <input
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                maxLength={50}
                placeholder={en ? "Somewhere on Earth" : "地球上的某个角落"}
              />
            </label>
            <label>
              {en ? "Personal link" : "个人链接"}
              <input
                type="url"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                maxLength={200}
                placeholder="https://"
              />
            </label>
          </div>
          <div className="profile-account">
            <span>@{user?.username}</span>
            <span>
              {en ? "Account email" : "账号邮箱"} · {user?.email}
            </span>
          </div>
          {status && (
            <p
              role={status.success ? "status" : "alert"}
              className={status.success ? "studio-success" : "studio-error"}
            >
              {status.text}
            </p>
          )}
          <footer className="profile-actions">
            <span>
              {en
                ? "Your name and signature appear to friends."
                : "名称和签名会展示给好友。"}
            </span>
            <button
              className="studio-button primary"
              disabled={saving}
              type="submit"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {saving
                ? en
                  ? "Saving…"
                  : "保存中…"
                : en
                  ? "Save changes"
                  : "保存修改"}
            </button>
          </footer>
        </form>
      </div>
    </dialog>
  );
}
