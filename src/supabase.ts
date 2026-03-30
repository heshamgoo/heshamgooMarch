import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://nuhxteyefjlweqmxvjnd.supabase.co';
export const supabaseAnonKey = 'sb_publishable_dcHadLI8EHR5X3UkAKAAoQ_XPBLjI0p';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleSupabaseError(error: any, operationType: OperationType, path: string | null) {
  let errorMessage = 'Unknown error';
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (error && typeof error === 'object') {
    errorMessage = error.message || error.details || error.hint || JSON.stringify(error);
  } else {
    errorMessage = String(error);
  }

  const errInfo = {
    error: errorMessage,
    operationType,
    path
  };
  console.error('Supabase Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
