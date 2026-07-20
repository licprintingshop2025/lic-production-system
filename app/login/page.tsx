"use client";

import Image from "next/image";
import { useState } from "react";

export default function LoginPage() {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            const data = (await res.json()) as { success?: boolean; error?: string };

            if (res.ok && data.success) {
                window.location.assign("/");
                return;
            }

            setError(data.error || "Incorrect password.");
        } catch {
            setError("Unable to sign in. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-[#FAF7F2] text-[#2B1A12]">
            <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.16),transparent_34%),linear-gradient(135deg,#FAF7F2_0%,#F5EFE4_100%)] px-5 py-12">
                <div className="w-full max-w-sm rounded-[28px] bg-white px-8 py-9 shadow-[0_20px_60px_rgba(0,0,0,0.08)] ring-1 ring-[#E8D7A6]">
                    <div className="flex flex-col items-center text-center">
                        <Image src="/lic-logo.jpg" alt="LIC Printing Shop" width={64} height={64} className="rounded" priority />
                        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.35em] text-[#C9A227]">LIC Printing Shop</p>
                        <h1 className="mt-1 text-2xl font-bold leading-tight text-[#4A2A1A]">Operations Center</h1>
                        <p className="mt-2 text-sm leading-relaxed text-gray-500">Sign in to view production</p>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-6">
                        <label htmlFor="site-password" className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Password</label>
                        <input
                            id="site-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            autoFocus
                            required
                            className="mt-2 w-full rounded-2xl border border-[#E8D7A6] bg-[#FAF7F2] px-4 py-3.5 text-sm font-medium tracking-wide outline-none transition focus:border-[#C9A227] focus:bg-white focus:ring-4 focus:ring-[#C9A227]/20"
                        />
                        {error && <p className="mt-2 text-sm font-medium text-red-600" role="alert">{error}</p>}
                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-[#C9A227] to-[#B88422] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#C9A227]/30 transition duration-300 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                        >
                            {loading ? "Signing in..." : "Sign in"}
                        </button>
                    </form>
                    <p className="mt-6 text-center text-xs text-gray-400">Access is limited to LIC staff</p>
                </div>
            </div>
        </main>
    );
}
