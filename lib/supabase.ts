
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper to validate a proper HTTP/HTTPS URL
function isValidHttpUrl(str: string): boolean {
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

// Cache: once we fetch the config from the API, we store it here
let cachedConfig: { supabaseUrl: string; supabaseAnonKey: string } | null = null;
let cachedClient: SupabaseClient | null = null;
let configLoaded = false;

// Async function to ensure the config is loaded from the SQLite API
export async function ensureSupabaseConfig() {
    if (configLoaded) return;
    configLoaded = true;

    try {
        const res = await fetch('/api/settings?type=config');
        if (res.ok) {
            const data = await res.json();
            if (data.supabaseUrl?.trim() && data.supabaseAnonKey?.trim()) {
                cachedConfig = {
                    supabaseUrl: data.supabaseUrl.trim(),
                    supabaseAnonKey: data.supabaseAnonKey.trim(),
                };
            }
        }
    } catch (e) {
        console.warn("[OpenRad] Could not fetch Supabase config from API:", e);
    }
}

// Synchronous getter — uses cached config or env vars
export const getSupabaseClient = (): SupabaseClient | null => {
    // If we already have a cached client, return it
    if (cachedClient) return cachedClient;

    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Override with cached config from API (if available)
    if (cachedConfig) {
        supabaseUrl = cachedConfig.supabaseUrl;
        supabaseAnonKey = cachedConfig.supabaseAnonKey;
    }

    if (supabaseUrl && supabaseAnonKey && isValidHttpUrl(supabaseUrl)) {
        try {
            cachedClient = createClient(supabaseUrl, supabaseAnonKey);
            return cachedClient;
        } catch (e) {
            console.error("[OpenRad] Failed to create Supabase client:", e);
            return null;
        }
    }

    return null;
};

// Reset cached client (e.g. when settings change)
export const resetSupabaseClient = () => {
    cachedClient = null;
    cachedConfig = null;
    configLoaded = false;
};
