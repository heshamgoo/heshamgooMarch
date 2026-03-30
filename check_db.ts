import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nuhxteyefjlweqmxvjnd.supabase.co';
const supabaseAnonKey = 'sb_publishable_dcHadLI8EHR5X3UkAKAAoQ_XPBLjI0p';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.from('settings').select('departments').eq('id', 'global').single();
  console.log(JSON.stringify(data, null, 2));
}
run();
