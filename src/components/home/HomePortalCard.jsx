import { ArrowRight, ArrowUpRight } from 'lucide-react';

const TONES = {
  forest: {
    shell: 'border-emerald-900/20 bg-[#f9f4ec] shadow-[0_24px_50px_rgba(16,70,58,0.12)]',
    badge: 'bg-emerald-950 text-emerald-50',
    icon: 'bg-emerald-900 text-emerald-50',
    accent: 'text-emerald-900',
    primary: 'bg-emerald-900 text-emerald-50 hover:bg-emerald-800',
    secondary: 'border-emerald-900/15 text-emerald-900 hover:bg-emerald-900/5',
  },
  rust: {
    shell: 'border-orange-900/20 bg-[#fff6ed] shadow-[0_24px_50px_rgba(154,52,18,0.12)]',
    badge: 'bg-orange-900 text-orange-50',
    icon: 'bg-orange-900 text-orange-50',
    accent: 'text-orange-900',
    primary: 'bg-orange-900 text-orange-50 hover:bg-orange-800',
    secondary: 'border-orange-900/15 text-orange-900 hover:bg-orange-900/5',
  },
  ink: {
    shell: 'border-stone-900/15 bg-[#fffdf8] shadow-[0_24px_50px_rgba(28,25,23,0.1)]',
    badge: 'bg-stone-900 text-stone-50',
    icon: 'bg-stone-900 text-stone-50',
    accent: 'text-stone-900',
    primary: 'bg-stone-900 text-stone-50 hover:bg-stone-800',
    secondary: 'border-stone-900/15 text-stone-900 hover:bg-stone-900/5',
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
        <p className="text-xs uppercase tracking-[0.3em] text-stone-500">{eyebrow}</p>
        <h3 className={`font-display text-3xl leading-tight ${colors.accent}`}>{title}</h3>
        <p className="text-sm leading-7 text-stone-600">{description}</p>
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
