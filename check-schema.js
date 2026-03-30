import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nuhxteyefjlweqmxvjnd.supabase.co';
const supabaseAnonKey = 'sb_publishable_dcHadLI8EHR5X3UkAKAAoQ_XPBLjI0p';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  const { data, error } = await supabase.from('settings').select('*').limit(1);
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Data:", data);
    if (data && data.length > 0) {
      console.log("Columns:", Object.keys(data[0]));
    }
  }
}

checkSchema();
