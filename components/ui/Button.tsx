import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-body font-medium rounded-lg transition-all duration-200",
        // Sizes
        size === 'sm' && "px-3 py-1.5 text-sm",
        size === 'md' && "px-4 py-2 text-sm",
        size === 'lg' && "px-6 py-3 text-base",
        // Variants
        variant === 'primary' && [
          "bg-cyan-400 text-[#0A1628] font-semibold",
          "hover:bg-cyan-300 hover:shadow-[0_0_20px_rgba(0,217,255,0.3)]",
          "active:bg-cyan-500",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        ],
        variant === 'secondary' && [
          "border border-slate-200 dark:border-white/20",
          "text-slate-700 dark:text-white",
          "hover:border-cyan-400/50 hover:text-cyan-600 dark:hover:text-cyan-400",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        ],
        variant === 'ghost' && [
          "text-slate-600 dark:text-slate-300",
          "hover:bg-slate-100 dark:hover:bg-white/5",
          "hover:text-cyan-600 dark:hover:text-cyan-400",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        ],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
