'use server';

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function signup(formData: FormData) {
  const supabase = createServerSupabaseClient();

  const leagueName = formData.get('leagueName') as string;
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const phone = (formData.get('phone') as string)?.replace(/\D/g, '') || null;
  const password = formData.get('password') as string;

  if (!leagueName || !name || !email || !password) {
    return { error: 'All fields are required' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
      return { error: 'An account with this email already exists' };
    }
    return { error: 'Failed to create account. Please try again.' };
  }

  if (!authData.user) {
    return { error: 'Failed to create account. Please try again.' };
  }

  // Use service role to create org + profile + membership (bypasses RLS)
  const serviceClient = createServiceRoleClient();
  const { data: orgResult, error: orgError } = await serviceClient.rpc('create_org_with_admin', {
    p_auth_user_id: authData.user.id,
    p_email: email,
    p_name: name,
    p_phone: phone,
    p_org_name: leagueName,
  });

  if (orgError) {
    return { error: 'Failed to create league. Please try again.' };
  }

  return { error: null, orgId: orgResult?.org_id };
}
