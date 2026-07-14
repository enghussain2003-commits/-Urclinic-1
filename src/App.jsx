import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './components/ToastProvider';
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
import SuperAdminClinics from './pages/SuperAdminClinics';
import SuperAdminClinicProvision from './pages/SuperAdminClinicProvision';
import SuperAdminClinicDetails from './pages/SuperAdminClinicDetails';
import SuperAdminPatients from './pages/SuperAdminPatients';
import SuperAdminPatientDetails from './pages/SuperAdminPatientDetails';
import ForceChangePassword from './pages/ForceChangePassword';
import SupportPage from './pages/SupportPage';
import SuperAdminSupportCenter from './pages/SuperAdminSupportCenter';
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
  const location = useLocation();
  const staffRoles = ['super_admin', 'clinic_admin', 'employee', 'doctor'];
  const isStaff = user && staffRoles.includes(user.role);

  if (!user) return <Navigate to="/login" />;
  if (user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  if (user.status === 'suspended') return <Navigate to="/login" replace />;

  // Staff-only pages (dashboard): block non-staff.
  if (requiredRole === 'clinic' && !isStaff) return <Navigate to="/" />;
  if (requiredRole === 'super_admin' && user.role !== 'super_admin') return <Navigate to="/dashboard" />;

  // Patient-only pages (booking): block staff and send them to their dashboard.
  if (requiredRole === 'patient' && user.role !== 'patient') {
    return <Navigate to={isStaff ? '/dashboard' : '/'} />;
  }

  return children;
};

function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <Router>
          <Layout>
            <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/change-password" element={
              <ProtectedRoute>
                <ForceChangePassword />
              </ProtectedRoute>
            } />
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
            <Route path="/dashboard/support" element={
              <ProtectedRoute>
                <SupportPage />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/support/tickets/:ticketId" element={
              <ProtectedRoute>
                <SupportPage />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/super-admin/support" element={
              <ProtectedRoute requiredRole="super_admin">
                <SuperAdminSupportCenter />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/super-admin/support/:ticketId" element={
              <ProtectedRoute requiredRole="super_admin">
                <SuperAdminSupportCenter />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/super-admin/clinics" element={
              <ProtectedRoute requiredRole="super_admin">
                <SuperAdminClinics />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/super-admin/clinics/new" element={
              <ProtectedRoute requiredRole="super_admin">
                <SuperAdminClinicProvision />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/super-admin/clinics/:id" element={
              <ProtectedRoute requiredRole="super_admin">
                <SuperAdminClinicDetails />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/super-admin/patients" element={
              <ProtectedRoute requiredRole="super_admin">
                <SuperAdminPatients />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/super-admin/patients/:patientId" element={
              <ProtectedRoute requiredRole="super_admin">
                <SuperAdminPatientDetails />
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
      </ToastProvider>
    </AppProvider>
  );
}

export default App;
