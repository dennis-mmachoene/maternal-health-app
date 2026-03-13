/**
 * Training Page — trigger model training, view progress, and compare models.
 */
import { useState, useEffect } from 'react'
import {
  Brain, Play, CheckCircle2, Clock, AlertCircle,
  Trophy, Cpu, RefreshCw, ChevronRight, Sparkles
} from 'lucide-react'
import { useApi, useMutation } from '../hooks/useApi'
import { trainingApi, modelsApi } from '../services/api'
import {
  Card, SectionHeader, LoadingState, ErrorState,
  StatCard, RiskBadge, ProgressBar
} from '../components/UI'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell
} from 'recharts'

const MODEL_META = {
  random_forest: {
    color: '#22c55e',
    tagline: 'Ensemble of 200 decision trees with bagging',
    pros: ['Handles imbalance', 'Feature importance', 'Robust to outliers'],
  },
  gradient_boosting: {
    color: '#f59e0b',
    tagline: 'Sequential boosting with shrinkage',
    pros: ['High accuracy', 'Flexible', 'Good on tabular data'],
  },
  logistic_regression: {
    color: '#3b82f6',
    tagline: 'Multinomial logistic with L2 regularization',
    pros: ['Interpretable', 'Fast inference', 'Probabilistic output'],
  },
  xgboost: {
    color: '#a855f7',
    tagline: 'XGBoost with column subsampling',
    pros: ['State-of-the-art', 'Regularization', 'GPU-ready'],
  },
}

function StatusBadge({ status }) {
  const map = {
    completed: { cls: 'bg-green-950/50 border-green-900/40 text-green-400', icon: CheckCircle2 },
    running: { cls: 'bg-rose-950/50 border-rose-900/40 text-rose-400', icon: Cpu },
    failed: { cls: 'bg-red-950/50 border-red-900/40 text-red-400', icon: AlertCircle },
    pending: { cls: 'bg-amber-950/50 border-amber-900/40 text-amber-400', icon: Clock },
  }
  const { cls, icon: Icon } = map[status] || map.pending
  return (
    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${cls}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  )
}

