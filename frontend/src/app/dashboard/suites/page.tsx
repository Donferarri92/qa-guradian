'use client';

import { useEffect, useState } from 'react';
import { fetchAPI, cn } from '@/lib/utils';

interface TestCase {
    id: string;
    name: string;
    type: string;
    severity: string;
    description?: string;
    order: number;
}

interface TestSuite {
    id: string;
    name: string;
    type: string;
    description?: string;
    isActive: boolean;
    schedule?: string;
    testCases: TestCase[];
    _count: { testCases: number };
}

export default function SuitesPage() {
    const [suites, setSuites] = useState<TestSuite[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSuite, setSelectedSuite] = useState<string | null>(null);

    useEffect(() => {
        loadSuites();
    }, []);

    const loadSuites = async () => {
        try {
            const data = await fetchAPI('/api/suites');
            setSuites(data.data.suites);
            if (data.data.suites.length > 0 && !selectedSuite) {
                setSelectedSuite(data.data.suites[0].id);
            }
        } catch (error) {
            console.error('Failed to load suites:', error);
        } finally {
            setLoading(false);
        }
    };

    const currentSuite = suites.find(s => s.id === selectedSuite);

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
                    <h1 className="text-2xl font-bold">Test Suites</h1>
                    <p className="text-gray-400">Configure your test suites and test cases</p>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-6">
                {/* Suite List */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-gray-800">
                        <h2 className="font-semibold">Suites</h2>
                    </div>
                    <div className="divide-y divide-gray-800">
                        {suites.map((suite) => (
                            <button
                                key={suite.id}
                                onClick={() => setSelectedSuite(suite.id)}
                                className={cn(
                                    'w-full text-left p-4 transition',
                                    selectedSuite === suite.id
                                        ? 'bg-blue-600/20 border-l-2 border-blue-500'
                                        : 'hover:bg-gray-800'
                                )}
                            >
                                <div className="font-medium">{suite.name}</div>
                                <div className="text-sm text-gray-500">
                                    {suite.type} • {suite._count?.testCases || suite.testCases?.length || 0} tests
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Suite Details */}
                <div className="col-span-3 bg-gray-900 border border-gray-800 rounded-xl">
                    {currentSuite ? (
                        <>
                            <div className="p-4 border-b border-gray-800">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-xl font-semibold">{currentSuite.name}</h2>
                                        <p className="text-gray-400 text-sm mt-1">
                                            {currentSuite.description || 'No description'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            'px-2 py-1 rounded text-xs',
                                            currentSuite.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
                                        )}>
                                            {currentSuite.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                        <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400">
                                            {currentSuite.type}
                                        </span>
                                    </div>
                                </div>
                                {currentSuite.schedule && (
                                    <div className="mt-2 text-sm text-gray-500">
                                        Schedule: {currentSuite.schedule}
                                    </div>
                                )}
                            </div>

                            <div className="divide-y divide-gray-800">
                                {currentSuite.testCases?.map((testCase) => (
                                    <div key={testCase.id} className="p-4 flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    'px-2 py-0.5 rounded text-xs font-medium',
                                                    testCase.severity === 'P0' && 'bg-red-500/20 text-red-400',
                                                    testCase.severity === 'P1' && 'bg-orange-500/20 text-orange-400',
                                                    testCase.severity === 'P2' && 'bg-yellow-500/20 text-yellow-400',
                                                )}>
                                                    {testCase.severity}
                                                </span>
                                                <span className="font-medium">{testCase.name}</span>
                                            </div>
                                            {testCase.description && (
                                                <div className="text-sm text-gray-500 mt-1">{testCase.description}</div>
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                                            {testCase.type}
                                        </span>
                                    </div>
                                )) || (
                                        <div className="p-8 text-center text-gray-500">
                                            No test cases in this suite
                                        </div>
                                    )}
                            </div>
                        </>
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            Select a suite to view details
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
