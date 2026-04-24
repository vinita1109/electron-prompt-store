'use client'

import { createContext, useContext } from 'react'

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'info'
  title: string
  description?: string
}

export type ToastInput = Omit<Toast, 'id'>

interface ToastContextValue {
  push: (toast: ToastInput) => void
}

export const ToastContext = createContext<ToastContextValue>({
  push: () => {
    /* noop default */
  }
})

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}

export function newToastId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}
