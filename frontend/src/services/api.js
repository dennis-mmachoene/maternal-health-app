/**
 * API Service — centralized Axios client for all backend requests.
 * Handles base URL, error normalization, and request/response interceptors.
 */
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'https://maternal-health-app.onrender.com/api/v1'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // 2 min for training
  headers: { 'Content-Type': 'application/json' },
})

// Response interceptor — normalize errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.detail ||
      error.message ||
      'An unexpected error occurred'
    return Promise.reject(new Error(message))
  }
)

// ─── Dataset ──────────────────────────────────────────────────────────────────
export const datasetApi = {
  getSummary: () => api.get('/dataset/'),
  ingest: () => api.post('/dataset/ingest/'),
}

// ─── EDA ──────────────────────────────────────────────────────────────────────
export const edaApi = {
  getOverview: () => api.get('/eda/'),
  getDistributions: () => api.get('/eda/distributions/'),
  getCorrelation: () => api.get('/eda/correlation/'),
}

// ─── Training ─────────────────────────────────────────────────────────────────
export const trainingApi = {
  start: () => api.post('/training/start/'),
  getStatus: () => api.get('/training/status/'),
  getHistory: () => api.get('/training/history/'),
}

// ─── Models ───────────────────────────────────────────────────────────────────
export const modelsApi = {
  list: () => api.get('/models/'),
  getPerformance: () => api.get('/performance/'),
}

// ─── Prediction ───────────────────────────────────────────────────────────────
export const predictionApi = {
  predict: (data) => api.post('/predict/', data),
  getHistory: () => api.get('/predictions/'),
  getFeatures: () => api.get('/features/'),
}

export default api
