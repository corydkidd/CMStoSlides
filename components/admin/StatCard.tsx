'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div className={cn(
      "p-6 rounded-xl border transition-all duration-200",
      "bg-white dark:bg-[#1A2332]",
      "border-slate-200 dark:border-white/10",
      "hover:shadow-md hover:border-cyan-400/30",
      className
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-lg bg-cyan-100 dark:bg-cyan-400/20">
          <Icon className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
        </div>
        {trend && (
          <div className={cn(
            "text-sm font-medium",
            trend.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}>
            {trend.isPositive ? '+' : ''}{trend.value}
          </div>
        )}
      </div>
      <div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{title}</p>
        <p className="stat-number text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
