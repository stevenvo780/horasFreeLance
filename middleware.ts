import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, extractTokenFromHeader, verifyToken } from '@/lib/auth';

const PUBLIC_ROUTES = ['/login', '/register'];
const PUBLIC_API_ROUTES = ['/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/auth/session'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
  const isPublicApiRoute = PUBLIC_API_ROUTES.some(route => pathname.startsWith(route));

  if (isPublicRoute || isPublicApiRoute) {
    return NextResponse.next();
  }

  const cookieToken = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
  const headerToken = extractTokenFromHeader(request.headers.get('authorization') || undefined);
  const token = cookieToken || headerToken || null;
  const payload = token ? verifyToken(token) : null;

  if (pathname.startsWith('/api/')) {
    if (!payload) {
      return NextResponse.json(
        { status: 'error', message: 'No autorizado' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  if (!payload) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};