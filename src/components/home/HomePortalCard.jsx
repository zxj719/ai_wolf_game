import { ArrowRight, ArrowUpRight } from 'lucide-react';

const TONES = {
  forest: {
    shell: 'border-line bg-bg-raised shadow-card',
    badge: 'bg-accent text-white',
    icon: 'bg-accent text-white',
    accent: 'text-ink',
    primary: 'bg-accent text-white hover:bg-accent-hover',
    secondary: 'border-line text-ink hover:bg-bg-sunken',
  },
  rust: {
    shell: 'border-line bg-bg-raised shadow-card',
    badge: 'bg-accent text-white',
    icon: 'bg-accent text-white',
    accent: 'text-ink',
    primary: 'bg-accent text-white hover:bg-accent-hover',
    secondary: 'border-line text-ink hover:bg-bg-sunken',
  },
  ink: {
    shell: 'border-line bg-bg-raised shadow-card',
    badge: 'bg-accent text-white',
    icon: 'bg-accent text-white',
    accent: 'text-ink',
    primary: 'bg-accent text-white hover:bg-accent-hover',
    secondary: 'border-line text-ink hover:bg-bg-sunken',
  },
};

function ActionButton({ action, className, children }) {
  if (!action) {
    return null;
  }

  const icon = action.external ? <ArrowUpRight size={16} /> : <ArrowRight size={16} />;

  if (action.href) {
    return (
      <a
        href={action.href}
        target={action.external ? '_blank' : undefined}
        rel={action.external ? 'noreferrer noopener' : undefined}
        className={className}
      >
        {children}
        {icon}
      </a>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={className}>
      {children}
      {icon}
    </button>
  );
}

export function HomePortalCard({
  eyebrow,
  title,
  description,
  badge,
  icon: Icon,
  tone = 'ink',
  primaryAction,
  secondaryAction,
}) {
  const colors = TONES[tone] ?? TONES.ink;

  return (
    <article className={`rounded-[30px] border p-6 transition-transform duration-300 hover:-translate-y-1 ${colors.shell}`}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${colors.icon}`}>
          <Icon size={24} />
        </div>
        {badge ? (
          <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.22em] ${colors.badge}`}>
            {badge}
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">{eyebrow}</p>
        <h3 className={`font-display text-3xl leading-tight ${colors.accent}`}>{title}</h3>
        <p className="text-sm leading-7 text-ink-muted">{description}</p>
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <ActionButton
          action={primaryAction}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${colors.primary}`}
        >
          {primaryAction?.label}
        </ActionButton>

        <ActionButton
          action={secondaryAction}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${colors.secondary}`}
        >
          {secondaryAction?.label}
        </ActionButton>
      </div>
    </article>
  );
}
