/**
 * ExpenseTracker PWA - Main Application
 */

// Global app state
const App = {
  currentView: 'home',
  isOnline: navigator.onLine,
  db: null,
  peer: null,

  // Initialize the application
  async init() {
    try {
      // Register service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('SW registered:', registration);
          })
          .catch(error => {
            console.log('SW registration failed:', error);
          });
      }

      // Initialize IndexedDB
      this.db = await DB.init();

      // Initialize UI
      if (typeof UI !== 'undefined') {
        UI.init();
      } else {
        throw new Error('UI module not loaded');
      }

      // Initialize modules
      await Camera.init();
      await Expenses.init();
      await People.init();
      await Settlement.init();
      await Sync.init();

      // Setup network listeners
      window.addEventListener('online', () => {
        this.isOnline = true;
        UI.updateOnlineStatus(true);
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        UI.updateOnlineStatus(false);
      });

      // Hide loading screen and show app
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('nav').classList.remove('hidden');

      // Load initial view
      this.navigateTo('home');

      console.log('ExpenseTracker initialized successfully');

    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('Failed to initialize the app. Please refresh and try again.');
    }
  },

  // Navigate to a specific view
  navigateTo(view) {
    this.currentView = view;

    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Load the view
    UI.loadView(view);
  },

  // Show error message
  showError(message) {
    this.showToast(message, 'error');
  },

  // Show success message
  showSuccess(message) {
    this.showToast(message, 'success');
  },

  // Show toast notification
  showToast(message, type = 'success') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Auto remove after delay
    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, duration);
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Wait for all scripts to load
  window.addEventListener('load', () => {
    App.init();
  });
});

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  App.showError('An unexpected error occurred. Please try again.');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  App.showError('An unexpected error occurred. Please try again.');
});
