export const DEMO_STORAGE_PREFIX = 'urclinic_demo_';

const demoKey = (key) => `${DEMO_STORAGE_PREFIX}${key}`;

export const readDemoJson = (key, fallback) => {
  try {
    const stored = localStorage.getItem(demoKey(key));
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

export const writeDemoJson = (key, value) => {
  try {
    localStorage.setItem(demoKey(key), JSON.stringify(value));
  } catch {
    // Demo storage is best-effort only.
  }
};

export const removeDemoItem = (key) => {
  try {
    localStorage.removeItem(demoKey(key));
  } catch {
    // Demo storage is best-effort only.
  }
};

export const readDemoFlag = (key) => {
  try {
    return localStorage.getItem(demoKey(key)) === 'true';
  } catch {
    return false;
  }
};
