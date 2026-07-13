import { readDemoFlag } from './demoStorage';

export const isDemoModeEnabled = (user = null) =>
  Boolean(user?.isDemo || user?.is_demo || user?.demoMode || user?.role === 'demo' || readDemoFlag('mode'));
