import { readDemoFlag } from './demoStorage';

export const isDemoModeEnabled = (user = null) =>
  Boolean(user && (user.isDemo || user.is_demo || user.demoMode || user.role === 'demo' || (import.meta.env.DEV && readDemoFlag('mode'))));
