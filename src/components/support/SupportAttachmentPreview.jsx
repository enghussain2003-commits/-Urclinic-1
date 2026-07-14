import { useEffect, useMemo } from 'react';
import { FileText, Image, Paperclip, X } from 'lucide-react';
import { formatSupportFileSize } from '../../services/supportService';

const SupportAttachmentPreview = ({ file, isAr, phase = 'idle', onRemove, disabled = false }) => {
  const previewUrl = useMemo(() => {
    if (!file || !String(file.type || '').startsWith('image/')) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  if (!file) return null;

  const isImage = String(file.type || '').startsWith('image/');
  const phaseLabel = {
    uploading: isAr ? 'جارٍ رفع المرفق...' : 'Uploading attachment...',
    sending: isAr ? 'جارٍ إرسال الرد...' : 'Sending reply...',
    hydrating: isAr ? 'جارٍ تأكيد المرفق...' : 'Confirming attachment...',
    done: isAr ? 'تم الإرسال' : 'Sent',
  }[phase] || (isAr ? 'جاهز للإرسال' : 'Ready to send');

  return (
    <div className={`support-file-preview ${disabled ? 'is-disabled' : ''}`}>
      <div className="support-file-preview__thumb">
        {previewUrl ? <img src={previewUrl} alt="" /> : (isImage ? <Image size={20} /> : <FileText size={20} />)}
      </div>
      <div className="support-file-preview__meta">
        <strong title={file.name}>{file.name}</strong>
        <span>
          <Paperclip size={13} />
          {file.type || (isAr ? 'ملف' : 'File')} · {formatSupportFileSize(file.size, isAr)}
        </span>
        <em>{phaseLabel}</em>
      </div>
      {onRemove && (
        <button type="button" onClick={onRemove} disabled={disabled} aria-label={isAr ? 'إزالة المرفق' : 'Remove attachment'}>
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default SupportAttachmentPreview;
