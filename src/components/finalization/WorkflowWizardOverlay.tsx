import React, { useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X } from "lucide-react"
import { WorkflowWizard } from "./WorkflowWizard"

interface WorkflowWizardOverlayProps {
  isOpen: boolean
  onClose: () => void
  initialNoteContent?: string
  encounterId?: string
}

export function WorkflowWizardOverlay({ isOpen, onClose, initialNoteContent, encounterId }: WorkflowWizardOverlayProps) {
  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-white"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-[110] w-10 h-10 rounded-full bg-white/90 border border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300 shadow-sm flex items-center justify-center"
            aria-label="Close finalization wizard"
          >
            <X size={18} />
          </button>
          <WorkflowWizard initialNoteContent={initialNoteContent} encounterId={encounterId} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
