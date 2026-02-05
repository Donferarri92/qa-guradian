'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchAPI, formatDate, getStatusColor, formatDuration } from '@/lib/utils';

interface TestRun {
    id: string;
    suite: { name: string; type: string };
    environment: { name: string; baseUrl: string };
    triggeredBy?: { name: string; email: string };
    status: string;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    totalTests: number;
    createdAt: string;
    completedAt?: string;
    duration?: number;
}

export default function RunsPage() {
    const [runs, setRuns] = useState<TestRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
        loadRuns();
    }, [filter]);

    const loadRuns = async () => {
        try {
            const params = new URLSearchParams({ limit: '50' });
            if (filter !== 'all') {
                params.set('status', filter);
            }

            const data = await fetchAPI(`/api/runs?${params}`);
            setRuns(data.data.runs);
        } catch (error) {
            console.error('Failed to load runs:', error);
        } finally {
            setLoading(false);
        }
    };

    const getPassRate = (run: TestRun) => {
        if (run.totalTests === 0) return 0;
        return ((run.passedTests / run.totalTests) * 100).toFixed(0);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Test Runs</h1>
                    <p className="text-gray-400">View all test execution history</p>
                </div>
                <div className="flex gap-2">
                    {['all', 'PASSED', 'FAILED', 'RUNNING', 'PENDING'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-3 py-1 rounded-lg text-sm transition ${filter === status
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:text-white'
                                }`}
                        >
                            {status === 'all' ? 'All' : status}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-gray-400">Loading...</div>
                </div>
            ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-800/50">
                            <tr>
                                <th className="text-left p-4 text-sm font-medium text-gray-400">Status</th>
                                <th className="text-left p-4 text-sm font-medium text-gray-400">Suite</th>
                                <th className="text-left p-4 text-sm font-medium text-gray-400">Environment</th>
                                <th className="text-left p-4 text-sm font-medium text-gray-400">Results</th>
                                <th className="text-left p-4 text-sm font-medium text-gray-400">Duration</th>
                                <th className="text-left p-4 text-sm font-medium text-gray-400">Date</th>
                                <th className="p-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {runs.map((run) => (
                                <tr key={run.id} className="hover:bg-gray-800/30 transition">
                                    <td className="p-4">
                                        <div
                                            className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                                run.status
                                            )}`}
                                        >
                                            {run.status}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-medium">{run.suite.name}</div>
                                        <div className="text-xs text-gray-500">{run.suite.type}</div>
                                    </td>
                                    <td className="p-4">
                                        <div>{run.environment.name}</div>
                                        <div className="text-xs text-gray-500 truncate max-w-[200px]">
                                            {run.environment.baseUrl}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500"
                                                    style={{ width: `${getPassRate(run)}%` }}
                                                />
                                            </div>
                                            <span className="text-sm text-gray-400">{getPassRate(run)}%</span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {run.passedTests}✓ {run.failedTests}✗ {run.skippedTests}○
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-400">
                                        {run.duration ? formatDuration(run.duration) : '-'}
                                    </td>
                                    <td className="p-4 text-sm text-gray-400">
                                        {formatDate(run.createdAt)}
                                    </td>
                                    <td className="p-4">
                                        <Link
                                            href={`/dashboard/runs/${run.id}`}
                                            className="text-blue-400 hover:text-blue-300"
                                        >
                                            View →
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {runs.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            No test runs found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
