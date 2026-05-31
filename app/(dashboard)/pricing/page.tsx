import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '€0',
    period: 'forever',
    features: [
      'Up to 2 groups created',
      'Up to 5 total groups (incl. joined)',
      'Unlimited media items',
      'Personal consumption notes',
    ],
    cta: 'Current plan',
    ctaHref: '/dashboard',
    highlight: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '€3',
    period: 'per month',
    features: [
      'Up to 10 groups created',
      'Unlimited groups joined',
      'Unlimited media items',
      'Personal consumption notes',
      'Priority support',
    ],
    cta: 'Upgrade',
    ctaHref: '/upgrade',
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact us',
    features: [
      'Unlimited groups created',
      'Unlimited groups joined',
      'Everything in Premium',
      'Custom onboarding',
    ],
    cta: 'Contact us',
    ctaHref: 'mailto:hello@thefriendarchive.com',
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="space-y-10 max-w-4xl">
      <div>
        <h1 className="font-serif text-3xl text-stone-100">Pricing</h1>
        <p className="text-stone-500 text-sm font-mono mt-1">
          Simple plans. No hidden fees.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`border p-6 space-y-6 ${
              plan.highlight
                ? 'border-amber-700/50 bg-amber-950/10'
                : 'border-stone-800/50'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="font-mono uppercase tracking-widest text-sm text-stone-400">
                  {plan.name}
                </h2>
                {plan.highlight && (
                  <Badge variant="default" className="text-[10px]">Popular</Badge>
                )}
              </div>
              <div>
                <span className="font-serif text-4xl text-stone-100">{plan.price}</span>
                <span className="text-stone-600 text-sm font-mono ml-2">/ {plan.period}</span>
              </div>
            </div>

            <ul className="space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="text-stone-400 text-sm font-light flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5 shrink-0">◆</span>
                  {f}
                </li>
              ))}
            </ul>

            <Link href={plan.ctaHref}>
              <Button
                variant={plan.highlight ? 'default' : 'outline'}
                className="w-full"
              >
                {plan.cta}
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
