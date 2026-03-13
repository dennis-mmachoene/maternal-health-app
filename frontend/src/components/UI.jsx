/**
 * Reusable UI Components — the design system building blocks.
 */
import { AlertCircle, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import clsx from 'clsx'

// ─── Loading ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return (
    <div className={clsx(
      'border-2 rounded-full animate-spin',
      sizes[size],
      'border-rose-900/40 border-t-rose-500',
      className
    )} />
  )
}

export function LoadingState({ message = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Spinner size="lg" />
      <p className="text-muted text-sm">{message}</p>
    </div>
  )
}

// ─── Error ────────────────────────────────────────────────────────────────────
export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-red-950/50 border border-red-900/40 flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-red-400" />
      </div>
      <div className="text-center">
        <p className="font-medium text-sm mb-1">Something went wrong</p>
        <p className="text-muted text-xs max-w-sm">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary text-xs">
          Try again
        </button>
      )}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = '', hover = false }) {
  return (
    <div className={clsx(hover ? 'card-hover' : 'card', className)}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, icon: Icon, trend, color = 'rose', className = '' }) {
  const colorMap = {
    rose: 'bg-rose-950/50 border-rose-900/30 text-rose-400',
    green: 'bg-green-950/50 border-green-900/30 text-green-400',
    amber: 'bg-amber-950/50 border-amber-900/30 text-amber-400',
    blue: 'bg-blue-950/50 border-blue-900/30 text-blue-400',
    purple: 'bg-purple-950/50 border-purple-900/30 text-purple-400',
  }

  return (
    <div className={clsx('stat-card animate-slide-up', className)}>
      <div className="flex items-start justify-between">
        {Icon && (
          <div className={clsx('w-9 h-9 rounded-xl border flex items-center justify-center mb-3', colorMap[color])}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        {trend !== undefined && (
          <span className={clsx('text-xs font-medium flex items-center gap-0.5',
            trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-muted'
          )}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="label-text mt-0.5">{label}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function RiskBadge({ level }) {
  const map = {
    'low risk': 'badge-low',
    'mid risk': 'badge-mid',
    'high risk': 'badge-high',
  }
  const dots = {
    'low risk': 'risk-dot-low',
    'mid risk': 'risk-dot-mid',
    'high risk': 'risk-dot-high',
  }
  return (
    <span className={map[level] || 'badge'}>
      <span className={dots[level] || 'w-2 h-2 rounded-full bg-gray-500'} />
      {level}
    </span>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="text-muted text-sm mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-subtle flex items-center justify-center mb-2">
          <Icon className="w-6 h-6 text-muted" />
        </div>
      )}
      <p className="font-medium">{title}</p>
      {description && <p className="text-muted text-sm max-w-xs">{description}</p>}
      {action}
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = 'rose', showLabel = false, className = '' }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const colors = {
    rose: 'bg-rose-500',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
  }
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-700', colors[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="text-xs text-muted w-10 text-right">{pct}%</span>}
    </div>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────
export function Table({ columns, data, className = '' }) {
  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-subtle">
            {columns.map((col) => (
              <th key={col.key} className="text-left py-3 px-4 label-text font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-subtle/50 hover:bg-surface-2/50 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className="py-3 px-4 text-muted">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-surface-2 border border-subtle w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
            active === tab.key
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-muted hover:text-white hover:bg-surface-3'
          )}
        >
          {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
export function Tooltip({ content, children }) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg text-xs bg-surface-3 border border-subtle text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-3" />
      </div>
    </div>
  )
}
