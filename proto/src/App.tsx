import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import { DashboardPage } from './routes/DashboardPage'
import { LocationsPage } from './routes/LocationsPage'
import { SettingsPage } from './routes/SettingsPage'

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <div className="app-title">
            <span className="app-title-main">Tempest</span>
            <span className="app-title-sub">Paramotor window finder</span>
          </div>
          <nav className="app-nav">
            <NavLink to="/" end className="app-nav-link">
              Dashboard
            </NavLink>
            <NavLink to="/locations" className="app-nav-link">
              Locations
            </NavLink>
            <NavLink to="/settings" className="app-nav-link">
              Settings
            </NavLink>
          </nav>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
