import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createServiceClient } from '../_shared/supabase.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

// Map Stripe Price IDs to subscription tiers
// TODO: Replace with real Stripe Price IDs from your dashboard
const TIER_FROM_PRICE: Record<string, string> = {
  'price_basic_monthly': 'basic',
  'price_basic_annual': 'basic',
  'price_pro_monthly': 'pro',
  'price_pro_annual': 'pro',
  'price_premium_monthly': 'premium',
  'price_premium_annual': 'premium',
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Webhook signature verification failed:', message);
    return new Response(`Invalid signature: ${message}`, { status: 400 });
  }

  const supabase = createServiceClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.org_id;
      const subscriptionId = session.subscription as string;

      if (orgId && subscriptionId) {
        // Look up the subscription to get the price/tier
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = sub.items.data[0]?.price.id;
        const tier = TIER_FROM_PRICE[priceId] || 'basic';

        await supabase
          .from('organizations')
          .update({
            stripe_subscription_id: subscriptionId,
            subscription_tier: tier,
            subscription_status: 'active',
          })
          .eq('id', orgId);

        console.log(`Checkout completed: org=${orgId}, tier=${tier}`);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id;
      const tier = TIER_FROM_PRICE[priceId] || 'basic';

      // Map Stripe subscription status to our status
      const statusMap: Record<string, string> = {
        active: 'active',
        past_due: 'past_due',
        canceled: 'canceled',
        unpaid: 'past_due',
        trialing: 'trialing',
      };
      const status = statusMap[sub.status] || 'active';

      // Find org by stripe_subscription_id
      const { error } = await supabase
        .from('organizations')
        .update({
          subscription_tier: tier,
          subscription_status: status,
        })
        .eq('stripe_subscription_id', sub.id);

      if (error) {
        console.error('Failed to update subscription:', error.message);
      } else {
        console.log(`Subscription updated: sub=${sub.id}, tier=${tier}, status=${status}`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;

      const { error } = await supabase
        .from('organizations')
        .update({
          subscription_tier: 'free',
          subscription_status: 'expired',
          stripe_subscription_id: null,
        })
        .eq('stripe_subscription_id', sub.id);

      if (error) {
        console.error('Failed to handle subscription deletion:', error.message);
      } else {
        console.log(`Subscription deleted: sub=${sub.id}`);
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
