/**
 * Expense Tracker PWA - Main App
 */

let deferredPrompt = null;
let newWorker = null;

// PWA Install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  const banner = document.getElementById('install-banner');
  if (banner && !window.matchMedia('(display-mode: standalone)').matches) {
    banner.classList.remove('hidden');
  }
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  document.getElementById('install-banner')?.classList.add('hidden');
});

const App = {
  currentView: 'home',
  isOnline: navigator.onLine,

  async init() {
    try {
      // Register service worker with update handling
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.register('./sw.js');
          console.log('SW registered');
          
          // Check for updates on page load
          reg.update();
          
          // Check for updates periodically (every 30 min)
          setInterval(() => reg.update(), 30 * 60 * 1000);
          
          reg.addEventListener('updatefound', () => {
            newWorker = reg.installing;
            
            newWorker?.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                this.showUpdateBanner();
              }
            });
          });

          // Handle controller change (when new SW takes over)
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
          });

        } catch (e) {
          console.warn('SW registration failed:', e);
        }
      }

      // Initialize database
      await DB.init();

      // Initialize settings first
      Settings.init();

      // Initialize modules
      UI.init();
      await Camera.init();
      await Expenses.init();
      await People.init();
      await Settlement.init();
      await Sync.init();

      // Apply mode settings to navigation
      Settings.updateNavigation();

      // Network status
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.showToast('Back online', 'success');
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.showToast('Offline mode', 'error');
      });

      // Setup install button
      this.setupInstall();

      // Hide loading, show app
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('nav').classList.remove('hidden');

      // Load initial view
      this.navigateTo('home');

      console.log('App ready');

    } catch (e) {
      console.error('Init failed:', e);
      document.getElementById('loading').innerHTML = 
        '<p style="color:white;padding:20px;text-align:center;">Failed to load. Please refresh.</p>';
    }
  },

  showUpdateBanner() {
    // Remove existing update banner
    document.getElementById('update-banner')?.remove();

    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.className = 'update-banner';
    banner.innerHTML = `
      <span>New version available</span>
      <button id="update-btn">Update Now</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('update-btn').onclick = () => {
      this.applyUpdate();
    };
  },

  applyUpdate() {
    if (newWorker) {
      // Tell the new SW to skip waiting and take over
      newWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  },

  setupInstall() {
    const installBtn = document.getElementById('install-btn');
    const dismissBtn = document.getElementById('install-dismiss');
    const banner = document.getElementById('install-banner');

    installBtn?.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        console.log('Install:', result.outcome);
        deferredPrompt = null;
        banner?.classList.add('hidden');
      }
    });

    dismissBtn?.addEventListener('click', () => {
      banner?.classList.add('hidden');
      localStorage.setItem('installDismissed', '1');
    });

    if (localStorage.getItem('installDismissed')) {
      banner?.classList.add('hidden');
    }
  },

  navigateTo(view) {
    this.currentView = view;

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Load view
    UI.loadView(view);
  },

  showError(msg) {
    this.showToast(msg, 'error');
  },

  showSuccess(msg) {
    this.showToast(msg, 'success');
  },

  showToast(msg, type = 'success') {
    // Remove existing
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }
};

// Start app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
