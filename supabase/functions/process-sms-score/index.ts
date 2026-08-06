import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createServiceClient } from '../_shared/supabase.ts';

// Async SMS score processor. Invoked by pg_net from the twilio-webhook
// after that webhook has already returned 200 to Twilio. Loads the queued
// sms_pending_scores row, resolves captain->team->match, calls Claude
// Vision, writes scores via submit_scores RPC, and texts the captain the
// outcome via Twilio REST API (the original HTTP response is long gone).

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

async function sendSms(to: string, body: string): Promise<void> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_PHONE_NUMBER');
  if (!sid || !token || !from) {
    console.error('Twilio REST creds missing; cannot reply to captain');
    return;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = 'Basic ' + uint8ToBase64(new TextEncoder().encode(`${sid}:${token}`));
  const form = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('Twilio REST reply failed:', res.status, text);
  }
}

type SupabaseClient = ReturnType<typeof createServiceClient>;

async function fail(
  supabase: SupabaseClient,
  smsId: string,
  toPhone: string,
  errorMessage: string,
  captainMessage: string,
): Promise<Response> {
  await supabase
    .from('sms_pending_scores')
    .update({ status: 'failed', error_message: errorMessage, processed_at: new Date().toISOString() })
    .eq('id', smsId);
  if (toPhone) await sendSms(toPhone, captainMessage);
  return new Response(JSON.stringify({ ok: false, error: errorMessage }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { sms_id } = await req.json().catch(() => ({ sms_id: null }));
  if (!sms_id) return new Response('Missing sms_id', { status: 400 });

  const supabase = createServiceClient();

  // Claim the row: only pick it up if still queued. Prevents a second
  // pg_net delivery (or manual drainer) from double-processing.
  const { data: claimed, error: claimError } = await supabase
    .from('sms_pending_scores')
    .update({ status: 'processing' })
    .eq('id', sms_id)
    .eq('status', 'queued')
    .select('*')
    .maybeSingle();

  if (claimError) {
    console.error('Claim error:', claimError);
    return new Response('Claim failed', { status: 500 });
  }
  if (!claimed) {
    // Already claimed by another invocation, or not queued anymore.
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const fromPhone = claimed.from_phone as string;
  const mediaUrl = claimed.media_url as string | null;
  const normalized = normalizePhone(fromPhone);

  // 1. Captain by phone.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('phone', normalized)
    .maybeSingle();
  if (!profile) {
    return await fail(supabase, sms_id, fromPhone, 'Phone number not recognized',
      'Sorry, your phone number is not registered with any league. Contact your league admin.');
  }

  // 2. Org membership.
  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('profile_id', profile.id)
    .maybeSingle();
  if (!membership) {
    return await fail(supabase, sms_id, fromPhone, 'No organization membership found',
      'Your account is not linked to any league. Contact your league admin.');
  }
  await supabase.from('sms_pending_scores').update({ org_id: membership.org_id }).eq('id', sms_id);

  // 2b. Subscription tier + status.
  const { data: org } = await supabase
    .from('organizations')
    .select('subscription_tier, subscription_status')
    .eq('id', membership.org_id)
    .maybeSingle();
  const SMS_TIERS = ['trial', 'pro', 'premium'];
  if (!org || !SMS_TIERS.includes(org.subscription_tier || '')) {
    return await fail(supabase, sms_id, fromPhone, 'SMS submission not available on current plan',
      'SMS score submission is not available on your league\'s current plan. Ask your admin to upgrade.');
  }
  const READ_ONLY_STATUSES = ['past_due', 'canceled', 'expired'];
  if (READ_ONLY_STATUSES.includes(org.subscription_status || '')) {
    return await fail(supabase, sms_id, fromPhone, 'Subscription is inactive',
      'Your league\'s subscription is inactive. Contact your league admin.');
  }

  // 3. Active season.
  const { data: season } = await supabase
    .from('seasons')
    .select('id')
    .eq('org_id', membership.org_id)
    .eq('status', 'active')
    .maybeSingle();
  if (!season) {
    return await fail(supabase, sms_id, fromPhone, 'No active season found',
      'No active season found for your league.');
  }

  // 4. Captain's team.
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('captain_profile_id', profile.id)
    .eq('org_id', membership.org_id)
    .eq('season_id', season.id)
    .maybeSingle();
  if (!team) {
    return await fail(supabase, sms_id, fromPhone, 'Not a team captain this season',
      'You are not listed as a team captain for the current season.');
  }
  await supabase.from('sms_pending_scores').update({ team_id: team.id }).eq('id', sms_id);

  // 5. Next unfinished match for this team.
  const { data: scheduleEntries } = await supabase
    .from('schedule')
    .select('*')
    .eq('org_id', membership.org_id)
    .eq('season_id', season.id)
    .eq('is_bye', false)
    .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
    .order('date', { ascending: false });
  if (!scheduleEntries || scheduleEntries.length === 0) {
    return await fail(supabase, sms_id, fromPhone, 'No scheduled matches found',
      'No matches found for your team.');
  }
  const { data: existingMatches } = await supabase
    .from('matches')
    .select('schedule_id')
    .eq('org_id', membership.org_id)
    .eq('season_id', season.id);
  const completedIds = new Set((existingMatches || []).map((m: { schedule_id: string }) => m.schedule_id));
  const targetSchedule = scheduleEntries.find(s => !completedIds.has(s.id));
  if (!targetSchedule) {
    return await fail(supabase, sms_id, fromPhone, 'All matches are already completed',
      'All your matches are already completed!');
  }
  await supabase.from('sms_pending_scores').update({ schedule_id: targetSchedule.id }).eq('id', sms_id);

  // 6. Image required.
  if (!mediaUrl) {
    return await fail(supabase, sms_id, fromPhone, 'No image attached',
      'Please send a photo of your scoresheet. No image was found in your message.');
  }

  // 7. Download image from Twilio.
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
  let imageBase64: string;
  let mediaType: string;
  try {
    const imageRes = await fetch(mediaUrl, {
      headers: {
        'Authorization': 'Basic ' + uint8ToBase64(new TextEncoder().encode(`${accountSid}:${authToken}`)),
      },
    });
    if (!imageRes.ok) throw new Error(`Failed to fetch image: ${imageRes.status}`);
    mediaType = imageRes.headers.get('content-type') || 'image/jpeg';
    const bytes = new Uint8Array(await imageRes.arrayBuffer());
    imageBase64 = uint8ToBase64(bytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return await fail(supabase, sms_id, fromPhone, `Failed to download image: ${msg}`,
      'Sorry, we could not process your image. Please try again or submit scores online.');
  }

  // 8. Rosters + team names.
  const [homeRosterRes, awayRosterRes, homeTeamRes, awayTeamRes] = await Promise.all([
    supabase.from('players').select('name').eq('team_id', targetSchedule.home_team_id).eq('org_id', membership.org_id),
    supabase.from('players').select('name').eq('team_id', targetSchedule.away_team_id).eq('org_id', membership.org_id),
    supabase.from('teams').select('name').eq('id', targetSchedule.home_team_id).maybeSingle(),
    supabase.from('teams').select('name').eq('id', targetSchedule.away_team_id).maybeSingle(),
  ]);
  if (!homeTeamRes.data || !awayTeamRes.data) {
    return await fail(supabase, sms_id, fromPhone, 'Could not load team data for this match',
      'Sorry, we could not find the teams for your match. Please contact your admin.');
  }
  const homeRoster = (homeRosterRes.data || []).map((p: { name: string }) => p.name);
  const awayRoster = (awayRosterRes.data || []).map((p: { name: string }) => p.name);

  // 9. League format.
  const { data: settings } = await supabase
    .from('league_settings')
    .select('matches_per_night, best_of')
    .eq('org_id', membership.org_id)
    .maybeSingle();
  const matchesPerNight = settings?.matches_per_night || 5;
  const bestOf = settings?.best_of || 3;
  const winsNeeded = Math.ceil(bestOf / 2);

  // 10. Claude Vision.
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
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
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
    await supabase
      .from('sms_pending_scores')
      .update({
        status: 'pending',
        error_message: `OCR parsing failed: ${msg}`,
        processed_at: new Date().toISOString(),
      })
      .eq('id', sms_id);
    await sendSms(fromPhone, 'We received your scoresheet but had trouble reading it. An admin will review it shortly.');
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 11. High confidence -> submit; else queue for admin.
  if (parsedResult.confidence === 'high' && parsedResult.matchups.length === matchesPerNight) {
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
      await supabase
        .from('sms_pending_scores')
        .update({
          status: 'pending',
          parsed_data: { ...parsedResult, rpc_error: rpcError.message },
          error_message: rpcError.message,
          processed_at: new Date().toISOString(),
        })
        .eq('id', sms_id);
      await sendSms(fromPhone, 'We read your scoresheet but hit a technical issue saving the scores. An admin will review.');
      return new Response(JSON.stringify({ ok: false, error: rpcError.message }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await supabase
      .from('sms_pending_scores')
      .update({
        parsed_data: parsedResult,
        status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', sms_id);

    const status = (rpcResult as { status: string }).status;
    let reply: string;
    if (status === 'auto_approved') {
      reply = `Scores submitted and auto-approved! ${homeTeamRes.data?.name} ${homeScore} - ${awayScore} ${awayTeamRes.data?.name}`;
    } else if (status === 'pending') {
      const other = team.id === targetSchedule.home_team_id ? awayTeamRes.data?.name : homeTeamRes.data?.name;
      reply = `Scores submitted! Waiting for ${other} to confirm.`;
    } else if (status === 'conflict') {
      reply = 'Scores submitted but don\'t match the other team\'s submission. An admin will review.';
    } else {
      reply = `Scores submitted! Status: ${status}`;
    }
    await sendSms(fromPhone, reply);
    return new Response(JSON.stringify({ ok: true, status }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Low/medium confidence — queue for admin.
  await supabase
    .from('sms_pending_scores')
    .update({
      parsed_data: parsedResult,
      status: 'pending',
      processed_at: new Date().toISOString(),
    })
    .eq('id', sms_id);
  await sendSms(fromPhone, 'Got your scoresheet! An admin will review and confirm the scores shortly.');
  return new Response(JSON.stringify({ ok: true, status: 'pending_review' }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
