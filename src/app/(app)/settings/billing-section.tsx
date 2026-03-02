'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, CardHeader, CardBody, Badge } from '@/components/ui';
import { CreditCard, Check } from 'lucide-react';

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    monthlyPrice: 5,
    annualPrice: 54,
    features: ['Up to 10 teams', 'Basic standings', 'Current season only'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 10,
    annualPrice: 108,
    popular: true,
    features: ['Up to 20 teams', 'Full stats', '3 years history', 'Photo upload'],
  },
  {
    id: 'premium',
    name: 'Premium',
    monthlyPrice: 20,
    annualPrice: 216,
    features: ['Unlimited teams', 'All-time history', 'Hall of Fame', 'Head-to-head'],
  },
];

export function BillingSection() {
  const { organization } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const supabase = createClient();

  const currentTier = organization?.subscription_tier || 'free';

  async function handleUpgrade(planId: string) {
    setLoading(planId);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan: planId, interval: billingPeriod },
      });

      if (error) {
        toast(error.message || 'Failed to start checkout', 'error');
        setLoading(null);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast('No checkout URL returned', 'error');
      }
    } catch {
      toast('Failed to start checkout. Please try again.', 'error');
    }
    setLoading(null);
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-800">Billing & Subscription</h2>
        </div>
      </CardHeader>
      <CardBody>
        {/* Current plan */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm text-slate-600">Current plan:</span>
          <Badge variant={currentTier === 'free' ? 'default' : 'success'}>
            {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
          </Badge>
          {organization?.subscription_status && organization.subscription_status !== 'trialing' && (
            <Badge variant={organization.subscription_status === 'active' ? 'success' : 'warning'}>
              {organization.subscription_status}
            </Badge>
          )}
        </div>

        {/* Billing period toggle */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => setBillingPeriod('monthly')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              billingPeriod === 'monthly'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingPeriod('annual')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              billingPeriod === 'annual'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Annual
            <span className="ml-1 text-xs opacity-75">(save ~17%)</span>
          </button>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => {
            const price = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
            const isCurrent = currentTier === plan.id;

            return (
              <div
                key={plan.id}
                className={`border rounded-lg p-4 relative ${
                  plan.popular
                    ? 'border-emerald-500 ring-1 ring-emerald-500'
                    : 'border-slate-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="success">Most Popular</Badge>
                  </div>
                )}
                <h3 className="font-bold text-slate-800 mt-1">{plan.name}</h3>
                <p className="mt-1">
                  <span className="text-2xl font-black text-slate-800">${price}</span>
                  <span className="text-sm text-slate-500">
                    /{billingPeriod === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </p>
                <ul className="mt-4 space-y-2">
                  {plan.features.map(f => (
                    <li key={f} className="text-sm text-slate-600 flex items-start gap-1.5">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full mt-4"
                  size="sm"
                  variant={isCurrent ? 'secondary' : 'primary'}
                  loading={loading === plan.id}
                  disabled={isCurrent}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {isCurrent ? 'Current Plan' : 'Upgrade'}
                </Button>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
