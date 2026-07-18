import { getToken } from "next-auth/jwt";
import { type NextRequest, NextResponse } from "next/server";

export default async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env["AUTH_SECRET"] });

  if (req.nextUrl.pathname === "/") {
    const destination = token ? "/dashboard" : "/login";
    return NextResponse.redirect(new URL(destination, req.nextUrl));
  }
}

export const config = {
  matcher: ["/"],
};
