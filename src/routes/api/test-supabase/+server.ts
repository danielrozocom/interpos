import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';

export const GET: RequestHandler = async () => {
	try {
		console.log('Testing Supabase connection...');
		
		// List all tables in the database
		const { data: tables, error: tablesError } = await sbServer
			.rpc('list_tables');
			
		if (tablesError) {
			console.log('Could not list tables, trying direct approach...');
			
			// Try to query the specific table directly
			const { data: testData, error: testError } = await sbServer
				.from('transactions_balance')
				.select('*')
				.limit(1);
				
			if (testError) {
				console.error('Error querying transactions_balance:', testError);
				return json({ 
					success: false, 
					error: 'Could not access transactions_balance table',
					details: testError
				});
			}
			
			return json({ 
				success: true, 
				message: 'transactions_balance table exists and is accessible',
				sampleData: testData
			});
		}
		
		return json({ 
			success: true, 
			tables: tables,
			message: 'Supabase connection successful'
		});
		
	} catch (error: any) {
		console.error('Supabase test error:', error);
		return json({ 
			success: false, 
			error: error.message || 'Unknown error testing Supabase' 
		}, { status: 500 });
	}
};