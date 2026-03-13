/**
 * EDA Page — Exploratory Data Analysis with distribution charts and correlation heatmap.
 */
import { useState } from 'react'
import {
  BarChart2, GitBranch, RefreshCw, Info
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, ScatterChart, Scatter, ZAxis
} from 'recharts'
import { useApi } from '../hooks/useApi'
import { edaApi } from '../services/api'
import {
  Card, SectionHeader, LoadingState, ErrorState, Tabs
} from '../components/UI'

const RISK_COLORS = {
  'low risk': '#22c55e',
  'mid risk': '#f59e0b',
  'high risk': '#ef4444',
}

const FEATURES = ['Age', 'SystolicBP', 'DiastolicBP', 'BS', 'BodyTemp', 'HeartRate']
const FEATURE_UNITS = {
  Age: 'years', SystolicBP: 'mmHg', DiastolicBP: 'mmHg',
  BS: 'mmol/L', BodyTemp: '°F', HeartRate: 'bpm',
}

// ─── Correlation Heatmap ──────────────────────────────────────────────────────
function CorrelationHeatmap({ data }) {
  if (!data) return null
  const { labels, matrix } = data

  const getColor = (val) => {
    const v = parseFloat(val)
    if (isNaN(v)) return 'rgba(255,255,255,0.05)'
    const abs = Math.abs(v)
    if (v > 0) return `rgba(225, 29, 72, ${0.1 + abs * 0.75})`
    return `rgba(59, 130, 246, ${0.1 + abs * 0.75})`
  }

  const cellSize = 52

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: labels.length * cellSize + 120 }}>
        {/* Column headers */}
        <div className="flex" style={{ paddingLeft: 120 }}>
          {labels.map((label) => (
            <div
              key={label}
              style={{ width: cellSize, minWidth: cellSize }}
              className="text-center text-xs text-muted pb-2 truncate"
              title={label}
            >
              {label.length > 6 ? label.slice(0, 6) + '…' : label}
            </div>
          ))}
        </div>
        {/* Rows */}
        {matrix.map((row, i) => (
          <div key={i} className="flex items-center">
            <div className="text-xs text-muted text-right pr-3 truncate" style={{ width: 120, minWidth: 120 }}>
              {labels[i]}
            </div>
            {row.map((val, j) => (
              <div
                key={j}
                title={`${labels[i]} × ${labels[j]}: ${parseFloat(val).toFixed(3)}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  minWidth: cellSize,
                  background: getColor(val),
                  border: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: Math.abs(parseFloat(val)) > 0.4 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                  cursor: 'default',
                  transition: 'all 0.15s',
                }}
                className="hover:scale-110 hover:z-10 relative"
              >
                {parseFloat(val).toFixed(2)}
              </div>
            ))}
          </div>
        ))}
        {/* Color scale legend */}
        <div className="flex items-center gap-3 mt-5 justify-center">
          <span className="text-xs text-muted">−1.0 Strong Negative</span>
          <div className="flex h-3 rounded overflow-hidden" style={{ width: 160 }}>
            {Array.from({ length: 20 }, (_, i) => {
              const v = -1 + i * 0.1
              return (
                <div key={i} className="flex-1" style={{
                  background: v < 0
                    ? `rgba(59,130,246,${Math.abs(v) * 0.85})`
                    : `rgba(225,29,72,${v * 0.85})`
                }} />
              )
            })}
          </div>
          <span className="text-xs text-muted">+1.0 Strong Positive</span>
        </div>
      </div>
    </div>
  )
}

// ─── Distribution Chart ───────────────────────────────────────────────────────
function DistributionChart({ feature, data }) {
  if (!data) return null
  const { counts, bin_edges, by_risk } = data

  const chartData = counts.map((count, i) => ({
    bin: `${bin_edges[i]?.toFixed(1)}`,
    count,
  }))

  const byRiskData = Object.entries(by_risk).map(([risk, info]) => ({
    risk,
    mean: info.mean,
    color: RISK_COLORS[risk],
  }))

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} barSize={8}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="bin"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 9 }}
            interval="preserveStartEnd"
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--color-text-muted)', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={25}
          />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '10px', fontSize: '11px' }}
            labelFormatter={(l) => `${feature}: ${l} ${FEATURE_UNITS[feature]}`}
          />
          <Bar dataKey="count" fill="#e11d48" opacity={0.75} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Mean by risk level */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        {byRiskData.map(({ risk, mean, color }) => (
          <div key={risk} className="text-center py-2 rounded-lg bg-surface-2">
            <div className="text-sm font-semibold" style={{ color }}>{mean}</div>
            <div className="text-xs text-muted capitalize">{risk.replace(' risk', '')}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main EDA Page ────────────────────────────────────────────────────────────
export default function EDA() {
  const [tab, setTab] = useState('distributions')
  const { data, loading, error, execute: refresh } = useApi(edaApi.getOverview)

  if (loading) return <LoadingState message="Computing EDA statistics…" />
  if (error) return <ErrorState message={error} onRetry={refresh} />

  const d = data?.data
  if (!d) return null

  const tabs = [
    { key: 'distributions', label: 'Distributions', icon: BarChart2 },
    { key: 'correlation', label: 'Correlation', icon: GitBranch },
  ]

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'DM Serif Display, serif' }}>
            Exploratory Analysis
          </h1>
          <p className="text-muted text-sm mt-1">
            Feature distributions, correlations, and risk-level breakdowns
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
          <button onClick={refresh} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {tab === 'distributions' && (
        <>
          {/* Distribution grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {FEATURES.map((feat) => (
              <Card key={feat} className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-sm">{feat}</h3>
                    <p className="text-xs text-muted">{FEATURE_UNITS[feat]}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted">Mean</div>
                    <div className="font-mono text-sm text-rose-400">
                      {d.summary?.statistics?.[feat]?.mean?.toFixed(1)}
                    </div>
                  </div>
                </div>
                <DistributionChart feature={feat} data={d.distributions?.[feat]} />
              </Card>
            ))}
          </div>

          {/* Feature statistics comparison */}
          <Card className="p-6">
            <SectionHeader
              title="Feature Statistics by Risk Level"
              subtitle="Mean value of each feature, segmented by risk category"
            />
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={FEATURES.map((feat) => {
                  const entry = { feature: feat }
                  Object.entries(RISK_COLORS).forEach(([risk, color]) => {
                    entry[risk] = d.distributions?.[feat]?.by_risk?.[risk]?.mean || 0
                  })
                  return entry
                })}
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="feature" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '12px' }}
                />
                <Legend formatter={(val) => <span style={{ color: RISK_COLORS[val], fontSize: 12 }}>{val}</span>} />
                {Object.entries(RISK_COLORS).map(([risk, color]) => (
                  <Bar key={risk} dataKey={risk} fill={color} opacity={0.8} radius={[3, 3, 0, 0]} barSize={20} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      {tab === 'correlation' && (
        <>
          <Card className="p-6">
            <SectionHeader
              title="Pearson Correlation Matrix"
              subtitle="Linear correlations between all numeric features and encoded risk level"
            />
            <div className="flex items-start gap-3 mb-6 p-4 rounded-xl bg-surface-2 border border-subtle">
              <Info className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted leading-relaxed">
                Values close to <span className="text-rose-400 font-medium">+1.0</span> indicate strong positive correlation,
                <span className="text-blue-400 font-medium"> −1.0</span> strong negative.
                RiskEncoded: 0=low, 1=mid, 2=high.
                Blood sugar (BS) and SystolicBP show the strongest correlation with RiskLevel.
              </p>
            </div>
            <CorrelationHeatmap data={d.correlation_matrix} />
          </Card>

          {/* Top correlations with Risk */}
          <Card className="p-6">
            <SectionHeader
              title="Correlation with Risk Level"
              subtitle="Sorted by absolute correlation strength with the target variable"
            />
            {(() => {
              const corrs = d.correlation_matrix?.dataframe?.RiskEncoded || {}
              const sorted = Object.entries(corrs)
                .filter(([k]) => k !== 'RiskEncoded')
                .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))

              return (
                <div className="space-y-3">
                  {sorted.map(([feat, val]) => {
                    const v = parseFloat(val)
                    const pct = Math.abs(v) * 100
                    const color = v > 0 ? '#e11d48' : '#3b82f6'
                    return (
                      <div key={feat} className="flex items-center gap-4">
                        <div className="w-28 text-sm font-mono text-rose-300 text-right">{feat}</div>
                        <div className="flex-1 flex items-center gap-3">
                          <div className="flex-1 h-2 rounded-full bg-surface-3 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: color }}
                            />
                          </div>
                          <span
                            className="w-14 text-right text-sm font-mono font-medium"
                            style={{ color }}
                          >
                            {v > 0 ? '+' : ''}{v.toFixed(3)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </Card>
        </>
      )}
    </div>
  )
}
