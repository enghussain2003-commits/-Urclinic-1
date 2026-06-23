import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Settings, Phone, MapPin, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';

const ClinicSettings = () => {
  const { t } = useTranslation();
  // In a real app, this data would come from Supabase `clinic_settings` table
  const { user } = useApp();
  
  const [settings, setSettings] = useState({
    clinic_name: 'My Clinic',
    phone: '+1234567890',
    address: 'Main Street 1, City Center',
    start_time: '09:00',
    end_time: '17:00',
    default_appointment_duration: 30
  });

  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      alert('Clinic settings updated successfully.');
    }, 800);
  };

  if (!user || !['super_admin', 'clinic_admin'].includes(user?.role)) {
    return (
      <div className="page-padding text-center">
        <h2>Access Denied</h2>
        <p>Only administrators can view and edit clinic settings.</p>
      </div>
    );
  }

  return (
    <div className="page-padding animate-in container" style={{ maxWidth: 700 }}>
      <div className="flex items-center gap-sm mb-xl">
        <Settings size={28} color="var(--primary)" />
        <h2 style={{ margin: 0 }}>Clinic Settings</h2>
      </div>

      <div className="glass p-8">
        <div className="form-group">
          <label className="form-label">Clinic Name</label>
          <input 
            className="input" 
            type="text" 
            value={settings.clinic_name}
            onChange={(e) => setSettings({...settings, clinic_name: e.target.value})}
          />
        </div>

        <div className="flex gap-md flex-wrap mb-md">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label"><Phone size={14} style={{ display: 'inline', marginInlineEnd: 4 }}/> Phone Number</label>
            <input 
              className="input" 
              type="tel" 
              value={settings.phone}
              onChange={(e) => setSettings({...settings, phone: e.target.value})}
            />
          </div>
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label"><MapPin size={14} style={{ display: 'inline', marginInlineEnd: 4 }}/> Address</label>
            <input 
              className="input" 
              type="text" 
              value={settings.address}
              onChange={(e) => setSettings({...settings, address: e.target.value})}
            />
          </div>
        </div>

        <h4 className="mb-md mt-xl"><Clock size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginInlineEnd: 8 }}/> Working Hours & Duration</h4>
        <div className="card-flat bg-alt mb-xl">
          <div className="flex gap-md flex-wrap mb-md">
            <div className="form-group mb-0" style={{ flex: 1 }}>
              <label className="form-label">Start Time</label>
              <input 
                className="input" 
                type="time" 
                value={settings.start_time}
                onChange={(e) => setSettings({...settings, start_time: e.target.value})}
              />
            </div>
            <div className="form-group mb-0" style={{ flex: 1 }}>
              <label className="form-label">End Time</label>
              <input 
                className="input" 
                type="time" 
                value={settings.end_time}
                onChange={(e) => setSettings({...settings, end_time: e.target.value})}
              />
            </div>
          </div>
          <div className="form-group mb-0 mt-md">
            <label className="form-label">Default Appointment Duration (Minutes)</label>
            <select 
              className="input"
              value={settings.default_appointment_duration}
              onChange={(e) => setSettings({...settings, default_appointment_duration: parseInt(e.target.value)})}
            >
              <option value={15}>15 Minutes</option>
              <option value={20}>20 Minutes</option>
              <option value={30}>30 Minutes</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={18} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClinicSettings;
