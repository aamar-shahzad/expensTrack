/**
 * Policies for who can add/remove people and add/delete expenses in shared groups.
 * - Personal account: current user can do everything.
 * - Shared account: only the group creator (host device) can add/remove people and delete expenses.
 *   Anyone in the group can add expenses and edit their own identity ("This is me").
 */

import type { Account } from '@/types';

/** True if this device is the group creator (host) for the account */
export function isGroupCreator(account: Account | undefined, deviceId: string | null): boolean {
  if (!account || account.mode !== 'shared') return true; // personal: you're the only one
  if (!deviceId || !account.hostDeviceId) return false;
  return account.hostDeviceId === deviceId;
}

/** Only group creator can add or remove people in shared groups */
export function canManagePeople(account: Account | undefined, deviceId: string | null): boolean {
  return isGroupCreator(account, deviceId);
}

/** Only group creator can delete expenses in shared groups; anyone can add */
export function canDeleteExpense(account: Account | undefined, deviceId: string | null): boolean {
  return isGroupCreator(account, deviceId);
}

/** Anyone can add expenses (no restriction) */
export function canAddExpense(): boolean {
  return true;
}
