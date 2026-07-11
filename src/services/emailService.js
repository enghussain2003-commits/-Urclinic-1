import { supabase } from '../supabaseClient';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

/**
 * Sends an email using the Supabase Edge Function 'send-email'
 * 
 * @param {string|string[]} to - The recipient's email address
 * @param {string} subject - The subject of the email
 * @param {string} html - The HTML content of the email
 */
export const sendEmail = async (to, subject, html) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { to, subject, html },
    });

    if (error) {
      console.error('Error invoking send-email function:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error('Exception invoking send-email function:', err);
    return { success: false, error: err };
  }
};

/**
 * Sends an appointment confirmation email to the patient
 */
export const sendAppointmentConfirmation = async (email, patientName, date, time, doctorName) => {
  const subject = 'تأكيد حجز موعد - UrClinic';
  const safePatientName = escapeHtml(patientName);
  const safeDate = escapeHtml(date);
  const safeTime = escapeHtml(time);
  const safeDoctorName = escapeHtml(doctorName || 'طبيب العيادة');
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: right;">
      <h2 style="color: #0f766e;">مرحباً ${safePatientName}،</h2>
      <p>تم تأكيد حجز موعدك في عيادات <strong>UrClinic</strong>.</p>
      
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p><strong>التاريخ:</strong> ${safeDate}</p>
        <p><strong>الوقت:</strong> ${safeTime}</p>
        <p><strong>الطبيب:</strong> ${safeDoctorName}</p>
      </div>
      
      <p>يرجى الحضور قبل الموعد بـ 10 دقائق.</p>
      <p>إذا كنت ترغب في إلغاء أو تعديل الموعد، يرجى التواصل معنا.</p>
      
      <br />
      <p>مع تحيات،</p>
      <p><strong>فريق UrClinic</strong></p>
    </div>
  `;

  return await sendEmail(email, subject, html);
};

/**
 * Sends an appointment reminder email to the patient
 */
export const sendAppointmentReminder = async (email, patientName, date, time) => {
  const subject = 'تذكير بموعدك القادم - UrClinic';
  const safePatientName = escapeHtml(patientName);
  const safeDate = escapeHtml(date);
  const safeTime = escapeHtml(time);
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: right;">
      <h2 style="color: #0f766e;">مرحباً ${safePatientName}،</h2>
      <p>نود تذكيرك بموعدك القادم في عيادات <strong>UrClinic</strong>.</p>
      
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p><strong>التاريخ:</strong> ${safeDate}</p>
        <p><strong>الوقت:</strong> ${safeTime}</p>
      </div>
      
      <p>نتمنى لك دوام الصحة والعافية.</p>
    </div>
  `;

  return await sendEmail(email, subject, html);
};

/**
 * Sends a general system notification
 */
export const sendSystemNotification = async (email, subject, message) => {
  const safeMessage = escapeHtml(message);
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: right;">
      <div style="padding: 20px; background-color: #f8fafc; border-radius: 8px;">
        ${safeMessage}
      </div>
      <br />
      <p><strong>فريق UrClinic</strong></p>
    </div>
  `;

  return await sendEmail(email, subject, html);
};
