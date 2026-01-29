import { signIn } from '@/lib/auth/actions';
import { Button } from '@/components/ui/Button';
import { AdvientBar } from '@/components/layout/AdvientBar';
import { Mail, Lock, ArrowRight } from 'lucide-react';

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const error = searchParams.error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-cyan-50/20 to-slate-100 dark:from-[#0A1628] dark:to-[#1A2332] p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 mb-4 shadow-lg shadow-cyan-400/30">
            <span className="font-display font-bold text-white text-2xl">C</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white mb-2">
            CMS Converter
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Transform regulatory documents into presentations
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-[#1A2332] rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 p-8">
          <form action={signIn} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0A1628] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-white/10 rounded-lg bg-white dark:bg-[#0A1628] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
            >
              <span>Sign In</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          {/* SSO Options (if configured) */}
          {/* Uncomment when SSO is set up
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-300 dark:border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-[#1A2332] text-slate-500">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="flex items-center justify-center px-4 py-3 border border-slate-300 dark:border-white/10 rounded-lg shadow-sm text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-[#0A1628] hover:bg-slate-50 dark:hover:bg-[#1A2332] transition-colors"
              >
                Google
              </button>
              <button
                type="button"
                className="flex items-center justify-center px-4 py-3 border border-slate-300 dark:border-white/10 rounded-lg shadow-sm text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-[#0A1628] hover:bg-slate-50 dark:hover:bg-[#1A2332] transition-colors"
              >
                Azure AD
              </button>
            </div>
          </div>
          */}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
          Powered by{' '}
          <span className="font-semibold text-cyan-600 dark:text-cyan-400">
            Advient Advisors
          </span>
        </p>
      </div>

      {/* Advient Bar */}
      <AdvientBar productName="CMS Converter" />
    </div>
  );
}
