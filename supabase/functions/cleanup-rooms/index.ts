// Supabase Edge Function to cleanup old rooms
// Deploy with: supabase functions deploy cleanup-rooms

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req: Request) => {
	try {
		const supabaseUrl = Deno.env.get('SUPABASE_URL')!
		const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

		const supabase = createClient(supabaseUrl, supabaseKey)

		// Mark inactive rooms (no activity for 24+ hours)
		const { data: markedInactive, error: markError } = await supabase
			.from('programs')
			.update({
				status: 'inactive',
				ended_at: new Date().toISOString()
			})
			.eq('status', 'active')
			.lt('last_activity', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
			.select();

		if (markError) {
			console.error('Error marking rooms inactive:', markError);
		} else {
			console.log(`Marked ${markedInactive?.length || 0} rooms as inactive`);
		}

		// Delete old rooms (ended/inactive for 7+ days)
		const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

		const { data: deleted, error: deleteError } = await supabase
			.from('programs')
			.delete()
			.in('status', ['inactive', 'ended'])
			.or(`ended_at.lt.${sevenDaysAgo},created_at.lt.${sevenDaysAgo}`)
			.select();

		if (deleteError) {
			console.error('Error deleting old rooms:', deleteError);
		} else {
			console.log(`Deleted ${deleted?.length || 0} old rooms`);
		}

		return new Response(
			JSON.stringify({
				success: true,
				markedInactive: markedInactive?.length || 0,
				deleted: deleted?.length || 0,
				timestamp: new Date().toISOString()
			}),
			{
				headers: { 'Content-Type': 'application/json' },
				status: 200
			}
	)
} catch (error) {
	const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
	return new Response(JSON.stringify({ error: errorMessage }), {
		headers: { 'Content-Type': 'application/json' },
		status: 500
	})
}
})
