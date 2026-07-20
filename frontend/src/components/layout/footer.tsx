import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { ROUTES } from '@/config/routes';

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-primary">{siteConfig.name}</h3>
            <p className="text-sm text-muted-foreground">
              Pan-African commerce, powered by AI. Buy, sell, and grow across Nigeria, Ghana, Kenya, South Africa, and beyond.
            </p>
          </div>

          {/* Marketplace */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Marketplace</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href={ROUTES.listings} className="hover:text-foreground transition-colors">
                  Browse Listings
                </Link>
              </li>
              <li>
                <Link href={ROUTES.search} className="hover:text-foreground transition-colors">
                  Search
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/about" className="hover:text-foreground transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/careers" className="hover:text-foreground transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/security" className="hover:text-foreground transition-colors">
                  Security
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
