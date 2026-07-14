const LEGACY_USER_STORAGE_KEY = 'user';
const USER_DISPLAY_CACHE_KEY = 'urclinic_user_display_cache';

export const getStoredUser = () => {
  // Authorization must never be reconstructed from browser storage.
  // Keep this compatibility export non-authoritative and clear the legacy key
  // that used to contain role, clinic_id, status, and other protected fields.
  clearStoredUser();
  return null;
};

export const setStoredUser = (user) => {
  try {
    localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
    localStorage.setItem(USER_DISPLAY_CACHE_KEY, JSON.stringify({
      id: user?.id || null,
      name: user?.name || user?.full_name || '',
      email: user?.email || '',
    }));
  } catch {
    // Display cache is best-effort only.
  }
};

export const clearStoredUser = () => {
  try {
    localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
    localStorage.removeItem(USER_DISPLAY_CACHE_KEY);
  } catch {
    // Browser storage may be unavailable.
  }
};
