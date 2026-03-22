import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/auth", "/api/auth/login", "/api/auth/register", "/api/auth/logout"];

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Allow public paths (login, register, auth API) — exact match
	if (PUBLIC_PATHS.some((p) => pathname === p)) {
		return NextResponse.next();
	}

	// Allow Next.js internals and static assets
	if (pathname.startsWith("/_next") || pathname.includes(".")) {
		return NextResponse.next();
	}

	// Check for the session cookie. We cannot query the database in edge
	// middleware, so we only verify the cookie exists here. The actual session
	// validation (expiration, existence in DB) happens in API routes and
	// server components via `getSession()`.
	const sessionToken = request.cookies.get("sapling_session")?.value;
	if (!sessionToken) {
		return NextResponse.redirect(new URL("/auth", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
