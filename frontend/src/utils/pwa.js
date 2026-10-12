// ── PWA Registration ───────────────────────────────────────

export const registerSW = async () => {
    if (!('serviceWorker' in navigator)) {
      console.log('Service workers not supported');
      return;
    }
  
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('Service worker registered:', reg.scope);
  
      // Listen for messages from service worker (e.g. flush queue)
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'FLUSH_QUEUE') {
          window.dispatchEvent(new CustomEvent('zammarket:flush-queue'));
        }
      });
  
      return reg;
    } catch (err) {
      console.error('SW registration failed:', err.message);
    }
  };
  
  // Request background sync when back online
  export const requestSync = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      if ('sync' in reg) {
        await reg.sync.register('zammarket-sync-messages');
      }
    } catch (err) {
      console.warn('Background sync not available:', err.message);
    }
  };
  
  // Chrome fires "beforeinstallprompt" once, soon after the page loads,
  // usually before the user reaches the dashboard. Keep it for later.
  let installPrompt = null;
  const installListeners = new Set();
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      installPrompt = e;
      installListeners.forEach((fn) => fn(e));
    });
    window.addEventListener('appinstalled', () => {
      installPrompt = null;
      installListeners.forEach((fn) => fn(null));
    });
  }
  export const getInstallPrompt = () => installPrompt;
  export const onInstallPrompt = (fn) => {
    installListeners.add(fn);
    return () => installListeners.delete(fn);
  };

  // Check if app is installed as PWA
  export const isPWA = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;