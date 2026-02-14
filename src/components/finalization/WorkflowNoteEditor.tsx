import React, { useState, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Bold, Italic, Underline, List, ListOrdered, Undo, Redo, MessageSquare, User } from "lucide-react"
import { Button } from "../ui/button"
import { Separator } from "../ui/separator"

declare global {
  interface Window {
    noteEditorInsertText?: (text: string) => void
  }
}

interface HighlightRange {
  start: number
  end: number
  className?: string
  label?: string
}

interface WorkflowNoteEditorProps {
  content: string
  onChange: (content: string) => void
  highlightRanges?: HighlightRange[]
  disabled?: boolean
  questionsCount?: number
  onShowQuestions?: () => void
  onInsertText?: (text: string) => void
}

export function WorkflowNoteEditor({
  content,
  onChange,
  highlightRanges = [],
  disabled = false,
  questionsCount = 0,
  onShowQuestions,
  onInsertText
}: WorkflowNoteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertText = (text: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newContent = content.slice(0, start) + text + content.slice(end)
    onChange(newContent)

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + text.length
      textarea.focus()
    }, 0)
  }

  React.useEffect(() => {
    if (onInsertText) {
      window.noteEditorInsertText = insertText
    }
    return () => {
      if (window.noteEditorInsertText) {
        delete window.noteEditorInsertText
      }
    }
  }, [onInsertText, content])

  const formatSelection = (prefix: string, suffix: string = prefix) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.slice(start, end)

    if (selectedText) {
      const newContent = content.slice(0, start) + prefix + selectedText + suffix + content.slice(end)
      onChange(newContent)

      setTimeout(() => {
        textarea.selectionStart = start + prefix.length
        textarea.selectionEnd = end + prefix.length
        textarea.focus()
      }, 0)
    }
  }

  const hasHighlights = highlightRanges && highlightRanges.length > 0

  const renderTextHighlights = () => {
    if (!hasHighlights || !highlightRanges.length || !content) return null

    const parts: Array<{
      text: string
      isHighlight: boolean
      highlightIndex?: number
    }> = []
    let lastIndex = 0

    const sortedRanges = [...highlightRanges].sort((a, b) => a.start - b.start)

    sortedRanges.forEach((range, index) => {
      if (range.start >= content.length || range.end > content.length || range.start >= range.end) {
        return
      }

      if (range.start > lastIndex) {
        parts.push({
          text: content.slice(lastIndex, range.start),
          isHighlight: false
        })
      }

      parts.push({
        text: content.slice(range.start, range.end),
        isHighlight: true,
        highlightIndex: index
      })

      lastIndex = range.end
    })

    if (lastIndex < content.length) {
      parts.push({
        text: content.slice(lastIndex),
        isHighlight: false
      })
    }

    const colors = [
      { bg: "rgba(59, 130, 246, 0.2)", border: "rgba(59, 130, 246, 0.5)" },
      { bg: "rgba(16, 185, 129, 0.2)", border: "rgba(16, 185, 129, 0.5)" },
      { bg: "rgba(245, 158, 11, 0.2)", border: "rgba(245, 158, 11, 0.5)" },
      { bg: "rgba(139, 92, 246, 0.2)", border: "rgba(139, 92, 246, 0.5)" }
    ]

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 pointer-events-none whitespace-pre-wrap text-transparent"
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif',
          fontSize: "14px",
          lineHeight: "1.6",
          color: "transparent",
          wordBreak: "break-word",
          overflowWrap: "break-word",
          padding: "0",
          margin: "0",
          border: "none",
          outline: "none",
          boxSizing: "border-box"
        }}
      >
        {parts.map((part, partIndex) => {
          if (!part.isHighlight) {
            return (
              <span key={partIndex} style={{ color: "transparent" }}>
                {part.text}
              </span>
            )
          }

          const colorSet = colors[(part.highlightIndex || 0) % colors.length]

          return (
            <motion.span
              key={partIndex}
              initial={{ backgroundColor: "transparent" }}
              animate={{
                backgroundColor: [
                  colorSet.bg,
                  colorSet.bg.replace("0.2", "0.3"),
                  colorSet.bg.replace("0.2", "0.35"),
                  colorSet.bg.replace("0.2", "0.3"),
                  colorSet.bg
                ]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: (part.highlightIndex || 0) * 0.3
              }}
              className="relative rounded-sm"
              style={{
                backgroundColor: colorSet.bg,
                color: "transparent",
                boxShadow: `0 0 0 1px ${colorSet.border}, 0 1px 3px ${colorSet.border}20`,
                margin: "0",
                padding: "0"
              }}
            >
              {part.text}

              <motion.span
                className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full shadow-sm"
                style={{ backgroundColor: colorSet.border }}
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: (part.highlightIndex || 0) * 0.2
                }}
              />
            </motion.span>
          )
        })}
      </motion.div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white border-b border-slate-200/50 px-4 py-4"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-slate-600 rounded-md flex items-center justify-center">
            <User size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 mb-1">John Smith</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-mono">ENC-2024-001247</span>
              <span>•</span>
              <span className="font-mono">PT-789456</span>
            </div>
          </div>

          {questionsCount > 0 && onShowQuestions && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onShowQuestions}
              className="h-9 px-4 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
              title={`${questionsCount} patient question${questionsCount !== 1 ? "s" : ""} available`}
            >
              <MessageSquare size={13} className="mr-1.5" />
              Patient Questions
              <div className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold ml-2">
                {questionsCount}
              </div>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 hover:bg-slate-50 text-slate-800 hover:text-slate-900"
              onClick={() => formatSelection("**", "**")}
              title="Bold"
            >
              <Bold size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 hover:bg-slate-50 text-slate-800 hover:text-slate-900"
              onClick={() => formatSelection("*", "*")}
              title="Italic"
            >
              <Italic size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 hover:bg-slate-50 text-slate-800 hover:text-slate-900"
              onClick={() => formatSelection("_", "_")}
              title="Underline"
            >
              <Underline size={16} />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6 mx-1 bg-slate-200" />

          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 hover:bg-slate-50 text-slate-800 hover:text-slate-900"
              onClick={() => insertText("\n• ")}
              title="Bullet List"
            >
              <List size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 hover:bg-slate-50 text-slate-800 hover:text-slate-900"
              onClick={() => insertText("\n1. ")}
              title="Numbered List"
            >
              <ListOrdered size={16} />
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 hover:bg-slate-50 text-slate-800 hover:text-slate-900"
              title="Undo"
            >
              <Undo size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 hover:bg-slate-50 text-slate-800 hover:text-slate-900"
              title="Redo"
            >
              <Redo size={16} />
            </Button>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={`flex-1 relative rounded-lg border transition-all duration-500 overflow-hidden ${
          hasHighlights ? "border-blue-200/70 shadow-lg shadow-blue-500/10" : "border-slate-200/50"
        }`}
      >
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #fcfcfd 0%, #fafbfc 50%, #f8f9fb 100%)" }}
        ></div>
        <AnimatePresence>
          {hasHighlights && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute inset-0 pointer-events-none z-0 rounded-lg"
              style={{
                background: "radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.025) 0%, transparent 60%)",
                boxShadow: "inset 0 0 0 1px rgba(59, 130, 246, 0.08)"
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {disabled && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-0 pointer-events-none z-5 rounded-lg"
              style={{
                background: "linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, rgba(99, 102, 241, 0.015) 100%)",
                backdropFilter: "blur(0.5px)"
              }}
            />
          )}
        </AnimatePresence>

        <div className="absolute inset-4">
          <div
            className="relative w-full h-full rounded-lg shadow-sm border border-slate-200/30 backdrop-blur-sm"
            style={{ background: "linear-gradient(135deg, #fdfdfe 0%, #fbfcfd 50%, #f9fafc 100%)" }}
          >
            <div className="absolute inset-4">
              <div className="relative w-full h-full">
                <div className="absolute inset-0 pointer-events-none z-20">
                  <AnimatePresence>{renderTextHighlights()}</AnimatePresence>
                </div>

                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => !disabled && onChange(e.target.value)}
                  className={`w-full h-full resize-none border-none bg-white focus:ring-0 focus:outline-none relative z-10 text-slate-900 transition-all duration-300 ${
                    disabled ? "cursor-default select-none opacity-90" : ""
                  }`}
                  placeholder="Start documenting the medical note..."
                  disabled={disabled}
                  style={{
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif',
                    fontSize: "14px",
                    lineHeight: "1.6",
                    padding: "0",
                    margin: "0",
                    border: "none",
                    outline: "none",
                    boxSizing: "border-box",
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                    pointerEvents: disabled ? "none" : "auto",
                    backgroundColor: "#ffffff"
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 py-2 bg-slate-50 border-t border-slate-200/50"
      >
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-1.5 h-1.5 bg-green-500 rounded-full"
            />
            <span>{disabled ? "Viewing evidence highlights" : "Auto-saving draft"}</span>
          </div>

          <div className="text-xs text-slate-500">Characters: {content.length}</div>
        </div>
      </motion.div>
    </div>
  )
}
