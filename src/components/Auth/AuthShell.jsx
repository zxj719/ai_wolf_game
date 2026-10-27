import { ArrowLeft, Sparkles } from "lucide-react";

export function AuthShell({
  locale = "zh",
  title,
  subtitle,
  children,
  footer,
}) {
  const en = locale === "en";
  return (
    <div className="studio-home studio-auth">
      <div className="studio-container">
        <header className="studio-header">
          <a href="/" className="studio-brand">
            <span className="brand-mark">
              z<span>✳</span>
            </span>
            <span>
              zhaxiaoji<span className="brand-domain">.com</span>
            </span>
          </a>
          <a href="/" className="auth-home-link">
            <ArrowLeft size={14} />
            {en ? "Back to the playground" : "回游乐场"}
          </a>
        </header>
        <div className="auth-layout">
          <section className="auth-intro">
            <span className="studio-kicker">A SPACE FOR CURIOUS MINDS</span>
            <h1>
              {en ? (
                <>
                  Good things
                  <br />
                  start with <em>hello.</em>
                </>
              ) : (
                <>
                  好玩的事，
                  <br />
                  从相遇开始<span>。</span>
                </>
              )}
            </h1>
            <p>
              {en
                ? "Save your stories, find your people, and make this little corner of the internet your own."
                : "把喜欢的东西留下，把聊得来的人找到。\n这里，也有属于你的小小角落。"}
            </p>
            <div className="auth-postcard" aria-hidden="true">
              <Sparkles size={45} strokeWidth={1} />
              <span>glad you’re here.</span>
              <small>ZHAXIAOJI / THE PLAYGROUND</small>
            </div>
          </section>
          <section className="auth-form-panel">
            <div className="studio-kicker">MAKE YOURSELF AT HOME</div>
            <h2>{title}</h2>
            <p className="auth-subtitle">{subtitle}</p>
            {children}
            {footer && <div className="mt-8">{footer}</div>}
          </section>
        </div>
      </div>
    </div>
  );
}
