'use client';

import { useEffect, useState } from 'react';
import { fetchAPI, cn } from '@/lib/utils';

interface ChecklistItem {
    id: string;
    content: string;
    isCompleted: boolean;
    order: number;
}

interface Checklist {
    id: string;
    name: string;
    description?: string;
    category: string;
    items: ChecklistItem[];
}

export default function ChecklistsPage() {
    const [checklists, setChecklists] = useState<Checklist[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedChecklist, setSelectedChecklist] = useState<string | null>(null);

    useEffect(() => {
        loadChecklists();
    }, []);

    const loadChecklists = async () => {
        try {
            const data = await fetchAPI('/api/checklists');
            setChecklists(data.data.checklists);
            if (data.data.checklists.length > 0 && !selectedChecklist) {
                setSelectedChecklist(data.data.checklists[0].id);
            }
        } catch (error) {
            console.error('Failed to load checklists:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleItem = async (checklistId: string, itemId: string, currentState: boolean) => {
        try {
            await fetchAPI(`/api/checklists/${checklistId}/items/${itemId}`, {
                method: 'PUT',
                body: JSON.stringify({ isCompleted: !currentState }),
            });

            setChecklists(checklists.map(cl => {
                if (cl.id === checklistId) {
                    return {
                        ...cl,
                        items: cl.items.map(item => {
                            if (item.id === itemId) {
                                return { ...item, isCompleted: !currentState };
                            }
                            return item;
                        }),
                    };
                }
                return cl;
            }));
        } catch (error) {
            console.error('Failed to update item:', error);
        }
    };

    const currentChecklist = checklists.find(c => c.id === selectedChecklist);

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
                <h1 className="text-2xl font-bold">Manual Checklists</h1>
                <p className="text-gray-400">QA checklists for manual verification</p>
            </div>

            <div className="grid grid-cols-4 gap-6">
                {/* Checklist selector */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-gray-800">
                        <h2 className="font-semibold">Checklists</h2>
                    </div>
                    <div className="divide-y divide-gray-800">
                        {checklists.map((checklist) => {
                            const completed = checklist.items.filter(i => i.isCompleted).length;
                            const total = checklist.items.length;
                            const percent = total > 0 ? (completed / total) * 100 : 0;

                            return (
                                <button
                                    key={checklist.id}
                                    onClick={() => setSelectedChecklist(checklist.id)}
                                    className={cn(
                                        'w-full text-left p-4 transition',
                                        selectedChecklist === checklist.id
                                            ? 'bg-blue-600/20 border-l-2 border-blue-500'
                                            : 'hover:bg-gray-800'
                                    )}
                                >
                                    <div className="font-medium">{checklist.name}</div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-green-500 transition-all"
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-500">{completed}/{total}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Checklist items */}
                <div className="col-span-3 bg-gray-900 border border-gray-800 rounded-xl">
                    {currentChecklist ? (
                        <>
                            <div className="p-4 border-b border-gray-800">
                                <h2 className="text-xl font-semibold">{currentChecklist.name}</h2>
                                {currentChecklist.description && (
                                    <p className="text-gray-400 text-sm mt-1">{currentChecklist.description}</p>
                                )}
                                <span className="inline-block mt-2 px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                                    {currentChecklist.category}
                                </span>
                            </div>
                            <div className="divide-y divide-gray-800">
                                {currentChecklist.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="p-4 flex items-center gap-3 hover:bg-gray-800/50 cursor-pointer"
                                        onClick={() => toggleItem(currentChecklist.id, item.id, item.isCompleted)}
                                    >
                                        <div className={cn(
                                            'w-5 h-5 rounded border-2 flex items-center justify-center transition',
                                            item.isCompleted
                                                ? 'bg-green-500 border-green-500 text-white'
                                                : 'border-gray-600'
                                        )}>
                                            {item.isCompleted && '✓'}
                                        </div>
                                        <span className={cn(
                                            'flex-1',
                                            item.isCompleted && 'line-through text-gray-500'
                                        )}>
                                            {item.content}
                                        </span>
                                    </div>
                                ))}
                                {currentChecklist.items.length === 0 && (
                                    <div className="p-8 text-center text-gray-500">
                                        No items in this checklist
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            Select a checklist to view items
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
