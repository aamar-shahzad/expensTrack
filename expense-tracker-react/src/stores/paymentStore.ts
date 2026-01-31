import { create } from 'zustand';
import type { Payment } from '@/types';
import { generateId } from '@/types';

interface PaymentState {
  payments: Payment[];
  loading: boolean;
  
  // Yjs integration
  setPayments: (payments: Payment[]) => void;
  setLoading: (loading: boolean) => void;
  
  // Actions
  addPayment: (payment: Omit<Payment, 'id' | 'syncId' | 'createdAt'>) => Promise<Payment>;
  deletePayment: (id: string) => Promise<void>;
}

// Reference to Yjs operations (set by YjsStoreSync)
let yjsOperations: {
  addPayment?: (payment: Omit<Payment, 'id' | 'syncId' | 'createdAt'>) => Payment;
  deletePayment?: (id: string) => void;
} = {};

export function setYjsPaymentOperations(ops: typeof yjsOperations) {
  yjsOperations = ops;
}

export const usePaymentStore = create<PaymentState>((set) => ({
  payments: [],
  loading: false,

  // Set payments from Yjs observer
  setPayments: (payments) => {
    set({ payments, loading: false });
  },

  setLoading: (loading) => {
    set({ loading });
  },

  // Add payment via Yjs
  addPayment: async (payment) => {
    if (yjsOperations.addPayment) {
      return yjsOperations.addPayment(payment);
    }
    // Fallback: create locally
    const newPayment: Payment = {
      ...payment,
      id: generateId(),
      syncId: generateId(),
      createdAt: Date.now()
    };
    set(state => ({
      payments: [newPayment, ...state.payments]
    }));
    return newPayment;
  },

  // Delete payment via Yjs
  deletePayment: async (id) => {
    if (yjsOperations.deletePayment) {
      yjsOperations.deletePayment(id);
      return;
    }
    // Fallback: delete locally
    set(state => ({
      payments: state.payments.filter(p => p.id !== id)
    }));
  }
}));
