// API configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const api = {
    baseUrl: API_URL,

    async fetch(endpoint: string, options: RequestInit = {}) {
        const url = `${API_URL}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
        return response;
    },

    async get(endpoint: string, token?: string) {
        return this.fetch(endpoint, {
            method: 'GET',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
    },

    async post(endpoint: string, data: unknown, token?: string) {
        return this.fetch(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
    },

    async put(endpoint: string, data: unknown, token?: string) {
        return this.fetch(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
    },

    async delete(endpoint: string, token?: string) {
        return this.fetch(endpoint, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
    },
};

export default api;
