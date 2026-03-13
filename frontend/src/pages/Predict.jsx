/**
 * Prediction Page — dynamic form for patient input, risk prediction & history.
 */
import { useState } from 'react'
import {
  Zap, HeartPulse, Thermometer, Droplets, Activity,
  User, AlertTriangle, CheckCircle2, Info, Clock, RefreshCw
} from 'lucide-react'
import { useApi, useMutation } from '../hooks/useApi'
import { predictionApi } from '../services/api'
import { Card, SectionHeader, LoadingState, ErrorState, RiskBadge } from '../components/UI'
import { RadialBarChart, RadialBar, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'

const FIELD_ICONS = {
  Age: User,
  SystolicBP: Activity,
  DiastolicBP: Activity,
  BS: Droplets,
  BodyTemp: Thermometer,
  HeartRate: HeartPulse,
}

const RISK_CONFIG = {
  'low risk': {
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.3)',
    icon: CheckCircle2,
    title: 'Low Risk',
    description: 'Vital signs appear within normal ranges. Continue standard prenatal monitoring.',
  },
  'mid risk': {
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.3)',
    icon: AlertTriangle,
    title: 'Mid Risk',
    description: 'Some indicators warrant closer monitoring. Recommend increased prenatal visits.',
  },
  'high risk': {
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.3)',
    icon: AlertTriangle,
    title: 'High Risk',
    description: 'Multiple elevated risk factors detected. Immediate clinical evaluation recommended.',
  },
}

const DEFAULT_VALUES = {
  Age: 25,
  SystolicBP: 120,
  DiastolicBP: 80,
  BS: 6.0,
  BodyTemp: 98.6,
  HeartRate: 72,
}

