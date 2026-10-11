/**
 * QR Code Scanner Module for LifeQR
 * Built with Editorial Swiss Theme matching website/landingpage.html.
 * Supports live camera video feed, drag-and-drop QR image upload, and fast jsQR decoding.
 */

class QRScanner {
  constructor(options = {}) {
    this.onSuccess = options.onSuccess || ((qr) => console.log('Scanned QR:', qr));
    this.onError = options.onError || ((err) => alert(err));
    this.videoStream = null;
    this.isScanning = false;
    this.modal = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.fileInputElement = null;
  }

  createModal() {
    let modal = document.getElementById('qrScannerModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'qrScannerModal';
      modal.className = 'hidden fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans';

      modal.innerHTML = `
        <div class="bg-white max-w-md w-full border-2 border-[#111111] shadow-[8px_8px_0px_#111111] overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in duration-200">
          
          <!-- Header -->
          <div class="bg-[#111111] p-4 sm:p-5 text-white flex items-center justify-between border-b-2 border-[#111111]">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 border border-white/20 bg-white/10 flex items-center justify-center text-[#E11D2E]">
                <span class="material-symbols-outlined text-xl">qr_code_scanner</span>
              </div>
              <div>
                <h3 class="font-black text-sm uppercase tracking-wider text-white flex items-center gap-2">
                  <span>Scan Patient QR Badge</span>
                  <span class="w-2 h-2 rounded-full bg-[#E11D2E] animate-ping"></span>
                </h3>
                <p class="text-white/70 text-[11px] font-mono">Live Camera &bull; File Upload &bull; Instant Decode</p>
              </div>
            </div>
            <button id="qrModalCloseBtn" class="p-1.5 text-white/80 hover:text-white hover:bg-white/10 transition" title="Close Scanner">
              <span class="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          <!-- Camera Viewport / Dropzone Area -->
          <div id="qrDropZone" class="relative bg-[#0d0d0d] aspect-square overflow-hidden flex items-center justify-center cursor-pointer group">
            
            <video 
              id="qrModalVideo" 
              autoplay 
              muted 
              playsinline
              class="w-full h-full object-cover"
            ></video>
            <canvas id="qrModalCanvas" class="hidden"></canvas>

            <!-- Viewfinder Target Frame -->
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div class="relative w-56 h-56 border border-white/30">
                <!-- Corner Brackets -->
                <div class="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-[#E11D2E]"></div>
                <div class="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-[#E11D2E]"></div>
                <div class="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-[#E11D2E]"></div>
                <div class="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-[#E11D2E]"></div>
                
                <!-- Laser Scan Line -->
                <div class="absolute left-1 right-1 h-[2px] bg-[#E11D2E] shadow-[0_0_10px_#E11D2E] animate-scan pointer-events-none"></div>
              </div>
            </div>

            <!-- Floating Status Badge -->
            <div class="absolute bottom-3 left-1/2 transform -translate-x-1/2 pointer-events-none">
              <div class="flex items-center gap-2 text-white bg-[#111111]/90 border border-white/20 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider shadow-lg">
                <span id="qrStatusDot" class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span id="qrStatusText">Align QR code in viewfinder</span>
              </div>
            </div>
          </div>

          <!-- Action Controls & File Upload -->
          <div class="p-4 sm:p-5 bg-[#ffffff] border-t-2 border-[#111111] flex flex-col gap-3 font-mono">
            <div class="flex items-center gap-2">
              <label class="flex-1 cursor-pointer inline-flex items-center justify-center gap-2 bg-[#111111] hover:bg-[#E11D2E] text-white font-bold py-2.5 px-4 text-xs uppercase tracking-wider transition border-2 border-[#111111]">
                <span class="material-symbols-outlined text-base">upload_file</span>
                <span>Upload QR Image</span>
                <input type="file" id="qrFileInput" accept="image/*" class="hidden">
              </label>
              <button id="qrModalCancelBtn" class="bg-white hover:bg-gray-100 text-[#111111] font-bold py-2.5 px-4 text-xs uppercase tracking-wider transition border-2 border-[#111111]">
                Cancel
              </button>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-gray-200 text-[10px] text-gray-500">
              <span>Tip: Drag &amp; drop QR badge photo directly onto viewfinder</span>
              <span class="font-mono text-gray-400">HIGH-PRECISION OPTICAL SCAN</span>
            </div>
          </div>

        </div>
      `;

      // Inject scanner laser animation style if not already present
      if (!document.getElementById('qrScannerStyles')) {
        const style = document.createElement('style');
        style.id = 'qrScannerStyles';
        style.textContent = `
          @keyframes qrLaserScan {
            0%, 100% { top: 8%; opacity: 0.2; }
            50% { top: 90%; opacity: 1; }
          }
          .animate-scan {
            animation: qrLaserScan 2.4s ease-in-out infinite;
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(modal);
    }

    this.modal = modal;
    this.videoElement = modal.querySelector('#qrModalVideo');
    this.canvasElement = modal.querySelector('#qrModalCanvas');
    this.fileInputElement = modal.querySelector('#qrFileInput');

    // Attach button listeners
    modal.querySelector('#qrModalCloseBtn').onclick = () => this.stop();
    modal.querySelector('#qrModalCancelBtn').onclick = () => this.stop();

    // File input change
    this.fileInputElement.onchange = (e) => this.handleFileUpload(e);

    // Drag and drop onto viewfinder area
    const dropZone = modal.querySelector('#qrDropZone');
    if (dropZone) {
      dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('ring-4', 'ring-[#E11D2E]');
      };
      dropZone.ondragleave = (e) => {
        e.preventDefault();
        dropZone.classList.remove('ring-4', 'ring-[#E11D2E]');
      };
      dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('ring-4', 'ring-[#E11D2E]');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.processImageFile(e.dataTransfer.files[0]);
        }
      };
    }
  }

  async start() {
    this.createModal();
    this.modal.classList.remove('hidden');

    const statusText = this.modal.querySelector('#qrStatusText');
    const statusDot = this.modal.querySelector('#qrStatusDot');
    if (statusText && statusDot) {
      statusText.textContent = 'Scanning live camera...';
      statusDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    }

    try {
      if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('CAMERA_API_NOT_AVAILABLE');
      }

      // Tiered camera constraints fallback
      let stream = null;
      const constraintList = [
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        { video: true, audio: false }
      ];

      for (const constraints of constraintList) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream) break;
        } catch (e) {
          console.warn('Constraint attempt failed, trying fallback:', constraints, e);
        }
      }

      if (!stream) {
        throw new Error('Camera access not granted or unavailable.');
      }

      this.videoStream = stream;
      this.videoElement.srcObject = stream;

      await new Promise((resolve) => {
        if (this.videoElement.readyState >= 2) {
          resolve();
        } else {
          this.videoElement.onloadedmetadata = () => resolve();
          setTimeout(resolve, 1500);
        }
      });

      await this.videoElement.play().catch(e => console.warn('Video play error:', e));
      this.isScanning = true;
      this.scanFrame();

    } catch (error) {
      console.warn('Camera initialization warning:', error);
      if (statusText && statusDot) {
        statusText.textContent = 'Camera unavailable — Upload image below';
        statusDot.className = 'w-2 h-2 rounded-full bg-amber-400';
      }
    }
  }

  stop() {
    this.isScanning = false;

    if (this.videoStream) {
      try {
        this.videoStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
      this.videoStream = null;
    }

    if (this.modal) {
      this.modal.classList.add('hidden');
    }
  }

  scanFrame() {
    if (!this.isScanning) return;
    if (!this.videoElement || !this.canvasElement) return;

    const video = this.videoElement;
    const canvas = this.canvasElement;
    const context = canvas.getContext('2d');

    if (video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        if (typeof jsQR !== 'undefined') {
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data) {
            console.log('✅ QR Code detected:', code.data);
            const qrValue = this.extractQRId(code.data);
            this.stop();
            this.onSuccess(qrValue);
            return;
          }
        }
      } catch (err) {
        console.error('Frame decode error:', err);
      }
    }

    requestAnimationFrame(() => this.scanFrame());
  }

  handleFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (file) {
      this.processImageFile(file);
    }
  }

  processImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = this.canvasElement || document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, img.width, img.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (typeof jsQR === 'undefined') {
          alert('QR decoder library missing. Please reload the page.');
          return;
        }

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          const qrValue = this.extractQRId(code.data);
          this.stop();
          this.onSuccess(qrValue);
        } else {
          alert('No valid LifeQR code found in the uploaded image. Please ensure the QR code is clear and well-lit.');
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  extractQRId(qrData) {
    if (!qrData) return '';
    const cleanStr = String(qrData).trim();

    // Check query params ?id=RAH-D3200470
    if (cleanStr.includes('id=')) {
      try {
        const url = new URL(cleanStr);
        const idParam = url.searchParams.get('id');
        if (idParam) return idParam.trim();
      } catch (e) {}
    }

    // Check /e/TOKEN or /emergency_access.html?id=...
    if (cleanStr.includes('/')) {
      const segments = cleanStr.split('/').filter(Boolean);
      const lastSeg = segments[segments.length - 1];
      if (lastSeg.includes('?id=')) {
        return lastSeg.split('?id=')[1].split('&')[0].trim();
      }
      return lastSeg.trim();
    }

    return cleanStr;
  }
}

// Global scanner instance and helpers
window.qrScanner = null;

window.initQRScanner = function(onSuccess, onError) {
  window.qrScanner = new QRScanner({ onSuccess, onError });
  return window.qrScanner;
};

window.startQRScanner = function(customSuccessCb) {
  if (customSuccessCb || !window.qrScanner) {
    const successHandler = customSuccessCb || ((qrValue) => {
      const input = document.getElementById('patientQrId');
      if (input) {
        input.value = qrValue;
      }
      if (typeof window.searchPatient === 'function') {
        window.searchPatient();
      }
    });

    window.initQRScanner(
      successHandler,
      (err) => console.error('QR Scanner error:', err)
    );
  }
  window.qrScanner.start();
};

window.stopQRScanner = function() {
  if (window.qrScanner) {
    window.qrScanner.stop();
  }
};
