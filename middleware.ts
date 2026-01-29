import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            // Override cookie options to work with IP addresses in development
            const cookieOptions = {
              ...options,
              sameSite: 'lax' as const,
              secure: false,
              httpOnly: true,
              path: '/',
            };
            supabaseResponse.cookies.set(name, value, cookieOptions);
          });
        },
      },
    }
  );

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect routes
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
                           request.nextUrl.pathname.startsWith('/history');

  // TEMPORARY: Auth disabled for testing
  // Redirect to login if not authenticated
  // if (!user && !isAuthRoute && (isDashboardRoute || isAdminRoute)) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = '/login';
  //   url.searchParams.set('redirectedFrom', request.nextUrl.pathname);
  //   return NextResponse.redirect(url);
  // }

  // Redirect to dashboard if authenticated and trying to access login
  // if (user && isAuthRoute) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = '/dashboard';
  //   return NextResponse.redirect(url);
  // }

  // TEMPORARY: Admin check disabled for testing
  // Check admin access for admin routes
  // if (user && isAdminRoute) {
  //   const { data: profile } = await supabase
  //     .from('profiles')
  //     .select('is_admin')
  //     .eq('id', user.id)
  //     .single();

  //   if (!profile?.is_admin) {
  //     const url = request.nextUrl.clone();
  //     url.pathname = '/dashboard';
  //     return NextResponse.redirect(url);
  //   }
  // }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
