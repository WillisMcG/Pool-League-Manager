import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createServiceClient } from '../_shared/supabase.ts';

function twimlResponse(message: string): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`;
  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

// Chunked base64 — spread crashes on large arrays.
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

async function verifyTwilioSignature(
  req: Request,
  params: URLSearchParams,
  authToken: string,
): Promise<boolean> {
  const signature = req.headers.get('x-twilio-signature');
  if (!signature) return false;

  const url = Deno.env.get('TWILIO_WEBHOOK_URL') || req.url;
  const sortedKeys = Array.from(params.keys()).sort();
  let dataString = url;
  for (const key of sortedKeys) {
    dataString += key + params.get(key);
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(dataString));
  const expected = uint8ToBase64(new Uint8Array(sig));

  return signature === expected;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!authToken) {
    console.error('TWILIO_AUTH_TOKEN not configured');
    return new Response('Server misconfigured', { status: 500 });
  }

  const formData = await req.formData();
  const params = new URLSearchParams();
  for (const [key, value] of formData.entries()) {
    params.set(key, value as string);
  }

  const valid = await verifyTwilioSignature(req, params, authToken);
  if (!valid) {
    console.error('Twilio signature verification failed');
    return new Response('Invalid signature', { status: 403 });
  }

  const messageSid = formData.get('MessageSid') as string || '';
  const fromPhone = formData.get('From') as string || '';
  const body = formData.get('Body') as string || '';
  const mediaUrl0 = formData.get('MediaUrl0') as string | null;

  if (!messageSid) {
    console.error('Missing MessageSid on Twilio request');
    return twimlResponse('Sorry, we could not process your message.');
  }

  const supabase = createServiceClient();

  // Idempotency: insert queued row keyed on MessageSid. If Twilio retries
  // (or delivers the same MMS twice), the unique index makes the second
  // insert fail and we short-circuit without re-triggering processing.
  const { data: inserted, error: insertError } = await supabase
    .from('sms_pending_scores')
    .insert({
      twilio_message_sid: messageSid,
      from_phone: fromPhone,
      body,
      media_url: mediaUrl0,
      status: 'queued',
    })
    .select('id')
    .single();

  if (insertError) {
    // 23505 = unique_violation — this is a Twilio retry, already queued.
    // Any other error is real; still respond 200 so Twilio doesn't retry.
    if (insertError.code === '23505') {
      return twimlResponse('Got it — your scoresheet is already being processed.');
    }
    console.error('Failed to enqueue SMS:', insertError);
    return twimlResponse('Sorry, we hit a technical issue. Please try again in a minute.');
  }

  // Kick the async processor via pg_net. Fire-and-forget: pg_net queues
  // the HTTP call in Postgres and delivers it in the background, so this
  // returns in milliseconds and does not block the Twilio response.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const processorUrl = `${supabaseUrl}/functions/v1/process-sms-score`;

  const { error: enqueueError } = await supabase.rpc('enqueue_sms_processing', {
    p_sms_id: inserted.id,
    p_function_url: processorUrl,
    p_service_role_key: serviceRoleKey,
  });

  if (enqueueError) {
    console.error('Failed to enqueue processor:', enqueueError);
    // Row is queued; a drainer can pick it up later. Still tell the
    // captain something reasonable.
    return twimlResponse('Got your scoresheet — an admin will review it shortly.');
  }

  return twimlResponse('Got it! Reading your scoresheet — we\'ll text back with the result in a minute.');
});
