import { X } from "lucide-react"
import type { ReactNode } from "react"
export default function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" onMouseDown={onClose}><section className="surface w-full max-w-lg rounded-2xl p-5" onMouseDown={(event) => event.stopPropagation()}><header className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold text-paper">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></header>{children}</section></div>
}