export default function Training() {
  const { data: statusData, execute: refreshStatus } = useApi(trainingApi.getStatus)
  const { data: histData, execute: refreshHistory } = useApi(trainingApi.getHistory)
  const { data: modelsData, execute: refreshModels } = useApi(modelsApi.list)
  const { mutate: startTrain, loading: training } = useMutation(trainingApi.start)
  const [trainMsg, setTrainMsg] = useState(null)
  const [trainResult, setTrainResult] = useState(null)

  const handleTrain = async () => {
    setTrainMsg({ type: 'info', text: 'Training in progress — this may take 30–60 seconds…' })
    setTrainResult(null)
    try {
      const res = await startTrain()
      setTrainMsg({ type: 'success', text: `Training complete! Best model: ${res.best_model?.replace('_', ' ')}` })
      setTrainResult(res)
      refreshStatus()
      refreshHistory()
      refreshModels()
    } catch (e) {
      setTrainMsg({ type: 'error', text: e.message })
    }
  }

  const run = statusData?.data
  const models = modelsData?.data || []
  const history = histData?.data || []

  // Radar chart data for model comparison
  const radarData = models.length > 0 ? [
    { metric: 'Accuracy', ...Object.fromEntries(models.map(m => [m.display_name, (m.accuracy || 0) * 100])) },
    { metric: 'F1 Score', ...Object.fromEntries(models.map(m => [m.display_name, (m.f1_macro || 0) * 100])) },
  ] : []

  // Bar comparison
  const barData = models.map(m => ({
    name: m.display_name,
    accuracy: parseFloat(((m.accuracy || 0) * 100).toFixed(1)),
    f1: parseFloat(((m.f1_macro || 0) * 100).toFixed(1)),
    color: MODEL_META[m.key]?.color || '#8b8b9a',
    isBest: m.is_best,
  }))

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'DM Serif Display, serif' }}>
            Model Training
          </h1>
          <p className="text-muted text-sm mt-1">
            Train Random Forest, Gradient Boosting, Logistic Regression & XGBoost
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { refreshStatus(); refreshModels(); refreshHistory() }} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleTrain}
            disabled={training}
            className="btn-primary"
            style={{ minWidth: 160 }}
          >
            {training ? (
              <>
                <span className="spinner" />
                Training…
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Training
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status message */}
      {trainMsg && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${
          trainMsg.type === 'success' ? 'bg-green-950/40 border-green-900/40 text-green-300' :
          trainMsg.type === 'error' ? 'bg-red-950/40 border-red-900/40 text-red-300' :
          'bg-rose-950/40 border-rose-900/40 text-rose-300'
        }`}>
          {trainMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> :
           trainMsg.type === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> :
           <span className="spinner flex-shrink-0" />}
          <p className="text-sm">{trainMsg.text}</p>
        </div>
      )}

      {/* Current run status */}
      {run && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <SectionHeader title="Latest Training Run" subtitle={`Run #${run.id}`} />
            <StatusBadge status={run.status} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
            <div className="p-3 rounded-xl bg-surface-2">
              <div className="label-text mb-1">Best Model</div>
              <div className="font-semibold text-sm capitalize">{run.best_model?.replace(/_/g, ' ') || '—'}</div>
            </div>
            <div className="p-3 rounded-xl bg-surface-2">
              <div className="label-text mb-1">Best Accuracy</div>
              <div className="font-semibold text-sm text-rose-400">
                {run.best_accuracy ? `${(run.best_accuracy * 100).toFixed(1)}%` : '—'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-surface-2">
              <div className="label-text mb-1">Best F1 (Macro)</div>
              <div className="font-semibold text-sm text-rose-400">
                {run.best_f1_score ? `${(run.best_f1_score * 100).toFixed(1)}%` : '—'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-surface-2">
              <div className="label-text mb-1">Duration</div>
              <div className="font-semibold text-sm">{run.duration_seconds ? `${run.duration_seconds.toFixed(1)}s` : '—'}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Model cards */}
      <div>
        <SectionHeader
          title="Trained Models"
          subtitle="All models trained on the preprocessed dataset with 80/20 split"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(MODEL_META).map(([key, meta]) => {
            const model = models.find(m => m.key === key)
            return (
              <Card key={key} className="p-5" style={{ borderColor: model?.is_best ? 'rgba(225,29,72,0.3)' : undefined }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
                    />
                    <div>
                      <h3 className="font-semibold text-sm capitalize">{key.replace(/_/g, ' ')}</h3>
                      <p className="text-xs text-muted">{meta.tagline}</p>
                    </div>
                  </div>
                  {model?.is_best && (
                    <span className="badge-best flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      Best
                    </span>
                  )}
                </div>

                {model ? (
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="p-3 rounded-lg bg-surface-2">
                      <div className="label-text text-xs mb-1">Accuracy</div>
                      <div className="font-bold text-lg" style={{ color: meta.color }}>
                        {(model.accuracy * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-2">
                      <div className="label-text text-xs mb-1">F1 Macro</div>
                      <div className="font-bold text-lg" style={{ color: meta.color }}>
                        {(model.f1_macro * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-muted">
                    Not yet trained
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {meta.pros.map(p => (
                    <span key={p} className="badge bg-surface-2 text-muted border border-subtle">
                      {p}
                    </span>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Comparison charts */}
      {barData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <SectionHeader title="Accuracy Comparison" subtitle="Accuracy vs F1 Macro per model" />
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => `${v}%`}
                  contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '12px' }}
                />
                <Legend />
                <Bar dataKey="accuracy" name="Accuracy %" fill="#e11d48" opacity={0.8} radius={[4, 4, 0, 0]} barSize={22} />
                <Bar dataKey="f1" name="F1 Macro %" fill="#fb7185" opacity={0.5} radius={[4, 4, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* History */}
          <Card className="p-6">
            <SectionHeader title="Training History" subtitle="All previous training runs" />
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {history.length === 0 ? (
                <p className="text-xs text-muted text-center py-8">No training history yet</p>
              ) : history.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-surface-2">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={r.status} />
                    <span className="text-xs text-muted">
                      {new Date(r.started_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs">
                    {r.best_model && (
                      <span className="text-rose-300 capitalize">{r.best_model.replace(/_/g, ' ')}</span>
                    )}
                    {r.best_accuracy && (
                      <span className="text-muted ml-2">{(r.best_accuracy * 100).toFixed(1)}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
