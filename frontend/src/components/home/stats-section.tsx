'use client';

import { useEffect, useRef, useState } from 'react';
import { Users, Package, Globe, ShieldCheck, Building2 } from 'lucide-react';

const STATS = [
  { value: 15, suffix: 'M+', label: 'Users', icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
  { value: 120, suffix: 'M+', label: 'Listings', icon: Package, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { value: 12, suffix: '', label: 'Countries', icon: Globe, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { value: 99.8, suffix: '%', label: 'Escrow Success', icon: ShieldCheck, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  { value: 500, suffix: 'K+', label: 'Businesses', icon: Building2, color: 'text-sky-500', bg: 'bg-sky-500/10' },
];

function CountUp({ target, suffix, active }: { target: number; suffix: string; active: boolean }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!active) return;
    const isDecimal = target % 1 !== 0;
    const duration = 1800;
    const steps = 60;
    const increment = target / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setCurrent(Math.min(parseFloat((increment * step).toFixed(1)), target));
      if (step >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [active, target]);

  const display = target % 1 !== 0 ? current.toFixed(1) : Math.floor(current).toLocaleString();
  return <>{display}{suffix}</>;
}

export function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setActive(true); obs.disconnect(); } }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="relative py-16 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {STATS.map(({ value, suffix, label, icon: Icon, color, bg }) => (
            <div key={label} className="card-premium p-6 text-center group">
              <div className={`mx-auto mb-3 h-12 w-12 rounded-2xl ${bg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
              <p className={`text-2xl sm:text-3xl font-black ${color}`}>
                <CountUp target={value} suffix={suffix} active={active} />
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 font-medium">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
