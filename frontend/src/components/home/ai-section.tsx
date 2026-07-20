'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, SendHorizontal, BadgeCheck, MapPin, TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EXAMPLE_QUERIES = [
  'Find me a Toyota Camry under ₦12M in Lagos',
  'Show 3-bedroom apartments in Lekki under ₦80M',
  'Best iPhone deals in Abuja right now',
  'Software developer jobs paying above ₦500K/month',
];

const AI_RESULT = {
  query: 'Find me a Toyota Camry under ₦12M in Lagos',
  count: 127,
  items: [
    { title: 'Toyota Camry 2021 XLE', price: '₦9.8M', location: 'Lagos Island', verified: true, score: 98 },
    { title: 'Toyota Camry 2022 SE', price: '₦11.2M', location: 'Lekki', verified: true, score: 95 },
    { title: 'Toyota Camry 2020 LE', price: '₦8.5M', location: 'Ikeja', verified: false, score: 88 },
  ],
};

export function AISection() {
  const router = useRouter();
  const [activeQuery, setActiveQuery] = useState(EXAMPLE_QUERIES[0]);
  const [inputVal, setInputVal] = useState('');
  const [showResult, setShowResult] = useState(true);

  return (
    <section className="py-20 relative overflow-hidden bg-background-subtle">
      {/* Background */}
      <div className="absolute inset-0 bg-grid bg-grid opacity-[0.025]" />
      <div className="absolute top-0 right-0 h-96 w-96 rounded-full blur-3xl bg-primary/8 pointer-events-none" />
      <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full blur-3xl bg-violet-500/8 pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2 items-center">

          {/* Left — copy */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-2 text-sm text-primary font-semibold">
              <Sparkles className="h-4 w-4 text-amber-500" />
              AI-Powered Search
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              Search like you're
              <br />
              <span className="text-gradient-primary">talking to a friend</span>
            </h2>

            <p className="text-muted-foreground leading-relaxed">
              No more keyword games. Just describe what you want — our AI understands
              context, location, budget, and preferences to surface the most relevant listings instantly.
            </p>

            <div className="space-y-3">
              {[
                { icon: Zap, text: 'Natural language understanding' },
                { icon: MapPin, text: 'Location-aware results' },
                { icon: TrendingUp, text: 'Price & trend analysis' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-muted-foreground">{text}</span>
                </div>
              ))}
            </div>

            <Button
              size="lg"
              onClick={() => router.push('/search')}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Try AI Search
            </Button>
          </div>

          {/* Right — AI panel mockup */}
          <div className="relative">
            {/* Glow */}
            <div className="absolute -inset-4 rounded-3xl bg-primary/5 blur-xl" />

            <div className="relative rounded-3xl border border-border/60 bg-card shadow-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4 bg-gradient-to-r from-primary/5 to-violet-500/5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Velontri AI Assistant</p>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </div>
                </div>
              </div>

              {/* Example queries */}
              <div className="px-5 pt-4 pb-2">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Try asking:</p>
                <div className="space-y-1.5">
                  {EXAMPLE_QUERIES.map((q) => (
                    <button
                      key={q}
                      onClick={() => { setActiveQuery(q); setShowResult(true); }}
                      className={`w-full text-left rounded-xl px-3 py-2 text-xs transition-all ${activeQuery === q ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      "{q}"
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat input */}
              <div className="px-5 py-3 border-t border-border/60">
                <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/50 px-3 py-2">
                  <input
                    type="text"
                    placeholder="Ask anything about listings…"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <button
                    className="h-6 w-6 rounded-lg bg-primary flex items-center justify-center flex-shrink-0"
                    onClick={() => { if (inputVal.trim()) { setActiveQuery(inputVal); setShowResult(true); setInputVal(''); } }}
                  >
                    <SendHorizontal className="h-3 w-3 text-white" />
                  </button>
                </div>
              </div>

              {/* Result panel */}
              {showResult && (
                <div className="border-t border-border/60 px-5 py-4 bg-emerald-50/50 dark:bg-emerald-900/10">
                  <div className="flex items-center gap-2 mb-3">
                    <BadgeCheck className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {AI_RESULT.count} matches found
                    </span>
                  </div>
                  <div className="space-y-2">
                    {AI_RESULT.items.map((item, i) => (
                      <div key={item.title} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 bg-card ${i === 0 ? 'border-emerald-300/60 dark:border-emerald-700/40' : 'border-border/60'}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {i === 0 && <span className="text-xs bg-emerald-500 text-white rounded-full px-2 py-0.5 flex-shrink-0">Best</span>}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{item.title}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {item.location}
                              {item.verified && <BadgeCheck className="h-3 w-3 text-emerald-500 ml-1" />}
                            </div>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-primary flex-shrink-0 ml-2">{item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
