/**
 * Overview Page — Dataset dashboard with summary stats and ingestion controls.
 */
import { useState } from 'react'
import {
  Database, Table2, Tag, AlertTriangle, Copy, RefreshCw,
  CheckCircle2, Upload, BarChart3, Users, Layers
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'
import { useApi, useMutation } from '../hooks/useApi'
import { datasetApi } from '../services/api'
import {
  StatCard, Card, SectionHeader, LoadingState, ErrorState,
  Table, RiskBadge
} from '../components/UI'

const RISK_COLORS = {
  'low risk': '#22c55e',
  'mid risk': '#f59e0b',
  'high risk': '#ef4444',
}

const FEATURE_DESCRIPTIONS = {
  Age: 'Patient age in years',
  SystolicBP: 'Systolic blood pressure (mmHg)',
  DiastolicBP: 'Diastolic blood pressure (mmHg)',
  BS: 'Blood sugar level (mmol/L)',
  BodyTemp: 'Body temperature (°F)',
  HeartRate: 'Resting heart rate (bpm)',
  RiskLevel: 'Target: low / mid / high risk',
}

export default function Overview() {
  const { data, loading, error, execute: refresh } = useApi(datasetApi.getSummary)
  const { mutate: ingest, loading: ingesting } = useMutation(datasetApi.ingest)
  const [ingestMsg, setIngestMsg] = useState(null)

  const handleIngest = async () => {
    try {
      const res = await ingest()
      setIngestMsg({ type: 'success', text: res.message || 'Dataset ingested successfully' })
      setTimeout(() => setIngestMsg(null), 4000)
    } catch (e) {
      setIngestMsg({ type: 'error', text: e.message })
    }
  }

  if (loading) return <LoadingState message="Loading dataset summary…" />
  if (error) return <ErrorState message={error} onRetry={refresh} />

  const d = data?.data
  if (!d) return null

  // Prepare chart data
  const classData = Object.entries(d.class_distribution || {}).map(([name, count]) => ({
    name, count,
    pct: d.class_percentages?.[name] || 0,
    fill: RISK_COLORS[name] || '#8b8b9a',
  }))

  const statsRows = Object.entries(d.statistics || {}).map(([feat, stats]) => ({
    feature: feat,
    mean: stats.mean?.toFixed(2),
    median: stats.median?.toFixed(2),
    std: stats.std?.toFixed(2),
    min: stats.min?.toFixed(2),
    max: stats.max?.toFixed(2),
    skew: stats.skewness?.toFixed(3),
  }))

  const featureRows = (d.columns || []).map((col) => ({
    name: col,
    type: col === 'RiskLevel' ? 'categorical' : 'numeric',
    description: FEATURE_DESCRIPTIONS[col] || '—',
    missing: d.missing_values?.[col] ?? 0,
  }))

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'DM Serif Display, serif' }}>
            Dataset Overview
          </h1>
          <p className="text-muted text-sm mt-1">
            Maternal Health Risk Dataset — sourced from Kaggle
          </p>
        </div>
        <div className="flex items-center gap-3">
          {ingestMsg && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border ${
              ingestMsg.type === 'success'
                ? 'bg-green-950/50 border-green-900/40 text-green-400'
                : 'bg-red-950/50 border-red-900/40 text-red-400'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              {ingestMsg.text}
            </div>
          )}
          <button onClick={() => refresh()} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button onClick={handleIngest} disabled={ingesting} className="btn-primary">
            {ingesting ? <span className="spinner" /> : <Upload className="w-4 h-4" />}
            {ingesting ? 'Ingesting…' : 'Ingest to DB'}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Records"
          value={d.total_rows?.toLocaleString()}
          icon={Database}
          color="rose"
          sub="Patient observations"
        />
        <StatCard
          label="Features"
          value={d.total_columns}
          icon={Table2}
          color="blue"
          sub={`${d.total_columns - 1} predictors + 1 target`}
        />
        <StatCard
          label="Risk Classes"
          value="3"
          icon={Layers}
          color="amber"
          sub="low / mid / high"
        />
        <StatCard
          label="Duplicates"
          value={d.duplicates ?? 0}
          icon={Copy}
          color={d.duplicates > 0 ? 'amber' : 'green'}
          sub={d.duplicates > 0 ? 'Will be removed' : 'Dataset is clean'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Distribution Pie */}
        <Card className="p-6">
          <SectionHeader
            title="Risk Level Distribution"
            subtitle="Class balance across all patient records"
          />
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={classData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={3}
                dataKey="count"
              >
                {classData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                formatter={(val, name, props) => [`${val} (${props.payload.pct}%)`, props.payload.name]}
                contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '12px' }}
              />
              <Legend
                formatter={(val) => <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{val}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {classData.map((c) => (
              <div key={c.name} className="text-center p-3 rounded-xl bg-surface-2">
                <div className="text-lg font-bold" style={{ color: c.fill }}>{c.count}</div>
                <div className="text-xs text-muted capitalize">{c.name}</div>
                <div className="text-xs font-medium" style={{ color: c.fill }}>{c.pct}%</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Class Bar Chart */}
        <Card className="p-6">
          <SectionHeader
            title="Records per Class"
            subtitle="Absolute count per risk level"
          />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={classData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '12px' }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {classData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Feature Overview Table */}
      <Card className="p-6">
        <SectionHeader
          title="Feature Inventory"
          subtitle="All columns, types, and missing value counts"
        />
        <Table
          columns={[
            { key: 'name', label: 'Feature', render: (v) => <span className="font-mono text-rose-300 text-xs">{v}</span> },
            { key: 'type', label: 'Type', render: (v) => (
              <span className={`badge text-xs ${v === 'categorical' ? 'badge-mid' : 'badge-low'}`}>{v}</span>
            )},
            { key: 'description', label: 'Description', render: (v) => <span className="text-white text-xs">{v}</span> },
            { key: 'missing', label: 'Missing', render: (v) => (
              <span className={v > 0 ? 'text-amber-400' : 'text-green-400'}>{v}</span>
            )},
          ]}
          data={featureRows}
        />
      </Card>

      {/* Statistical Summary Table */}
      <Card className="p-6">
        <SectionHeader
          title="Statistical Summary"
          subtitle="Descriptive statistics for all numeric features"
        />
        <Table
          columns={[
            { key: 'feature', label: 'Feature', render: (v) => <span className="font-mono text-rose-300 text-xs">{v}</span> },
            { key: 'mean', label: 'Mean', render: (v) => <span className="text-white">{v}</span> },
            { key: 'median', label: 'Median', render: (v) => <span className="text-white">{v}</span> },
            { key: 'std', label: 'Std Dev', render: (v) => <span className="text-white">{v}</span> },
            { key: 'min', label: 'Min', render: (v) => <span className="text-muted">{v}</span> },
            { key: 'max', label: 'Max', render: (v) => <span className="text-muted">{v}</span> },
            { key: 'skew', label: 'Skewness', render: (v) => (
              <span className={Math.abs(parseFloat(v)) > 1 ? 'text-amber-400' : 'text-green-400'}>{v}</span>
            )},
          ]}
          data={statsRows}
        />
      </Card>
    </div>
  )
}
