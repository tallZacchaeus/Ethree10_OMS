import { auth } from "@/server/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;

  // Only intercept the bare root path
  if (nextUrl.pathname === "/") {
    const destination = session?.user ? "/dashboard" : "/login";
    return NextResponse.redirect(new URL(destination, nextUrl));
  }
});

export const config = {
  matcher: ["/"],
};
