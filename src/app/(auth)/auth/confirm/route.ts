import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = createServerSupabaseClient();
    await supabase.auth.verifyOtp({ token_hash, type });
  }

  return NextResponse.redirect(new URL('/dashboard', request.url));
}
