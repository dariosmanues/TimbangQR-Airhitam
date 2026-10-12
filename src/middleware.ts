import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("timbang_session")?.value;
  const { pathname, search } = request.nextUrl;

  // Lewati halaman publik, auth API, dan OCR API
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/ocr-yolo") ||
    pathname.startsWith("/api/qr-decode") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Jika belum ada cookie sesi, redirect ke /login dengan membawa target redirect & yolo_url
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    const returnUrl = `${pathname}${search}`;
    loginUrl.searchParams.set("redirect", returnUrl);

    const yoloUrl =
      request.nextUrl.searchParams.get("yolo_url") ||
      request.nextUrl.searchParams.get("yoloUrl");
    if (yoloUrl) {
      loginUrl.searchParams.set("yolo_url", yoloUrl);
    }

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match semua request kecuali file statis next dan favicon
     */
    "/((?!api/|_next/static|_next/image|favicon.ico).*)",
  ],
};
