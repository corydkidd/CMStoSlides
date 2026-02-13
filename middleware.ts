import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: true,
  });

  console.log('[Middleware]', {
    path: request.nextUrl.pathname,
    hasToken: !!token,
    cookies: request.cookies.getAll().map(c => c.name),
  });

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth/');
  const isApiAuthRoute = request.nextUrl.pathname.startsWith('/api/auth/');
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/history') ||
    request.nextUrl.pathname.startsWith('/admin');

  // Allow NextAuth API routes through
  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  // Redirect to sign in if not authenticated and trying to access protected routes
  // TEMPORARILY DISABLED FOR DEBUGGING
  // if (!token && isProtectedRoute) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = '/auth/signin';
  //   url.searchParams.set('callbackUrl', request.nextUrl.pathname);
  //   return NextResponse.redirect(url);
  // }

  // Redirect to dashboard if authenticated and trying to access auth pages
  if (token && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
