import { useCallback, useEffect } from 'react';
import { useYjs, useYArray } from './YjsProvider';
import { useAccountStore } from '@/stores/accountStore';
import { useSyncStore } from '@/stores/syncStore';
import type { Expense, Person, Payment } from '@/types';
import { generateId, getYearMonth } from '@/types';

/**
 * Hook for Yjs-based sync operations
 * Replaces the old PeerJS-based useSync hook
 */
export function useYjsSync() {
  const yjs = useYjs();
  const { ydoc, expenses: yExpenses, people: yPeople, payments: yPayments, connect, disconnect, setAwareness, isConnected, connectedPeers } = yjs;
  
  const currentAccount = useAccountStore(s => s.getCurrentAccount());
  const selfPersonId = useAccountStore(s => s.selfPersonId);
  const { deviceId, setConnected, addConnectedPeer } = useSyncStore();
  
  // Get reactive arrays
  const expenses = useYArray(yExpenses);
  const people = useYArray(yPeople);
  const payments = useYArray(yPayments);
  
  // Sync connection state to syncStore
  useEffect(() => {
    setConnected(isConnected);
  }, [isConnected, setConnected]);
  
  // Sync connected peers to syncStore
  useEffect(() => {
    // Clear existing peers and add new ones
    connectedPeers.forEach(peer => {
      addConnectedPeer(peer.id);
    });
  }, [connectedPeers, addConnectedPeer]);
  
  // Connect to room when account is shared
  useEffect(() => {
    if (currentAccount?.mode === 'shared' && currentAccount.id) {
      const roomName = `expense-tracker-${currentAccount.id}`;
      connect(roomName);
      
      // Set awareness with user info
      const selfPerson = people.find(p => p.id === selfPersonId);
      setAwareness({
        id: deviceId,
        name: selfPerson?.name || 'Unknown',
        color: getRandomColor(deviceId)
      });
    }
    
    return () => {
      // Don't disconnect on cleanup - let provider handle it
    };
  }, [currentAccount?.mode, currentAccount?.id, connect, deviceId, selfPersonId, people, setAwareness]);
  
  // ============ EXPENSE OPERATIONS ============
  
  const addExpense = useCallback((expense: Omit<Expense, 'id' | 'syncId' | 'syncStatus' | 'yearMonth' | 'createdAt'>) => {
    const newExpense: Expense = {
      ...expense,
      id: generateId(),
      syncId: generateId(),
      syncStatus: 'synced', // Always synced with Yjs
      yearMonth: getYearMonth(expense.date),
      createdAt: Date.now()
    };
    
    ydoc.transact(() => {
      yExpenses.push([newExpense]);
    });
    
    return newExpense;
  }, [ydoc, yExpenses]);
  
  const updateExpense = useCallback((id: string, updates: Partial<Expense>) => {
    ydoc.transact(() => {
      const index = yExpenses.toArray().findIndex(e => e.id === id);
      if (index !== -1) {
        const existing = yExpenses.get(index);
        const updated = { ...existing, ...updates, updatedAt: Date.now() };
        yExpenses.delete(index, 1);
        yExpenses.insert(index, [updated]);
      }
    });
  }, [ydoc, yExpenses]);
  
  const deleteExpense = useCallback((id: string) => {
    ydoc.transact(() => {
      const index = yExpenses.toArray().findIndex(e => e.id === id);
      if (index !== -1) {
        yExpenses.delete(index, 1);
      }
    });
  }, [ydoc, yExpenses]);
  
  const getExpensesByMonth = useCallback((month: number, year: number): Expense[] => {
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    return expenses.filter(e => e.yearMonth === yearMonth).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [expenses]);
  
  // ============ PEOPLE OPERATIONS ============
  
  const addPerson = useCallback((name: string, claimedBy?: string) => {
    const newPerson: Person = {
      id: generateId(),
      name,
      syncId: generateId(),
      createdAt: Date.now(),
      claimedBy
    };
    
    ydoc.transact(() => {
      yPeople.push([newPerson]);
    });
    
    return newPerson;
  }, [ydoc, yPeople]);
  
  const updatePerson = useCallback((id: string, updates: Partial<Person>) => {
    ydoc.transact(() => {
      const index = yPeople.toArray().findIndex(p => p.id === id);
      if (index !== -1) {
        const existing = yPeople.get(index);
        const updated = { ...existing, ...updates, updatedAt: Date.now() };
        yPeople.delete(index, 1);
        yPeople.insert(index, [updated]);
      }
    });
  }, [ydoc, yPeople]);
  
  const deletePerson = useCallback((id: string) => {
    // Check if person is referenced
    const isReferenced = expenses.some(e => 
      e.payerId === id || 
      e.splitWith?.includes(id) ||
      (e.splitDetails && id in e.splitDetails)
    ) || payments.some(p => p.fromId === id || p.toId === id);
    
    if (isReferenced) {
      throw new Error('Cannot delete: This person is referenced by expenses or payments.');
    }
    
    ydoc.transact(() => {
      const index = yPeople.toArray().findIndex(p => p.id === id);
      if (index !== -1) {
        yPeople.delete(index, 1);
      }
    });
  }, [ydoc, yPeople, expenses, payments]);
  
  const claimPerson = useCallback((id: string, claimDeviceId: string) => {
    updatePerson(id, { claimedBy: claimDeviceId });
  }, [updatePerson]);
  
  // ============ PAYMENT OPERATIONS ============
  
  const addPayment = useCallback((payment: Omit<Payment, 'id' | 'syncId' | 'createdAt'>) => {
    const newPayment: Payment = {
      ...payment,
      id: generateId(),
      syncId: generateId(),
      createdAt: Date.now()
    };
    
    ydoc.transact(() => {
      yPayments.push([newPayment]);
    });
    
    return newPayment;
  }, [ydoc, yPayments]);
  
  const deletePayment = useCallback((id: string) => {
    ydoc.transact(() => {
      const index = yPayments.toArray().findIndex(p => p.id === id);
      if (index !== -1) {
        yPayments.delete(index, 1);
      }
    });
  }, [ydoc, yPayments]);
  
  // ============ SYNC OPERATIONS ============
  
  const connectToRoom = useCallback((roomName: string, password?: string) => {
    connect(roomName, password);
  }, [connect]);
  
  const disconnectFromRoom = useCallback(() => {
    disconnect();
  }, [disconnect]);
  
  // Get person name helper
  const getPersonName = useCallback((id: string): string => {
    const person = people.find(p => p.id === id);
    return person?.name || 'Unknown';
  }, [people]);
  
  return {
    // Data
    expenses,
    people,
    payments,
    
    // Connection state
    isConnected,
    connectedPeers,
    
    // Expense operations
    addExpense,
    updateExpense,
    deleteExpense,
    getExpensesByMonth,
    
    // People operations
    addPerson,
    updatePerson,
    deletePerson,
    claimPerson,
    getPersonName,
    
    // Payment operations
    addPayment,
    deletePayment,
    
    // Sync operations
    connect: connectToRoom,
    disconnect: disconnectFromRoom,
    setAwareness,
    
    // Raw Yjs access (for advanced use)
    ydoc,
    yExpenses,
    yPeople,
    yPayments
  };
}

// Helper to generate consistent color from ID
function getRandomColor(id: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
  ];
  
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

export default useYjsSync;
