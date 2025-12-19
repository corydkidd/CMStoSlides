# Advient Advisors - Design System

**Version:** 2.0  
**Last Updated:** December 2025  
**Applies To:** All Advient digital products

---

## Design Philosophy

**"Technical Gravitas Meets Executive Presence"**

Advient products serve enterprise clients in regulated industries (pharmaceutical, maritime, industrial). Our design must:

1. **Signal AI/technology leadership** — Clients come to us because we're cutting-edge
2. **Remain approachable for business users** — Not developer tools; executive-friendly
3. **Convey premium quality** — Enterprise pricing demands enterprise polish
4. **Be consistent across products** — Unified brand experience
5. **Feel bold and distinctive** — Not generic SaaS; visibly different

**Reference aesthetic:** Bloomberg Terminal meets MIT Media Lab — sophisticated, data-informed, with visible tech flourishes (cyan glows, gradients, dark mode).

---

## Quick Start for New Products

### Essential Setup

```bash
# 1. Install dependencies
npm install next react react-dom tailwindcss framer-motion lucide-react recharts

# 2. Add Google Fonts to layout
# Space Grotesk (headers) + Inter (body)
```

### Required Components

Every Advient product must include:

1. **Advient Bar** — Bottom bar with branding (always dark)
2. **Collapsible Sidebar** — Dark navy with cyan accents
3. **Theme Toggle** — Light/dark mode support
4. **Card Hover Effects** — Cyan glow on hover
5. **Stat Cards with Color Variants** — Visible gradients + colored borders

---

## Brand Identity

### Advient Bar

Every Advient product includes the **Advient Bar** — a persistent footer that ties products together.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                      [Product Interface]                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ ADVIENT   Product Name • v0.0      [Products ▼]    [Support]   │
└─────────────────────────────────────────────────────────────────┘
```

**Specifications:**
- Height: 40px
- Background: `#0A1628` (navy-deep) — always dark regardless of theme
- Border-top: 1px solid `rgba(255, 255, 255, 0.1)`
- Position: Fixed bottom
- Z-index: 50

```tsx
// components/layout/AdvientBar.tsx

'use client';

import Link from 'next/link';
import { APP_VERSION } from '@/lib/config';

export function AdvientBar({ productName = 'Product' }: { productName?: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-10 bg-[#0A1628] border-t border-white/10 flex items-center justify-between px-6 z-50">
      {/* Left: Advient Brand */}
      <div className="flex items-center gap-3">
        <span className="font-display text-xs font-semibold uppercase tracking-wider text-cyan-400">
          Advient
        </span>
        <span className="text-white/30">|</span>
        <span className="text-xs text-white/60">
          {productName} • v{APP_VERSION}
        </span>
      </div>
      
      {/* Right: Links */}
      <div className="flex items-center gap-6">
        <Link 
          href="https://advientadvisors.com" 
          target="_blank"
          className="text-xs text-white/60 hover:text-cyan-400 transition-colors"
        >
          Products
        </Link>
        <Link 
          href="mailto:cory@advientadvisors.com"
          className="text-xs text-white/60 hover:text-cyan-400 transition-colors"
        >
          Support
        </Link>
      </div>
    </div>
  );
}
```

---

## Theme System

### Theme Context

All Advient products support light and dark modes via a theme context.

```tsx
// contexts/ThemeContext.tsx

'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('advient-theme') as Theme;
    if (stored) {
      setTheme(stored);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('advient-theme', theme);
  }, [theme, mounted]);

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  // Prevent flash
  if (!mounted) return null;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

### Theme Toggle Component

```tsx
// components/ui/ThemeToggle.tsx

