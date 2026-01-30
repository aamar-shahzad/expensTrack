import { useState, useRef, useCallback, useEffect } from 'react';
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
  const [error, setError] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Start camera
  const startCamera = useCallback(async (video: HTMLVideoElement) => {
    // Stop any existing stream first to prevent resource leaks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setError(null);
    
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
    } catch (err) {
      console.error('Camera error:', err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera permission denied');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera found');
        } else {
          setError(err.message || 'Failed to access camera');
        }
      } else {
        setError('Failed to access camera');
      }
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
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      
      img.onload = () => {
        // Revoke the object URL after image loads
        URL.revokeObjectURL(objectUrl);
        
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
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (thumb) => {
            if (thumb) {
              resolve(thumb);
            } else {
              reject(new Error('Failed to create thumbnail'));
            }
          },
          'image/jpeg',
          0.7
        );
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };
      
      img.src = objectUrl;
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
          // Use global regex to replace ALL commas (e.g., $1,234,567.89)
          amount = parseFloat(match[1].replace(/,/g, ''));
          break;
        }
      }

      // Extract date
      let date: string | null = null;
      
      // Pattern 1: MM/DD/YY or MM/DD/YYYY or MM-DD-YY or MM-DD-YYYY
      const numericDateMatch = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
      if (numericDateMatch) {
        const [, part1, part2, part3] = numericDateMatch;
        let year = parseInt(part3, 10);
        const month = parseInt(part1, 10);
        const day = parseInt(part2, 10);
        
        // Handle 2-digit years
        if (year < 100) {
          year = year >= 50 ? 1900 + year : 2000 + year;
        }
        
        // Validate date parts
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
          date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
      
      // Pattern 2: Month DD, YYYY (e.g., "January 15, 2024")
      if (!date) {
        const textDateMatch = text.match(/(\w{3,9})\s+(\d{1,2}),?\s+(\d{4})/i);
        if (textDateMatch) {
          try {
            const parsed = new Date(textDateMatch[0]);
            if (!isNaN(parsed.getTime())) {
              date = parsed.toISOString().split('T')[0];
            }
          } catch {
            // Ignore parsing errors
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

    const video = videoRef.current;
    
    // Validate video dimensions - video may not be fully loaded yet
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }
    
    const canvas = document.createElement('canvas');
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
    try {
      const thumbnail = await createThumbnail(blob);
      const record = await db.addImage(blob, thumbnail);
      return record.id;
    } catch (error) {
      console.error('Failed to save image:', error);
      throw error;
    }
  }, [createThumbnail]);

  return {
    isActive,
    isProcessing,
    ocrProgress,
    error,
    startCamera,
    stopCamera,
    captureImage,
    processOCR,
    scanQRCode,
    saveImage
  };
}
