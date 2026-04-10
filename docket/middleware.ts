import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

const PROTECTED_ROUTES = [
  "/dashboard",
  "/invoices",
  "/clients",
  "/reports",
  "/settings",
  "/billing",
]

const ADMIN_ROUTES = ["/admin"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  )
  const isAdmin = ADMIN_ROUTES.some((route) => pathname.startsWith(route))

  if (!isProtected && !isAdmin) {
    return NextResponse.next()
  }

  const { user, supabaseResponse } = await updateSession(request)

  if (!user) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAdmin && !user.email?.endsWith("@docket.com.au")) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
