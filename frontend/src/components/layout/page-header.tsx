import { ReactNode } from 'react';
import { Breadcrumbs, useBreadcrumbs } from './breadcrumbs';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  showBreadcrumbs?: boolean;
}

export function PageHeader({ title, description, actions, showBreadcrumbs = true }: PageHeaderProps) {
  const breadcrumbs = useBreadcrumbs();

  return (
    <div className="mb-6 space-y-4">
      {showBreadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
