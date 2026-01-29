import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui';

interface QRCodeProps {
  deviceId: string;
  syncUrl: string;
  onCopyCode: () => void;
}

export function QRCode({ deviceId, syncUrl, onCopyCode }: QRCodeProps) {
  const [showQR, setShowQR] = useState(false);

  return (
    <div className="bg-[var(--white)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-3xl font-mono font-bold tracking-widest">
          {deviceId}
        </div>
        <Button size="sm" variant="secondary" onClick={onCopyCode}>
          Copy
        </Button>
      </div>

      <button
        onClick={() => setShowQR(!showQR)}
        className="text-[var(--teal-green)] text-sm font-medium"
      >
        {showQR ? 'Hide QR Code' : 'Show QR Code'}
      </button>

      {showQR && (
        <div className="mt-4 flex justify-center p-4 bg-white rounded-xl">
          <QRCodeSVG value={syncUrl} size={200} />
        </div>
      )}
    </div>
  );
}
