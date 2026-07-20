import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/siteAuth";

export async function POST(req: Request) {
    const response = NextResponse.redirect(new URL("/login", req.url), 303);
    response.cookies.set(AUTH_COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: new Date(0),
        path: "/",
    });
    return response;
}
