import { Star, Quote } from 'lucide-react';

const TESTIMONIALS = [
  {
    name: 'Amara Okonkwo',
    role: 'Fashion Designer',
    location: 'Lagos, Nigeria',
    text: 'Velontri transformed my business completely. I now ship orders to buyers across six African countries every week. The escrow feature gives my customers confidence to buy expensive items.',
    avatar: 'AO',
    gradient: 'from-pink-500 to-rose-500',
    stars: 5,
    metric: '3× revenue growth',
  },
  {
    name: 'Kofi Mensah',
    role: 'Electronics Retailer',
    location: 'Accra, Ghana',
    text: 'Sales tripled in three months. The AI search brings buyers who are actually ready to purchase, not just browsing. Best marketplace I have ever used on the continent.',
    avatar: 'KM',
    gradient: 'from-blue-500 to-indigo-500',
    stars: 5,
    metric: '300% more sales',
  },
  {
    name: 'Wanjiru Kamau',
    role: 'Property Agent',
    location: 'Nairobi, Kenya',
    text: 'I closed seven property deals last quarter through Velontri. The verification system makes buyers trust sellers, and the escrow removes all the risk from large transactions.',
    avatar: 'WK',
    gradient: 'from-emerald-500 to-teal-500',
    stars: 5,
    metric: '7 deals closed',
  },
  {
    name: 'Chidi Eze',
    role: 'Auto Dealer',
    location: 'Port Harcourt, Nigeria',
    text: 'I moved my entire car dealership online through Velontri. The analytics dashboard shows me exactly what buyers are searching for so I can stock the right vehicles.',
    avatar: 'CE',
    gradient: 'from-amber-500 to-orange-500',
    stars: 5,
    metric: '₦45M sold monthly',
  },
  {
    name: 'Yemi Adebayo',
    role: 'Software Developer',
    location: 'Ibadan, Nigeria',
    text: 'As a freelancer, Velontri gave me access to clients I could never reach before. The AI matches my profile to the right job listings. My income doubled in 6 months.',
    avatar: 'YA',
    gradient: 'from-violet-500 to-purple-500',
    stars: 5,
    metric: '2× income in 6mo',
  },
  {
    name: 'Fatima Al-Hassan',
    role: 'Fashion Store Owner',
    location: 'Kano, Nigeria',
    text: "Running a fashion business in Kano while reaching customers in Lagos and Accra felt impossible before. Velontri made it simple. The platform handles everything beautifully.",
    avatar: 'FA',
    gradient: 'from-sky-500 to-cyan-500',
    stars: 5,
    metric: '12 cities reached',
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-20 bg-background-subtle">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Testimonials</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Loved by African entrepreneurs
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">
            Join thousands of sellers, buyers, and businesses who trust Velontri every day.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map(({ name, role, location, text, avatar, gradient, stars, metric }) => (
            <div key={name} className="card-premium p-6 space-y-4 flex flex-col">
              {/* Quote icon */}
              <Quote className="h-6 w-6 text-primary/30" />

              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>

              {/* Text */}
              <p className="text-sm leading-relaxed text-muted-foreground flex-1">"{text}"</p>

              {/* Metric badge */}
              <div className="inline-flex w-fit items-center rounded-full bg-primary/8 border border-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                {metric}
              </div>

              {/* Author */}
              <div className="flex items-center gap-3 pt-1 border-t border-border/60">
                <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-sm font-bold text-white flex-shrink-0`}>
                  {avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="text-xs text-muted-foreground">{role} · {location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
