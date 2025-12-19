'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

interface SidebarProps {
  productName: string;
  productLogo?: React.ReactNode;
  navItems: NavItem[];
  footerContent?: React.ReactNode;
}

export function Sidebar({ productName, productLogo, navItems, footerContent }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 bottom-10 z-40 flex flex-col transition-all duration-300",
        "bg-[#0A1628] border-r border-white/10",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "p-4 border-b border-white/10 flex items-center",
        collapsed ? "justify-center" : "gap-3"
      )}>
        {productLogo || (
          <div className="w-8 h-8 rounded-lg bg-cyan-400/20 flex items-center justify-center flex-shrink-0">
            <span className="font-display font-bold text-cyan-400 text-sm">
              {productName.charAt(0)}
            </span>
          </div>
        )}
        {!collapsed && (
          <span className="font-display font-semibold text-white text-sm truncate">
            {productName}
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all duration-200 relative group",
                collapsed && "justify-center px-0 mx-1",
                isActive
                  ? "bg-cyan-400/15 text-cyan-400 font-medium"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              {/* Active indicator - glowing bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-cyan-400 rounded-r-full shadow-[0_0_15px_rgba(0,217,255,0.7)]" />
              )}

              <Icon className={cn("w-5 h-5 flex-shrink-0", collapsed && "mx-auto")} />

              {!collapsed && (
                <>
                  <span className="font-body text-sm">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto text-xs bg-white/10 text-white/40 px-2 py-0.5 rounded">
                      {item.badge}
                    </span>
                  )}
                </>
              )}

              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-[#1A2332] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer content (e.g., data sources) */}
      {!collapsed && footerContent && (
        <div className="px-4 py-4 border-t border-white/10">
          {footerContent}
        </div>
      )}

      {/* Theme toggle and collapse button */}
      <div className="p-2 border-t border-white/10 flex items-center justify-between">
        <ThemeToggle />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 text-white/40 hover:text-cyan-400 transition-colors rounded-lg hover:bg-white/5"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  );
}
