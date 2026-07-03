import { createClient } from '@supabase/supabase-js';

// Supabase configuration
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check .env.local');
}

const globalForSupabase = globalThis as typeof globalThis & {
  __malawiModelsSupabase?: ReturnType<typeof createClient>;
};

// Create Supabase client
export const supabase = globalForSupabase.__malawiModelsSupabase ?? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'malawimodels-auth-token',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

if (import.meta.env.DEV) {
  globalForSupabase.__malawiModelsSupabase = supabase;
}

// Helper function to get current user
export const getCurrentUser = () => {
  return supabase.auth.getUser();
};

// Helper function to get session
export const getSession = () => {
  return supabase.auth.getSession();
};

// Export auth for convenience
export const auth = supabase.auth;
