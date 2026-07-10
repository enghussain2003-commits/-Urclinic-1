import { useApp } from '../context/AppContext';
import AdminDashboard    from './AdminDashboard';
import DoctorDashboard   from './DoctorDashboard';
import EmployeeDashboard from './EmployeeDashboard';

/**
 * Dashboard — role-based router.
 * Each role renders its own dedicated dashboard component.
 * Adding a new role = adding one import + one condition here.
 */
const Dashboard = () => {
  const { user } = useApp();

  if (user?.role === 'doctor')   return <DoctorDashboard />;
  if (user?.role === 'employee') return <EmployeeDashboard />;

  // clinic_admin + super_admin
  return <AdminDashboard />;
};

export default Dashboard;
