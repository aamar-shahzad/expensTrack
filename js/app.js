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

      // Initialize accounts first
      Accounts.init();
      
      // Check if new user (no accounts) - show onboarding
      if (Accounts.accounts.length === 0) {
        document.getElementById('loading').classList.add('hidden');
        this.showOnboarding();
        console.log('New user - showing onboarding');
        return;
      }
      
      // Initialize database for current account
      await DB.init(Accounts.currentAccountId);

      // Initialize settings from current account
      const currentAccount = Accounts.getCurrentAccount();
      Settings.init();
      if (currentAccount) {
        Settings.setCurrency(currentAccount.currency);
        Settings.setMode(currentAccount.mode);
      }

      // Initialize modules
      UI.init();
      await Camera.init();
      await Expenses.init();
      await People.init();
      await Settlement.init();
      await Sync.init();

      // Process recurring expenses
      await this.processRecurringExpenses();

      // Apply mode settings to navigation
      Settings.updateNavigation();

      // Network status
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.updateOfflineIndicator();
        this.showToast('Back online', 'success');
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.updateOfflineIndicator();
        this.showToast('Offline mode', 'error');
      });
      
      // Initial offline check
      this.updateOfflineIndicator();

      // Setup install button
      this.setupInstall();

      // Hide loading, show app
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('nav').classList.remove('hidden');
      document.getElementById('fab-add')?.classList.remove('hidden');

      // Load initial view
      this.navigateTo('home');
      
      // Show onboarding for first-time users
      if (!localStorage.getItem('et_onboarded')) {
        setTimeout(() => this.showOnboarding(), 500);
      }
      
      // Check for pending connection (from join flow)
      const pendingConnect = localStorage.getItem('et_pendingConnect');
      if (pendingConnect) {
        localStorage.removeItem('et_pendingConnect');
        setTimeout(() => {
          this.navigateTo('sync');
          setTimeout(() => {
            Sync.connectToDevice(pendingConnect);
            this.showToast('Connecting to sync partner...', 'info');
          }, 1000);
        }, 500);
      }

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
    // Skip if same view
    if (this.currentView === view && view !== 'home') return;
    
    const previousView = this.currentView;
    this.currentView = view;

    // Update nav buttons with haptic
    document.querySelectorAll('.nav-btn').forEach(btn => {
      const wasActive = btn.classList.contains('active');
      const isActive = btn.dataset.view === view;
      btn.classList.toggle('active', isActive);
      
      // Haptic on tab change
      if (isActive && !wasActive) {
        this.haptic('light');
      }
    });

    // Show/hide FAB (only on home view)
    const fab = document.getElementById('fab-add');
    if (fab) {
      fab.classList.toggle('hidden', view !== 'home');
    }

    // Page transition animation
    const main = document.getElementById('main-content');
    if (main && previousView !== view) {
      main.classList.add('page-transition');
      setTimeout(() => main.classList.remove('page-transition'), 200);
    }

    // Load view
    UI.loadView(view);
  },

  showError(msg) {
    this.haptic('error');
    this.showToast(msg, 'error');
  },

  showSuccess(msg) {
    this.haptic('success');
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
  },

  // Loading states
  showLoading(text = 'Loading...') {
    this.hideLoading();
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'app-loading';
    overlay.innerHTML = `
      <div style="text-align:center">
        <div class="loading-spinner"></div>
        <div class="loading-text">${text}</div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  hideLoading() {
    document.getElementById('app-loading')?.remove();
  },

  // Button loading state
  setButtonLoading(btn, loading = true) {
    if (!btn) return;
    if (loading) {
      btn.classList.add('btn-loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
    }
  },

  // Haptic feedback
  haptic(type = 'light') {
    if ('vibrate' in navigator) {
      switch(type) {
        case 'success': navigator.vibrate(10); break;
        case 'error': navigator.vibrate([10, 50, 10]); break;
        default: navigator.vibrate(5);
      }
    }
  },

  // Offline indicator
  updateOfflineIndicator() {
    let indicator = document.getElementById('offline-indicator');
    
    if (!navigator.onLine) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.className = 'offline-indicator';
        indicator.innerHTML = '📴 Offline';
        document.body.appendChild(indicator);
      }
    } else {
      indicator?.remove();
    }
  },

  // Show onboarding for new users
  showOnboarding() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="onboarding">
        <div class="onboarding-header">
          <div class="onboarding-icon">💰</div>
          <h1>Welcome to Expense Tracker</h1>
          <p>Track expenses, split bills, and settle up with friends</p>
        </div>
        
        <div class="onboarding-section">
          <h2>Get Started</h2>
          <p class="onboarding-hint">Choose how you want to begin:</p>
          
          <div class="account-type-cards">
            <div class="account-type-card" id="create-private">
              <div class="account-type-icon">👤</div>
              <div class="account-type-name">Personal</div>
              <div class="account-type-desc">Track your own expenses privately</div>
            </div>
            
            <div class="account-type-card" id="create-shared">
              <div class="account-type-icon">👥</div>
              <div class="account-type-name">New Group</div>
              <div class="account-type-desc">Create a shared account to split with others</div>
            </div>
            
            <div class="account-type-card highlight" id="join-existing">
              <div class="account-type-icon">🔗</div>
              <div class="account-type-name">Join Group</div>
              <div class="account-type-desc">Someone invited you? Join their shared account</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Handle private account creation
    document.getElementById('create-private').onclick = () => {
      this.showAccountNamePrompt('single');
    };

    // Handle shared account creation
    document.getElementById('create-shared').onclick = () => {
      this.showAccountNamePrompt('shared');
    };
    
    // Handle join existing
    document.getElementById('join-existing').onclick = () => {
      this.showJoinAccountFlow();
    };
  },
  
  // Show join account flow for new users
  showJoinAccountFlow() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <button class="sheet-cancel" onclick="this.closest('.modal-overlay').remove()">Back</button>
          <span class="sheet-title">Join Shared Account</span>
          <span></span>
        </div>
        <div class="sheet-body">
          <div class="join-instructions">
            <div class="join-step">
              <div class="join-step-num">1</div>
              <div class="join-step-text">Ask the account owner for their <strong>6-letter ID</strong> or <strong>QR code</strong></div>
            </div>
            <div class="join-step">
              <div class="join-step-num">2</div>
              <div class="join-step-text">Enter the ID below or scan their QR code</div>
            </div>
            <div class="join-step">
              <div class="join-step-num">3</div>
              <div class="join-step-text">All expenses will sync automatically</div>
            </div>
          </div>
          
          <div class="form-group" style="margin-top:20px">
            <label>Enter their Device ID</label>
            <input type="text" id="join-device-id" placeholder="e.g. ABC123" maxlength="6" style="text-transform:uppercase;text-align:center;font-size:24px;letter-spacing:4px;font-weight:700">
          </div>
          
          <div style="text-align:center;margin:16px 0;color:var(--text-secondary)">or</div>
          
          <button class="btn-secondary" id="join-scan-qr" style="width:100%;margin-bottom:16px">
            📷 Scan QR Code
          </button>
          
          <button class="btn-primary" id="join-connect-btn">Connect & Join</button>
          
          <p class="join-note">You'll create a local account that syncs with theirs. Your name will be added to the group.</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus input
    setTimeout(() => document.getElementById('join-device-id').focus(), 300);
    
    // Scan QR
    document.getElementById('join-scan-qr').onclick = () => {
      modal.remove();
      this.showJoinQRScanner();
    };
    
    // Connect button
    document.getElementById('join-connect-btn').onclick = async () => {
      const deviceId = document.getElementById('join-device-id').value.trim().toUpperCase();
      if (!deviceId || deviceId.length < 4) {
        this.showError('Enter a valid device ID');
        return;
      }
      
      modal.remove();
      await this.joinWithDeviceId(deviceId);
    };
    
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  },
  
  // QR Scanner for joining
  showJoinQRScanner() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="qr-scanner-modal">
        <div class="qr-scanner-header">
          <button class="qr-close" id="qr-close">✕</button>
          <span>Scan QR Code</span>
        </div>
        <div class="qr-scanner-body">
          <video id="qr-video" autoplay playsinline></video>
          <div class="qr-overlay">
            <div class="qr-frame"></div>
          </div>
        </div>
        <div class="qr-scanner-hint">Point camera at the QR code shown on their device</div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const video = document.getElementById('qr-video');
    let stream = null;
    let scanning = true;
    
    // Start camera
    navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    }).then(s => {
      stream = s;
      video.srcObject = stream;
      this.scanQRCode(video, (result) => {
        if (!scanning) return;
        
        // Check if it's our format
        if (result.startsWith('EXPENSE-SYNC:')) {
          scanning = false;
          const deviceId = result.replace('EXPENSE-SYNC:', '');
          stream.getTracks().forEach(t => t.stop());
          modal.remove();
          this.joinWithDeviceId(deviceId);
        }
      });
    }).catch(err => {
      console.error('Camera error:', err);
      this.showError('Could not access camera');
      modal.remove();
      this.showJoinAccountFlow();
    });
    
    document.getElementById('qr-close').onclick = () => {
      scanning = false;
      if (stream) stream.getTracks().forEach(t => t.stop());
      modal.remove();
      this.showJoinAccountFlow();
    };
  },
  
  // Scan QR code from video
  scanQRCode(video, onResult) {
    if (typeof jsQR === 'undefined') {
      console.warn('jsQR not loaded');
      return;
    }
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const scan = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          onResult(code.data);
          return;
        }
      }
      requestAnimationFrame(scan);
    };
    
    scan();
  },
  
  // Join with device ID
  async joinWithDeviceId(deviceId) {
    // Show loading
    this.showToast('Connecting...', 'info');
    
    // First create a shared account for this user
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <span></span>
          <span class="sheet-title">Almost there!</span>
          <span></span>
        </div>
        <div class="sheet-body">
          <p style="text-align:center;margin-bottom:20px">Enter your name so others know who you are:</p>
          
          <div class="form-group">
            <label>Your Name</label>
            <input type="text" id="join-user-name" placeholder="e.g. John" maxlength="30">
          </div>
          
          <div class="form-group">
            <label>Account Name (optional)</label>
            <input type="text" id="join-account-name" placeholder="e.g. Roommates, Trip" maxlength="30">
          </div>
          
          <button class="btn-primary" id="join-finish-btn">Join & Sync</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('join-user-name').focus(), 300);
    
    document.getElementById('join-finish-btn').onclick = async () => {
      const userName = document.getElementById('join-user-name').value.trim();
      const accountName = document.getElementById('join-account-name').value.trim() || 'Shared Expenses';
      
      if (!userName) {
        this.showError('Enter your name');
        return;
      }
      
      try {
        // Create shared account
        const account = Accounts.createAccount(accountName, 'shared', '$');
        Accounts.setCurrentAccount(account.id);
        
        // Add self as a person
        await DB.addPerson({ name: userName });
        
        // Mark as onboarded
        localStorage.setItem('et_onboarded', 'true');
        
        // Store the device to connect to
        localStorage.setItem('et_pendingConnect', deviceId);
        
        modal.remove();
        
        this.showSuccess('Account created! Syncing...');
        
        // Reload and connect
        setTimeout(() => location.reload(), 500);
        
      } catch (e) {
        console.error('Join failed:', e);
        this.showError('Failed to create account');
      }
    };
  },

  showAccountNamePrompt(mode) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <button class="sheet-cancel" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <span class="sheet-title">Name Your Account</span>
          <button class="sheet-save" id="save-first-account">Create</button>
        </div>
        <div class="sheet-body">
          <div class="input-group">
            <label>Account Name</label>
            <input type="text" id="first-account-name" placeholder="${mode === 'single' ? 'e.g., Personal, My Expenses' : 'e.g., Family, Roommates, Trip'}" autocomplete="off" autofocus>
          </div>
          <div class="input-group">
            <label>Currency</label>
            <select id="first-account-currency" class="form-select">
              ${Settings.currencies.map(c => `<option value="${c.symbol}">${c.symbol} - ${c.name}</option>`).join('')}
            </select>
          </div>
          <p style="font-size:13px;color:#667781;margin-top:12px">
            ${mode === 'single' 
              ? '👤 Private account - only you can see this data' 
              : '👥 Shared account - you can add people and sync with other devices'}
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    setTimeout(() => document.getElementById('first-account-name').focus(), 100);

    document.getElementById('save-first-account').onclick = async () => {
      const name = document.getElementById('first-account-name').value.trim();
      const currency = document.getElementById('first-account-currency').value;

      if (!name) {
        this.showError('Enter a name for your account');
        return;
      }

      // Create the account
      const account = Accounts.createAccount(name, mode, currency);
      Accounts.setCurrentAccount(account.id);
      localStorage.setItem('et_onboarded', 'true');
      
      modal.remove();
      
      // Show feature tour before reload
      this.showFeatureTour(mode);
    };
  },

  showFeatureTour(mode) {
    const isShared = mode === 'shared';
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="tour-modal">
        <div class="tour-slides">
          <div class="tour-slide active" data-slide="0">
            <div class="tour-icon">📝</div>
            <h3>Track Expenses</h3>
            <p>Add expenses quickly with the + button. Snap receipts to auto-fill amounts!</p>
          </div>
          <div class="tour-slide" data-slide="1">
            <div class="tour-icon">📊</div>
            <h3>See Insights</h3>
            <p>View spending trends, category breakdowns, and monthly comparisons.</p>
          </div>
          ${isShared ? `
          <div class="tour-slide" data-slide="2">
            <div class="tour-icon">👥</div>
            <h3>Split & Settle</h3>
            <p>Add people, split expenses, and see who owes what. Mark payments as settled!</p>
          </div>
          <div class="tour-slide" data-slide="3">
            <div class="tour-icon">🔄</div>
            <h3>Sync Devices</h3>
            <p>Connect with others using QR codes. All expenses sync automatically!</p>
          </div>
          ` : `
          <div class="tour-slide" data-slide="2">
            <div class="tour-icon">💾</div>
            <h3>Backup Data</h3>
            <p>Export your data anytime from Settings. Never lose your expense history!</p>
          </div>
          `}
        </div>
        <div class="tour-dots">
          <span class="tour-dot active" data-dot="0"></span>
          <span class="tour-dot" data-dot="1"></span>
          <span class="tour-dot" data-dot="2"></span>
          ${isShared ? '<span class="tour-dot" data-dot="3"></span>' : ''}
        </div>
        <div class="tour-buttons">
          <button class="tour-skip" id="tour-skip">Skip</button>
          <button class="tour-next btn-primary" id="tour-next">Next</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    let currentSlide = 0;
    const totalSlides = isShared ? 4 : 3;
    
    const updateSlide = () => {
      modal.querySelectorAll('.tour-slide').forEach((s, i) => {
        s.classList.toggle('active', i === currentSlide);
      });
      modal.querySelectorAll('.tour-dot').forEach((d, i) => {
        d.classList.toggle('active', i === currentSlide);
      });
      
      const nextBtn = modal.querySelector('#tour-next');
      nextBtn.textContent = currentSlide === totalSlides - 1 ? 'Get Started' : 'Next';
    };
    
    modal.querySelector('#tour-next').onclick = () => {
      if (currentSlide < totalSlides - 1) {
        currentSlide++;
        updateSlide();
      } else {
        modal.remove();
        this.showSuccess('Account created!');
        setTimeout(() => location.reload(), 500);
      }
    };
    
    modal.querySelector('#tour-skip').onclick = () => {
      modal.remove();
      this.showSuccess('Account created!');
      setTimeout(() => location.reload(), 500);
    };
    
    modal.querySelectorAll('.tour-dot').forEach(dot => {
      dot.onclick = () => {
        currentSlide = parseInt(dot.dataset.dot);
        updateSlide();
      };
    });

    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  },

  // Process recurring expenses - auto-add for current month if not exists
  async processRecurringExpenses() {
    try {
      const expenses = await DB.getExpenses();
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      
      // Find recurring expenses (look at all months to find recurring ones)
      const recurringExpenses = expenses.filter(e => e.recurring === 'monthly');
      
      // Group by description + payerId to find unique recurring expenses
      const recurringMap = new Map();
      recurringExpenses.forEach(e => {
        const key = `${e.description}|${e.payerId}|${e.amount}`;
        if (!recurringMap.has(key)) {
          recurringMap.set(key, e);
        }
      });
      
      // Check each recurring expense to see if it exists for current month
      let addedCount = 0;
      for (const [key, template] of recurringMap) {
        const existsThisMonth = expenses.some(e => 
          e.description === template.description &&
          e.payerId === template.payerId &&
          e.amount === template.amount &&
          e.date.startsWith(currentMonthStr)
        );
        
        if (!existsThisMonth) {
          // Add this recurring expense for current month
          const day = template.date.split('-')[2] || '01';
          const newDate = `${currentMonthStr}-${day}`;
          
          await DB.addExpense({
            description: template.description,
            amount: template.amount,
            date: newDate,
            payerId: template.payerId,
            splitType: template.splitType || 'equal',
            splitDetails: template.splitDetails,
            recurring: 'monthly'
          });
          addedCount++;
        }
      }
      
      if (addedCount > 0) {
        console.log(`Added ${addedCount} recurring expense(s) for this month`);
      }
    } catch (e) {
      console.error('Failed to process recurring expenses:', e);
    }
  }
};

// Start app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