// ─── Probability Gauge ────────────────────────────────────────────────────────
function ProbabilityChart({ probabilities }) {
  const data = Object.entries(probabilities).map(([label, prob]) => ({
    name: label,
    value: Math.round(prob * 100),
    fill: label === 'low risk' ? '#22c55e' : label === 'mid risk' ? '#f59e0b' : '#ef4444',
  }))

  return (
    <div className="space-y-3">
      {data.map(({ name, value, fill }) => (
        <div key={name} className="flex items-center gap-3">
          <div className="w-20 text-xs capitalize" style={{ color: fill }}>{name}</div>
          <div className="flex-1 h-2.5 rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${value}%`, background: fill }}
            />
          </div>
          <span className="text-xs font-mono w-10 text-right" style={{ color: fill }}>
            {value}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Result Card ──────────────────────────────────────────────────────────────
function PredictionResult({ result }) {
  if (!result) return null

  const label = result.predicted_label
  const config = RISK_CONFIG[label] || RISK_CONFIG['low risk']
  const IconComp = config.icon

  return (
    <div
      className="rounded-2xl p-6 border animate-slide-up"
      style={{ background: config.bg, borderColor: config.border }}
    >
      <div className="flex items-start gap-4 mb-5">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${config.color}20`, border: `1px solid ${config.border}` }}
        >
          <IconComp className="w-6 h-6" style={{ color: config.color }} />
        </div>
        <div>
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Predicted Risk Level</div>
          <div className="text-2xl font-bold" style={{ color: config.color, fontFamily: 'DM Serif Display, serif' }}>
            {config.title}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {result.confidence !== null && (
              <span className="text-sm text-muted">
                Confidence: <span style={{ color: config.color }}>{Math.round(result.confidence * 100)}%</span>
              </span>
            )}
            <span className="text-xs text-muted">via {result.model_display_name}</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted mb-5 leading-relaxed">{config.description}</p>

      {result.probabilities && Object.keys(result.probabilities).length > 0 && (
        <div className="pt-4 border-t" style={{ borderColor: `${config.color}20` }}>
          <div className="label-text mb-3">Class Probabilities</div>
          <ProbabilityChart probabilities={result.probabilities} />
        </div>
      )}

      <div className="mt-4 pt-4 border-t text-xs text-muted" style={{ borderColor: `${config.color}20` }}>
        ⚠️ This prediction is for informational purposes only and does not constitute medical advice.
        Always consult a qualified healthcare professional.
      </div>
    </div>
  )
}

// ─── Main Prediction Page ─────────────────────────────────────────────────────
export default function Predict() {
  const { data: featuresData, loading: featLoading } = useApi(predictionApi.getFeatures)
  const { data: historyData, execute: refreshHistory } = useApi(predictionApi.getHistory)
  const { mutate: predict, loading: predicting } = useMutation(predictionApi.predict)

  const [values, setValues] = useState(DEFAULT_VALUES)
  const [selectedModel, setSelectedModel] = useState('best')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const features = featuresData?.data || []
  const history = historyData?.data || []

  const handleChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: parseFloat(val) || 0 }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setResult(null)
    try {
      const payload = { ...values, model_key: selectedModel }
      const res = await predict(payload)
      setResult(res.data)
      refreshHistory()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleReset = () => {
    setValues(DEFAULT_VALUES)
    setResult(null)
    setError(null)
  }

  if (featLoading) return <LoadingState message="Loading feature definitions…" />

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'DM Serif Display, serif' }}>
          Risk Prediction
        </h1>
        <p className="text-muted text-sm mt-1">
          Enter patient vitals to receive an instant AI-powered risk assessment
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Form */}
        <div className="xl:col-span-3">
          <Card className="p-6">
            <SectionHeader
              title="Patient Vitals"
              subtitle="Enter measured values for risk assessment"
            />

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Model selector */}
              <div>
                <label className="label-text block mb-2">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="input-field"
                >
                  <option value="best">Best Model (auto-selected)</option>
                  <option value="random_forest">Random Forest</option>
                  <option value="gradient_boosting">Gradient Boosting</option>
                  <option value="logistic_regression">Logistic Regression</option>
                  <option value="xgboost">XGBoost</option>
                </select>
              </div>

              {/* Feature inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {features.map((feat) => {
                  const IconComp = FIELD_ICONS[feat.key] || Activity
                  return (
                    <div key={feat.key}>
                      <label className="label-text block mb-2">
                        {feat.label}
                        <span className="ml-1 normal-case font-normal text-muted">({feat.unit})</span>
                      </label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <IconComp className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                        </div>
                        <input
                          type="number"
                          min={feat.min}
                          max={feat.max}
                          step={feat.step}
                          value={values[feat.key] ?? feat.default}
                          onChange={(e) => handleChange(feat.key, e.target.value)}
                          className="input-field pl-10"
                          required
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted mt-1">
                        <span>Min: {feat.min}</span>
                        <span className="text-center">{feat.description}</span>
                        <span>Max: {feat.max}</span>
                      </div>

                      {/* Slider */}
                      <input
                        type="range"
                        min={feat.min}
                        max={feat.max}
                        step={feat.step}
                        value={values[feat.key] ?? feat.default}
                        onChange={(e) => handleChange(feat.key, e.target.value)}
                        className="w-full mt-2 accent-rose-500 h-1"
                      />
                    </div>
                  )
                })}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/50 border border-red-900/40 text-red-300 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={predicting} className="btn-primary flex-1">
                  {predicting ? (
                    <><span className="spinner" /> Predicting…</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Predict Risk Level</>
                  )}
                </button>
                <button type="button" onClick={handleReset} className="btn-secondary">
                  Reset
                </button>
              </div>
            </form>
          </Card>
        </div>

        {/* Result */}
        <div className="xl:col-span-2 space-y-6">
          {result ? (
            <PredictionResult result={result} />
          ) : (
            <Card className="p-6 flex flex-col items-center justify-center min-h-64 text-center">
              <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-subtle flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-muted" />
              </div>
              <p className="font-medium">No prediction yet</p>
              <p className="text-xs text-muted mt-1">Fill in the patient vitals form and click Predict</p>
            </Card>
          )}

          {/* Clinical reference */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-4 h-4 text-rose-400" />
              <div className="label-text">Clinical Reference Ranges</div>
            </div>
            <div className="space-y-2 text-xs">
              {[
                { label: 'Systolic BP', normal: '90–120 mmHg', warning: '≥140 = hypertension' },
                { label: 'Diastolic BP', normal: '60–80 mmHg', warning: '≥90 = hypertension' },
                { label: 'Blood Sugar', normal: '3.9–7.8 mmol/L', warning: '>7.8 = hyperglycemia risk' },
                { label: 'Body Temp', normal: '97–99 °F', warning: '>100.4 = fever' },
                { label: 'Heart Rate', normal: '60–100 bpm', warning: '>100 = tachycardia' },
              ].map(({ label, normal, warning }) => (
                <div key={label} className="flex items-start justify-between py-1.5 border-b border-subtle/50">
                  <span className="font-medium text-white/70 w-24">{label}</span>
                  <span className="text-green-400/80">{normal}</span>
                  <span className="text-amber-400/60 text-right">{warning}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Prediction history */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <SectionHeader title="Recent Predictions" subtitle="Last 20 prediction requests" />
          <button onClick={refreshHistory} className="btn-secondary text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted">No predictions made yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-subtle">
                  <th className="label-text text-left py-2 px-3">Time</th>
                  <th className="label-text text-left py-2 px-3">Age</th>
                  <th className="label-text text-left py-2 px-3">SBP/DBP</th>
                  <th className="label-text text-left py-2 px-3">BS</th>
                  <th className="label-text text-left py-2 px-3">Result</th>
                  <th className="label-text text-left py-2 px-3">Confidence</th>
                  <th className="label-text text-left py-2 px-3">Model</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-subtle/30 hover:bg-surface-2/40 transition-colors">
                    <td className="py-2.5 px-3 text-muted">
                      {new Date(h.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 text-white">{h.input_data?.Age}</td>
                    <td className="py-2.5 px-3 text-white">
                      {h.input_data?.SystolicBP}/{h.input_data?.DiastolicBP}
                    </td>
                    <td className="py-2.5 px-3 text-white">{h.input_data?.BS}</td>
                    <td className="py-2.5 px-3">
                      <RiskBadge level={h.predicted_label} />
                    </td>
                    <td className="py-2.5 px-3 text-rose-400">
                      {h.confidence ? `${Math.round(h.confidence * 100)}%` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-muted capitalize">
                      {h.model_used?.replace(/_/g, ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
