import { useTranslation } from 'react-i18next';
import { Clock, CheckCircle, MapPin } from 'lucide-react';

const DoctorCard = ({ doctor, onSelect, selected }) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const name = isAr
    ? (doctor.nameAr || doctor.full_name || doctor.name || '')
    : (doctor.name || doctor.full_name || doctor.nameAr || '');

  // Single clean initial for the avatar (avoids the cramped two-letter placeholder look).
  const initial = (name.trim().charAt(0) || '?').toUpperCase();

  // Clinic location comes from the doctor's database record.
  const clinicLocation = doctor.clinic_address || doctor.clinic_name || (isAr ? 'العيادة الرئيسية' : 'Main Clinic');

  return (
    <div
      className={`doctor-card ${selected ? 'selected' : ''}`}
      onClick={() => onSelect && onSelect(doctor)}
    >
      <div className="doctor-card-head">
        <div className="doctor-avatar">{initial}</div>
        {doctor.fee > 0 && (
          <span className="doctor-fee">${doctor.fee}</span>
        )}
      </div>

      <div className="doctor-name">{name}</div>
      <div className="doctor-specialty">{t(doctor.specialty) || doctor.specialty}</div>

      <div className="doctor-meta">
        <MapPin size={14} />
        <span>{clinicLocation}</span>
      </div>

      <div className="doctor-card-foot">
        <span className="doctor-availability">
          {doctor.available !== false
            ? <><CheckCircle size={14} /> {t('available')}</>
            : <><Clock size={14} /> {doctor.nextSlot}</>}
        </span>
      </div>
    </div>
  );
};

export default DoctorCard;
