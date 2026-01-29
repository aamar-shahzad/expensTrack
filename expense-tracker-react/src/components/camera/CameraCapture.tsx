import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, useToast } from '@/components/ui';
import { useCamera } from '@/hooks/useCamera';
import { useExpenseStore } from '@/stores/expenseStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { useAccountStore } from '@/stores/accountStore';
import { haptic } from '@/lib/utils';
import { getToday } from '@/types';

export function CameraCapture() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const {
    isActive,
    isProcessing,
    ocrProgress,
    startCamera,
    stopCamera,
    captureImage,
    processOCR,
    saveImage
  } = useCamera();
  
  const addExpense = useExpenseStore(s => s.addExpense);
  const people = usePeopleStore(s => s.people);
  const lastPayerId = usePeopleStore(s => s.lastPayerId);
  const isSharedMode = useAccountStore(s => s.isSharedMode());
  
  const [capturedImage, setCapturedImage] = useState<Blob | null>(null);
  const [ocrResult, setOcrResult] = useState<{
    amount: number | null;
    description: string | null;
    date: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // Start camera on mount
  useEffect(() => {
    if (videoRef.current) {
      startCamera(videoRef.current);
    }
    
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleCapture = async () => {
    haptic('light');
    
    const blob = await captureImage();
    if (!blob) {
      showError('Failed to capture');
      return;
    }
    
    setCapturedImage(blob);
    
    // Process OCR
    const result = await processOCR(blob);
    setOcrResult(result);
    
    if (result.amount) {
      haptic('success');
      showSuccess('Receipt scanned!');
    }
  };

  const handleSave = async () => {
    if (!capturedImage) return;
    
    setSaving(true);
    haptic('light');
    
    try {
      // Save image
      const imageId = await saveImage(capturedImage);
      
      // Resolve payer in shared mode
      const payerId = isSharedMode && people.length > 0
        ? (lastPayerId || people[0].id)
        : undefined;

      // Create expense
      await addExpense({
        description: ocrResult?.description || 'Receipt',
        amount: ocrResult?.amount || 0,
        date: ocrResult?.date || getToday(),
        imageId,
        splitType: 'equal',
        payerId
      });
      
      haptic('success');
      showSuccess('Expense saved!');
      navigate('/');
    } catch (error) {
      console.error('Save error:', error);
      showError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRetake = () => {
    haptic('light');
    setCapturedImage(null);
    setOcrResult(null);
  };

  return (
    <div className="fixed inset-0 bg-black z-[1000] flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 safe-top">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center"
        >
          ✕
        </button>
        <span className="text-white font-medium">
          {capturedImage ? 'Review' : 'Scan Receipt'}
        </span>
        <div className="w-10" />
      </div>

      {/* Camera View or Captured Image */}
      {capturedImage ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <img
            src={URL.createObjectURL(capturedImage)}
            alt="Captured receipt"
            className="max-w-full max-h-full object-contain rounded-xl"
          />
        </div>
      ) : (
        <video
          ref={videoRef}
          className="flex-1 object-cover"
          playsInline
          muted
        />
      )}

      {/* OCR Progress */}
      {isProcessing && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mb-4" />
          <div className="text-white text-lg font-medium">Scanning receipt...</div>
          <div className="text-white/70">{ocrProgress}%</div>
        </div>
      )}

      {/* OCR Results */}
      {ocrResult && !isProcessing && (
        <div className="absolute bottom-32 left-4 right-4 bg-white rounded-xl p-4 safe-bottom">
          <h3 className="font-semibold mb-3">Detected:</h3>
          <div className="space-y-2">
            {ocrResult.amount && (
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Amount</span>
                <span className="font-semibold">${ocrResult.amount.toFixed(2)}</span>
              </div>
            )}
            {ocrResult.description && (
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Description</span>
                <span className="font-medium">{ocrResult.description}</span>
              </div>
            )}
            {ocrResult.date && (
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Date</span>
                <span>{ocrResult.date}</span>
              </div>
            )}
            {!ocrResult.amount && !ocrResult.description && (
              <div className="text-[var(--text-secondary)] text-center">
                Could not detect receipt details. You can still save the image.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 safe-bottom">
        {capturedImage ? (
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleRetake}
              className="flex-1 bg-white/10 border-white text-white"
            >
              Retake
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              className="flex-1"
            >
              Save Expense
            </Button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={handleCapture}
              disabled={!isActive || isProcessing}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-full border-4 border-[var(--teal-green)]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
