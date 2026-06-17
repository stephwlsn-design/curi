export function PageShell({ children, className = '', wide = true }) {
  return (
    <div className={`p-6 lg:p-8 w-full ${wide ? 'max-w-[1600px]' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function PageHeader({ title, description, children, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold text-theme-text mb-2">{title}</h1>
        {description && (
          <p className="text-base text-theme-muted/60 leading-relaxed max-w-3xl">{description}</p>
        )}
        {children}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
