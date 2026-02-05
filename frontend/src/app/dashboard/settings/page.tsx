'use client';

import { useEffect, useState } from 'react';
import { fetchAPI } from '@/lib/utils';

interface Environment {
    id: string;
    name: string;
    baseUrl: string;
    isProduction: boolean;
    isActive: boolean;
}

export default function SettingsPage() {
    const [environments, setEnvironments] = useState<Environment[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [newEnv, setNewEnv] = useState({ name: '', baseUrl: '', isProduction: false });
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => {
        const userData = localStorage.getItem('qa-guardian-user');
        if (userData) {
            setUser(JSON.parse(userData));
        }
        loadEnvironments();
    }, []);

    const loadEnvironments = async () => {
        try {
            const data = await fetchAPI('/api/environments');
            setEnvironments(data.data.environments);
        } catch (error) {
            console.error('Failed to load environments:', error);
        } finally {
            setLoading(false);
        }
    };

    const addEnvironment = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await fetchAPI('/api/environments', {
                method: 'POST',
                body: JSON.stringify(newEnv),
            });
            setNewEnv({ name: '', baseUrl: '', isProduction: false });
            setShowAddForm(false);
            loadEnvironments();
        } catch (error) {
            console.error('Failed to add environment:', error);
        }
    };

    const toggleEnvironment = async (id: string, isActive: boolean) => {
        try {
            await fetchAPI(`/api/environments/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ isActive: !isActive }),
            });
            loadEnvironments();
        } catch (error) {
            console.error('Failed to update environment:', error);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold">Settings</h1>
                <p className="text-gray-400">Configure your QA Guardian instance</p>
            </div>

            {/* Profile Section */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Profile</h2>
                {user && (
                    <div className="space-y-3">
                        <div>
                            <label className="text-sm text-gray-400">Name</label>
                            <div className="mt-1 text-white">{user.name || 'Not set'}</div>
                        </div>
                        <div>
                            <label className="text-sm text-gray-400">Email</label>
                            <div className="mt-1 text-white">{user.email}</div>
                        </div>
                        <div>
                            <label className="text-sm text-gray-400">Role</label>
                            <div className="mt-1">
                                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm">
                                    {user.role}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Environments Section */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Test Environments</h2>
                    {user?.role === 'ADMIN' && (
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                            + Add Environment
                        </button>
                    )}
                </div>

                {showAddForm && (
                    <form onSubmit={addEnvironment} className="p-4 border-b border-gray-800 bg-gray-800/30">
                        <div className="grid grid-cols-3 gap-4">
                            <input
                                type="text"
                                placeholder="Environment name"
                                value={newEnv.name}
                                onChange={(e) => setNewEnv({ ...newEnv, name: e.target.value })}
                                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                required
                            />
                            <input
                                type="url"
                                placeholder="https://example.com"
                                value={newEnv.baseUrl}
                                onChange={(e) => setNewEnv({ ...newEnv, baseUrl: e.target.value })}
                                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                required
                            />
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={newEnv.isProduction}
                                        onChange={(e) => setNewEnv({ ...newEnv, isProduction: e.target.checked })}
                                        className="rounded"
                                    />
                                    Production
                                </label>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                <div className="divide-y divide-gray-800">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading...</div>
                    ) : (
                        environments.map((env) => (
                            <div key={env.id} className="p-4 flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{env.name}</span>
                                        {env.isProduction && (
                                            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">
                                                Production
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-500 mt-1">{env.baseUrl}</div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`text-sm ${env.isActive ? 'text-green-400' : 'text-gray-500'}`}>
                                        {env.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                    {user?.role === 'ADMIN' && (
                                        <button
                                            onClick={() => toggleEnvironment(env.id, env.isActive)}
                                            className="text-sm text-blue-400 hover:text-blue-300"
                                        >
                                            {env.isActive ? 'Disable' : 'Enable'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Scheduler Info */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Scheduled Runs</h2>
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                        <div>
                            <div className="font-medium">Daily Regression</div>
                            <div className="text-gray-500">Every day at 6:00 AM UTC</div>
                        </div>
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Active</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                        <div>
                            <div className="font-medium">Weekly Deep Dive</div>
                            <div className="text-gray-500">Every Sunday at 2:00 AM UTC</div>
                        </div>
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Active</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
