'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchAPI, formatDate, getStatusColor, formatDuration } from '@/lib/utils';

interface TestRun {
    id: string;
    suite: { name: string; type: string };
    environment: { name: string };
    status: string;
    passedTests: number;
    failedTests: number;
    totalTests: number;
    createdAt: string;
    duration?: number;
}

interface DashboardStats {
    totalRuns: number;
    passRate: number;
    p0Failures: number;
    lastRunDate: string;
}

export default function DashboardPage() {
    const [recentRuns, setRecentRuns] = useState<TestRun[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            const runsData = await fetchAPI('/api/runs?limit=10');
            setRecentRuns(runsData.data.runs);

            // Calculate stats
            if (runsData.data.runs.length > 0) {
                const total = runsData.data.runs.length;
                const passed = runsData.data.runs.filter((r: TestRun) => r.status === 'PASSED').length;
                const p0Failures = runsData.data.runs.reduce((acc: number, r: TestRun) => {
                    return acc + (r.status === 'FAILED' ? r.failedTests : 0);
                }, 0);

                setStats({
                    totalRuns: runsData.data.total,
                    passRate: (passed / total) * 100,
                    p0Failures,
                    lastRunDate: runsData.data.runs[0]?.createdAt,
                });
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const startRun = async (suiteType: 'daily' | 'weekly') => {
        try {
            const suitesData = await fetchAPI('/api/suites');
            const suite = suitesData.data.suites.find((s: any) =>
                s.type === suiteType.toUpperCase()
            );

            const envsData = await fetchAPI('/api/environments');
            const env = envsData.data.environments.find((e: any) => e.isProduction);

            if (suite && env) {
                await fetchAPI('/api/runs', {
                    method: 'POST',
                    body: JSON.stringify({
                        suiteId: suite.id,
                        environmentId: env.id,
                    }),
                });
                loadDashboardData();
            }
        } catch (error) {
            console.error('Failed to start run:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-400">Loading...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Dashboard</h1>
                    <p className="text-gray-400">Monitor your test runs and results</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => startRun('daily')}
                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition flex items-center gap-2"
                    >
                        <span>🚀</span> Run Daily Regression
                    </button>
                    <button
                        onClick={() => startRun('weekly')}
                        className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition flex items-center gap-2"
                    >
                        <span>🔍</span> Run Weekly Deep Dive
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <div className="text-3xl font-bold">{stats?.totalRuns || 0}</div>
                    <div className="text-gray-400 text-sm">Total Runs</div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <div className="text-3xl font-bold text-green-500">
                        {stats?.passRate.toFixed(1) || 0}%
                    </div>
                    <div className="text-gray-400 text-sm">Pass Rate</div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <div className="text-3xl font-bold text-red-500">
                        {stats?.p0Failures || 0}
                    </div>
                    <div className="text-gray-400 text-sm">P0 Failures</div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <div className="text-lg font-medium">
                        {stats?.lastRunDate ? formatDate(stats.lastRunDate) : 'Never'}
                    </div>
                    <div className="text-gray-400 text-sm">Last Run</div>
                </div>
            </div>

            {/* Recent Runs */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <h2 className="font-semibold">Recent Test Runs</h2>
                    <Link href="/dashboard/runs" className="text-blue-400 hover:text-blue-300 text-sm">
                        View All →
                    </Link>
                </div>
                <div className="divide-y divide-gray-800">
                    {recentRuns.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No test runs yet. Click "Run Daily Regression" to start.
                        </div>
                    ) : (
                        recentRuns.map((run) => (
                            <Link
                                key={run.id}
                                href={`/dashboard/runs/${run.id}`}
                                className="flex items-center justify-between p-4 hover:bg-gray-800/50 transition"
                            >
                                <div className="flex items-center gap-4">
                                    <div
                                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                            run.status
                                        )}`}
                                    >
                                        {run.status}
                                    </div>
                                    <div>
                                        <div className="font-medium">{run.suite.name}</div>
                                        <div className="text-sm text-gray-400">
                                            {run.environment.name} • {formatDate(run.createdAt)}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm">
                                        <span className="text-green-500">{run.passedTests} passed</span>
                                        {run.failedTests > 0 && (
                                            <span className="text-red-500 ml-2">{run.failedTests} failed</span>
                                        )}
                                    </div>
                                    {run.duration && (
                                        <div className="text-xs text-gray-500">
                                            {formatDuration(run.duration)}
                                        </div>
                                    )}
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
