import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const backendUrl = `${BACKEND_URL}${pathname}${search}`;
  return NextResponse.rewrite(backendUrl);
}

export const config = {
  matcher: '/api/:path*',
};
