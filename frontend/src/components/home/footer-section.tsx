import Link from 'next/link';
import { Sparkles, Twitter, Instagram, Linkedin, Youtube } from 'lucide-react';
import { siteConfig } from '@/config/site';

const FOOTER_LINKS = {
  Product: [
    { label: 'Browse listings', href: '/listings' },
    { label: 'AI Search', href: '/search' },
    { label: 'Pricing', href: '/subscriptions/tiers' },
    { label: 'Mobile app', href: '#download' },
    { label: 'Business solutions', href: '/business' },
  ],
  Company: [
    { label: 'About us', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Careers', href: '/careers' },
    { label: 'Press', href: '/press' },
    { label: 'Partners', href: '/partners' },
  ],
  Support: [
    { label: 'Help center', href: '/help' },
    { label: 'Contact us', href: '/contact' },
    { label: 'Seller guide', href: '/seller-guide' },
    { label: 'Buyer protection', href: '/buyer-protection' },
    { label: 'Trust & safety', href: '/safety' },
  ],
  Legal: [
    { label: 'Privacy policy', href: '/privacy' },
    { label: 'Terms of service', href: '/terms' },
    { label: 'Cookie policy', href: '/cookies' },
    { label: 'Accessibility', href: '/accessibility' },
  ],
};

const COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Cameroon', 'Senegal', 'Côte d\'Ivoire', 'Tanzania', 'Uganda', 'Rwanda', 'Ethiopia', 'Egypt'];

const SOCIALS = [
  { icon: Twitter, href: 'https://twitter.com/velontri', label: 'Twitter' },
  { icon: Instagram, href: 'https://instagram.com/velontri', label: 'Instagram' },
  { icon: Linkedin, href: 'https://linkedin.com/company/velontri', label: 'LinkedIn' },
  { icon: Youtube, href: 'https://youtube.com/@velontri', label: 'YouTube' },
];

export function FooterSection() {
  return (
    <footer className="border-t border-border/60 bg-background">
      {/* Markets strip */}
      <div className="border-b border-border/60 bg-background-subtle">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-2">Available in:</span>
            {COUNTRIES.map((c) => (
              <span key={c} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div className="space-y-5">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-glow-sm">
                <Sparkles className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-xl font-black text-gradient-primary">{siteConfig.name}</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Africa's most beautiful commerce platform. Built for the next generation of African entrepreneurs.
            </p>
            {/* Socials */}
            <div className="flex gap-2">
              {SOCIALS.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 w-9 rounded-xl border border-border bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all"
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
            {/* Trust badges */}
            <div className="flex flex-wrap gap-2 pt-1">
              {['SSL Secured', 'NDPR Compliant', 'Escrow Licensed'].map((badge) => (
                <span key={badge} className="text-xs border border-emerald-500/30 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400 rounded-full px-3 py-1 font-medium">
                  ✓ {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-bold mb-4 text-foreground">{title}</h4>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-border/60">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Velontri Technologies Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            Made with <span className="text-red-400 mx-1">♥</span> for Africa
          </div>
        </div>
      </div>
    </footer>
  );
}
