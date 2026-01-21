/**
 * Expense Tracker PWA - Main App
 */

let deferredPrompt = null;

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
      // Register service worker
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.register('./sw.js');
          console.log('SW registered');
          
          reg.addEventListener('updatefound', () => {
            const newSW = reg.installing;
            newSW?.addEventListener('statechange', () => {
              if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                this.showToast('Update available - refresh to update', 'success');
              }
            });
          });
        } catch (e) {
          console.warn('SW registration failed:', e);
        }
      }

      // Initialize database
      await DB.init();

      // Initialize modules
      UI.init();
      await Camera.init();
      await Expenses.init();
      await People.init();
      await Settlement.init();
      await Sync.init();

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
