/**
 * Sidebar — persistent left navigation for the dashboard.
 */
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, BarChart2, Brain, Zap, Activity,
  HeartPulse, ChevronRight, Github
} from 'lucide-react'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/eda', label: 'Exploration', icon: BarChart2 },
  { to: '/training', label: 'Model Training', icon: Brain },
  { to: '/performance', label: 'Performance', icon: Activity },
  { to: '/predict', label: 'Predict Risk', icon: Zap },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col h-screen sticky top-0 border-r"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-1)' }}
    >
      {/* Logo */}
      <div className="px-5 py-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center glow-accent">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight" style={{ fontFamily: 'DM Serif Display, serif' }}>
              MaternaML
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Risk Intelligence
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="label-text px-4 mb-3">Navigation</p>
        {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
          const isActive = exact ? location.pathname === to : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className={clsx('nav-item group', isActive && 'active')}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight className="w-3 h-3 opacity-50" />}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span>Kaggle Dataset • 1014 records</span>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
          Maternal Health Risk v1.0
        </p>
      </div>
    </aside>
  )
}
