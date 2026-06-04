import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Check, Minus } from 'lucide-react';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '€0',
    period: 'forever',
    description: 'Everything you need to start archiving with a small circle.',
    cta: 'Your current plan',
    ctaHref: '/dashboard',
    ctaVariant: 'outline' as const,
    highlight: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '€3',
    period: 'per month',
    description: 'For people with many circles or groups that grow over time.',
    cta: 'Upgrade to Premium',
    ctaHref: '/upgrade',
    ctaVariant: 'default' as const,
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: 'billed annually',
    description: 'For teams, communities, or power archivists who need no ceiling.',
    cta: 'Contact us',
    ctaHref: 'mailto:hello@thefriendarchive.com',
    ctaVariant: 'outline' as const,
    highlight: false,
  },
] as const;

type Availability = true | false | string;

interface FeatureRow {
  label: string;
  sub?: string;
  free: Availability;
  premium: Availability;
  enterprise: Availability;
}

const featureTable: FeatureRow[] = [
  {
    label: 'Groups you can create',
    free: 'Up to 2',
    premium: 'Up to 10',
    enterprise: 'Unlimited',
  },
  {
    label: 'Total groups (incl. joined)',
    free: 'Up to 5',
    premium: 'Unlimited',
    enterprise: 'Unlimited',
  },
  {
    label: 'Media items per group',
    free: 'Unlimited',
    premium: 'Unlimited',
    enterprise: 'Unlimited',
  },
  {
    label: 'Media types',
    sub: 'Movies, TV, books, video games',
    free: true,
    premium: true,
    enterprise: true,
  },
  {
    label: 'Personal consumption notes',
    sub: 'Visible only to you, up to 500 chars',
    free: true,
    premium: true,
    enterprise: true,
  },
  {
    label: 'Who consumed tracking',
    sub: 'See who in your group has watched, read, or played',
    free: true,
    premium: true,
    enterprise: true,
  },
  {
    label: 'Public group discovery',
    free: true,
    premium: true,
    enterprise: true,
  },
  {
    label: 'Priority support',
    free: false,
    premium: true,
    enterprise: true,
  },
  {
    label: 'Custom onboarding',
    free: false,
    premium: false,
    enterprise: true,
  },
];

function AvailabilityCell({ value }: { value: Availability }) {
  if (value === true)
    return <Check className="h-4 w-4 mx-auto" style={{ color: 'var(--color-success)' }} />;
  if (value === false)
    return <Minus className="h-4 w-4 mx-auto" style={{ color: 'oklch(0.32 0.005 60)' }} />;
  return (
    <span className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
      {value}
    </span>
  );
}

