import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

type StatVariant = 'default' | 'primary' | 'success' | 'warning' | 'info';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: StatVariant;
  className?: string;
}

const variantConfig = {
  default: {
    light: 'bg-white border-l-slate-300',
    dark: 'dark:bg-[#1a2332] dark:border-l-slate-600',
    number: 'text-slate-900 dark:text-white',
    iconBg: 'bg-slate-100 dark:bg-white/10',
    iconColor: 'text-slate-600 dark:text-slate-400',
  },
  primary: {
    light: 'bg-gradient-to-br from-white to-cyan-50/50 border-l-cyan-400',
    dark: 'dark:bg-gradient-to-br dark:from-[#1a2332] dark:to-cyan-900/20 dark:border-l-cyan-400',
    number: 'text-cyan-700 dark:text-cyan-400',
    iconBg: 'bg-cyan-100 dark:bg-cyan-400/20',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
  },
  success: {
    light: 'bg-gradient-to-br from-white to-emerald-50/50 border-l-emerald-400',
    dark: 'dark:bg-gradient-to-br dark:from-[#1a2332] dark:to-emerald-900/20 dark:border-l-emerald-400',
    number: 'text-emerald-700 dark:text-emerald-400',
    iconBg: 'bg-emerald-100 dark:bg-emerald-400/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    light: 'bg-gradient-to-br from-white to-amber-50/50 border-l-amber-400',
    dark: 'dark:bg-gradient-to-br dark:from-[#1a2332] dark:to-amber-900/20 dark:border-l-amber-400',
    number: 'text-amber-700 dark:text-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-400/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    light: 'bg-gradient-to-br from-white to-blue-50/50 border-l-blue-400',
    dark: 'dark:bg-gradient-to-br dark:from-[#1a2332] dark:to-blue-900/20 dark:border-l-blue-400',
    number: 'text-blue-700 dark:text-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-400/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  className
}: StatCardProps) {
  const config = variantConfig[variant];

  return (
    <div className={cn(
      "rounded-xl border-l-4 border border-slate-200 dark:border-white/10 p-6 shadow-md transition-all duration-200",
      "hover:-translate-y-0.5 hover:border-cyan-400/50",
      "hover:shadow-[0_4px_20px_rgba(0,217,255,0.15)]",
      "dark:hover:shadow-[0_4px_20px_rgba(0,217,255,0.25)]",
      config.light,
      config.dark,
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className={cn("font-display text-4xl font-bold mt-1 tracking-tight", config.number)}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>

        {Icon && (
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", config.iconBg)}>
            <Icon className={cn("w-6 h-6", config.iconColor)} />
          </div>
        )}
      </div>
    </div>
  );
}
