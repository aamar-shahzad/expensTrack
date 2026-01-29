/**
 * Camera and Image Capture Module
 * - Compresses images to max 800px for storage efficiency
 * - Creates thumbnails for list views
 */

const Camera = {
  videoElement: null,
  canvasElement: null,
  stream: null,
  capturedImage: null,
  MAX_IMAGE_SIZE: 800, // Max width/height for stored images

  async init() {
    this.videoElement = document.createElement('video');
    this.canvasElement = document.createElement('canvas');
    this.videoElement.style.display = 'none';
    this.canvasElement.style.display = 'none';
    document.body.appendChild(this.videoElement);
    document.body.appendChild(this.canvasElement);
  },

  async capturePhoto() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });

      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      this.showCameraModal();

    } catch (error) {
      console.error('Camera access failed:', error);
      App.showError('Camera access denied');
    }
  },

  showCameraModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="camera-fullscreen">
        <div class="camera-header">
          <button class="camera-close" id="camera-cancel">✕</button>
        </div>
        <div class="camera-preview-container">
          <video id="camera-preview" autoplay playsinline muted></video>
        </div>
        <div class="camera-controls">
          <div class="camera-hint">Tap button to capture photo</div>
          <button class="camera-shutter" id="take-photo">
            <div class="shutter-inner"></div>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const videoPreview = modal.querySelector('#camera-preview');
    videoPreview.srcObject = this.stream;

    modal.querySelector('#camera-cancel').onclick = () => {
      this.stopCamera();
      modal.remove();
    };

    modal.querySelector('#take-photo').onclick = () => {
      this.takePhoto();
      this.stopCamera();
      modal.remove();
    };
  },

  async takePhoto() {
    const canvas = this.canvasElement;
    const video = this.videoElement;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      try {
        // Compress the image
        const compressed = await this.compressImage(blob);
        const thumbnail = await this.createThumbnail(compressed);

        const imageData = await DB.saveImage(compressed, thumbnail);
        this.capturedImage = imageData;

        this.showImagePreview(imageData.id);
        App.showSuccess('Photo captured');
        
        // Run OCR to extract amount
        this.runOCR(compressed);

      } catch (error) {
        console.error('Failed to save photo:', error);
        App.showError('Failed to save photo');
      }
    }, 'image/jpeg', 0.8);
  },

  async chooseFromGallery() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp';
    input.capture = ''; // Prevent camera capture on mobile

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        // Compress the image before storing
        const compressed = await this.compressImage(file);
        const thumbnail = await this.createThumbnail(compressed);

        const imageData = await DB.saveImage(compressed, thumbnail);
        this.capturedImage = imageData;

        this.showImagePreview(imageData.id);
        App.showSuccess('Photo added');
        
        // Run OCR to extract amount
        this.runOCR(compressed);

      } catch (error) {
        console.error('Failed to save photo:', error);
        App.showError('Failed to save photo');
      }
    };

    input.click();
  },

  // Compress image to max size for efficient storage and sync
  async compressImage(blob) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        let { width, height } = img;

        // Only resize if larger than max
        if (width > this.MAX_IMAGE_SIZE || height > this.MAX_IMAGE_SIZE) {
          if (width > height) {
            height = (height * this.MAX_IMAGE_SIZE) / width;
            width = this.MAX_IMAGE_SIZE;
          } else {
            width = (width * this.MAX_IMAGE_SIZE) / height;
            height = this.MAX_IMAGE_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((result) => {
          URL.revokeObjectURL(img.src);
          resolve(result);
        }, 'image/jpeg', 0.7); // 70% quality for good balance
      };

      img.src = URL.createObjectURL(blob);
    });
  },

  async createThumbnail(blob) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const maxSize = 150;
        let { width, height } = img;

        if (width > height) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else {
          width = (width * maxSize) / height;
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((result) => {
          URL.revokeObjectURL(img.src);
          resolve(result);
        }, 'image/jpeg', 0.6);
      };

      img.src = URL.createObjectURL(blob);
    });
  },

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  },

  showImagePreview(imageId) {
    const preview = document.getElementById('image-preview');
    if (!preview) return;

    DB.getImage(imageId).then(img => {
      if (img && img.thumbnail) {
        const url = URL.createObjectURL(img.thumbnail);
        preview.innerHTML = `
          <img src="${url}" alt="Receipt">
          <span>📎 Receipt attached</span>
          <button type="button" onclick="Camera.removeImage()">Remove</button>
        `;
        preview.classList.remove('hidden');
      }
    });
  },

  removeImage(deleteFromDb = true) {
    if (this.capturedImage) {
      // Only delete from database if explicitly requested (user clicked Remove)
      // Don't delete when just clearing the preview after saving
      if (deleteFromDb) {
        DB.deleteImage(this.capturedImage.id);
      }
      this.capturedImage = null;
    }

    const preview = document.getElementById('image-preview');
    if (preview) {
      preview.innerHTML = '';
      preview.classList.add('hidden');
    }
    
    // Hide OCR status
    const ocrStatus = document.getElementById('ocr-status');
    if (ocrStatus) {
      ocrStatus.classList.add('hidden');
    }
  },

  // Run OCR to extract amount, store name, and date from receipt
  async runOCR(blob) {
    // Check if Tesseract is available
    if (typeof Tesseract === 'undefined') {
      console.log('Tesseract not loaded');
      return;
    }
    
    const ocrStatus = document.getElementById('ocr-status');
    const amountInput = document.getElementById('expense-amount');
    const descInput = document.getElementById('expense-description');
    const dateInput = document.getElementById('expense-date');
    
    if (!ocrStatus || !amountInput) {
      console.log('OCR: Missing elements');
      return;
    }
    
    try {
      console.log('OCR: Starting scan...');
      ocrStatus.innerHTML = '🔍 Scanning receipt...';
      ocrStatus.style.color = '#667781';
      ocrStatus.classList.remove('hidden');
      
      // Create URL for the blob
      const imageUrl = URL.createObjectURL(blob);
      
      // Run OCR with Tesseract.js v5 API
      const result = await Tesseract.recognize(imageUrl, 'eng', {
        logger: m => {
          console.log('OCR progress:', m.status, m.progress);
          if (m.status === 'recognizing text' && m.progress) {
            const progress = Math.round(m.progress * 100);
            ocrStatus.innerHTML = `🔍 Scanning... ${progress}%`;
          }
        }
      });
      
      URL.revokeObjectURL(imageUrl);
      
      const text = result.data.text;
      console.log('OCR: Raw text:', text);
      
      // Extract all data from receipt
      const ocrData = this.parseReceipt(text);
      console.log('OCR: Parsed data:', ocrData);
      
      // Build result display
      let resultHtml = '';
      let foundSomething = false;
      
      // Auto-fill amount
      if (ocrData.amount && !amountInput.value) {
        amountInput.value = ocrData.amount.toFixed(2);
        resultHtml += `<div>✓ Amount: ${Settings.getCurrency()}${ocrData.amount.toFixed(2)}</div>`;
        foundSomething = true;
      }
      
      // Auto-fill store name as description
      if (ocrData.storeName && descInput && !descInput.value) {
        descInput.value = ocrData.storeName;
        resultHtml += `<div>✓ Store: ${ocrData.storeName}</div>`;
        foundSomething = true;
      }
      
      // Auto-fill date if found and different from today
      if (ocrData.date && dateInput) {
        const today = new Date().toISOString().split('T')[0];
        if (dateInput.value === today) {
          dateInput.value = ocrData.date;
          resultHtml += `<div>✓ Date: ${ocrData.date}</div>`;
          foundSomething = true;
        }
      }
      
      // Show items found (for reference)
      if (ocrData.items && ocrData.items.length > 0) {
        resultHtml += `<div style="margin-top:4px;font-size:11px;color:#667781">${ocrData.items.length} item(s) detected</div>`;
      }
      
      if (foundSomething) {
        ocrStatus.innerHTML = resultHtml;
        ocrStatus.style.color = '#25d366';
      } else {
        ocrStatus.innerHTML = 'No data found in receipt';
        ocrStatus.style.color = '#667781';
      }
      
      // Hide after 10 seconds
      setTimeout(() => {
        ocrStatus.classList.add('hidden');
      }, 10000);
      
    } catch (error) {
      console.error('OCR failed:', error);
      ocrStatus.innerHTML = 'Scan failed - try again';
      ocrStatus.style.color = '#ff3b30';
      setTimeout(() => ocrStatus.classList.add('hidden'), 5000);
    }
  },

  // Parse receipt text to extract structured data
  parseReceipt(text) {
    const result = {
      amount: null,
      storeName: null,
      date: null,
      items: []
    };
    
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Extract store name (usually first few lines, all caps or prominent)
    result.storeName = this.extractStoreName(lines);
    
    // Extract date
    result.date = this.extractDate(text);
    
    // Extract amounts
    const amounts = this.extractAmounts(text);
    if (amounts.length > 0) {
      result.amount = Math.max(...amounts);
    }
    
    // Extract line items (item + price pairs)
    result.items = this.extractItems(lines);
    
    return result;
  },

  // Extract store name from receipt
  extractStoreName(lines) {
    // Common store name patterns
    const knownStores = [
      'walmart', 'target', 'costco', 'safeway', 'kroger', 'whole foods',
      'trader joe', 'aldi', 'publix', 'wegmans', 'cvs', 'walgreens',
      'starbucks', 'mcdonald', 'subway', 'chipotle', 'panera',
      'amazon', 'best buy', 'home depot', 'lowes', 'ikea',
      'tim hortons', 'dunkin', 'wendys', 'burger king', 'taco bell'
    ];
    
    // Check first 5 lines for store name
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].toLowerCase();
      
      // Check against known stores
      for (const store of knownStores) {
        if (line.includes(store)) {
          // Return properly capitalized version
          return lines[i].replace(/[^a-zA-Z0-9\s&'-]/g, '').trim();
        }
      }
      
      // Look for lines that are mostly uppercase (store names often are)
      const upperCount = (lines[i].match(/[A-Z]/g) || []).length;
      const letterCount = (lines[i].match(/[a-zA-Z]/g) || []).length;
      
      if (letterCount > 3 && upperCount / letterCount > 0.7) {
        // Clean up the store name
        const cleaned = lines[i]
          .replace(/[^a-zA-Z0-9\s&'-]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (cleaned.length >= 3 && cleaned.length <= 30) {
          return cleaned;
        }
      }
    }
    
    return null;
  },

  // Extract date from receipt text
  extractDate(text) {
    // Common date patterns
    const patterns = [
      // MM/DD/YYYY or MM-DD-YYYY
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/,
      // YYYY/MM/DD or YYYY-MM-DD
      /(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
      // Month DD, YYYY
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s*(20\d{2})/i,
      // DD Month YYYY
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*(20\d{2})/i
    ];
    
    const monthMap = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
      'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          let year, month, day;
          
          if (match[1].length === 4) {
            // YYYY-MM-DD format
            year = match[1];
            month = match[2].padStart(2, '0');
            day = match[3].padStart(2, '0');
          } else if (isNaN(match[1])) {
            // Month name format (Month DD, YYYY)
            month = monthMap[match[1].toLowerCase().substring(0, 3)];
            day = match[2].padStart(2, '0');
            year = match[3];
          } else if (isNaN(match[2])) {
            // DD Month YYYY format
            day = match[1].padStart(2, '0');
            month = monthMap[match[2].toLowerCase().substring(0, 3)];
            year = match[3];
          } else {
            // MM/DD/YYYY format
            month = match[1].padStart(2, '0');
            day = match[2].padStart(2, '0');
            year = match[3];
          }
          
          // Validate date
          const dateStr = `${year}-${month}-${day}`;
          const date = new Date(dateStr);
          if (!isNaN(date.getTime()) && date <= new Date()) {
            return dateStr;
          }
        } catch (e) {
          console.log('Date parse error:', e);
        }
      }
    }
    
    return null;
  },

  // Extract line items from receipt
  extractItems(lines) {
    const items = [];
    
    for (const line of lines) {
      // Look for lines with item name and price
      // Pattern: text followed by price at end
      const match = line.match(/^(.+?)\s+(\d+\.\d{2})\s*$/);
      if (match) {
        const name = match[1].replace(/[^a-zA-Z0-9\s]/g, '').trim();
        const price = parseFloat(match[2]);
        
        if (name.length >= 2 && price > 0 && price < 1000) {
          items.push({ name, price });
        }
      }
    }
    
    return items;
  },

  // Extract monetary amounts from text
  extractAmounts(text) {
    const amounts = [];
    
    // Normalize text - handle common OCR mistakes
    const normalizedText = text
      .replace(/[oO]/g, '0')  // Sometimes O is read as 0
      .replace(/[lI]/g, '1')  // Sometimes l/I is read as 1
      .replace(/\s+/g, ' ');
    
    // Patterns for common currency formats (order matters - more specific first)
    const patterns = [
      // Currency symbol patterns
      /[\$€£¥₹]\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/g,  // $123.45 or $1,234.56
      /(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*[\$€£¥₹]/g,  // 123.45$
      
      // Keyword patterns (total, amount, due, etc.)
      /(?:total|amount|sum|due|balance|subtotal|grand\s*total)[:\s]*[\$€£¥₹]?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/gi,
      
      // Currency code patterns
      /(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:USD|EUR|GBP|INR)/gi,
      
      // Generic decimal patterns (most permissive - last)
      /(\d{1,3}(?:,\d{3})*\.\d{2})/g,  // 1,234.56
      /(\d+\.\d{2})/g,  // 123.45
    ];
    
    for (const pattern of patterns) {
      let match;
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      while ((match = pattern.exec(normalizedText)) !== null) {
        const numStr = match[1].replace(/,/g, '');
        const num = parseFloat(numStr);
        // Reasonable range for expenses (more than $0.50, less than $100,000)
        if (num >= 0.50 && num < 100000) {
          amounts.push(num);
        }
      }
    }
    
    // Remove duplicates and sort by value (descending)
    const unique = [...new Set(amounts)].sort((a, b) => b - a);
    console.log('OCR: Unique amounts found:', unique);
    return unique;
  }
};
