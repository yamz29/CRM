'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10),
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}` }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión' }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages])

  const sendDirect = (text: string) => {
    if (loading) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: messages.slice(-10) }),
    })
      .then(async (res) => {
        const data = await res.json()
        setMessages(prev => [...prev, { role: 'assistant', content: res.ok ? data.reply : `Error: ${data.error}` }])
      })
      .catch(() => {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión' }])
      })
      .finally(() => setLoading(false))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:scale-105 transition-all flex items-center justify-center"
          title="Asistente IA"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[550px] max-h-[calc(100vh-4rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <div>
                <p className="font-semibold text-sm">Asistente Gonzalva</p>
                <p className="text-[10px] text-blue-200">Conectado al CRM</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8 space-y-3">
                <Bot className="w-10 h-10 mx-auto text-blue-500 opacity-60" />
                <div>
                  <p className="font-medium text-foreground text-sm">Hola, soy el asistente del CRM</p>
                  <p className="text-xs text-muted-foreground mt-1">Pregunta sobre proyectos, clientes, facturas, producción...</p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                  {[
                    '¿Cuánto tenemos por cobrar?',
                    '¿Qué proyectos están activos?',
                    'Resumen del pipeline',
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => sendDirect(q)}
                      className="text-[11px] px-2.5 py-1.5 rounded-full border border-border bg-muted/50 hover:bg-muted text-foreground transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                }`}>
                  {msg.role === 'assistant' ? <MarkdownLite text={msg.content} /> : msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 items-center">
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="bg-muted rounded-xl px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregunta algo..."
                className="flex-1 px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Simple markdown renderer for bold, lists, and line breaks
function MarkdownLite({ text }: { text: string }) {
  const lines = text.split('\n')

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        // Bold
        let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // List items
        const isList = /^[-•]\s/.test(line)
        if (isList) {
          processed = processed.replace(/^[-•]\s/, '')
          return <div key={i} className="flex gap-1.5"><span className="text-muted-foreground">•</span><span dangerouslySetInnerHTML={{ __html: processed }} /></div>
        }
        // Empty line
        if (!line.trim()) return <div key={i} className="h-1" />
        // Normal line
        return <div key={i} dangerouslySetInnerHTML={{ __html: processed }} />
      })}
    </div>
  )
}