'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg transition-all hover:bg-white/10 group"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5 text-white/60 group-hover:text-cyan-400 transition-colors" />
      ) : (
        <Sun className="w-5 h-5 text-white/60 group-hover:text-cyan-400 transition-colors" />
      )}
    </button>
  );
}
```

---

## Color System

### CSS Variables (Add to globals.css)

```css
:root {
  /* ============================================
     LIGHT MODE (Default)
     ============================================ */
  
  /* Backgrounds */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --bg-card: #ffffff;
  --bg-page: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  
  /* Text */
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  
  /* Borders */
  --border-primary: #e2e8f0;
  --border-secondary: #cbd5e1;
  --border-hover: rgba(0, 217, 255, 0.5);
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.05);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.05), 0 4px 6px rgba(0, 0, 0, 0.05);
  --shadow-cyan: 0 4px 20px rgba(0, 217, 255, 0.15);
  --shadow-cyan-lg: 0 8px 30px rgba(0, 217, 255, 0.2);
  
  /* Card hover glow */
  --card-hover-shadow: 0 4px 20px rgba(0, 217, 255, 0.15);
  --card-hover-border: rgba(0, 217, 255, 0.5);
  
  /* Table hover */
  --table-hover: rgba(0, 217, 255, 0.05);
}

.dark {
  /* ============================================
     DARK MODE
     ============================================ */
  
  /* Backgrounds */
  --bg-primary: #0A1628;
  --bg-secondary: #111827;
  --bg-tertiary: #1f2937;
  --bg-card: #1a2332;
  --bg-page: #0A1628;
  
  /* Text */
  --text-primary: #f1f5f9;
  --text-secondary: #cbd5e1;
  --text-muted: #64748b;
  
  /* Borders */
  --border-primary: rgba(255, 255, 255, 0.1);
  --border-secondary: rgba(255, 255, 255, 0.2);
  --border-hover: rgba(0, 217, 255, 0.5);
  
  /* Shadows - more visible cyan glow in dark mode */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.3), 0 4px 6px rgba(0, 0, 0, 0.2);
  --shadow-cyan: 0 4px 20px rgba(0, 217, 255, 0.25);
  --shadow-cyan-lg: 0 8px 30px rgba(0, 217, 255, 0.35);
  
  /* Card hover glow - brighter in dark mode */
  --card-hover-shadow: 0 4px 20px rgba(0, 217, 255, 0.25);
  --card-hover-border: rgba(0, 217, 255, 0.5);
  
  /* Table hover */
  --table-hover: rgba(0, 217, 255, 0.08);
}

/* ============================================
   FIXED COLORS (Same in both modes)
   ============================================ */

:root, .dark {
  /* Navy (sidebar, advient bar - always dark) */
  --navy-deep: #0A1628;
  --navy-medium: #1A2332;
  --navy-card: #1a2332;
  
  /* Cyan accent */
  --cyan-primary: #00D9FF;
  --cyan-400: #22d3ee;
  --cyan-500: #06b6d4;
  --cyan-600: #0891b2;
  --cyan-700: #0e7490;
  --cyan-glow: rgba(0, 217, 255, 0.2);
  --cyan-dim: rgba(0, 217, 255, 0.1);
  
  /* Semantic colors */
  --success: #10B981;
  --success-light: #D1FAE5;
  --success-dark: rgba(16, 185, 129, 0.2);
  
  --warning: #F59E0B;
  --warning-light: #FEF3C7;
  --warning-dark: rgba(245, 158, 11, 0.2);
  
  --error: #EF4444;
  --error-light: #FEE2E2;
  --error-dark: rgba(239, 68, 68, 0.2);
  
  --info: #3B82F6;
  --info-light: #DBEAFE;
  --info-dark: rgba(59, 130, 246, 0.2);
}
```

### Tailwind Configuration

```javascript
// tailwind.config.js

