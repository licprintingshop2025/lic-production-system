import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createSiteAuthToken } from "@/lib/siteAuth";

export async function POST(req: Request) {
    let body: { password?: unknown };

    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid login request." }, { status: 400 });
    }

    const password = typeof body.password === "string" ? body.password : "";
    const sitePassword = process.env.SITE_PASSWORD;

    if (!sitePassword) {
        return NextResponse.json(
            { error: "Server is not configured. Contact the site owner." },
            { status: 500 },
        );
    }

    if (password !== sitePassword) {
        return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(AUTH_COOKIE_NAME, createSiteAuthToken(password), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
    });

    return response;
}
