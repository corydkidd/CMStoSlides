import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'cyan' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  onClick?: () => void;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-400/20 dark:text-cyan-400',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-400/20 dark:text-red-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-400',
};

export function Badge({ children, variant = 'default', className, onClick }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium transition-colors",
        variantStyles[variant],
        onClick && "cursor-pointer hover:opacity-80",
        className
      )}
      onClick={onClick}
    >
      {children}
    </span>
  );
}
