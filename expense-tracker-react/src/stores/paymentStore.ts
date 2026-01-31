import { create } from 'zustand';
import type { Payment } from '@/types';

interface PaymentState {
  payments: Payment[];
  loading: boolean;
  
  // Actions
  setPayments: (payments: Payment[]) => void;
  setLoading: (loading: boolean) => void;
  addPaymentToStore: (payment: Payment) => void;
  deletePaymentFromStore: (id: string) => void;
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  payments: [],
  loading: false,

  // Set payments from Yjs observer
  setPayments: (payments) => {
    set({ payments, loading: false });
  },

  setLoading: (loading) => {
    set({ loading });
  },

  // Add payment to local store (called after Yjs add)
  addPaymentToStore: (payment) => {
    set(state => ({
      payments: [payment, ...state.payments]
    }));
  },

  // Delete payment from local store (called after Yjs delete)
  deletePaymentFromStore: (id) => {
    set(state => ({
      payments: state.payments.filter(p => p.id !== id)
    }));
  }
}));
