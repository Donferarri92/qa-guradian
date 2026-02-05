'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchAPI, formatDate } from '@/lib/utils';

interface Report {
    id: string;
    run: {
        id: string;
        suite: { name: string };
        environment: { name: string };
        passedTests: number;
        failedTests: number;
        totalTests: number;
        completedAt: string;
    };
    format: string;
    publicUrl?: string;
    publicToken?: string;
    createdAt: string;
}

export default function ReportsPage() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadReports();
    }, []);

    const loadReports = async () => {
        try {
            const data = await fetchAPI('/api/reports');
            setReports(data.data.reports);
        } catch (error) {
            console.error('Failed to load reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const getPassRate = (report: Report) => {
        const total = report.run.totalTests;
        if (total === 0) return 0;
        return ((report.run.passedTests / total) * 100).toFixed(0);
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
            <div>
                <h1 className="text-2xl font-bold">Reports</h1>
                <p className="text-gray-400">View and share test reports</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl">
                <div className="grid grid-cols-6 p-4 border-b border-gray-800 text-sm font-medium text-gray-400">
                    <div>Suite</div>
                    <div>Environment</div>
                    <div>Results</div>
                    <div>Format</div>
                    <div>Generated</div>
                    <div>Actions</div>
                </div>
                <div className="divide-y divide-gray-800">
                    {reports.map((report) => (
                        <div key={report.id} className="grid grid-cols-6 p-4 items-center">
                            <div>
                                <div className="font-medium">{report.run.suite.name}</div>
                            </div>
                            <div className="text-gray-400">{report.run.environment.name}</div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500"
                                            style={{ width: `${getPassRate(report)}%` }}
                                        />
                                    </div>
                                    <span className="text-sm">{getPassRate(report)}%</span>
                                </div>
                            </div>
                            <div>
                                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                                    {report.format}
                                </span>
                            </div>
                            <div className="text-sm text-gray-400">
                                {formatDate(report.createdAt)}
                            </div>
                            <div className="flex gap-2">
                                <Link
                                    href={`/dashboard/runs/${report.run.id}`}
                                    className="text-blue-400 hover:text-blue-300 text-sm"
                                >
                                    View Run
                                </Link>
                                {report.publicUrl && (
                                    <a
                                        href={report.publicUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-green-400 hover:text-green-300 text-sm"
                                    >
                                        Share
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                    {reports.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            No reports generated yet. Run some tests first!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
