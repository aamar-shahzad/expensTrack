import { useRef, useEffect, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { Button } from '@/components/ui';

interface QRScannerProps {
  onScan: (data: { accountId: string; deviceId: string; accountName: string }) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

// QR format: et:{accountId}:{deviceId}:{accountName}
function parseQRData(data: string): { accountId: string; deviceId: string; accountName: string } | null {
  if (!data.startsWith('et:')) {
    return null;
  }
  
  const parts = data.slice(3).split(':');
  if (parts.length < 2) {
    return null;
  }
  
  return {
    accountId: parts[0],
    deviceId: parts[1],
    accountName: parts[2] || 'Shared Group'
  };
}

export function QRScanner({ onScan, onError, onCancel }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastInvalidQRRef = useRef<string | null>(null);
  const invalidCountRef = useRef(0);
  
  const [isStarting, setIsStarting] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showInvalidHint, setShowInvalidHint] = useState(false);

  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animationRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });
    
    if (code && code.data) {
      const parsed = parseQRData(code.data);
      if (parsed) {
        stopCamera();
        onScan(parsed);
        return;
      } else {
        // Track invalid QR codes
        if (code.data !== lastInvalidQRRef.current) {
          lastInvalidQRRef.current = code.data;
          invalidCountRef.current++;
          
          // Show hint after 2 invalid scans
          if (invalidCountRef.current >= 2) {
            setShowInvalidHint(true);
          }
        }
      }
    }
    
    animationRef.current = requestAnimationFrame(scanFrame);
  }, [onScan, stopCamera]);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        streamRef.current = stream;
        setHasPermission(true);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsStarting(false);
          animationRef.current = requestAnimationFrame(scanFrame);
        }
      } catch (err) {
        console.error('Camera error:', err);
        setHasPermission(false);
        setIsStarting(false);
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            onError('Camera permission denied. Please allow camera access to scan QR codes.');
          } else {
            onError('Could not access camera. Please try again.');
          }
        }
      }
    };
    
    startCamera();
    
    return () => {
      stopCamera();
    };
  }, [scanFrame, stopCamera, onError]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 flex items-center justify-between safe-top">
        <button
          onClick={() => {
            stopCamera();
            onCancel();
          }}
          className="text-white text-lg"
        >
          Cancel
        </button>
        <h1 className="text-white font-semibold">Scan QR Code</h1>
        <div className="w-16" /> {/* Spacer */}
      </div>
      
      {/* Camera View */}
      <div className="flex-1 relative overflow-hidden">
        {isStarting && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p>Starting camera...</p>
            </div>
          </div>
        )}
        
        {hasPermission === false && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="text-white text-center">
              <div className="text-5xl mb-4">📷</div>
              <h2 className="text-xl font-semibold mb-2">Camera Access Required</h2>
              <p className="text-white/70 mb-6">
                Please allow camera access to scan QR codes
              </p>
              <Button onClick={onCancel}>Go Back</Button>
            </div>
          </div>
        )}
        
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        
        {/* Scan overlay */}
        {!isStarting && hasPermission && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Darkened corners */}
            <div className="absolute inset-0 bg-black/50" />
            
            {/* Scan area */}
            <div className="relative w-64 h-64">
              {/* Clear center */}
              <div className="absolute inset-0 bg-transparent" style={{
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
              }} />
              
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
              
              {/* Scanning line animation */}
              <div className="absolute left-2 right-2 h-0.5 bg-[var(--teal-green)] animate-pulse" 
                   style={{ top: '50%' }} />
            </div>
          </div>
        )}
        
        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      
      {/* Instructions */}
      <div className="flex-shrink-0 p-6 text-center safe-bottom">
        <p className="text-white/80">
          Point your camera at the QR code shown on the other device
        </p>
        {showInvalidHint && (
          <p className="text-amber-400 text-sm mt-2">
            Make sure you're scanning a QR code from the Expense Tracker app
          </p>
        )}
      </div>
    </div>
  );
}
