'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/dashboard/runs', label: 'Test Runs', icon: '🚀' },
    { href: '/dashboard/suites', label: 'Test Suites', icon: '📋' },
    { href: '/dashboard/reports', label: 'Reports', icon: '📄' },
    { href: '/dashboard/checklists', label: 'Checklists', icon: '✓' },
    { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('qa-guardian-token');
        const userData = localStorage.getItem('qa-guardian-user');

        if (!token) {
            router.push('/login');
            return;
        }

        if (userData) {
            setUser(JSON.parse(userData));
        }
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem('qa-guardian-token');
        localStorage.removeItem('qa-guardian-user');
        router.push('/login');
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white flex">
            {/* Sidebar */}
            <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-300`}>
                <div className="p-4 border-b border-gray-800">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-sm">QA</span>
                        </div>
                        {sidebarOpen && (
                            <span className="font-semibold text-lg">QA Guardian</span>
                        )}
                    </Link>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${isActive
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                    }`}
                            >
                                <span className="text-lg">{item.icon}</span>
                                {sidebarOpen && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-800">
                    {user && sidebarOpen && (
                        <div className="mb-3">
                            <div className="text-sm font-medium">{user.name || user.email}</div>
                            <div className="text-xs text-gray-500">{user.role}</div>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition flex items-center gap-3"
                    >
                        <span>🚪</span>
                        {sidebarOpen && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-auto">
                <div className="p-6">{children}</div>
            </main>
        </div>
    );
}
