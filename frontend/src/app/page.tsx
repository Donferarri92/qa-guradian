'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Home() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('qa-guardian-token');
        setIsLoggedIn(!!token);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            <nav className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold">QA</span>
                            </div>
                            <span className="text-white font-semibold text-lg">QA Guardian</span>
                        </div>
                        <div className="flex gap-4">
                            {isLoggedIn ? (
                                <Link
                                    href="/dashboard"
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href="/login"
                                        className="text-white/80 hover:text-white px-4 py-2 transition"
                                    >
                                        Login
                                    </Link>
                                    <Link
                                        href="/login"
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                                    >
                                        Get Started
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                <div className="text-center">
                    <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
                        Automated QA Testing
                        <br />
                        <span className="text-blue-400">for E-commerce</span>
                    </h1>
                    <p className="text-xl text-white/70 max-w-2xl mx-auto mb-10">
                        Run daily regression tests and weekly deep-dive analysis. Catch issues before your customers do.
                    </p>
                    <div className="flex gap-4 justify-center">
                        <Link
                            href="/login"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg text-lg font-medium transition"
                        >
                            Start Testing
                        </Link>
                        <Link
                            href="#features"
                            className="border border-white/30 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-white/10 transition"
                        >
                            Learn More
                        </Link>
                    </div>
                </div>

                <div id="features" className="mt-32 grid md:grid-cols-3 gap-8">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                        <div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-lg flex items-center justify-center mb-4">
                            ✓
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Daily Regression</h3>
                        <p className="text-white/60">
                            Critical journey tests for home, PLP, PDP, cart, and checkout. Run every morning.
                        </p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                        <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center mb-4">
                            📊
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Weekly Deep Dive</h3>
                        <p className="text-white/60">
                            Lighthouse, security headers, SEO, image quality, and cross-browser testing.
                        </p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                        <div className="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-lg flex items-center justify-center mb-4">
                            📧
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Instant Alerts</h3>
                        <p className="text-white/60">
                            Get notified immediately when P0 tests fail. Email and Slack integrations.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
