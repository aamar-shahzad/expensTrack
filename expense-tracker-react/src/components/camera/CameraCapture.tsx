import { useRef, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, useToast } from '@/components/ui';
import { useCamera } from '@/hooks/useCamera';
import { useExpenseStore } from '@/stores/expenseStore';
import { usePeopleStore } from '@/stores/peopleStore';
import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { haptic, cn } from '@/lib/utils';
import { getToday } from '@/types';

export function CameraCapture() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
  const currency = useSettingsStore(s => s.currency);
  
  const [capturedImage, setCapturedImage] = useState<Blob | null>(null);
  const [ocrResult, setOcrResult] = useState<{
    amount: number | null;
    description: string | null;
    date: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Create stable object URL for preview
  const imagePreviewUrl = useMemo(() => {
    if (capturedImage) {
      return URL.createObjectURL(capturedImage);
    }
    return null;
  }, [capturedImage]);

  // Cleanup object URL on unmount or when image changes
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  // Start camera on mount
  useEffect(() => {
    const initCamera = async () => {
      if (videoRef.current) {
        const success = await startCamera(videoRef.current);
        if (!success) {
          setCameraError('Camera access denied. You can still upload an image.');
        }
      }
    };
    
    initCamera();
    
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Update edit fields when OCR result changes
  useEffect(() => {
    if (ocrResult) {
      setEditAmount(ocrResult.amount?.toString() || '');
      setEditDescription(ocrResult.description || '');
    }
  }, [ocrResult]);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    haptic('light');
    setCapturedImage(file);
    
    // Process OCR
    const result = await processOCR(file);
    setOcrResult(result);
    
    if (result.amount) {
      haptic('success');
      showSuccess('Receipt scanned!');
    }
  };

  const handleSave = async () => {
    if (!capturedImage) return;
    
    // Validate amount
    const finalAmount = parseFloat(editAmount) || ocrResult?.amount || 0;
    if (finalAmount <= 0) {
      showError('Please enter a valid amount');
      haptic('error');
      return;
    }
    
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
        description: editDescription || ocrResult?.description || 'Receipt',
        amount: finalAmount,
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
    setEditMode(false);
    setEditAmount('');
    setEditDescription('');
  };

  return (
    <div className="fixed inset-0 bg-black z-[1000] flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 safe-top bg-gradient-to-b from-black/60 to-transparent">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center active:scale-95 transition-transform"
        >
          ✕
        </button>
        <span className="text-white font-semibold text-lg">
          {capturedImage ? 'Review' : 'Scan Receipt'}
        </span>
        <div className="w-10" />
      </div>

      {/* Camera View or Captured Image */}
      {capturedImage && imagePreviewUrl ? (
        <div className="flex-1 flex items-center justify-center bg-black">
          <img
            src={imagePreviewUrl}
            alt="Captured receipt"
            className="max-w-full max-h-[60vh] object-contain"
          />
        </div>
      ) : cameraError ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="text-6xl mb-4">📷</div>
          <p className="text-white/80 mb-6">{cameraError}</p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="bg-white text-black"
          >
            Choose from Gallery
          </Button>
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
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
          <div className="relative w-20 h-20 mb-4">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="4"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="var(--teal-green)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${ocrProgress * 2.26} 226`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-white font-bold">
              {ocrProgress}%
            </div>
          </div>
          <div className="text-white text-lg font-medium">Scanning receipt...</div>
          <div className="text-white/60 text-sm mt-1">Extracting details</div>
        </div>
      )}

      {/* OCR Results Card */}
      {capturedImage && ocrResult && !isProcessing && (
        <div className="bg-white rounded-t-3xl px-4 pt-6 pb-32 safe-bottom">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Receipt Details</h3>
            <button
              onClick={() => setEditMode(!editMode)}
              className="text-[var(--teal-green)] text-sm font-medium px-3 py-1 rounded-full bg-[var(--teal-green)]/10"
            >
              {editMode ? 'Done' : 'Edit'}
            </button>
          </div>
          
          <div className="space-y-4">
            {/* Amount */}
            <div className="bg-[var(--bg)] rounded-xl p-4">
              <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1 block">
                Amount
              </label>
              {editMode ? (
                <div className="flex items-center gap-2">
                  <span className="text-2xl text-[var(--teal-green)]">{currency}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    className="flex-1 text-2xl font-bold bg-transparent border-none outline-none"
                    autoFocus
                  />
                </div>
              ) : (
                <div className="text-2xl font-bold">
                  {currency}{editAmount || ocrResult.amount?.toFixed(2) || '0.00'}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-[var(--bg)] rounded-xl p-4">
              <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1 block">
                Description
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="What was this for?"
                  className="w-full text-lg bg-transparent border-none outline-none"
                />
              ) : (
                <div className="text-lg">
                  {editDescription || ocrResult.description || 'Receipt'}
                </div>
              )}
            </div>

            {/* Date */}
            {ocrResult.date && (
              <div className="bg-[var(--bg)] rounded-xl p-4">
                <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1 block">
                  Date
                </label>
                <div className="text-lg">{ocrResult.date}</div>
              </div>
            )}

            {!ocrResult.amount && !editAmount && (
              <div className="text-center py-4 text-[var(--text-secondary)]">
                <span className="text-2xl mb-2 block">🔍</span>
                Could not detect amount. Please enter manually.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 safe-bottom bg-gradient-to-t from-black via-black/80 to-transparent">
        {capturedImage ? (
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleRetake}
              className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              Retake
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              className="flex-1"
            >
              Save {editAmount || ocrResult?.amount ? `${currency}${editAmount || ocrResult?.amount?.toFixed(2)}` : 'Expense'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {/* Capture Button */}
            <button
              onClick={handleCapture}
              disabled={!isActive || isProcessing}
              className={cn(
                'w-20 h-20 rounded-full bg-white flex items-center justify-center transition-all',
                'active:scale-90 disabled:opacity-50 disabled:scale-100',
                'shadow-lg shadow-white/20'
              )}
            >
              <div className="w-16 h-16 rounded-full border-4 border-[var(--teal-green)]" />
            </button>
            
            {/* Gallery Option */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-white/80 py-2 px-4 rounded-full bg-white/10 backdrop-blur-sm active:bg-white/20"
            >
              <span>🖼️</span>
              <span className="text-sm">Choose from gallery</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
