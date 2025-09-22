import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // API routes that don't require authentication
  const publicApiRoutes = ['/api/auth/login', '/api/auth/register'];
  const isPublicApiRoute = publicApiRoutes.some(route => pathname.startsWith(route));

  // If it's a public route, allow access
  if (isPublicRoute || isPublicApiRoute) {
    return NextResponse.next();
  }

  // For API routes, check for Bearer token
  if (pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { status: 'error', message: 'No autorizado' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // For protected pages, redirect to login if no token in headers
  // Note: We can't check localStorage in middleware, so we'll handle this client-side
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