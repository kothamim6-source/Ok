import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { QuickLinkButton } from '../../types';

export const QUICK_BUTTON_STYLES: Record<
  QuickLinkButton['style'],
  { label: string; className: string; dotClass: string }
> = {
  red: {
    label: 'Red Glow',
    className:
      'bg-gradient-to-r from-red-600 to-rose-600 text-white border border-red-400/40 shadow-[0_2px_12px_rgba(220,38,38,0.4)] hover:brightness-110 rounded-lg',
    dotClass: 'bg-red-500',
  },
  blue: {
    label: 'Ocean Blue',
    className:
      'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border border-blue-400/40 shadow-[0_2px_12px_rgba(37,99,235,0.4)] hover:brightness-110 rounded-full',
    dotClass: 'bg-blue-500',
  },
  emerald: {
    label: 'Emerald',
    className:
      'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border border-emerald-400/40 shadow-[0_2px_12px_rgba(16,185,129,0.4)] hover:brightness-110 rounded-md',
    dotClass: 'bg-emerald-500',
  },
  amber: {
    label: 'Gold VIP',
    className:
      'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-black border border-yellow-200/60 shadow-[0_2px_12px_rgba(245,158,11,0.45)] hover:brightness-105 rounded-xl font-extrabold',
    dotClass: 'bg-amber-400',
  },
  purple: {
    label: 'Royal Purple',
    className:
      'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white border border-purple-400/40 shadow-[0_2px_12px_rgba(147,51,234,0.4)] hover:brightness-110 rounded-lg',
    dotClass: 'bg-purple-500',
  },
  pink: {
    label: 'Neon Pink',
    className:
      'bg-pink-600/20 text-pink-200 border border-pink-500/60 shadow-[0_2px_12px_rgba(236,72,153,0.3)] hover:bg-pink-600/35 rounded-full',
    dotClass: 'bg-pink-500',
  },
  cyan: {
    label: 'Cyber Cyan',
    className:
      'bg-cyan-500/15 text-cyan-200 border border-cyan-400/50 shadow-[0_2px_12px_rgba(6,182,212,0.3)] hover:bg-cyan-500/30 rounded-md',
    dotClass: 'bg-cyan-400',
  },
  orange: {
    label: 'Sunset Orange',
    className:
      'bg-gradient-to-r from-orange-500 to-red-500 text-white border border-orange-300/40 shadow-[0_2px_12px_rgba(249,115,22,0.4)] hover:brightness-110 rounded-xl',
    dotClass: 'bg-orange-500',
  },
};

export const DEFAULT_QUICK_BUTTONS: QuickLinkButton[] = [
  { id: 'qb_default_1', label: '🔥 Trending Now', url: '/trending', style: 'red', openInNewTab: false },
  { id: 'qb_default_2', label: '👑 VIP Membership', url: '/premium', style: 'amber', openInNewTab: false },
  { id: 'qb_default_3', label: '✈️ Join Telegram', url: 'https://t.me/', style: 'blue', openInNewTab: true },
  { id: 'qb_default_4', label: '📂 Categories', url: '/categories', style: 'purple', openInNewTab: false },
  { id: 'qb_default_5', label: '📱 Download App', url: '/download', style: 'emerald', openInNewTab: false },
  { id: 'qb_default_6', label: '⚡ Watch Later', url: '/watch-later', style: 'cyan', openInNewTab: false },
];

export function QuickButtonsBar({ buttonsOverride }: { buttonsOverride?: QuickLinkButton[] }) {
  const { settings } = useSettingsStore();
  const buttons = buttonsOverride ?? settings?.quickButtons ?? DEFAULT_QUICK_BUTTONS;

  if (!buttons || buttons.length === 0) return null;

  return (
    <div className="w-full flex flex-wrap items-center justify-center sm:justify-start gap-1.5 py-0.5">
      {buttons.map((btn) => {
        const styleDef = QUICK_BUTTON_STYLES[btn.style] || QUICK_BUTTON_STYLES.red;
        const baseClasses = `inline-flex items-center gap-1 px-2 py-1 text-[10px] sm:text-[11px] leading-tight font-bold tracking-wide transition-all duration-200 active:scale-95 ${styleDef.className}`;
        const trimmedUrl = (btn.url || '').trim();
        const isInternal = trimmedUrl.startsWith('/');

        if (isInternal && !btn.openInNewTab) {
          return (
            <Link key={btn.id} to={trimmedUrl} className={baseClasses}>
              <span>{btn.label}</span>
            </Link>
          );
        }

        const href = trimmedUrl || '#';
        return (
          <a
            key={btn.id}
            href={href}
            target={btn.openInNewTab !== false ? '_blank' : undefined}
            rel={btn.openInNewTab !== false ? 'noopener noreferrer' : undefined}
            className={baseClasses}
          >
            <span>{btn.label}</span>
            {!isInternal && <ExternalLink className="w-2.5 h-2.5 opacity-80 shrink-0" />}
          </a>
        );
      })}
    </div>
  );
}
