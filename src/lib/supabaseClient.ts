// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rfdrkforpgmnjvszhqmb.supabase.co';
const supabaseKey =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZHJrZm9ycGdtbmp2c3pocW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzNDE3NjUsImV4cCI6MjA1OTkxNzc2NX0.x07NLBJRWq0uTcv_kGVn7Vz_vkpmdxtRsAtzNcIzGaY';

export const supabase = createClient(supabaseUrl, supabaseKey);
