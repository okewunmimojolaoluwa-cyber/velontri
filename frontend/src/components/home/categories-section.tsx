import Link from 'next/link';

const CATEGORIES = [
  {
    name: 'Smartphones',
    count: '12K+ listings',
    href: '/listings?category=Electronics',
    img: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80&fit=crop',
    gradient: 'from-blue-600/80 to-indigo-900/90',
  },
  {
    name: 'Vehicles',
    count: '3K+ listings',
    href: '/listings?category=Vehicles',
    img: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=600&q=80&fit=crop',
    gradient: 'from-amber-600/80 to-orange-900/90',
  },
  {
    name: 'Real Estate',
    count: '5K+ listings',
    href: '/listings?category=Property',
    img: 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=600&q=80&fit=crop',
    gradient: 'from-emerald-600/80 to-teal-900/90',
  },
  {
    name: 'Fashion',
    count: '8K+ listings',
    href: '/listings?category=Fashion',
    img: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80&fit=crop',
    gradient: 'from-pink-600/80 to-rose-900/90',
  },
  {
    name: 'Jobs',
    count: '4K+ listings',
    href: '/listings?category=Jobs',
    img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80&fit=crop',
    gradient: 'from-violet-600/80 to-purple-900/90',
  },
  {
    name: 'Electronics',
    count: '7K+ listings',
    href: '/listings?category=Electronics',
    img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80&fit=crop',
    gradient: 'from-sky-600/80 to-cyan-900/90',
  },
];

export function CategoriesSection() {
  return (
    <section className="py-20 bg-background-subtle">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Explore</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Browse by category
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto text-sm">
            From smartphones to skyscrapers — everything you need, right here.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {CATEGORIES.map(({ name, count, href, img, gradient }) => (
            <Link
              key={name}
              href={href}
              className="group relative overflow-hidden rounded-2xl aspect-[4/3] shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              {/* Photo */}
              <img
                src={img}
                alt={name}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-108"
                loading="lazy"
              />

              {/* Gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-t ${gradient} opacity-70 group-hover:opacity-80 transition-opacity duration-300`} />

              {/* Glass panel at bottom */}
              <div className="absolute bottom-0 inset-x-0 p-4 backdrop-blur-sm bg-black/10">
                <h3 className="text-white font-bold text-lg leading-tight">{name}</h3>
                <p className="text-white/60 text-xs mt-0.5">{count}</p>
              </div>

              {/* Hover arrow */}
              <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:bg-white/20">
                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
