import { supabase } from './supabaseClient';

export interface Program {
	id: string;
	title: string;
	description?: string;
	created_by: string;
	created_at: string;
	status: 'active' | 'completed' | 'cancelled';
}

// Add this temporary test function to CreateRoom.svelte
async function testConnection() {
	const { data, error } = await supabase.from('programs').select('*').limit(1);

	console.log('Test connection:', { data, error });
}
