import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const AUTH_COOKIE_NAME = "lic_auth";

export function createSiteAuthToken(password: string) {
    return crypto.createHash("sha256").update(password).digest("hex");
}

export async function isSiteAuthenticated() {
    const sitePassword = process.env.SITE_PASSWORD;
    if (!sitePassword) return false;

    const cookieStore = await cookies();
    const authCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!authCookie) return false;

    const expectedToken = createSiteAuthToken(sitePassword);
    const actualBuffer = Buffer.from(authCookie);
    const expectedBuffer = Buffer.from(expectedToken);

    if (actualBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function requireSiteAuth() {
    if (!(await isSiteAuthenticated())) redirect("/login");
}
