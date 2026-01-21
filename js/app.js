/**
 * ExpenseTracker PWA - Main Application
 */

// PWA Install prompt
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Show install banner if not already installed
  const banner = document.getElementById('install-banner');
  if (banner && !window.matchMedia('(display-mode: standalone)').matches) {
    banner.classList.remove('hidden');
  }
});

// Global app state
const App = {
  currentView: 'home',
  isOnline: navigator.onLine,
  db: null,

  async init() {
    try {
      // Register service worker
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW registered:', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.showToast('Update available! Refresh to update.', 'success');
            }
          });
        });
      }

      // Initialize IndexedDB
      this.db = await DB.init();

      // Initialize UI
      if (typeof UI !== 'undefined') {
        UI.init();
      }

      // Initialize modules
      if (typeof Camera !== 'undefined') await Camera.init();
      if (typeof Expenses !== 'undefined') await Expenses.init();
      if (typeof People !== 'undefined') await People.init();
      if (typeof Settlement !== 'undefined') await Settlement.init();
      if (typeof Sync !== 'undefined') await Sync.init();

      // Setup network listeners
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.showToast('Back online', 'success');
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.showToast('You\'re offline', 'error');
      });

      // Setup install button
      this.setupInstallButton();

      // Hide loading screen
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('nav').classList.remove('hidden');

      // Check URL for view parameter
      const urlParams = new URLSearchParams(window.location.search);
      const viewParam = urlParams.get('view');
      
      // Load initial view
      this.navigateTo(viewParam || 'home');

      console.log('ExpenseTracker ready');

    } catch (error) {
      console.error('Init failed:', error);
      document.getElementById('loading').innerHTML = `
        <p style="color: white; text-align: center; padding: 20px;">
          Failed to load app.<br>Please refresh the page.
        </p>
      `;
    }
  },

  setupInstallButton() {
    const installBtn = document.getElementById('install-btn');
    const dismissBtn = document.getElementById('install-dismiss');
    const banner = document.getElementById('install-banner');

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          console.log('Install outcome:', outcome);
          deferredPrompt = null;
          banner.classList.add('hidden');
        }
      });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        banner.classList.add('hidden');
        localStorage.setItem('installDismissed', 'true');
      });
    }

    // Don't show if already dismissed
    if (localStorage.getItem('installDismissed')) {
      banner?.classList.add('hidden');
    }
  },

  navigateTo(view) {
    this.currentView = view;

    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Load the view
    UI.loadView(view);

    // Update URL without reload
    const url = new URL(window.location);
    if (view === 'home') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', view);
    }
    window.history.replaceState({}, '', url);
  },

  showError(message) {
    this.showToast(message, 'error');
  },

  showSuccess(message) {
    this.showToast(message, 'success');
  },

  showToast(message, type = 'success') {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}

// Handle app installed event
window.addEventListener('appinstalled', () => {
  console.log('App installed');
  deferredPrompt = null;
  document.getElementById('install-banner')?.classList.add('hidden');
});
