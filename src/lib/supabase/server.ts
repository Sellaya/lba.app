import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
	if (_supabaseAdmin) {
		return _supabaseAdmin;
	}

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !supabaseServiceRoleKey) {
		throw new Error(
			'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.'
		);
	}

	_supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
		auth: { persistSession: false },
	});

	return _supabaseAdmin;
}

// Export a function that returns the client directly
// This function is safe to call and will handle errors gracefully
export function getSupabaseClient(): SupabaseClient {
	try {
		return getSupabaseAdmin();
	} catch (error: any) {
		console.error('Failed to get Supabase client:', error);
		throw error;
	}
}

// Export a Proxy that lazily initializes on first property access
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
	get(_target, prop) {
		const client = getSupabaseAdmin();
		return (client as any)[prop];
	},
});


