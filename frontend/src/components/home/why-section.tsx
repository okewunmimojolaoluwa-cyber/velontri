import { Shield, Zap, Globe, Sparkles, TrendingUp, Headphones } from 'lucide-react';

const FEATURES = [
  {
    icon: Shield,
    title: 'Escrow on every deal',
    desc: 'Your money is held securely until you confirm receipt. Dispute resolution in under 24 hours.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    icon: Sparkles,
    title: 'AI-powered matching',
    desc: "Describe what you want in plain English. Our AI finds the best matches across millions of listings.",
    color: 'text-primary',
    bg: 'bg-primary/8',
    border: 'border-primary/20',
  },
  {
    icon: Globe,
    title: 'Pan-African reach',
    desc: 'Sell once, reach buyers across Nigeria, Ghana, Kenya, South Africa, and 8 more markets.',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  {
    icon: Zap,
    title: 'Instant multi-currency',
    desc: 'NGN, GHS, KES, ZAR and more. Accept any African currency with zero conversion friction.',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    icon: TrendingUp,
    title: 'Business analytics',
    desc: 'Real-time dashboards, revenue charts, buyer insights, and AI recommendations for your store.',
    color: 'text-sky-500',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
  },
  {
    icon: Headphones,
    title: '24/7 live support',
    desc: 'Dedicated human support team available around the clock via chat, call, or WhatsApp.',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
];

export function WhySection() {
  return (
    <section className="py-20 bg-background">
      {/* Section background pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-0 h-96 w-96 -translate-y-1/2 rounded-full blur-3xl bg-primary/4" />
        <div className="absolute top-1/2 right-0 h-72 w-72 -translate-y-1/2 rounded-full blur-3xl bg-violet-500/4" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Why Velontri</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Built for African commerce
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
            Every feature was designed for the realities of doing business across Africa —
            from Lagos to Nairobi to Cape Town.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc, color, bg, border }) => (
            <div
              key={title}
              className={`group card-premium p-6 border ${border} hover:shadow-lg hover:-translate-y-1`}
            >
              <div className={`mb-4 h-12 w-12 rounded-2xl ${bg} border ${border} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
              <h3 className="font-semibold mb-2 text-[15px]">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
