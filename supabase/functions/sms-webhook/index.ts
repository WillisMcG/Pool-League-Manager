// Supabase Edge Function: SMS Webhook for Twilio
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function parseScore(body) {
  const text = body.trim().toLowerCase();
  const match = text.match(/(d+)s*[-s]?s*(?:tos*)?(d+)/i);
  if (!match) return null;
  let s1 = parseInt(match[1]), s2 = parseInt(match[2]);
  if (s1 > 5 || s2 > 5) return null;
  if (text.match(/lost|lose/i)) [s1, s2] = [s2, s1];
  return { homeScore: s1, awayScore: s2 };
}

async function sendSMS(to, message) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) return false;
  const url = "https://api.twilio.com/2010-04-01/Accounts/" + TWILIO_ACCOUNT_SID + "/Messages.json";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + btoa(TWILIO_ACCOUNT_SID + ":" + TWILIO_AUTH_TOKEN),
    },
    body: new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: message }),
  });
  return response.ok;
}

const normalizePhone = (p) => p.replace(/D/g, "").slice(-10);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  try {
    const formData = await req.formData();
    const msg = { From: formData.get("From"), Body: formData.get("Body") };
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const phone = normalizePhone(msg.From);
    
    const { data: users } = await supabase.from("users")
      .select("id, username, team_id, org_id").ilike("phone", "%" + phone + "%");
    
    if (!users?.length) {
      await sendSMS(msg.From, "Phone not registered. Contact league admin.");
      return new Response('<?xml version="1.0"?><Response></Response>', 
        { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
    }
    
    const user = users[0];
    const body = msg.Body.trim().toLowerCase();
    
    if (body === "help") {
      await sendSMS(msg.From, "Send score as '3-2'. Commands: help, status");
      return new Response('<?xml version="1.0"?><Response></Response>',
        { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
    }
    
    const parsed = parseScore(msg.Body);
    if (!parsed) {
      await sendSMS(msg.From, "Could not parse. Send as '3-2'");
      return new Response('<?xml version="1.0"?><Response></Response>',
        { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
    }
    
    const { data: matches } = await supabase.from("schedule")
      .select("id, week, home_team_id, away_team_id, season_id")
      .or("home_team_id.eq." + user.team_id + ",away_team_id.eq." + user.team_id)
      .eq("org_id", user.org_id).eq("is_bye", false)
      .order("date", { ascending: false }).limit(5);
    
    if (!matches?.length) {
      await sendSMS(msg.From, "No matches found.");
      return new Response('<?xml version="1.0"?><Response></Response>',
        { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
    }
    
    let target = null;
    for (const m of matches) {
      const { data: e } = await supabase.from("matches").select("id").eq("schedule_id", m.id).single();
      if (!e) { target = m; break; }
    }
    
    if (!target) {
      await sendSMS(msg.From, "All matches scored. Contact admin.");
      return new Response('<?xml version="1.0"?><Response></Response>',
        { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
    }
    
    const isHome = target.home_team_id === user.team_id;
    const hs = isHome ? parsed.homeScore : parsed.awayScore;
    const as = isHome ? parsed.awayScore : parsed.homeScore;
    
    const { data: existing } = await supabase.from("submissions")
      .select("id").eq("schedule_id", target.id).eq("submitted_by_team_id", user.team_id).single();
    
    if (existing) {
      await sendSMS(msg.From, "Already submitted for Week " + target.week);
      return new Response('<?xml version="1.0"?><Response></Response>',
        { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
    }
    
    await supabase.from("submissions").insert({
      schedule_id: target.id, submitted_by_team_id: user.team_id,
      submitted_by_user_id: user.id, home_score: hs, away_score: as,
      matchups: [], org_id: user.org_id, season_id: target.season_id, source: "sms"
    });
    
    const { data: other } = await supabase.from("submissions")
      .select("home_score, away_score").eq("schedule_id", target.id)
      .neq("submitted_by_team_id", user.team_id).single();
    
    if (other?.home_score === hs && other?.away_score === as) {
      await supabase.from("matches").insert({
        schedule_id: target.id, home_score: hs, away_score: as,
        matchups: [], org_id: user.org_id, season_id: target.season_id
      });
      await supabase.from("submissions").delete().eq("schedule_id", target.id);
      await sendSMS(msg.From, "Confirmed! Week " + target.week + ": " + as + "-" + hs + " Final!");
    } else if (other) {
      await sendSMS(msg.From, "Submitted but conflict. Admin will review.");
    } else {
      await sendSMS(msg.From, "Submitted Week " + target.week + ": " + as + "-" + hs + ". Waiting for opponent.");
    }
    
    return new Response('<?xml version="1.0"?><Response></Response>',
      { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
