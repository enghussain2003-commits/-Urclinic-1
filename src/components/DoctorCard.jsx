import { useTranslation } from 'react-i18next';
import { Clock, CheckCircle, MapPin, Stethoscope } from 'lucide-react';

const DoctorCard = ({ doctor, onSelect, selected, bookingVariant = false }) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const name = isAr
    ? (doctor.nameAr || doctor.full_name || doctor.name || '')
    : (doctor.name || doctor.full_name || doctor.nameAr || '');

  // Single clean initial for the avatar (avoids the cramped two-letter placeholder look).
  const initial = (name.trim().charAt(0) || '?').toUpperCase();

  // Clinic location comes from the doctor's database record.
  const clinicLocation = doctor.clinic_address || doctor.clinic_name || (isAr ? 'العيادة الرئيسية' : 'Main Clinic');
  const workingHours = `${doctor.open_time || '09:00'} - ${doctor.close_time || '17:00'}`;
  const CardTag = onSelect ? 'button' : 'div';

  return (
    <CardTag
      {...(onSelect ? { type: 'button' } : {})}
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
      <div className="doctor-specialty">
        {bookingVariant && <Stethoscope size={14} />}
        {t(doctor.specialty) || doctor.specialty}
      </div>

      <div className="doctor-meta">
        <MapPin size={14} />
        <span>{clinicLocation}</span>
      </div>
      {bookingVariant && (
        <div className="doctor-meta">
          <Clock size={14} />
          <span dir="ltr">{workingHours}</span>
        </div>
      )}

      <div className="doctor-card-foot">
        <span className="doctor-availability">
          {doctor.available !== false
            ? <><CheckCircle size={14} /> {t('available')}</>
            : <><Clock size={14} /> {doctor.nextSlot}</>}
        </span>
        {bookingVariant && selected && <span className="doctor-selected-mark"><CheckCircle size={14} /></span>}
      </div>
    </CardTag>
  );
};

export default DoctorCard;
