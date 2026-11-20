import { watchActionBarClearance } from '../shared/lib/action-bar-clearance';
import { watchTouchTooltips } from '../shared/lib/touch-tooltip';
import '../styles/app.css';

export function initializeShell() {
  const stopClearance = watchActionBarClearance();
  const stopTooltips = watchTouchTooltips();
  import.meta.hot?.dispose(() => {
    stopClearance();
    stopTooltips();
  });
  if (import.meta.env.PROD && window.isSecureContext && 'serviceWorker' in navigator) {
    void navigator.serviceWorker
      .register('/picopos-service-worker.js', { updateViaCache: 'none' })
      .catch(() => {});
  }
}