module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx}', './app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        navy: {
          deep: '#0A1628',
          medium: '#1A2332',
          card: '#1a2332',
        },
        cyan: {
          primary: '#00D9FF',
        },
        dark: {
          primary: '#0A1628',
          secondary: '#111827',
          tertiary: '#1f2937',
          card: '#1a2332',
        },
      },
      boxShadow: {
        'cyan': '0 4px 20px rgba(0, 217, 255, 0.15)',
        'cyan-lg': '0 8px 30px rgba(0, 217, 255, 0.2)',
        'cyan-dark': '0 4px 20px rgba(0, 217, 255, 0.25)',
        'cyan-dark-lg': '0 8px 30px rgba(0, 217, 255, 0.35)',
      },
    },
  },
  plugins: [],
};
```

---

## Typography

### Font Setup

```tsx
// app/layout.tsx

import { Space_Grotesk, Inter } from 'next/font/google';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

### Type Scale

| Class | Size | Usage |
|-------|------|-------|
| `text-xs` | 12px | Captions, labels, badges |
| `text-sm` | 14px | Secondary text, table cells |
| `text-base` | 16px | Body text |
| `text-lg` | 18px | Lead text, card titles |
| `text-xl` | 20px | Small headers |
| `text-2xl` | 24px | Section headers |
| `text-3xl` | 30px | Page titles |
| `text-4xl` | 36px | Large stats |
| `text-5xl` | 48px | Hero stats |

### Typography Classes

```css
/* Apply to elements */

/* Page title */
.page-title {
  @apply font-display text-3xl font-bold tracking-tight;
  @apply text-slate-900 dark:text-white;
}

/* Section header with cyan accent */
.section-header {
  @apply font-display text-xl font-semibold pl-4 border-l-4 border-cyan-400;
  @apply text-slate-900 dark:text-white;
}

/* Card title */
.card-title {
  @apply font-display text-lg font-semibold;
  @apply text-slate-900 dark:text-white;
}

/* Stat number - large, colored */
.stat-number {
  @apply font-display text-4xl font-bold tracking-tight;
}

/* Body text */
.body-text {
  @apply font-body text-base;
  @apply text-slate-600 dark:text-slate-300;
}

/* Muted/caption text */
.caption {
  @apply font-body text-sm;
  @apply text-slate-500 dark:text-slate-400;
}

/* Uppercase label */
.label-uppercase {
  @apply font-display text-xs font-semibold uppercase tracking-wider;
  @apply text-cyan-600 dark:text-cyan-400;
}
```

---

## Component Specifications

### Sidebar (Collapsible, Always Dark)

The sidebar uses the navy-deep background regardless of theme.

```tsx
// components/layout/Sidebar.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface NavItem {
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
```

---

### Cards with Hover Glow

All cards have visible hover effects with cyan glow.

```tsx
// components/ui/Card.tsx

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
```

---

### Stat Cards with Color Variants

Stat cards have visible gradients and colored left borders.

```tsx
// components/ui/StatCard.tsx

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

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
    gradient: '',
    gradientDark: '',
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
```

---

### Section Header with Cyan Accent

```tsx
// components/ui/SectionHeader.tsx

import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeader({ title, subtitle, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-6 pl-4 border-l-4 border-cyan-400", className)}>
      <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}
```

---

### Buttons

```tsx
// components/ui/Button.tsx

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
        ],
        variant === 'secondary' && [
          "border border-slate-200 dark:border-white/20",
          "text-slate-700 dark:text-white",
          "hover:border-cyan-400/50 hover:text-cyan-600 dark:hover:text-cyan-400",
        ],
        variant === 'ghost' && [
          "text-slate-600 dark:text-slate-300",
          "hover:bg-slate-100 dark:hover:bg-white/5",
          "hover:text-cyan-600 dark:hover:text-cyan-400",
        ],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

---

### Data Tables

```tsx
// components/ui/DataTable.tsx

import { cn } from '@/lib/utils';

interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends { id: string | number }>({ 
  columns, 
  data,
  onRowClick 
}: DataTableProps<T>) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
            {columns.map((column) => (
              <th 
                key={String(column.key)}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {data.map((row) => (
            <tr 
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={cn(
                "transition-colors",
                "hover:bg-cyan-50/50 dark:hover:bg-cyan-400/5",
                onRowClick && "cursor-pointer"
              )}
            >
              {columns.map((column) => (
                <td 
                  key={String(column.key)}
                  className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300"
                >
                  {column.render 
                    ? column.render(row[column.key], row)
                    : String(row[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

### Badges

```tsx
// components/ui/Badge.tsx

import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'cyan' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-400/20 dark:text-cyan-400',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-400/20 dark:text-red-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-400',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
      variantStyles[variant],
      className
    )}>
      {children}
    </span>
  );
}
```

---

## Chart Styling

### Chart Color Palette

```typescript
// lib/chartConfig.ts

export const chartColors = {
  // Primary - always cyan first
  primary: '#00D9FF',
  
  // Categorical palette (ordered by visual distinction)
  categorical: [
    '#00D9FF',  // Cyan (primary) - always first
    '#10B981',  // Emerald
    '#F59E0B',  // Amber
    '#8B5CF6',  // Violet
    '#EC4899',  // Pink
    '#3B82F6',  // Blue
    '#EF4444',  // Red
    '#6B7280',  // Gray (last resort)
  ],
  
  // Semantic colors for specific meanings
  positive: '#10B981',
  negative: '#EF4444',
  neutral: '#6B7280',
  
  // For benefit ratings or similar scales
  scale: {
    best: '#10B981',      // Emerald
    good: '#00D9FF',      // Cyan
    moderate: '#F59E0B',  // Amber
    poor: '#94A3B8',      // Gray
    worst: '#EF4444',     // Red
  },
};

// Theme-aware chart configuration
export function getChartTheme(isDark: boolean) {
  return {
    background: isDark ? '#1a2332' : '#ffffff',
    text: isDark ? '#94a3b8' : '#64748b',
    textSecondary: isDark ? '#64748b' : '#94a3b8',
    grid: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
    
    tooltip: {
      background: isDark ? '#1f2937' : '#ffffff',
      border: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
      text: isDark ? '#f1f5f9' : '#0f172a',
    },
  };
}

// Recharts tooltip style
export function getTooltipStyle(isDark: boolean) {
  const theme = getChartTheme(isDark);
  return {
    contentStyle: {
      background: theme.tooltip.background,
      border: `1px solid ${theme.tooltip.border}`,
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      padding: '12px',
    },
    labelStyle: {
      color: theme.tooltip.text,
      fontWeight: 600,
      marginBottom: '4px',
    },
    itemStyle: {
      color: theme.tooltip.text,
      fontSize: '12px',
    },
  };
}
```

---

## Animation Guidelines

### CSS Animations (Add to globals.css)

```css
/* Fade in on page load */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out forwards;
}

/* Staggered children animation */
.animate-stagger > * {
  opacity: 0;
  animation: fadeIn 0.3s ease-out forwards;
}

.animate-stagger > *:nth-child(1) { animation-delay: 0ms; }
.animate-stagger > *:nth-child(2) { animation-delay: 50ms; }
.animate-stagger > *:nth-child(3) { animation-delay: 100ms; }
.animate-stagger > *:nth-child(4) { animation-delay: 150ms; }
.animate-stagger > *:nth-child(5) { animation-delay: 200ms; }
.animate-stagger > *:nth-child(6) { animation-delay: 250ms; }

/* Glow pulse for attention */
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 217, 255, 0.2); }
  50% { box-shadow: 0 0 20px rgba(0, 217, 255, 0.4); }
}

.animate-glow-pulse {
  animation: glowPulse 2s ease-in-out infinite;
}

/* Skeleton loading */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.dark .skeleton {
  background: linear-gradient(90deg, #1f2937 25%, #374151 50%, #1f2937 75%);
  background-size: 200% 100%;
}
```

---

## Main Layout Template

```tsx
// components/layout/MainLayout.tsx

'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Sidebar } from './Sidebar';
import { AdvientBar } from './AdvientBar';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
  productName: string;
  navItems: Array<{ href: string; label: string; icon: any; badge?: string }>;
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
```

---

## File Structure for New Products

```
/advient-[product-name]
├── /app
│   ├── layout.tsx           # Root layout with fonts, ThemeProvider
│   ├── page.tsx             # Dashboard/home
│   ├── globals.css          # CSS variables, animations
│   └── /[feature]/page.tsx  # Feature pages
├── /components
│   ├── /layout
│   │   ├── MainLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── AdvientBar.tsx
│   ├── /ui
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── StatCard.tsx
│   │   ├── Badge.tsx
│   │   ├── DataTable.tsx
│   │   ├── SectionHeader.tsx
│   │   └── ThemeToggle.tsx
│   └── /[feature]           # Feature-specific components
├── /contexts
│   └── ThemeContext.tsx
├── /lib
│   ├── config.ts            # APP_VERSION, product config
│   ├── utils.ts             # cn() helper, etc.
│   └── chartConfig.ts       # Chart colors and themes
├── tailwind.config.js
└── package.json
```

---

## Implementation Checklist for New Products

### Foundation
```
□ Install dependencies (next, react, tailwindcss, framer-motion, lucide-react)
□ Add Google Fonts (Space Grotesk, Inter) to layout
□ Copy CSS variables to globals.css
□ Configure tailwind.config.js with Advient tokens
□ Set up ThemeContext and ThemeProvider
□ Create lib/config.ts with APP_VERSION
```

### Layout Components
```
□ Implement AdvientBar component
□ Implement Sidebar component (collapsible, dark theme)
□ Implement MainLayout wrapper
□ Add ThemeToggle to sidebar
```

### UI Components
```
□ Card with hover glow effect
□ StatCard with color variants
□ SectionHeader with cyan accent
□ Button (primary, secondary, ghost)
□ Badge variants
□ DataTable with hover states
```

### Styling
```
□ Apply font-display to all headers
□ Apply font-body to all body text
□ Add animation classes (fade-in, stagger)
□ Configure chart colors (cyan-first)
□ Test all components in light mode
□ Test all components in dark mode
```

### Final Checks
```
□ Verify Advient Bar displays correctly
□ Verify sidebar collapse works
□ Verify theme toggle persists
□ Verify hover effects on cards
□ Test responsive behavior
□ Verify WCAG contrast ratios
```

---

## Color Quick Reference

### Light Mode
| Element | Color/Class |
|---------|-------------|
| Page background | `bg-gradient-to-b from-slate-50 to-slate-100` |
| Card background | `bg-white` |
| Primary text | `text-slate-900` |
| Secondary text | `text-slate-600` |
| Muted text | `text-slate-500` |
| Border | `border-slate-200` |
| Hover glow | `shadow-[0_4px_20px_rgba(0,217,255,0.15)]` |

### Dark Mode
| Element | Color/Class |
|---------|-------------|
| Page background | `bg-[#0A1628]` |
| Card background | `bg-[#1a2332]` |
| Primary text | `text-white` |
| Secondary text | `text-slate-300` |
| Muted text | `text-slate-400` |
| Border | `border-white/10` |
| Hover glow | `shadow-[0_4px_20px_rgba(0,217,255,0.25)]` |

### Fixed (Both Modes)
| Element | Color |
|---------|-------|
| Sidebar/Advient Bar | `#0A1628` |
| Primary accent | `#00D9FF` (cyan-400) |
| Success | `#10B981` (emerald-500) |
| Warning | `#F59E0B` (amber-500) |
| Error | `#EF4444` (red-500) |

---

## Contact

For questions about the design system or updates, contact:

**Cory Kidd**  
Advient Advisors  
cory@advientadvisors.com

---

*This design system is maintained by Advient Advisors. Version 2.0 — December 2025*
