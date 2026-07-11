import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Phone, ChevronRight, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';

const PatientsList = () => {
  const navigate = useNavigate();
  const { patients, loading } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const todayMs = new Date().getTime();

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
    const diff = todayMs - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  const Avatar = ({ name }) => (
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0
    }}>
      {name?.charAt(0)?.toUpperCase() || 'P'}
    </div>
  );

  return (
    <div className="page-padding animate-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-xl flex-wrap gap-md page-header-row">
        <h2 style={{ margin: 0 }}>Patients / المرضى</h2>
        <div style={{ position: 'relative' }} className="search-box">
          <Search size={18} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', insetInlineStart: 12, color: 'var(--text-secondary)' }} />
          <input
            type="text"
            className="input"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingInlineStart: '2.5rem', minWidth: 220 }}
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
        <>
          {/* ── Desktop table ── */}
          <div className="glass p-4 table-container">
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
                  <tr
                    key={patient.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/dashboard/patients/${patient.id}`)}
                  >
                    <td>
                      <div className="flex items-center gap-sm">
                        <Avatar name={patient.full_name} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{patient.full_name}</div>
                          <div className="text-sm text-muted">{patient.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="flex items-center gap-sm"><Phone size={14} style={{ color: 'var(--text-muted)' }} /> {patient.phone || '-'}</span>
                    </td>
                    <td>{patient.gender || '-'}</td>
                    <td>{calculateAge(patient.date_of_birth)}</td>
                    <td className="text-sm text-muted">{new Date(patient.created_at).toLocaleDateString()}</td>
                    <td><ChevronRight size={18} style={{ color: 'var(--text-muted)' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile card list ── */}
          <div className="mobile-card-list">
            {filteredPatients.map(patient => (
              <div
                key={patient.id}
                className="mobile-card-item"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/dashboard/patients/${patient.id}`)}
              >
                <div className="flex items-center gap-sm" style={{ marginBottom: '0.75rem' }}>
                  <Avatar name={patient.full_name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{patient.full_name}</div>
                    <div className="text-sm text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patient.email}</div>
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
                <div className="mobile-card-row">
                  <span className="mobile-card-label"><Phone size={12} /> Phone</span>
                  <span className="mobile-card-value" dir="ltr">{patient.phone || '-'}</span>
                </div>
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Gender / Age</span>
                  <span className="mobile-card-value">{patient.gender || '-'} • {calculateAge(patient.date_of_birth)} yrs</span>
                </div>
                <div className="mobile-card-row">
                  <span className="mobile-card-label"><Calendar size={12} /> Registered</span>
                  <span className="mobile-card-value">{new Date(patient.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PatientsList;
