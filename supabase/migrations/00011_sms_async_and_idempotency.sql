-- Async SMS processing + Twilio retry idempotency.
--
-- Why: the sync twilio-webhook runs Claude Vision inline. Vision commonly
-- takes 5-15s and Twilio times out at 15s, retrying up to 3x. Each retry
-- re-runs submit_scores and corrupts match data. Split the flow: the
-- webhook writes a queued row (deduped on Twilio MessageSid) and returns
-- fast; process-sms-score drains it async.

-- 1. pg_net for the async kick from webhook -> processor.
create extension if not exists pg_net with schema extensions;

-- 2. Idempotency key + new statuses.
alter table sms_pending_scores
  add column if not exists twilio_message_sid text;

create unique index if not exists sms_pending_scores_message_sid_uidx
  on sms_pending_scores(twilio_message_sid)
  where twilio_message_sid is not null;

alter table sms_pending_scores
  drop constraint if exists sms_pending_scores_status_check;

alter table sms_pending_scores
  add constraint sms_pending_scores_status_check
  check (status in ('queued', 'processing', 'pending', 'processed', 'failed'));

-- 3. Fast-lookup index for the drainer.
create index if not exists idx_sms_pending_queued
  on sms_pending_scores(status, created_at)
  where status in ('queued', 'processing');

-- 4. Enqueue helper. The webhook calls this via PostgREST after inserting
-- the queued row; pg_net delivers a fire-and-forget HTTP POST to
-- process-sms-score. Security definer because pg_net functions live in
-- the net schema and are not exposed to the service role by default.
create or replace function public.enqueue_sms_processing(
  p_sms_id uuid,
  p_function_url text,
  p_service_role_key text
) returns bigint
language plpgsql
security definer
set search_path = extensions, public
as $$
declare
  v_request_id bigint;
begin
  select net.http_post(
    url := p_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || p_service_role_key
    ),
    body := jsonb_build_object('sms_id', p_sms_id),
    timeout_milliseconds := 30000
  ) into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function public.enqueue_sms_processing(uuid, text, text) from public, anon, authenticated;
grant execute on function public.enqueue_sms_processing(uuid, text, text) to service_role;
