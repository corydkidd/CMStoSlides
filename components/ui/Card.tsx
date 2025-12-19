import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hover?: boolean;
}

export function Card({ children, className, hover = true, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-6 transition-all duration-200",
        // Light mode
        "bg-white border-slate-200 shadow-md",
        // Dark mode
        "dark:bg-[#1a2332] dark:border-white/10",
        // Hover effects (if enabled)
        hover && [
          "hover:-translate-y-0.5",
          "hover:border-cyan-400/50",
          "hover:shadow-[0_4px_20px_rgba(0,217,255,0.15)]",
          "dark:hover:shadow-[0_4px_20px_rgba(0,217,255,0.25)]",
        ],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("font-display text-lg font-semibold text-slate-900 dark:text-white", className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-slate-500 dark:text-slate-400 mt-1", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("", className)} {...props}>
      {children}
    </div>
  );
}
