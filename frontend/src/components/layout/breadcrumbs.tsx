import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && <span className="mx-2">/</span>}
          {item.href ? (
            <Link
              href={item.href}
              className={cn(
                'hover:text-foreground transition-colors',
                index === items.length - 1 && 'text-foreground font-medium',
              )}
            >
              {item.label}
            </Link>
          ) : (
            <span className={cn(index === items.length - 1 && 'text-foreground font-medium')}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}

export function useBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname();
  
  // Generate breadcrumbs from pathname
  const segments = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
  ];

  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;
    items.push({
      label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
      href: isLast ? undefined : currentPath,
    });
  });

  return items;
}