const faqs = [
  {
    q: 'Can I upgrade or downgrade at any time?',
    a: 'Yes. Upgrades take effect immediately. Downgrades apply at the end of your billing cycle.',
  },
  {
    q: 'What happens to my groups if I downgrade from Premium to Free?',
    a: 'Your existing groups and all data are preserved. You just cannot create new groups beyond the Free limit until you upgrade again.',
  },
  {
    q: 'Is there a free trial for Premium?',
    a: 'The Free plan is permanent and does not expire — start there and upgrade when you need more groups.',
  },
  {
    q: 'How does payment work?',
    a: 'Payment integration is coming soon. For now, Premium activation is handled manually. Contact us to arrange it.',
  },
];

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let currentPlan: string | null = null;
  if (user) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', user.id)
      .single();
    currentPlan = sub?.plan ?? 'free';
  }

  return (
    <div className="space-y-20 max-w-5xl">
      {/* Header */}
      <div className="space-y-4 pt-2">
        <p
          className="font-mono text-xs uppercase tracking-[0.3em]"
          style={{ color: 'oklch(0.72 0.12 65 / 0.65)' }}
        >
          Pricing
        </p>
        <h1 className="font-serif text-5xl text-stone-100 font-light leading-[1.0]">
          Simple plans.
          <br />
          <span style={{ color: 'var(--color-accent)' }}>No hidden fees.</span>
        </h1>
        <p className="text-stone-400 text-base font-light max-w-lg leading-relaxed">
          Start free and stay free as long as you like. Upgrade when your archive outgrows two
          groups.
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border border-stone-800/50">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="p-8 space-y-7 border-b sm:border-b-0 sm:border-r border-stone-800/50 last:border-r-0 last:border-b-0 relative flex flex-col"
            style={
              plan.highlight
                ? { backgroundColor: 'oklch(0.115 0.015 60)' }
                : {}
            }
          >
            {plan.highlight && (
              <div
                className="absolute top-0 inset-x-0 h-0.5"
                style={{ backgroundColor: 'var(--color-accent)' }}
              />
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p
                  className="font-mono text-xs uppercase tracking-[0.3em]"
                  style={{ color: plan.highlight ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
                >
                  {plan.name}
                </p>
                {plan.highlight && (
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border"
                    style={{
                      borderColor: 'oklch(0.55 0.12 60 / 0.4)',
                      color: 'var(--color-accent)',
                    }}
                  >
                    Popular
                  </span>
                )}
                {currentPlan === plan.id && (
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border"
                    style={{
                      borderColor: 'oklch(0.72 0.14 160 / 0.4)',
                      color: 'var(--color-success)',
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-5xl text-stone-100 font-light">{plan.price}</span>
                {plan.price !== 'Custom' && (
                  <span className="font-mono text-xs" style={{ color: 'oklch(0.38 0.005 60)' }}>
                    / {plan.period}
                  </span>
                )}
              </div>
              <p className="text-sm font-light leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {plan.description}
              </p>
            </div>

            <div className="flex-1" />

            <Link href={plan.ctaHref}>
              <Button
                variant={plan.highlight ? 'default' : 'outline'}
                className="w-full"
                disabled={currentPlan === plan.id && plan.id === 'free'}
              >
                {currentPlan === plan.id && plan.id === 'free' ? 'Current plan' : plan.cta}
              </Button>
            </Link>
          </div>
        ))}
      </div>

      {/* Feature comparison table */}
      <div className="space-y-5">
        <h2 className="font-mono text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>
          Full comparison
        </h2>

        <div className="border border-stone-800/50 overflow-x-auto">
          {/* Table header */}
          <div
            className="grid border-b border-stone-800/50"
            style={{ gridTemplateColumns: '1fr repeat(3, minmax(80px, 140px))' }}
          >
            <div className="p-4" />
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="p-4 text-center border-l border-stone-800/50"
                style={plan.highlight ? { backgroundColor: 'oklch(0.115 0.015 60)' } : {}}
              >
                <p
                  className="font-mono text-xs uppercase tracking-[0.25em]"
                  style={{ color: plan.highlight ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
                >
                  {plan.name}
                </p>
              </div>
            ))}
          </div>

          {featureTable.map((row) => (
            <div
              key={row.label}
              className="grid border-b border-stone-800/30 last:border-b-0"
              style={{ gridTemplateColumns: '1fr repeat(3, minmax(80px, 140px))' }}
            >
              <div className="px-4 py-3.5 space-y-0.5">
                <p className="text-sm text-stone-200 font-light">{row.label}</p>
                {row.sub && (
                  <p className="text-xs font-mono" style={{ color: 'oklch(0.42 0.005 60)' }}>
                    {row.sub}
                  </p>
                )}
              </div>
              {(['free', 'premium', 'enterprise'] as const).map((planId) => (
                <div
                  key={planId}
                  className="px-4 py-3.5 flex items-center justify-center border-l border-stone-800/30"
                  style={
                    planId === 'premium'
                      ? { backgroundColor: 'oklch(0.115 0.015 60)' }
                      : {}
                  }
                >
                  <AvailabilityCell value={row[planId]} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-6">
        <h2 className="font-mono text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>
          Questions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 border border-stone-800/50">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="p-6 space-y-2 border-b border-r border-stone-800/30 last:border-b-0 even:border-r-0 sm:even:border-r sm:[&:nth-child(3)]:border-r-0 sm:[&:nth-child(3)]:border-b-0 sm:[&:nth-child(4)]:border-b-0"
            >
              <p className="font-serif text-base text-stone-100">{faq.q}</p>
              <p className="text-sm font-light leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <p
        className="font-mono text-xs text-center pb-4"
        style={{ color: 'oklch(0.38 0.005 60)' }}
      >
        No credit card required to start · Cancel or change at any time · Payment integration coming soon
      </p>
    </div>
  );
}
