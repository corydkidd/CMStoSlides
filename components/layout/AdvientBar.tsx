'use client';

import Link from 'next/link';
import { APP_VERSION, APP_CONFIG } from '@/lib/config';

export function AdvientBar({ productName = APP_CONFIG.name }: { productName?: string }) {
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
