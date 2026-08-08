'use client'

import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { useAppStore } from '@/lib/store'

export default function Toast() {
  const { toast, hideToast } = useAppStore()

  if (!toast) return null

  const iconMap = {
    success: <CheckCircle2 size={20} className="text-emerald-500" />,
    error: <XCircle size={20} className="text-red-500" />,
    info: <Info size={20} className="text-blue-500" />,
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 toast-anim">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-100 flex items-center gap-3 px-4 py-3 pr-2 max-w-sm">
        {iconMap[toast.type]}
        <span className="text-sm font-medium text-slate-700">{toast.message}</span>
        <button
          onClick={hideToast}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 ml-1"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
