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
          <div class="image-preview-box">
            <img src="${url}" alt="Receipt">
            <span>Receipt attached</span>
            <button type="button" onclick="Camera.removeImage()">Remove</button>
          </div>
        `;
        preview.classList.remove('hidden');
      }
    });
  },

  removeImage() {
    if (this.capturedImage) {
      DB.deleteImage(this.capturedImage.id);
      this.capturedImage = null;
    }

    const preview = document.getElementById('image-preview');
    if (preview) {
      preview.innerHTML = '';
      preview.classList.add('hidden');
    }
  }
};
