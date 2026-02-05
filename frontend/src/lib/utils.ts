import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export async function fetchAPI(
    endpoint: string,
    options: RequestInit = {}
): Promise<any> {
    const token = typeof window !== 'undefined'
        ? localStorage.getItem('qa-guardian-token')
        : null;

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
    };

    const response = await fetch(endpoint, {
        ...options,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Request failed');
    }

    return data;
}

export function formatDate(date: string | Date): string {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(date));
}

export function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}

export function getStatusColor(status: string): string {
    switch (status.toUpperCase()) {
        case 'PASSED':
            return 'text-green-500 bg-green-500/10';
        case 'FAILED':
            return 'text-red-500 bg-red-500/10';
        case 'RUNNING':
            return 'text-blue-500 bg-blue-500/10';
        case 'PENDING':
            return 'text-yellow-500 bg-yellow-500/10';
        case 'CANCELLED':
            return 'text-gray-500 bg-gray-500/10';
        default:
            return 'text-gray-500 bg-gray-500/10';
    }
}

export function getSeverityColor(severity: string): string {
    switch (severity) {
        case 'P0':
            return 'text-red-500 bg-red-500/10 border-red-500/30';
        case 'P1':
            return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
        case 'P2':
            return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
        default:
            return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    }
}
