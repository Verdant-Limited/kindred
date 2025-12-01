import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabase } from '$lib/supabaseClient';

export const load: PageServerLoad = async ({ params }) => {
	const { code } = params;

	// Validate code format
	if (!code || !/^\d{4}$/.test(code)) {
		throw error(400, {
			message: 'Invalid room code - must be 4 digits'
		});
	}

	try {
		// Check if room exists in database
		const { data: room, error: dbError } = await supabase
			.from('programs')
			.select('id, title, created_by')
			.eq('id', code)
			.single();

		if (dbError) throw dbError;

		if (!room) {
			throw error(404, {
				message: 'Room not found'
			});
		}

		return {
			code,
			room: {
				id: room.id,
				title: room.title,
				createdBy: room.created_by
			}
		};
	} catch {
		throw error(500, {
			message: 'Failed to load room'
		});
	}
};
