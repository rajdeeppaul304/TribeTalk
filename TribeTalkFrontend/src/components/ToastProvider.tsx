import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { X } from "lucide-react"

type Toast = { id: number; message: string; tone: "info" | "error" | "success" }
type ToastContextValue = { toast: (message: string, tone?: Toast["tone"]) => void }
const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random()
    setItems((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4500)
  }, [])
  const value = useMemo(() => ({ toast }), [toast])
  return <ToastContext.Provider value={value}>{children}<div className="pointer-events-none fixed bottom-5 right-5 z-[100] grid w-[min(360px,calc(100vw-2rem))] gap-2">{items.map((item) => <div key={item.id} role="status" className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl ${item.tone === "error" ? "border-red-300/30 bg-red-950/90 text-red-100" : item.tone === "success" ? "border-accent/30 bg-panel/95 text-accent-soft" : "border-white/10 bg-panel/95 text-paper"}`}><span className="min-w-0 flex-1">{item.message}</span><button className="icon-button -mr-2 -mt-2" aria-label="Dismiss notification" onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}><X size={15}/></button></div>)}</div></ToastContext.Provider>
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error("useToast must be used inside ToastProvider")
  return value.toast
}
