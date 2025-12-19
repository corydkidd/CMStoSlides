'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Sidebar, type NavItem } from './Sidebar';
import { AdvientBar } from './AdvientBar';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
  productName: string;
  navItems: NavItem[];
  sidebarFooter?: React.ReactNode;
}

export function MainLayout({ children, productName, navItems, sidebarFooter }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { theme } = useTheme();

  // Persist sidebar state
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved) setSidebarCollapsed(saved === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-200",
      theme === 'dark'
        ? "bg-[#0A1628]"
        : "bg-gradient-to-b from-slate-50 to-slate-100"
    )}>
      <Sidebar
        productName={productName}
        navItems={navItems}
        footerContent={sidebarFooter}
      />

      <main className={cn(
        "transition-all duration-300 pb-12 min-h-screen",
        sidebarCollapsed ? "ml-16" : "ml-60"
      )}>
        <div className="p-6 animate-fade-in">
          {children}
        </div>
      </main>

      <AdvientBar productName={productName} />
    </div>
  );
}
