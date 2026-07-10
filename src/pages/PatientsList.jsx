import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Phone, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';

const PatientsList = () => {

  const navigate = useNavigate();
  const { patients, loading } = useApp();

  const [searchQuery, setSearchQuery] = useState('');

  const filteredPatients = patients.filter(p => {
    const q = searchQuery.toLowerCase();
    return (
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.phone || '').includes(q) ||
      (p.email || '').toLowerCase().includes(q)
    );
  });

  const calculateAge = (dob) => {
    if (!dob) return '-';
    // eslint-disable-next-line react-hooks/purity
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  return (
    <div className="page-padding animate-in">
      <div className="flex justify-between items-center mb-xl flex-wrap gap-md">
        <h2 style={{ margin: 0 }}>Patients / المرضى</h2>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={18} style={{ position: 'absolute', top: 12, left: 12, color: 'var(--text-secondary)' }} />
          <input
            type="text"
            className="input"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-xl text-muted">Loading patients...</div>
      ) : filteredPatients.length === 0 ? (
        <div className="glass p-8 text-center">
          <User size={48} style={{ opacity: 0.15, margin: '0 auto 1rem' }} />
          <p className="text-muted">{searchQuery ? 'No patients match your search.' : 'No registered patients yet.'}</p>
        </div>
      ) : (
        <div className="glass p-4">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Phone</th>
                  <th>Gender</th>
                  <th>Age</th>
                  <th>Registered</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map(patient => (
                  <tr key={patient.id} style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/dashboard/patients/${patient.id}`)}>
                    <td>
                      <div className="flex items-center gap-sm">
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0
                        }}>
                          {patient.full_name?.charAt(0)?.toUpperCase() || 'P'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{patient.full_name}</div>
                          <div className="text-sm text-muted">{patient.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="flex items-center gap-sm"><Phone size={14} className="text-muted" /> {patient.phone || '-'}</span>
                    </td>
                    <td>{patient.gender || '-'}</td>
                    <td>{calculateAge(patient.date_of_birth)}</td>
                    <td className="text-sm text-muted">{new Date(patient.created_at).toLocaleDateString()}</td>
                    <td>
                      <ChevronRight size={18} className="text-muted" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientsList;
