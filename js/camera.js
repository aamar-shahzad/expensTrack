/**
 * Camera and Image Capture Module
 */

const Camera = {
  videoElement: null,
  canvasElement: null,
  stream: null,
  capturedImage: null,

  async init() {
    // Create hidden video and canvas elements for camera
    this.videoElement = document.createElement('video');
    this.canvasElement = document.createElement('canvas');
    this.videoElement.style.display = 'none';
    this.canvasElement.style.display = 'none';
    document.body.appendChild(this.videoElement);
    document.body.appendChild(this.canvasElement);
  },

  async capturePhoto() {
    try {
      // Request camera permission
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Rear camera
        audio: false
      });

      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      // Show camera preview modal
      this.showCameraModal();

    } catch (error) {
      console.error('Camera access failed:', error);
      App.showError('Camera access denied or not available');
    }
  },

  showCameraModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-container';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">Take Photo</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <video id="camera-preview" autoplay playsinline></video>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-close">Cancel</button>
          <button class="btn btn-primary" id="take-photo">📸 Capture</button>
        </div>
      </div>
    `;

    document.getElementById('modals').appendChild(modal);

    const videoPreview = modal.querySelector('#camera-preview');
    videoPreview.srcObject = this.stream;

    // Setup events
    modal.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        this.stopCamera();
        modal.remove();
      });
    });

    modal.querySelector('#take-photo').addEventListener('click', () => {
      this.takePhoto();
      this.stopCamera();
      modal.remove();
    });
  },

  async takePhoto() {
    const canvas = this.canvasElement;
    const video = this.videoElement;
    const context = canvas.getContext('2d');

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0);

    // Convert to blob
    canvas.toBlob(async (blob) => {
      try {
        // Create thumbnail
        const thumbnail = await this.createThumbnail(blob);

        // Save image to DB
        const imageData = await DB.saveImage(blob, thumbnail);
        this.capturedImage = imageData;

        // Show preview
        this.showImagePreview(imageData.id);

        App.showSuccess('Photo captured successfully');

      } catch (error) {
        console.error('Failed to save photo:', error);
        App.showError('Failed to save photo');
      }
    }, 'image/jpeg', 0.8);
  },

  async chooseFromGallery() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        // Create thumbnail
        const thumbnail = await this.createThumbnail(file);

        // Save image to DB
        const imageData = await DB.saveImage(file, thumbnail);
        this.capturedImage = imageData;

        // Show preview
        this.showImagePreview(imageData.id);

        App.showSuccess('Photo selected successfully');

      } catch (error) {
        console.error('Failed to save photo:', error);
        App.showError('Failed to save photo');
      }
    };

    input.click();
  },

  async createThumbnail(blob) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Thumbnail size
        const maxSize = 200;
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

        canvas.toBlob(resolve, 'image/jpeg', 0.7);
      };
      img.src = URL.createObjectURL(blob);
    });
  },

  async showImagePreview(imageId) {
    const preview = document.getElementById('image-preview');
    if (!preview) return;

    try {
      const imageData = await DB.getImage(imageId);
      if (!imageData) return;

      const thumbUrl = URL.createObjectURL(imageData.thumbnail || imageData.blob);
      preview.classList.remove('hidden');
      preview.innerHTML = `
        <img src="${thumbUrl}" alt="Receipt">
        <div class="preview-info">Receipt attached</div>
        <button class="btn-danger btn-small" onclick="Camera.removeImage()">Remove</button>
      `;
    } catch (error) {
      console.error('Failed to show image preview:', error);
    }
  },

  removeImage() {
    this.capturedImage = null;
    const preview = document.getElementById('image-preview');
    if (preview) {
      preview.classList.add('hidden');
      preview.innerHTML = '';
    }
  },

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  },

  getCapturedImage() {
    return this.capturedImage;
  }
};
