'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const endpoint = isRegister ? '/auth/register' : '/auth/login';
            const response = await api.post(endpoint, formData);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'Authentication failed');
            }

            // Store token
            localStorage.setItem('qa-guardian-token', data.data.token);
            localStorage.setItem('qa-guardian-user', JSON.stringify(data.data.user));

            // Redirect to dashboard
            router.push('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-2 mb-4">
                        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">QA</span>
                        </div>
                        <span className="text-white font-semibold text-xl">QA Guardian</span>
                    </Link>
                    <h1 className="text-2xl font-bold text-white">
                        {isRegister ? 'Create an account' : 'Welcome back'}
                    </h1>
                    <p className="text-white/60 mt-1">
                        {isRegister ? 'Start testing your e-commerce site' : 'Sign in to your account'}
                    </p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isRegister && (
                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-1">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Your name"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>

                        {error && (
                            <div className="bg-red-500/20 border border-red-500/40 text-red-300 px-4 py-2 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg font-medium transition"
                        >
                            {isLoading ? 'Please wait...' : isRegister ? 'Create account' : 'Sign in'}
                        </button>
                    </form>

                    <div className="mt-4 text-center">
                        <button
                            onClick={() => setIsRegister(!isRegister)}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
