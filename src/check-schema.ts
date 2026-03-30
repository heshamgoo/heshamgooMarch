import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nuhxteyefjlweqmxvjnd.supabase.co';
const supabaseAnonKey = 'sb_publishable_dcHadLI8EHR5X3UkAKAAoQ_XPBLjI0p';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
  const columns = ['id', 'name', 'address', 'contactPerson', 'telPoBox', 'email', 'trn'];
  const validColumns = [];
  const invalidColumns = [];

  for (const col of columns) {
    const payload = { id: 'test_col_check' };
    payload[col] = 'test';
    
    const { error } = await supabase.from('clients').upsert(payload);
    
    if (error && error.message.includes('Could not find the')) {
      invalidColumns.push(col);
    } else {
      validColumns.push(col);
    }
  }

  console.log("Clients Valid columns:", validColumns);
  console.log("Clients Invalid columns:", invalidColumns);
  
  await supabase.from('clients').delete().eq('id', 'test_col_check');
}

checkColumns();
