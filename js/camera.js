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

  // Run OCR to extract amount from receipt
  async runOCR(blob) {
    // Check if Tesseract is available
    if (typeof Tesseract === 'undefined') {
      console.log('Tesseract not loaded');
      return;
    }
    
    const ocrStatus = document.getElementById('ocr-status');
    const amountInput = document.getElementById('expense-amount');
    
    if (!ocrStatus || !amountInput) {
      console.log('OCR: Missing elements');
      return;
    }
    
    try {
      console.log('OCR: Starting scan...');
      ocrStatus.textContent = '🔍 Scanning receipt...';
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
            ocrStatus.textContent = `🔍 Scanning... ${progress}%`;
          }
        }
      });
      
      URL.revokeObjectURL(imageUrl);
      
      console.log('OCR: Raw text:', result.data.text);
      
      // Extract amounts from text (look for currency patterns)
      const text = result.data.text;
      const amounts = this.extractAmounts(text);
      
      console.log('OCR: Found amounts:', amounts);
      
      if (amounts.length > 0) {
        // Use the largest amount (usually the total)
        const bestAmount = Math.max(...amounts);
        
        // Only auto-fill if amount field is empty
        if (!amountInput.value) {
          amountInput.value = bestAmount.toFixed(2);
          ocrStatus.textContent = `✓ Found: ${Settings.getCurrency()}${bestAmount.toFixed(2)}`;
          ocrStatus.style.color = '#25d366';
        } else {
          ocrStatus.textContent = `Found ${Settings.getCurrency()}${bestAmount.toFixed(2)} (field has value)`;
          ocrStatus.style.color = '#667781';
        }
      } else {
        ocrStatus.textContent = 'No amount found in receipt';
        ocrStatus.style.color = '#667781';
      }
      
      // Hide after 8 seconds (longer to see result)
      setTimeout(() => {
        ocrStatus.classList.add('hidden');
      }, 8000);
      
    } catch (error) {
      console.error('OCR failed:', error);
      ocrStatus.textContent = 'Scan failed - try again';
      ocrStatus.style.color = '#ff3b30';
      setTimeout(() => ocrStatus.classList.add('hidden'), 5000);
    }
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
