import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createServiceClient } from '../_shared/supabase.ts';

function twimlResponse(message: string): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`;
  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createServiceClient();

  // Parse form-encoded body from Twilio
  const formData = await req.formData();
  const fromPhone = formData.get('From') as string || '';
  const body = formData.get('Body') as string || '';
  const numMedia = parseInt(formData.get('NumMedia') as string || '0', 10);
  const mediaUrl0 = formData.get('MediaUrl0') as string | null;
  const mediaType0 = formData.get('MediaContentType0') as string | null;

  // TODO: Verify Twilio signature (HMAC-SHA1) for production
  // const twilioSig = req.headers.get('x-twilio-signature');
  // const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;

  const normalized = normalizePhone(fromPhone);

  // 1. Identify captain by phone number
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('phone', normalized)
    .single();

  if (!profile) {
    await supabase.from('sms_pending_scores').insert({
      from_phone: fromPhone,
      body,
      media_url: mediaUrl0,
      status: 'failed',
      error_message: 'Phone number not recognized',
    });
    return twimlResponse('Sorry, your phone number is not registered with any league. Contact your league admin.');
  }

  // 2. Find org membership
  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('profile_id', profile.id)
    .single();

  if (!membership) {
    await supabase.from('sms_pending_scores').insert({
      from_phone: fromPhone,
      body,
      media_url: mediaUrl0,
      status: 'failed',
      error_message: 'No organization membership found',
    });
    return twimlResponse('Your account is not linked to any league. Contact your league admin.');
  }

  // 3. Find active season
  const { data: season } = await supabase
    .from('seasons')
    .select('id')
    .eq('org_id', membership.org_id)
    .eq('status', 'active')
    .single();

  if (!season) {
    await supabase.from('sms_pending_scores').insert({
      org_id: membership.org_id,
      from_phone: fromPhone,
      body,
      media_url: mediaUrl0,
      status: 'failed',
      error_message: 'No active season found',
    });
    return twimlResponse('No active season found for your league.');
  }

  // 4. Find captain's team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('captain_profile_id', profile.id)
    .eq('org_id', membership.org_id)
    .eq('season_id', season.id)
    .single();

  if (!team) {
    await supabase.from('sms_pending_scores').insert({
      org_id: membership.org_id,
      from_phone: fromPhone,
      body,
      media_url: mediaUrl0,
      status: 'failed',
      error_message: 'Not a team captain this season',
    });
    return twimlResponse('You are not listed as a team captain for the current season.');
  }

  // 5. Find the most recent unfinished match for this team
  // Get schedule entries for this team that don't have a match yet
  const { data: scheduleEntries } = await supabase
    .from('schedule')
    .select('*')
    .eq('org_id', membership.org_id)
    .eq('season_id', season.id)
    .eq('is_bye', false)
    .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
    .order('date', { ascending: false });

  if (!scheduleEntries || scheduleEntries.length === 0) {
    await supabase.from('sms_pending_scores').insert({
      org_id: membership.org_id,
      from_phone: fromPhone,
      body,
      media_url: mediaUrl0,
      team_id: team.id,
      status: 'failed',
      error_message: 'No scheduled matches found',
    });
    return twimlResponse('No matches found for your team.');
  }

  // Find first schedule entry without a completed match
  const { data: existingMatches } = await supabase
    .from('matches')
    .select('schedule_id')
    .eq('org_id', membership.org_id)
    .eq('season_id', season.id);
  const completedIds = new Set((existingMatches || []).map((m: { schedule_id: string }) => m.schedule_id));

  const targetSchedule = scheduleEntries.find(s => !completedIds.has(s.id));
  if (!targetSchedule) {
    await supabase.from('sms_pending_scores').insert({
      org_id: membership.org_id,
      from_phone: fromPhone,
      body,
      media_url: mediaUrl0,
      team_id: team.id,
      status: 'failed',
      error_message: 'All matches are already completed',
    });
    return twimlResponse('All your matches are already completed!');
  }

  // 6. Check for image attachment
  if (numMedia === 0 || !mediaUrl0) {
    await supabase.from('sms_pending_scores').insert({
      org_id: membership.org_id,
      from_phone: fromPhone,
      body,
      team_id: team.id,
      schedule_id: targetSchedule.id,
      status: 'failed',
      error_message: 'No image attached',
    });
    return twimlResponse('Please send a photo of your scoresheet. No image was found in your message.');
  }

  // 7. Download image from Twilio
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN') || '';

  let imageBase64: string;
  try {
    const imageRes = await fetch(mediaUrl0, {
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      },
    });
    if (!imageRes.ok) throw new Error(`Failed to fetch image: ${imageRes.status}`);
    const imageBuffer = await imageRes.arrayBuffer();
    const bytes = new Uint8Array(imageBuffer);
    imageBase64 = btoa(String.fromCharCode(...bytes));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await supabase.from('sms_pending_scores').insert({
      org_id: membership.org_id,
      from_phone: fromPhone,
      body,
      media_url: mediaUrl0,
      team_id: team.id,
      schedule_id: targetSchedule.id,
      status: 'failed',
      error_message: `Failed to download image: ${msg}`,
    });
    return twimlResponse('Sorry, we could not process your image. Please try again or submit scores online.');
  }

  // 8. Get rosters for the match
  const [homeRosterRes, awayRosterRes] = await Promise.all([
    supabase.from('players').select('name').eq('team_id', targetSchedule.home_team_id).eq('org_id', membership.org_id),
    supabase.from('players').select('name').eq('team_id', targetSchedule.away_team_id).eq('org_id', membership.org_id),
  ]);

  const homeRoster = (homeRosterRes.data || []).map((p: { name: string }) => p.name);
  const awayRoster = (awayRosterRes.data || []).map((p: { name: string }) => p.name);

  // Get team names
  const [homeTeamRes, awayTeamRes] = await Promise.all([
    supabase.from('teams').select('name').eq('id', targetSchedule.home_team_id).single(),
    supabase.from('teams').select('name').eq('id', targetSchedule.away_team_id).single(),
  ]);

  // Get league settings
  const { data: settings } = await supabase
    .from('league_settings')
    .select('matches_per_night, best_of')
    .eq('org_id', membership.org_id)
    .single();
  const matchesPerNight = settings?.matches_per_night || 5;
  const bestOf = settings?.best_of || 3;
  const winsNeeded = Math.ceil(bestOf / 2);

  // 9. Call Claude Vision API to parse scoresheet
  let parsedResult: {
    matchups: Array<{ home_player: string; away_player: string; home_wins: number; away_wins: number }>;
    confidence: string;
    notes?: string;
  };

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType0, data: imageBase64 },
            },
            {
              type: 'text',
              text: `Parse this pool league scoresheet. Format: ${matchesPerNight} games, best of ${bestOf} (first to ${winsNeeded}).
