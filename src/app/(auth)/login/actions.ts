'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const supabase = createServerSupabaseClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: 'Invalid email or password' };
  }

  return { error: null };
}

export async function logout() {
  const supabase = createServerSupabaseClient();
  await supabase.auth.signOut();
}
