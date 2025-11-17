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

// Export a getter function that lazily initializes
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
	get(_target, prop) {
		const client = getSupabaseAdmin();
		const value = (client as any)[prop];
		if (typeof value === 'function') {
			return value.bind(client);
		}
		if (value && typeof value === 'object') {
			// Handle nested objects like storage, auth, etc.
			return new Proxy(value, {
				get(_target, nestedProp) {
					const nestedValue = (value as any)[nestedProp];
					if (typeof nestedValue === 'function') {
						return nestedValue.bind(value);
					}
					return nestedValue;
				},
			});
		}
		return value;
	},
});


