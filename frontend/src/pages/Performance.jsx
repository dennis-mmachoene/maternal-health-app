/**
 * Performance Page — model evaluation metrics, confusion matrices, feature importance.
 */
import { useState } from 'react'
import { Activity, Target, RefreshCw, Info, Award } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend, Cell
} from 'recharts'
import { useApi } from '../hooks/useApi'
import { modelsApi } from '../services/api'
import { Card, SectionHeader, LoadingState, ErrorState, EmptyState, Tabs, ProgressBar } from '../components/UI'

const MODEL_COLORS = {
  random_forest: '#22c55e',
  gradient_boosting: '#f59e0b',
  logistic_regression: '#3b82f6',
  xgboost: '#a855f7',
}

const METRIC_INFO = {
  accuracy: 'Fraction of correct predictions out of all predictions',
  precision_macro: 'Average precision across all classes (unweighted)',
  recall_macro: 'Average recall (sensitivity) across all classes',
  f1_macro: 'Harmonic mean of precision and recall — balanced metric',
  roc_auc: 'Area under ROC curve — measures discriminative ability',
}

// ─── Confusion Matrix Visualizer ─────────────────────────────────────────────
function ConfusionMatrix({ matrix, classNames }) {
  if (!matrix || !classNames) return null

  const maxVal = Math.max(...matrix.flat())

  return (
    <div>
      <div className="flex items-center justify-center mb-3">
        <div>
          {/* Column labels */}
          <div className="flex mb-1 ml-20">
            {classNames.map((name) => (
              <div key={name} className="w-20 text-center text-xs text-muted capitalize">
                {name.replace(' risk', '')}
              </div>
            ))}
          </div>
          {/* Rows */}
          {matrix.map((row, i) => (
            <div key={i} className="flex items-center mb-1">
              <div className="w-20 text-right text-xs text-muted pr-3 capitalize">
                {classNames[i]?.replace(' risk', '')}
              </div>
              {row.map((val, j) => {
                const isDiag = i === j
                const intensity = maxVal > 0 ? val / maxVal : 0
                return (
                  <div
                    key={j}
                    className="w-20 h-14 flex flex-col items-center justify-center rounded-lg mx-0.5 transition-all"
                    style={{
                      background: isDiag
                        ? `rgba(225, 29, 72, ${0.15 + intensity * 0.7})`
                        : `rgba(239, 68, 68, ${intensity * 0.4})`,
                      border: isDiag
                        ? '1px solid rgba(225, 29, 72, 0.4)'
                        : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <span className={`text-lg font-bold ${isDiag ? 'text-rose-300' : 'text-red-400/70'}`}>
                      {val}
                    </span>
                    <span className="text-xs text-muted">
                      {maxVal > 0 ? Math.round((val / matrix[i].reduce((a, b) => a + b, 0)) * 100) : 0}%
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <div className="w-3 h-3 rounded bg-rose-500/70" />
          Correct predictions (diagonal)
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <div className="w-3 h-3 rounded bg-red-500/30" />
          Misclassifications
        </div>
      </div>
    </div>
  )
}

// ─── Feature Importance Chart ─────────────────────────────────────────────────
function FeatureImportanceChart({ importance }) {
  if (!importance || importance.length === 0) return (
    <p className="text-xs text-muted text-center py-8">Feature importance not available for this model</p>
  )

  const top12 = importance.slice(0, 12)
  const maxImp = top12[0]?.importance || 1

  return (
    <div className="space-y-2.5">
      {top12.map((f) => (
        <div key={f.feature} className="flex items-center gap-3">
          <div className="flex items-center gap-2 w-44 flex-shrink-0">
            <span className="text-xs font-mono text-rose-300 truncate">{f.feature}</span>
          </div>
          <div className="flex-1 h-2 rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-rose-500 transition-all duration-700"
              style={{ width: `${(f.importance / maxImp) * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono text-muted w-14 text-right">
            {(f.importance * 100).toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Performance Page ────────────────────────────────────────────────────
export default function Performance() {
  const { data, loading, error, execute: refresh } = useApi(modelsApi.getPerformance)
  const [selectedModel, setSelectedModel] = useState(null)

  if (loading) return <LoadingState message="Loading model performance data…" />
  if (error) return <ErrorState message={error} onRetry={refresh} />

  const d = data?.data
  if (!d || d.error) return (
    <div className="p-8">
      <EmptyState
        icon={Activity}
        title="No models trained yet"
        description="Go to the Model Training page to train your first models."
      />
    </div>
  )

  const models = Object.entries(d.models || {})
  const classNames = d.class_names || ['low risk', 'mid risk', 'high risk']
  const bestKey = d.best_model

  // Default to best model
  const activeKey = selectedModel || bestKey
  const activeModel = d.models?.[activeKey]

  // Comparison bar data
  const comparisonData = models.map(([key, m]) => ({
    name: m.display_name,
    Accuracy: parseFloat(((m.accuracy || 0) * 100).toFixed(1)),
    'F1 Macro': parseFloat(((m.f1_macro || 0) * 100).toFixed(1)),
    Precision: parseFloat(((m.precision_macro || 0) * 100).toFixed(1)),
    Recall: parseFloat(((m.recall_macro || 0) * 100).toFixed(1)),
    key,
  }))

  const modelTabs = models.map(([key, m]) => ({
    key,
    label: m.display_name + (key === bestKey ? ' ★' : ''),
  }))

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'DM Serif Display, serif' }}>
            Model Performance
          </h1>
          <p className="text-muted text-sm mt-1">
            Detailed evaluation metrics, confusion matrices, and feature importance
          </p>
        </div>
        <button onClick={refresh} className="btn-secondary">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Metric comparison overview */}
      <Card className="p-6">
        <SectionHeader
          title="Model Comparison"
          subtitle="Accuracy, F1 Macro, Precision, Recall across all models"
        />
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={comparisonData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="name" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v) => `${v}%`}
              contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '12px' }}
            />
            <Legend formatter={(v) => <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{v}</span>} />
            <Bar dataKey="Accuracy" fill="#e11d48" opacity={0.9} radius={[3, 3, 0, 0]} barSize={16} />
            <Bar dataKey="F1 Macro" fill="#fb7185" opacity={0.7} radius={[3, 3, 0, 0]} barSize={16} />
            <Bar dataKey="Precision" fill="#fda4af" opacity={0.6} radius={[3, 3, 0, 0]} barSize={16} />
            <Bar dataKey="Recall" fill="#9f1239" opacity={0.6} radius={[3, 3, 0, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Best model highlight */}
      {bestKey && d.models[bestKey] && (
        <div
          className="p-5 rounded-2xl border flex items-center gap-4"
          style={{ background: 'rgba(225,29,72,0.06)', borderColor: 'rgba(225,29,72,0.2)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center flex-shrink-0">
            <Award className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-sm">
              Best Model: <span className="text-rose-400 capitalize">{d.models[bestKey].display_name}</span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Selected by highest F1 Macro score —
              Accuracy: <span className="text-white">{(d.models[bestKey].accuracy * 100).toFixed(1)}%</span> |
              F1: <span className="text-white">{(d.models[bestKey].f1_macro * 100).toFixed(1)}%</span> |
              AUC: <span className="text-white">{d.models[bestKey].roc_auc ? (d.models[bestKey].roc_auc * 100).toFixed(1) + '%' : 'N/A'}</span>
            </p>
          </div>
        </div>
      )}

      {/* Per-model detail */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Model Detail</h2>
          <div className="flex gap-1 p-1 rounded-xl bg-surface-2 border border-subtle">
            {modelTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setSelectedModel(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeKey === tab.key
                    ? 'text-white'
                    : 'text-muted hover:text-white'
                }`}
                style={activeKey === tab.key ? { background: MODEL_COLORS[tab.key] || '#e11d48' } : {}}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeModel && (
          <div className="space-y-6 animate-slide-up">
            {/* Metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {['accuracy', 'precision_macro', 'recall_macro', 'f1_macro', 'roc_auc'].map((metric) => {
                const val = activeModel[metric]
                return (
                  <Card key={metric} className="p-4 text-center">
                    <div className="text-2xl font-bold text-rose-400">
                      {val !== null && val !== undefined ? `${(val * 100).toFixed(1)}%` : 'N/A'}
                    </div>
                    <div className="label-text text-xs mt-1">{metric.replace(/_/g, ' ')}</div>
                    {METRIC_INFO[metric] && (
                      <div className="text-xs text-muted mt-1 leading-tight hidden md:block">
                        {METRIC_INFO[metric]}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>

            {/* CV scores */}
            {activeModel.cv_scores && (
              <Card className="p-5">
                <div className="label-text mb-3">5-Fold Cross Validation (F1 Macro)</div>
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold text-rose-400">
                    {(activeModel.cv_scores.mean * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted">
                    ± {(activeModel.cv_scores.std * 100).toFixed(2)}% std
                  </div>
                  <div className="flex gap-2">
                    {activeModel.cv_scores.scores.map((s, i) => (
                      <span key={i} className="font-mono text-xs px-2 py-1 rounded bg-surface-2 text-muted">
                        {(s * 100).toFixed(1)}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Confusion Matrix */}
              <Card className="p-6">
                <SectionHeader title="Confusion Matrix" subtitle="Predicted vs. actual class labels" />
                <ConfusionMatrix matrix={activeModel.confusion_matrix} classNames={classNames} />
              </Card>

              {/* Feature Importance */}
              <Card className="p-6">
                <SectionHeader title="Feature Importance" subtitle="Top predictors ranked by contribution" />
                <FeatureImportanceChart importance={activeModel.feature_importance} />
              </Card>
            </div>

            {/* Per-class report */}
            {activeModel.per_class_report && (
              <Card className="p-6">
                <SectionHeader title="Per-Class Report" subtitle="Precision, Recall, F1 for each risk category" />
                <div className="grid grid-cols-3 gap-4">
                  {classNames.map((cls) => {
                    const r = activeModel.per_class_report[cls]
                    if (!r) return null
                    return (
                      <div key={cls} className="p-4 rounded-xl bg-surface-2">
                        <div className="font-semibold text-sm capitalize mb-3">{cls}</div>
                        {[
                          { label: 'Precision', val: r.precision },
                          { label: 'Recall', val: r.recall },
                          { label: 'F1-Score', val: r['f1-score'] },
                        ].map(({ label, val }) => (
                          <div key={label} className="mb-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted">{label}</span>
                              <span className="text-rose-300">{(val * 100).toFixed(1)}%</span>
                            </div>
                            <ProgressBar value={val * 100} color="rose" />
                          </div>
                        ))}
                        <div className="text-xs text-muted mt-2">Support: {r.support}</div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
