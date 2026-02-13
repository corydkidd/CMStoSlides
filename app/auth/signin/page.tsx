'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/Button';
import { ArrowRight } from 'lucide-react';

function SignInContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-cyan-50/20 to-slate-100 dark:from-[#0A1628] dark:to-[#1A2332] p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 mb-4 shadow-lg shadow-cyan-400/30">
            <span className="font-display font-bold text-white text-2xl">C</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Regulatory Intelligence
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Monitor and analyze regulatory developments
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-[#1A2332] rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 p-8">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-600 dark:text-red-400">
                {error === 'OAuthAccountNotLinked'
                  ? 'This email is already linked to another account.'
                  : 'Authentication failed. Please try again.'}
              </p>
            </div>
          )}

          <Button
            onClick={() => signIn('authentik', { callbackUrl })}
            className="w-full"
            size="lg"
          >
            <span>Sign in with Advient SSO</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
          Powered by{' '}
          <span className="font-semibold text-cyan-600 dark:text-cyan-400">
            Advient Advisors
          </span>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
