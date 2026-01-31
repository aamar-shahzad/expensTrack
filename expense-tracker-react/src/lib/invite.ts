/**
 * Parse invite input from various formats:
 * - et:accountId:deviceId:accountName (QR format)
 * - URL: .../join?account=xxx&name=yyy
 * - URL: ...?account=xxx&name=yyy
 */
export function parseInviteInput(
  input: string
): { accountId: string; deviceId: string; accountName: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Format: et:accountId:deviceId:accountName
  if (trimmed.startsWith('et:')) {
    const parts = trimmed.slice(3).split(':');
    if (parts.length >= 2) {
      return {
        accountId: parts[0],
        deviceId: parts[1],
        accountName: decodeURIComponent(parts[2] || 'Shared Group')
      };
    }
  }

  // URL format: .../join?account=xxx&name=yyy or ?account=xxx&name=yyy
  try {
    const url = trimmed.startsWith('http')
      ? trimmed
      : trimmed.includes('?')
        ? `https://x${trimmed}`
        : `https://x?${trimmed}`;
    const parsed = new URL(url);
    const accountId = parsed.searchParams.get('account');
    const accountName = parsed.searchParams.get('name') || 'Shared Group';
    if (accountId) {
      return {
        accountId,
        deviceId: parsed.searchParams.get('device') || '',
        accountName: decodeURIComponent(accountName)
      };
    }
  } catch {
    // Not a valid URL, try as raw accountId (UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(trimmed)) {
      return {
        accountId: trimmed,
        deviceId: '',
        accountName: 'Shared Group'
      };
    }
  }

  return null;
}

/**
 * Generate invite link/code for sharing
 */
export function generateInviteCode(
  accountId: string,
  deviceId: string,
  accountName: string
): string {
  return `et:${accountId}:${deviceId}:${encodeURIComponent(accountName)}`;
}

/**
 * Generate shareable URL (for Copy invite link).
 * deviceId = host peer id so joiners can connect via PeerJS.
 */
export function generateInviteUrl(
  accountId: string,
  accountName: string,
  deviceId?: string,
  baseUrl: string = typeof window !== 'undefined' ? window.location.origin + (import.meta.env.BASE_URL || '/') : ''
): string {
  const path = baseUrl.replace(/\/$/, '') + '/join';
  const params = new URLSearchParams();
  params.set('account', accountId);
  params.set('name', accountName);
  if (deviceId) params.set('device', deviceId);
  return `${path}?${params.toString()}`;
}
