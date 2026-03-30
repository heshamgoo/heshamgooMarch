import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nuhxteyefjlweqmxvjnd.supabase.co';
const supabaseAnonKey = 'sb_publishable_dcHadLI8EHR5X3UkAKAAoQ_XPBLjI0p';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const defaultDepts = [
    { id: 'dept_1', name: 'General', createdAt: new Date().toISOString() },
    { id: 'dept_2', name: 'HR', createdAt: new Date().toISOString() },
    { id: 'dept_3', name: 'Finance', createdAt: new Date().toISOString() },
    { id: 'dept_4', name: 'Operation', createdAt: new Date().toISOString() },
    { id: 'dept_5', name: 'Public', createdAt: new Date().toISOString() }
  ];
  const { error } = await supabase.from('settings').update({ departments: [JSON.stringify(defaultDepts)] }).eq('id', 'global');
  console.log('Fixed DB:', error || 'Success');
}
run();
