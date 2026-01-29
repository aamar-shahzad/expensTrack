import { useState, useRef, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import jsQR from 'jsqr';
import * as db from '@/db/operations';

interface OCRResult {
  amount: number | null;
  description: string | null;
  date: string | null;
  confidence: number;
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  // Start camera
  const startCamera = useCallback(async (video: HTMLVideoElement) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      video.srcObject = stream;
      await video.play();
      
      videoRef.current = video;
      streamRef.current = stream;
      setIsActive(true);
      
      return true;
    } catch (error) {
      console.error('Camera error:', error);
      return false;
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    setIsActive(false);
  }, []);

  // Capture image from video
  const captureImage = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current) return null;

    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0);
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
    });
  }, []);

  // Create thumbnail
  const createThumbnail = useCallback(async (blob: Blob): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 200;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((thumb) => resolve(thumb!), 'image/jpeg', 0.7);
      };
      img.src = URL.createObjectURL(blob);
    });
  }, []);

  // Process image with OCR
  const processOCR = useCallback(async (imageBlob: Blob): Promise<OCRResult> => {
    setIsProcessing(true);
    setOcrProgress(0);

    try {
      const result = await Tesseract.recognize(imageBlob, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });

      const text = result.data.text;
      const confidence = result.data.confidence;

      // Extract amount
      const amountPatterns = [
        /(?:total|amount|sum|due|balance)[:\s]*\$?\s*(\d+[.,]\d{2})/i,
        /\$\s*(\d+[.,]\d{2})/,
        /(\d+[.,]\d{2})\s*(?:total|due)/i,
        /(\d{1,3}(?:,\d{3})*\.\d{2})/
      ];

      let amount: number | null = null;
      for (const pattern of amountPatterns) {
        const match = text.match(pattern);
        if (match) {
          amount = parseFloat(match[1].replace(',', ''));
          break;
        }
      }

      // Extract date
      const datePatterns = [
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
        /(\w{3,9})\s+(\d{1,2}),?\s+(\d{4})/i
      ];

      let date: string | null = null;
      for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
          try {
            const parsed = new Date(match[0]);
            if (!isNaN(parsed.getTime())) {
              date = parsed.toISOString().split('T')[0];
              break;
            }
          } catch {
            // Continue to next pattern
          }
        }
      }

      // Extract description (first line or store name)
      const lines = text.split('\n').filter(l => l.trim());
      let description: string | null = null;
      
      for (const line of lines.slice(0, 3)) {
        const cleaned = line.trim();
        if (cleaned.length > 3 && cleaned.length < 50 && !/^\d+$/.test(cleaned)) {
          description = cleaned;
          break;
        }
      }

      return { amount, description, date, confidence };
    } catch (error) {
      console.error('OCR error:', error);
      return { amount: null, description: null, date: null, confidence: 0 };
    } finally {
      setIsProcessing(false);
      setOcrProgress(0);
    }
  }, []);

  // Scan QR code from video frame
  const scanQRCode = useCallback((): string | null => {
    if (!videoRef.current) return null;

    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    
    return code?.data || null;
  }, []);

  // Save image to database
  const saveImage = useCallback(async (blob: Blob): Promise<string> => {
    const thumbnail = await createThumbnail(blob);
    const record = await db.addImage(blob, thumbnail);
    return record.id;
  }, [createThumbnail]);

  return {
    isActive,
    isProcessing,
    ocrProgress,
    startCamera,
    stopCamera,
    captureImage,
    processOCR,
    scanQRCode,
    saveImage
  };
}
