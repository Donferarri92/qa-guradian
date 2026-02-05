'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchAPI, formatDate, getStatusColor, getSeverityColor, formatDuration } from '@/lib/utils';

interface TestResult {
    id: string;
    testCase: {
        id: string;
        name: string;
        type: string;
        severity: string;
        description?: string;
    };
    status: string;
    error?: string;
    screenshotUrl?: string;
    duration?: number;
    manualNotes?: string;
}

interface TestRun {
    id: string;
    suite: { name: string; type: string; description?: string };
    environment: { name: string; baseUrl: string };
    triggeredBy?: { name: string; email: string };
    status: string;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    totalTests: number;
    createdAt: string;
    completedAt?: string;
    startedAt?: string;
    duration?: number;
    metrics?: any;
    results: TestResult[];
}

export default function RunDetailPage() {
    const params = useParams();
    const [run, setRun] = useState<TestRun | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'failed' | 'passed'>('all');

    useEffect(() => {
        loadRun();
    }, [params.id]);

    const loadRun = async () => {
        try {
            const data = await fetchAPI(`/api/runs/${params.id}`);
            setRun(data.data.run);
        } catch (error) {
            console.error('Failed to load run:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateReport = async () => {
        try {
            await fetchAPI(`/api/reports/generate/${params.id}`, { method: 'POST' });
            // Reload to get report link
            loadRun();
        } catch (error) {
            console.error('Failed to generate report:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-400">Loading...</div>
            </div>
        );
    }

    if (!run) {
        return (
            <div className="text-center py-20">
                <h2 className="text-xl font-bold text-gray-400">Run not found</h2>
                <Link href="/dashboard/runs" className="text-blue-400 hover:text-blue-300 mt-4 inline-block">
                    ← Back to runs
                </Link>
            </div>
        );
    }

    const filteredResults = run.results.filter((r) => {
        if (activeTab === 'failed') return r.status === 'FAILED';
        if (activeTab === 'passed') return r.status === 'PASSED';
        return true;
    });

    const passRate = run.totalTests > 0 ? ((run.passedTests / run.totalTests) * 100) : 0;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <Link href="/dashboard/runs" className="text-gray-400 hover:text-white text-sm mb-2 inline-block">
                        ← Back to runs
                    </Link>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        {run.suite.name}
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(run.status)}`}>
                            {run.status}
                        </span>
                    </h1>
                    <p className="text-gray-400">
                        {run.environment.name} • {formatDate(run.createdAt)}
                    </p>
                </div>
                <button
                    onClick={generateReport}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition"
                >
                    📄 Generate Report
                </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-5 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold">{run.totalTests}</div>
                    <div className="text-sm text-gray-400">Total Tests</div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-green-500">{run.passedTests}</div>
                    <div className="text-sm text-gray-400">Passed</div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-red-500">{run.failedTests}</div>
                    <div className="text-sm text-gray-400">Failed</div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-gray-500">{run.skippedTests}</div>
                    <div className="text-sm text-gray-400">Skipped</div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold">{passRate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-400">Pass Rate</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-800 pb-2">
                {(['all', 'failed', 'passed'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-t-lg transition ${activeTab === tab
                                ? 'bg-gray-800 text-white'
                                : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {tab === 'all' && ` (${run.results.length})`}
                        {tab === 'failed' && ` (${run.failedTests})`}
                        {tab === 'passed' && ` (${run.passedTests})`}
                    </button>
                ))}
            </div>

            {/* Results List */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
                {filteredResults.map((result) => (
                    <div key={result.id} className="p-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                                <div className={`mt-1 px-2 py-0.5 rounded text-xs font-medium border ${getSeverityColor(result.testCase.severity)}`}>
                                    {result.testCase.severity}
                                </div>
                                <div>
                                    <div className="font-medium flex items-center gap-2">
                                        {result.testCase.name}
                                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(result.status)}`}>
                                            {result.status}
                                        </span>
                                    </div>
                                    {result.testCase.description && (
                                        <div className="text-sm text-gray-500 mt-1">{result.testCase.description}</div>
                                    )}
                                    {result.error && (
                                        <div className="mt-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg font-mono">
                                            {result.error}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="text-right text-sm text-gray-400">
                                {result.duration && formatDuration(result.duration)}
                            </div>
                        </div>
                    </div>
                ))}
                {filteredResults.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        No results to show
                    </div>
                )}
            </div>
        </div>
    );
}
