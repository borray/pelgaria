import React, { useState, useEffect, useRef, useCallback } from 'react'
import { IconSend, IconPaperclip, IconPlus } from '@tabler/icons-react'
import { io, Socket } from 'socket.io-client'
import apiClient from '../api/client'
import { useAuthStore } from '../store/auth'
import type { ChatConversation, ChatMessage, User } from '../types'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { formatDateTime } from '../utils/formatters'

let socket: Socket | null = null
type ChatUser = Pick<User, 'id' | 'login' | 'discord_username' | 'discord_avatar'>

function getSocket(token: string): Socket {
  if (!socket || !socket.connected) {
    socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    })
  }
  return socket
}

export function ChatPage() {
  const { user, accessToken } = useAuthStore()
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [body, setBody] = useState('')
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [users, setUsers] = useState<ChatUser[]>([])
  const [showNewConvModal, setShowNewConvModal] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const socketRef = useRef<Socket | null>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiClient.get<ChatConversation[]>('/chat/conversations')
      setConversations(res.data)
    } catch { setConversations([]) }
  }, [])

  useEffect(() => {
    fetchConversations()
    apiClient.get<ChatUser[]>('/chat/users').then((r) => setUsers(r.data)).catch(() => {})

    if (user && accessToken) {
      const sock = getSocket(accessToken)
      socketRef.current = sock

      sock.on('new_message', (message: ChatMessage) => {
        setMessages((prev) => {
          if (prev.find((m) => m.id === message.id)) return prev
          return [...prev, message]
        })
        setConversations((prev) =>
          prev.map((c) =>
            c.id === message.conversation_id
              ? { ...c, messages: [message] }
              : c
          )
        )
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })

      sock.on('messages_read', () => {
        // refresh read state if needed
      })
    }

    return () => {
      socketRef.current?.off('new_message')
      socketRef.current?.off('messages_read')
    }
  }, [user, accessToken, fetchConversations])

  const selectConversation = async (convId: string) => {
    setActiveConvId(convId)
    setMessagesLoading(true)
    try {
      const res = await apiClient.get<ChatMessage[]>(`/chat/conversations/${convId}/messages`)
      setMessages(res.data)
      socketRef.current?.emit('join_conversation', convId)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {
      setMessages([])
    } finally {
      setMessagesLoading(false)
    }
  }

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!body.trim() || !activeConvId || sending) return
    const msgBody = body.trim()
    setBody('')
    setSending(true)
    try {
      await apiClient.post(`/chat/conversations/${activeConvId}/messages`, { body: msgBody })
    } catch { setBody(msgBody) }
    finally { setSending(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !activeConvId) return
    const formData = new FormData()
    Array.from(files).forEach((f) => formData.append('files', f))
    try {
      await apiClient.post(`/chat/conversations/${activeConvId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    } catch { alert('Ошибка загрузки файла') }
    finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCreateConversation = async (type: 'GENERAL' | 'DIRECT') => {
    try {
      const payload = type === 'DIRECT' ? { type, user_id: selectedUserId } : { type }
      const res = await apiClient.post<ChatConversation>('/chat/conversations', payload)
      setShowNewConvModal(false)
      setSelectedUserId('')
      fetchConversations()
      selectConversation(res.data.id)
    } catch { alert('Ошибка создания беседы') }
  }

  const activeConv = conversations.find((c) => c.id === activeConvId)

  const getConvName = (conv: ChatConversation): string => {
    if (conv.type === 'GENERAL') return 'Общий чат'
    const other = conv.participants?.find((p) => p.user_id !== user?.id)
    if (other) {
      const otherUser = (other as typeof other & { user?: { login: string } }).user
      if (otherUser) return otherUser.login
    }
    return 'Личная беседа'
  }

  const getLastMsg = (conv: ChatConversation): string => {
    const last = conv.messages?.[0]
    if (!last) return 'Нет сообщений'
    const s = (last.sender as { login: string } | undefined)?.login ?? '?'
    return `${s}: ${last.body?.slice(0, 40) ?? '[файл]'}${(last.body?.length ?? 0) > 40 ? '…' : ''}`
  }

  const isUnread = (conv: ChatConversation): boolean => {
    const last = conv.messages?.[0]
    if (!last || !user) return false
    const readBy = last.read_by as string[]
    return !readBy.includes(user.id) && last.sender_id !== user.id
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 100px)', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      {/* Left panel */}
      <div style={{ width: '260px', borderRight: '0.5px solid #D0D7E3', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #D0D7E3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#0A1628' }}>Чат</span>
          <button
            onClick={() => setShowNewConvModal(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', padding: '2px' }}
            title="Новая беседа"
          >
            <IconPlus size={16} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {conversations.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>Нет бесед</div>
          )}
          {conversations.map((conv) => {
            const unread = isUnread(conv)
            const isActive = conv.id === activeConvId
            return (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: isActive ? '#EFF6FF' : 'transparent',
                  borderBottom: '0.5px solid #F3F4F6',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = '#F8F9FB' }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <div style={{ fontSize: '13px', fontWeight: unread || isActive ? 600 : 400, color: '#0A1628', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getConvName(conv)}
                </div>
                <div style={{ fontSize: '12px', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getLastMsg(conv)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!activeConvId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: '14px' }}>
            Выберите беседу
          </div>
        ) : (
          <>
            <div style={{ padding: '12px 20px', borderBottom: '0.5px solid #D0D7E3', background: '#F8F9FB' }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#0A1628' }}>
                {activeConv ? getConvName(activeConv) : ''}
              </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {messagesLoading && <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>Загрузка...</div>}
              {messages.map((msg) => {
                const isOwn = msg.sender_id === user?.id
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: isOwn ? '#4A90D9' : '#374151' }}>
                        {msg.sender?.login ?? '?'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{formatDateTime(msg.created_at)}</span>
                    </div>
                    {msg.body && (
                      <div style={{ maxWidth: '80%', padding: '8px 12px', borderRadius: '8px', background: isOwn ? '#4A90D9' : '#F3F4F6', color: isOwn ? '#FFFFFF' : '#1F2937', fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.body}
                      </div>
                    )}
                    {msg.attachments?.map((att) => (
                      <div key={att.id} style={{ marginTop: '4px' }}>
                        {att.mime_type.startsWith('image/') ? (
                          <img src={att.url} alt={att.original_name} style={{ maxWidth: '240px', maxHeight: '180px', borderRadius: '4px', border: '0.5px solid #D0D7E3', cursor: 'pointer' }} onClick={() => window.open(att.url, '_blank')} />
                        ) : (
                          <a href={att.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: '#F3F4F6', borderRadius: '4px', fontSize: '13px', color: '#4A90D9', textDecoration: 'none', border: '0.5px solid #D0D7E3' }}>
                            📎 {att.original_name}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            <div style={{ borderTop: '0.5px solid #D0D7E3', padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ background: 'none', border: '1px solid #D0D7E3', borderRadius: '4px', cursor: 'pointer', color: '#6B7280', padding: '6px', display: 'flex', alignItems: 'center', flexShrink: 0, height: '36px', width: '36px', justifyContent: 'center' }}
                title="Прикрепить файл"
              >
                <IconPaperclip size={16} />
              </button>
              <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Сообщение... (Enter — отправить, Shift+Enter — новая строка)"
                rows={1}
                style={{ flex: 1, resize: 'none', padding: '8px 10px', border: '1px solid #D0D7E3', borderRadius: '4px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#1F2937', outline: 'none', maxHeight: '120px', overflow: 'auto' }}
                onInput={(e) => {
                  const ta = e.currentTarget
                  ta.style.height = 'auto'
                  ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
                }}
              />
              <Button variant="primary" size="sm" onClick={() => handleSend()} loading={sending} disabled={!body.trim()} style={{ height: '36px', flexShrink: 0 }}>
                <IconSend size={14} />
              </Button>
            </div>
          </>
        )}
      </div>

      {showNewConvModal && (
        <div onClick={() => setShowNewConvModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: '4px', padding: '24px', width: '360px', fontFamily: 'Inter, sans-serif' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#0A1628' }}>Новая беседа</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Button variant="secondary" onClick={() => handleCreateConversation('GENERAL')} style={{ justifyContent: 'flex-start' }}>
                Общий чат
              </Button>
              <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '12px' }}>
                <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px' }}>Личная беседа</div>
                <Select
                  options={users.filter((u) => u.id !== user?.id).map((u) => ({ value: u.id, label: u.login }))}
                  placeholder="— Выберите пользователя —"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  searchable
                  style={{ marginBottom: '8px' }}
                />
                <Button variant="primary" disabled={!selectedUserId} onClick={() => handleCreateConversation('DIRECT')}>
                  Начать беседу
                </Button>
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="secondary" size="sm" onClick={() => setShowNewConvModal(false)}>Закрыть</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
