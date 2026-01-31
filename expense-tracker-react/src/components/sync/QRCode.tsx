import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui';

interface QRCodeProps {
  deviceId: string;
  accountId: string;
  accountName: string;
  onCopyCode: () => void;
  showQRByDefault?: boolean;
}

// Generate QR data in format: et:{accountId}:{deviceId}:{accountName}
function generateQRData(accountId: string, deviceId: string, accountName: string): string {
  return `et:${accountId}:${deviceId}:${accountName}`;
}

export function QRCode({ deviceId, accountId, accountName, onCopyCode, showQRByDefault = false }: QRCodeProps) {
  const [showQR, setShowQR] = useState(showQRByDefault);
  
  const qrData = generateQRData(accountId, deviceId, accountName);

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
          <QRCodeSVG value={qrData} size={200} />
        </div>
      )}
    </div>
  );
}
