import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { parseScoresheetImage } from '@/lib/ocr/parse-scoresheet';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Authenticate
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse form data
  const formData = await request.formData();
  const file = formData.get('image') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid image type. Use JPEG, PNG, or WebP.' }, { status: 400 });
  }

  // Validate file size (5MB max for Claude Vision)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image too large. Maximum 5MB.' }, { status: 400 });
  }

  const homeTeamName = formData.get('homeTeamName') as string || '';
  const awayTeamName = formData.get('awayTeamName') as string || '';
  const homeRoster: string[] = JSON.parse(formData.get('homeRoster') as string || '[]');
  const awayRoster: string[] = JSON.parse(formData.get('awayRoster') as string || '[]');
  const matchesPerNight = parseInt(formData.get('matchesPerNight') as string || '5', 10);
  const bestOf = parseInt(formData.get('bestOf') as string || '3', 10);

  // Convert to base64
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp';

  try {
    const result = await parseScoresheetImage(base64, mediaType, {
      homeTeamName,
      awayTeamName,
      homeRoster,
      awayRoster,
      matchesPerNight,
      bestOf,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('OCR parsing failed:', err);
    return NextResponse.json(
      { error: 'Failed to parse scoresheet. Please try again or enter scores manually.' },
      { status: 500 },
    );
  }
}
