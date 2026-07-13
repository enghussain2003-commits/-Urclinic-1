import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Settings, Phone, MapPin, Clock, Building2, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../supabaseClient';
import { isDemoModeEnabled } from '../demo/demoMode';
import { readDemoJson, writeDemoJson } from '../demo/demoStorage';

const EMPTY_SETTINGS = {
  name: '',
  phone: '',
  address: '',
  start_time: '09:00',
  end_time: '17:00',
  default_appointment_duration: 30,
};

const normalizeClinic = (clinic) => {
  const hours = clinic?.working_hours && typeof clinic.working_hours === 'object'
    ? clinic.working_hours
    : {};
  return {
    name: clinic?.name || '',
    phone: clinic?.phone || '',
    address: clinic?.address || '',
    start_time: hours.start || '09:00',
    end_time: hours.end || '17:00',
    default_appointment_duration: clinic?.default_appointment_duration || 30,
  };
};

const ClinicSettings = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { user } = useApp();
  const { error: showErrorToast, success: showSuccessToast } = useToast();
  const isDemo = isDemoModeEnabled(user);

  const [clinics, setClinics] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState(user?.clinic_id || '');
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const canEdit = user && ['super_admin', 'clinic_admin'].includes(user.role);
  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (!canEdit) {
      return;
    }

    if (isDemo) {
      const frame = requestAnimationFrame(() => {
        const demoSettings = readDemoJson('clinic_settings', {
          id: 'demo-clinic',
          name: 'UrClinic Demo Clinic',
          phone: '+964 770 000 0000',
          address: isAr ? 'بغداد - عيادة تجريبية' : 'Baghdad - Demo Clinic',
          working_hours: { start: '09:00', end: '17:00' },
          default_appointment_duration: 30,
        });
        setClinics([demoSettings]);
        setSelectedClinicId('demo-clinic');
        setSettings(normalizeClinic(demoSettings));
        setLoading(false);
      });
      return () => cancelAnimationFrame(frame);
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      setFormError('');
      try {
        let query = supabase
          .from('clinics')
          .select('id, name, phone, address, working_hours, default_appointment_duration')
          .order('name', { ascending: true });

        if (!isSuperAdmin) {
          if (!user?.clinic_id) {
            throw new Error(isAr ? 'لا يوجد معرف عيادة مرتبط بهذا الحساب.' : 'No clinic is linked to this account.');
          }
          query = query.eq('id', user.clinic_id);
        }

        const { data, error: loadError } = await query;
        if (loadError) throw loadError;
        if (!active) return;

        const rows = data || [];
        setClinics(rows);

        const nextClinicId = isSuperAdmin
          ? (selectedClinicId || rows[0]?.id || '')
          : user.clinic_id;
        setSelectedClinicId(nextClinicId);

        const row = rows.find(c => String(c.id) === String(nextClinicId));
        setSettings(row ? normalizeClinic(row) : EMPTY_SETTINGS);
      } catch (err) {
        if (active) {
          setClinics([]);
          setSettings(EMPTY_SETTINGS);
          console.error('Clinic settings load failed:', {
            message: err?.message,
            code: err?.code,
            clinicId: user?.clinic_id,
            role: user?.role,
          });
          showErrorToast(isAr ? 'تعذر تحميل إعدادات العيادة.' : 'Could not load clinic settings.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [canEdit, isAr, isDemo, isSuperAdmin, selectedClinicId, showErrorToast, user?.clinic_id, user?.role]);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setFormError('');
  };

  const handleClinicChange = (clinicId) => {
    setSelectedClinicId(clinicId);
    const clinic = clinics.find(c => String(c.id) === String(clinicId));
    setSettings(clinic ? normalizeClinic(clinic) : EMPTY_SETTINGS);
    setFormError('');
  };

  const handleSave = async () => {
    if (!selectedClinicId) {
      setFormError(isAr ? 'اختر عيادة أولاً.' : 'Select a clinic first.');
      return;
    }
    if (!settings.name.trim()) {
      setFormError(isAr ? 'اسم العيادة مطلوب.' : 'Clinic name is required.');
      return;
    }

    const payload = {
      name: settings.name.trim(),
      phone: settings.phone.trim() || null,
      address: settings.address.trim() || null,
      working_hours: {
        start: settings.start_time,
        end: settings.end_time,
      },
      default_appointment_duration: Number(settings.default_appointment_duration) || 30,
    };

    setSaving(true);
    setFormError('');
    try {
      if (isDemo) {
        const demoClinic = { id: 'demo-clinic', ...payload };
        writeDemoJson('clinic_settings', demoClinic);
        setClinics([demoClinic]);
      } else {
        let update = supabase.from('clinics').update(payload).eq('id', selectedClinicId);
        if (!isSuperAdmin) update = update.eq('id', user.clinic_id);
        const { error: saveError } = await update;
        if (saveError) throw saveError;
        setClinics(prev => prev.map(c => String(c.id) === String(selectedClinicId) ? { ...c, ...payload } : c));
      }

      showSuccessToast(isAr ? 'تم حفظ إعدادات العيادة بنجاح.' : 'Clinic settings saved successfully.');
    } catch (err) {
      console.error('Clinic settings save failed:', {
        message: err?.message,
        code: err?.code,
        clinicId: selectedClinicId,
        role: user?.role,
      });
      showErrorToast(isAr ? 'تعذر حفظ إعدادات العيادة.' : 'Could not save clinic settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="page-padding text-center">
        <h2>{isAr ? 'غير مصرح' : 'Access Denied'}</h2>
        <p>{isAr ? 'إعدادات العيادة متاحة للمسؤولين فقط.' : 'Only administrators can view and edit clinic settings.'}</p>
      </div>
    );
  }

  return (
    <div className="page-padding animate-in">
      <div className="flex items-center justify-between gap-md mb-xl flex-wrap">
        <div className="flex items-center gap-sm">
          <Settings size={28} color="var(--primary)" />
          <h2 style={{ margin: 0 }}>{isAr ? 'إعدادات العيادة' : 'Clinic Settings'}</h2>
        </div>
        {isDemo && <span className="badge badge-warning">{isAr ? 'وضع العرض التجريبي' : 'Demo Mode'}</span>}
      </div>

      <div className="glass p-8" style={{ maxWidth: 760 }}>
        {isSuperAdmin && (
          <div className="form-group">
            <label className="form-label">
              <Building2 size={14} style={{ display: 'inline', marginInlineEnd: 4 }} />
              {isAr ? 'اختر العيادة' : 'Select clinic'}
            </label>
            <select
              className="input"
              value={selectedClinicId}
              onChange={(e) => handleClinicChange(e.target.value)}
              disabled={loading || saving || clinics.length === 0}
            >
              <option value="">{isAr ? 'اختر عيادة...' : 'Select clinic...'}</option>
              {clinics.map(clinic => (
                <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
              ))}
            </select>
            <p className="text-sm text-muted mt-xs">
              {isAr
                ? 'المشرف العام يختار العيادة صراحة قبل تعديل إعداداتها.'
                : 'Super admins must explicitly select which clinic they are editing.'}
            </p>
          </div>
        )}

        {loading ? (
          <div className="text-center text-muted py-xl">{t('loading')}</div>
        ) : (
          <>
            {formError && (
              <div className="card-flat mb-md" style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)' }}>
                <AlertCircle size={16} style={{ display: 'inline', marginInlineEnd: 6 }} />
                {formError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{isAr ? 'اسم العيادة' : 'Clinic Name'}</label>
              <input
                className="input"
                type="text"
                value={settings.name}
                onChange={(e) => updateSetting('name', e.target.value)}
                disabled={saving || !selectedClinicId}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group mb-0">
                <label className="form-label">
                  <Phone size={14} style={{ display: 'inline', marginInlineEnd: 4 }} />
                  {isAr ? 'رقم الهاتف' : 'Phone Number'}
                </label>
                <input
                  className="input"
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => updateSetting('phone', e.target.value)}
                  disabled={saving || !selectedClinicId}
                />
              </div>
              <div className="form-group mb-0">
                <label className="form-label">
                  <MapPin size={14} style={{ display: 'inline', marginInlineEnd: 4 }} />
                  {isAr ? 'العنوان' : 'Address'}
                </label>
                <input
                  className="input"
                  type="text"
                  value={settings.address}
                  onChange={(e) => updateSetting('address', e.target.value)}
                  disabled={saving || !selectedClinicId}
                />
              </div>
            </div>

            <h4 className="mb-md mt-xl">
              <Clock size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginInlineEnd: 8 }} />
              {isAr ? 'ساعات العمل ومدة الحجز' : 'Working Hours & Duration'}
            </h4>
            <div className="card-flat bg-alt mb-xl">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group mb-0">
                  <label className="form-label">{isAr ? 'وقت البداية' : 'Start Time'}</label>
                  <input
                    className="input"
                    type="time"
                    value={settings.start_time}
                    onChange={(e) => updateSetting('start_time', e.target.value)}
                    disabled={saving || !selectedClinicId}
                  />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label">{isAr ? 'وقت الانتهاء' : 'End Time'}</label>
                  <input
                    className="input"
                    type="time"
                    value={settings.end_time}
                    onChange={(e) => updateSetting('end_time', e.target.value)}
                    disabled={saving || !selectedClinicId}
                  />
                </div>
              </div>
              <div className="form-group mb-0">
                <label className="form-label">{isAr ? 'مدة الحجز الافتراضية (دقيقة)' : 'Default Appointment Duration (minutes)'}</label>
                <select
                  className="input"
                  value={settings.default_appointment_duration}
                  onChange={(e) => updateSetting('default_appointment_duration', parseInt(e.target.value, 10))}
                  disabled={saving || !selectedClinicId}
                >
                  <option value={15}>15 {isAr ? 'دقيقة' : 'Minutes'}</option>
                  <option value={20}>20 {isAr ? 'دقيقة' : 'Minutes'}</option>
                  <option value={30}>30 {isAr ? 'دقيقة' : 'Minutes'}</option>
                  <option value={45}>45 {isAr ? 'دقيقة' : 'Minutes'}</option>
                  <option value={60}>60 {isAr ? 'دقيقة' : 'Minutes'}</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !selectedClinicId} style={{ minWidth: 160 }}>
                <Save size={18} /> {saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save Settings')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClinicSettings;
