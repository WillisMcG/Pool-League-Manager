import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { corsHeaders } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

// Map plan + interval to Stripe Price IDs
const PRICE_MAP: Record<string, Record<string, string>> = {
  basic: {
    monthly: 'price_1Suf0HDidS2jVuhadtJLgnLX',
    annual: 'price_1Suf0HDidS2jVuhaYZ3GEQzW',
  },
  pro: {
    monthly: 'price_1SufOZDidS2jVuha7RkjyRXi',
    annual: 'price_1SufOZDidS2jVuhakiQNABxz',
  },
  premium: {
    monthly: 'price_1SufPkDidS2jVuhatY2mAZT1',
    annual: 'price_1SufPkDidS2jVuham4wwGraF',
  },
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify the JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createServiceClient();
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    // Look up profile and org
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();
    if (!profile) throw new Error('Profile not found');

    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id, role')
      .eq('profile_id', profile.id)
      .single();
    if (!membership) throw new Error('No membership found');
    if (membership.role !== 'admin') throw new Error('Only admins can manage billing');

    const { data: org } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', membership.org_id)
      .single();
    if (!org) throw new Error('Organization not found');

    // Parse request body
    const { plan, interval } = await req.json();
    if (!plan || !interval) throw new Error('Missing plan or interval');

    const priceId = PRICE_MAP[plan]?.[interval];
    if (!priceId) throw new Error('Invalid plan or interval');

    // Get or create Stripe customer
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { org_id: org.id, org_name: org.name },
      });
      customerId = customer.id;

      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', org.id);
    }

    // Create Checkout Session
    const origin = req.headers.get('origin') || 'https://pool-league-manager.com';
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings?billing=success`,
      cancel_url: `${origin}/settings?billing=canceled`,
      metadata: { org_id: org.id },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
