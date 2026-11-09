interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  action,
}) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div className="space-y-1.5">
      <div className="flex items-center gap-2.5">
        <span className="h-6 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40" />
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
      </div>
      {description && (
        <p className="pl-3.5 text-sm text-slate-500">{description}</p>
      )}
    </div>
    {action && <div className="flex items-center gap-2">{action}</div>}
  </div>
);
