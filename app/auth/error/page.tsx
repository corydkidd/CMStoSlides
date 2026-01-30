'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-cyan-50/20 to-slate-100 dark:from-[#0A1628] dark:to-[#1A2332] p-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500 mb-4">
          <span className="font-display font-bold text-white text-2xl">!</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Authentication Error
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          {error || 'An unexpected error occurred during sign in.'}
        </p>
        <Link href="/auth/signin">
          <Button>Try Again</Button>
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}