Home team: "${homeTeamRes.data?.name}". Roster: [${homeRoster.join(', ')}]
Away team: "${awayTeamRes.data?.name}". Roster: [${awayRoster.join(', ')}]
Return ONLY JSON: {"matchups":[{"home_player":"name","away_player":"name","home_wins":N,"away_wins":N}],"confidence":"high|medium|low","notes":"..."}
Player names MUST match roster names exactly. Return exactly ${matchesPerNight} matchups.`,
            },
          ],
        }],
      }),
    });

    const anthropicData = await anthropicRes.json();
    const text = anthropicData.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    parsedResult = JSON.parse(jsonMatch[0]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await supabase.from('sms_pending_scores').insert({
      org_id: membership.org_id,
      from_phone: fromPhone,
      body,
      media_url: mediaUrl0,
      team_id: team.id,
      schedule_id: targetSchedule.id,
      status: 'pending',
      error_message: `OCR parsing failed: ${msg}`,
    });
    return twimlResponse('We received your scoresheet but had trouble reading it. An admin will review it shortly.');
  }

  // 10. Store the SMS record
  const smsRecord = {
    org_id: membership.org_id,
    from_phone: fromPhone,
    body,
    media_url: mediaUrl0,
    parsed_data: parsedResult,
    team_id: team.id,
    schedule_id: targetSchedule.id,
    status: 'pending' as const,
  };

  // 11. If high confidence, auto-submit
  if (parsedResult.confidence === 'high' && parsedResult.matchups.length === matchesPerNight) {
    // Compute scores
    const homeScore = parsedResult.matchups.filter(m => m.home_wins > m.away_wins).length;
    const awayScore = parsedResult.matchups.filter(m => m.away_wins > m.home_wins).length;

    const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_scores', {
      p_org_id: membership.org_id,
      p_season_id: season.id,
      p_schedule_id: targetSchedule.id,
      p_team_id: team.id,
      p_submitted_by: profile.id,
      p_home_score: homeScore,
      p_away_score: awayScore,
      p_matchups: parsedResult.matchups,
    });

    if (rpcError) {
      smsRecord.status = 'pending';
      smsRecord.parsed_data = { ...parsedResult, rpc_error: rpcError.message };
      await supabase.from('sms_pending_scores').insert(smsRecord);
      return twimlResponse(`We read your scoresheet but hit an issue: ${rpcError.message}. An admin will review.`);
    }

    const status = (rpcResult as { status: string }).status;
    await supabase.from('sms_pending_scores').insert({
      ...smsRecord,
      status: 'processed',
      processed_at: new Date().toISOString(),
    });

    if (status === 'auto_approved') {
      return twimlResponse(`Scores submitted and auto-approved! ${homeTeamRes.data?.name} ${homeScore} - ${awayScore} ${awayTeamRes.data?.name}`);
    } else if (status === 'pending') {
      return twimlResponse(`Scores submitted! Waiting for ${team.id === targetSchedule.home_team_id ? awayTeamRes.data?.name : homeTeamRes.data?.name} to confirm.`);
    } else if (status === 'conflict') {
      return twimlResponse('Scores submitted but don\'t match the other team\'s submission. An admin will review.');
    }

    return twimlResponse(`Scores submitted! Status: ${status}`);
  }

  // Low/medium confidence — queue for admin
  await supabase.from('sms_pending_scores').insert(smsRecord);
  return twimlResponse('Got your scoresheet! An admin will review and confirm the scores shortly.');
});
