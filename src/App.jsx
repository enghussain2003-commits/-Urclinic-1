import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import NotificationBell from './components/NotificationBell';
import Home from './pages/Home';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Booking from './pages/Booking';
import PatientProfile from './pages/PatientProfile';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import DoctorManagement from './pages/DoctorManagement';
import ScheduleView from './pages/ScheduleView';
import PatientsList from './pages/PatientsList';
import StaffPatientProfile from './pages/StaffPatientProfile';
import ClinicSettings from './pages/ClinicSettings';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import UserSettings from './pages/UserSettings';
import { Menu } from 'lucide-react';

const Layout = ({ children }) => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      {isDashboard ? (
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      ) : null}

      <main className={`app-main ${isDashboard ? 'with-sidebar' : ''}`}>
        {/* Public page navbar */}
        {!isDashboard && (
          <div className="container">
            <Navbar />
          </div>
        )}

        {/* Dashboard top bar */}
        {isDashboard && (
          <div className="dashboard-topbar">
            {/* Hamburger — only visible on mobile via CSS */}
            <button
              className="dashboard-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <span className="dashboard-topbar-brand">UrClinic</span>
            <div className="dashboard-topbar-actions">
              <NotificationBell />
            </div>
          </div>
        )}

        {children}
      </main>
    </div>
  );
};

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user } = useApp();
  const staffRoles = ['super_admin', 'clinic_admin', 'employee', 'doctor'];
  const isStaff = user && staffRoles.includes(user.role);

  if (!user) return <Navigate to="/login" />;

  // Staff-only pages (dashboard): block non-staff.
  if (requiredRole === 'clinic' && !isStaff) return <Navigate to="/" />;

  // Patient-only pages (booking): block staff and send them to their dashboard.
  if (requiredRole === 'patient' && user.role !== 'patient') {
    return <Navigate to={isStaff ? '/dashboard' : '/'} />;
  }

  return children;
};

function App() {
  return (
    <AppProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/booking" element={
              <ProtectedRoute requiredRole="patient">
                <Booking />
              </ProtectedRoute>
            } />
            
            <Route path="/profile" element={
              <ProtectedRoute requiredRole="patient">
                <PatientProfile />
              </ProtectedRoute>
            } />

            <Route path="/dashboard" element={
              <ProtectedRoute requiredRole="clinic">
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/appointments" element={
              <ProtectedRoute requiredRole="clinic">
                <Appointments />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/doctors" element={
              <ProtectedRoute requiredRole="clinic">
                <DoctorManagement />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/schedule" element={
              <ProtectedRoute requiredRole="clinic">
                <ScheduleView />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/patients" element={
              <ProtectedRoute requiredRole="clinic">
                <PatientsList />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/patients/:id" element={
              <ProtectedRoute requiredRole="clinic">
                <StaffPatientProfile />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/settings" element={
              <ProtectedRoute requiredRole="clinic">
                <ClinicSettings />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <UserSettings />
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </AppProvider>
  );
}

export default App;
