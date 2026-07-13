// Dependency-free "download as PDF": open a styled print window and trigger the browser's
// print dialog, where the user picks "Save as PDF". Works in every modern browser without
// adding a PDF library to the bundle.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

export function downloadPrescriptionPdf(rx, { isAr = false, doctorName = '', patientName = '', clinicName = 'UrClinic' } = {}) {
  const meds = Array.isArray(rx.medicines) ? rx.medicines : [];
  const dir = isAr ? 'rtl' : 'ltr';
  const L = isAr
    ? { title: 'وصفة طبية', clinic: clinicName, doctor: 'الطبيب', patient: 'المريض', date: 'التاريخ',
        diagnosis: 'التشخيص', meds: 'الأدوية', instructions: 'التعليمات', dosage: 'الجرعة', none: '—' }
    : { title: 'Medical Prescription', clinic: clinicName, doctor: 'Doctor', patient: 'Patient', date: 'Date',
        diagnosis: 'Diagnosis', meds: 'Medicines', instructions: 'Instructions', dosage: 'Dosage', none: '—' };

  const medRows = meds.length
    ? meds.map(m => `
        <tr>
          <td>${esc(m.name)}</td>
          <td>${esc(m.dosage)}</td>
          <td>${esc(m.instructions)}</td>
        </tr>`).join('')
    : `<tr><td colspan="3" style="text-align:center;color:#888">${L.none}</td></tr>`;

  const html = `<!doctype html>
<html dir="${dir}" lang="${isAr ? 'ar' : 'en'}">
<head>
<meta charset="utf-8" />
<title>${esc(L.title)} - ${esc(patientName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Tahoma, Arial, sans-serif; color: #1a1a1a; padding: 40px; }
  .rx-symbol { font-size: 42px; font-weight: 800; color: #2d8b7f; }
  h1 { margin: 0; font-size: 22px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2d8b7f; padding-bottom: 16px; margin-bottom: 20px; }
  .meta { margin: 4px 0; font-size: 14px; }
  .meta b { display: inline-block; min-width: 90px; }
  .section-title { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #2d8b7f; margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: ${isAr ? 'right' : 'left'}; padding: 8px 10px; border-bottom: 1px solid #e5e5e5; }
  th { background: #f3faf8; }
  .box { background: #f7f7f7; border-radius: 8px; padding: 12px 14px; font-size: 14px; }
  .foot { margin-top: 40px; font-size: 12px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <h1>${esc(L.title)}</h1>
      <div class="meta" style="color:#2d8b7f;font-weight:700">${esc(L.clinic)}</div>
    </div>
    <div class="rx-symbol">℞</div>
  </div>

  <div class="meta"><b>${esc(L.patient)}:</b> ${esc(patientName)}</div>
  <div class="meta"><b>${esc(L.doctor)}:</b> ${esc(doctorName)}</div>
  <div class="meta"><b>${esc(L.date)}:</b> ${esc(rx.prescribed_date || '')}</div>

  ${rx.diagnosis ? `<div class="section-title">${esc(L.diagnosis)}</div><div class="box">${esc(rx.diagnosis)}</div>` : ''}

  <div class="section-title">${esc(L.meds)}</div>
  <table>
    <thead><tr><th>${esc(L.meds)}</th><th>${esc(L.dosage)}</th><th>${esc(L.instructions)}</th></tr></thead>
    <tbody>${medRows}</tbody>
  </table>

  ${rx.instructions ? `<div class="section-title">${esc(L.instructions)}</div><div class="box">${esc(rx.instructions)}</div>` : ''}

  <div class="foot">UrClinic — ${esc(rx.prescribed_date || '')}</div>

  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) {
    console.warn('Prescription PDF window was blocked by the browser pop-up policy.');
    return false;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
