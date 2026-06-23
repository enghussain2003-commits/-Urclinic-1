import React from 'react';
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

const Layout = ({ children }) => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard');

  return (
    <div className="app-layout">
      {isDashboard ? <Sidebar /> : null}
      <main className={`app-main ${isDashboard ? 'with-sidebar' : ''}`}>
        {!isDashboard && <div className="container"><Navbar /></div>}
        {isDashboard && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
            padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)',
          }}>
            <NotificationBell />
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
          </Routes>
        </Layout>
      </Router>
    </AppProvider>
  );
}

export default App;
