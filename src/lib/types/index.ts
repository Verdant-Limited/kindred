export interface Program {
	id: string;
	title: string;
	description?: string;
	created_by: string;
	created_at: string;
	status: 'active' | 'completed' | 'cancelled';
}
