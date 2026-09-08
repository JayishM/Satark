import { Routes, Route } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import DashboardPage from '@/pages/DashboardPage'
import RiskMapPage from '@/pages/RiskMapPage'
import AlertsPage from '@/pages/AlertsPage'
import AnalyticsPage from '@/pages/AnalyticsPage'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/map" element={<RiskMapPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Routes>
    </AppShell>
  )
}
