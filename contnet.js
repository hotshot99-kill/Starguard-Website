// CyberGuard Pro - Content Script

class CyberGuardContent {
  constructor() {
    this.modules = {
      adblock: true,
      privacy: true,
      phishing: true,
      password: true,
      malware: true,
      identity: true,
      camera: true,
      restrictions: true
    };

    this.stats = {
      adsBlocked: 0,
      trackersBlocked: 0,
      formsProtected: 0,
      passwordsChecked: 0
    };

    this.observers = [];
    this.blockedElements = new Set();
    this.passwordFields = new Map();
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupMessageListener();
    this.blockMediaAccess();
    this.setupPasswordChecker();
    this.setupFormProtection();
    this.setupAdBlocker();
    this.setupPrivacyAnalyzer();
    this.createFloatingPanel();
    this.startMonitoring();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['cyberguard_modules']);
      if (result.cyberguard_modules) {
        Object.keys(this.modules).forEach(key => {
          if (result.cyberguard_modules[key]) {
            this.modules[key] = result.cyberguard_modules[key].enabled;
          }
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'performQuickScan':
        this.performQuickScan().then(sendResponse);
        break;
      case 'analyzePrivacy':
        this.analyzePrivacy().then(sendResponse);
        break;
      case 'moduleToggled':
        this.modules[message.module] = message.enabled;
        if (message.module === 'adblock') {
          this.toggleAdBlocker(message.enabled);
        }
        sendResponse({ success: true });
        break;
      case 'adBlocked':
        this.showNotification('Ad blocked', '🛡️', 'success');
        this.updateFloatingPanel('ads', 1);
        break;
      case 'trackerBlocked':
        this.showNotification('Tracker blocked', '🕵️', 'success');
        this.updateFloatingPanel('trackers', 1);
        break;
      case 'updatePrivacyScore':
        this.updatePrivacyScore(message.hasSecurityHeaders, message.headers);
        break;
      default:
        sendResponse({ error: 'Unknown action' });
    }
  }

  blockMediaAccess() {
    if (!this.modules.camera) return;

    // Override getUserMedia
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      // Show permission request
      const allowed = await this.showMediaPermissionDialog(constraints);
      
      if (!allowed) {
        this.showNotification('Camera/microphone access blocked', '🎥', 'warning');
        throw new Error('Media access denied by CyberGuard');
      }
      
      return originalGetUserMedia(constraints);
    };
  }

  async showMediaPermissionDialog(constraints) {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.innerHTML = `
        <div style="
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          font-family: 'Segoe UI', sans-serif;
        " id="cyberguard-media-dialog">
          <div style="
            background: white;
            padding: 30px;
            border-radius: 16px;
            text-align: center;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          ">
            <div style="font-size: 48px; margin-bottom: 16px;">🎥</div>
            <h2 style="margin-bottom: 16px; color: #333;">Media Access Request</h2>
            <p style="margin-bottom: 24px; color: #666; line-height: 1.6;">
              This website wants to access your ${constraints.video ? 'camera' : ''} ${constraints.video && constraints.audio ? 'and' : ''} ${constraints.audio ? 'microphone' : ''}. 
              Only allow if you trust this site.
            </p>
            <div>
              <button id="allow-media" style="
                background: linear-gradient(135deg, #00C4CC, #00FF88);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                margin-right: 12px;
              ">Allow</button>
              <button id="block-media" style="
                background: linear-gradient(135deg, #FF4757, #FF6B9D);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
              ">Block</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);

      document.getElementById('allow-media').onclick = () => {
        dialog.remove();
        resolve(true);
      };

      document.getElementById('block-media').onclick = () => {
        dialog.remove();
        resolve(false);
      };

      // Auto-block after 10 seconds
      setTimeout(() => {
        if (document.getElementById('cyberguard-media-dialog')) {
          dialog.remove();
          resolve(false);
        }
      }, 10000);
    });
  }

  setupPasswordChecker() {
    if (!this.modules.password) return;

    const passwordInputs = document.querySelectorAll('input[type="password"]');
    passwordInputs.forEach(input => this.attachPasswordChecker(input));

    // Watch for dynamically added password fields
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const passwordFields = node.querySelectorAll ? node.querySelectorAll('input[type="password"]') : [];
            passwordFields.forEach(field => this.attachPasswordChecker(field));
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    this.observers.push(observer);
  }

  attachPasswordChecker(input) {
    if (this.passwordFields.has(input)) return;
    
    this.passwordFields.set(input, true);

    const strengthIndicator = this.createPasswordStrengthIndicator();
    input.parentNode.insertBefore(strengthIndicator, input.nextSibling);

    input.addEventListener('input', async (e) => {
      const password = e.target.value;
      if (password.length === 0) {
        strengthIndicator.style.display = 'none';
        return;
      }

      strengthIndicator.style.display = 'block';
      
      try {
        const result = await chrome.runtime.sendMessage({
          action: 'checkPassword',
          password: password
        });

        this.updatePasswordStrengthIndicator(strengthIndicator, result);
        this.stats.passwordsChecked++;
      } catch (error) {
        console.error('Password check failed:', error);
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        strengthIndicator.style.display = 'none';
      }, 3000);
    });
  }

  createPasswordStrengthIndicator() {
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      position: absolute;
      z-index: 999999;
      background: white;
      border: 2px solid #00C4CC;
      border-radius: 12px;
      padding: 12px 16px;
      margin-top: 4px;
      box-shadow: 0 8px 32px rgba(0, 196, 204, 0.3);
      font-family: 'Segoe UI', sans-serif;
      min-width: 250px;
      display: none;
    `;

    return indicator;
  }

  updatePasswordStrengthIndicator(indicator, result) {
    const strengthColors = {
      weak: '#FF4757',
      moderate: '#FFB84D',
      strong: '#00FF88'
    };

    const strengthEmojis = {
      weak: '❌',
      moderate: '⚠️',
      strong: '✅'
    };

    indicator.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 16px; margin-right: 8px;">${strengthEmojis[result.strength]}</span>
        <strong style="color: ${strengthColors[result.strength]};">
          ${result.strength.toUpperCase()} (${result.score}%)
        </strong>
      </div>
      <div style="background: #f0f0f0; height: 6px; border-radius: 3px; margin-bottom: 8px;">
        <div style="
          background: linear-gradient(135deg, ${strengthColors[result.strength]}, ${strengthColors[result.strength]}88);
          height: 100%;
          width: ${result.score}%;
          border-radius: 3px;
          transition: width 0.3s ease;
        "></div>
      </div>
      ${result.issues.length > 0 ? `
        <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
          Issues: ${result.issues.slice(0, 2).join(', ')}
        </div>
      ` : ''}