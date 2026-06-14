import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  IconCheck,
  IconFile,
  IconMessageCircle,
  IconPaperclip,
  IconPlus,
  IconSearch,
  IconSend,
  IconShieldLock,
  IconUsers,
  IconWifi,
} from '@tabler/icons-react'
import { io, Socket } from 'socket.io-client'
import apiClient from '../api/client'
import { useAuthStore } from '../store/auth'
import type { ChatConversation, ChatMessage, User } from '../types'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { formatDateTime } from '../utils/formatters'
import { Modal } from '../components/ui/Modal'

let socket: Socket | null = null
type ChatUser = Pick<User, 'id' | 'login' | 'discord_username' | 'discord_avatar'>
type ConversationParticipant = NonNullable<ChatConversation['participants']>[number] & { user?: ChatUser }

function getSocket(token: string): Socket {
  if (!socket || !socket.connected) {
    socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    })
  }
  return socket
}

function initials(value: string): string {
  return value.trim().slice(0, 2).toUpperCase() || 'СН'
}

export function ChatPage() {
  const { user, accessToken } = useAuthStore()
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [body, setBody] = useState('')
  const [query, setQuery] = useState('')
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [users, setUsers] = useState<ChatUser[]>([])
  const [showNewConvModal, setShowNewConvModal] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const activeConvIdRef = useRef<string | null>(null)

  useEffect(() => {
    activeConvIdRef.current = activeConvId
  }, [activeConvId])

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiClient.get<ChatConversation[]>('/chat/conversations')
      setConversations(res.data)
    } catch {
      setConversations([])
    }
  }, [])

  useEffect(() => {
    fetchConversations()
    apiClient.get<ChatUser[]>('/chat/users').then((response) => setUsers(response.data)).catch(() => {})

    if (user && accessToken) {
      const currentSocket = getSocket(accessToken)
      socketRef.current = currentSocket

      currentSocket.on('new_message', (message: ChatMessage) => {
        if (message.conversation_id === activeConvIdRef.current) {
          setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
        setConversations((current) => current.map((conversation) =>
          conversation.id === message.conversation_id
            ? { ...conversation, messages: [message] }
            : conversation
        ))
      })
    }

    return () => {
      socketRef.current?.off('new_message')
      socketRef.current?.off('messages_read')
    }
  }, [user, accessToken, fetchConversations])

  const getConvName = useCallback((conversation: ChatConversation): string => {
    if (conversation.type === 'GENERAL') return 'Общий служебный канал'
    const other = (conversation.participants as ConversationParticipant[] | undefined)
      ?.find((participant) => participant.user_id !== user?.id)
    return other?.user?.login ?? 'Личная беседа'
  }, [user?.id])

  const getLastMessage = (conversation: ChatConversation): string => {
    const last = conversation.messages?.[0]
    if (!last) return 'Сообщений пока нет'
    const sender = last.sender?.login ?? 'Сотрудник'
    const content = last.body?.trim() || 'Прикреплён файл'
    return `${sender}: ${content.slice(0, 52)}${content.length > 52 ? '…' : ''}`
  }

  const isUnread = (conversation: ChatConversation): boolean => {
    const last = conversation.messages?.[0]
    if (!last || !user) return false
    return !last.read_by.includes(user.id) && last.sender_id !== user.id
  }

  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return conversations
    return conversations.filter((conversation) =>
      getConvName(conversation).toLowerCase().includes(normalized)
      || getLastMessage(conversation).toLowerCase().includes(normalized)
    )
  }, [conversations, getConvName, query])

  const activeConversation = conversations.find((conversation) => conversation.id === activeConvId)
  const activeParticipants = (activeConversation?.participants as ConversationParticipant[] | undefined) ?? []

  const selectConversation = async (conversationId: string) => {
    setActiveConvId(conversationId)
    setMessagesLoading(true)
    try {
      const response = await apiClient.get<ChatMessage[]>(`/chat/conversations/${conversationId}/messages`)
      setMessages(response.data)
      socketRef.current?.emit('join_conversation', conversationId)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {
      setMessages([])
    } finally {
      setMessagesLoading(false)
    }
  }

  const handleSend = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!body.trim() || !activeConvId || sending) return
    const messageBody = body.trim()
    setBody('')
    setSending(true)
    try {
      await apiClient.post(`/chat/conversations/${activeConvId}/messages`, { body: messageBody })
    } catch {
      setBody(messageBody)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || !activeConvId) return
    const formData = new FormData()
    Array.from(files).forEach((file) => formData.append('files', file))
    setUploading(true)
    try {
      await apiClient.post(`/chat/conversations/${activeConvId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    } catch {
      window.alert('Не удалось загрузить вложение')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCreateConversation = async (type: 'GENERAL' | 'DIRECT') => {
    try {
      const payload = type === 'DIRECT' ? { type, user_id: selectedUserId } : { type }
      const response = await apiClient.post<ChatConversation>('/chat/conversations', payload)
      setShowNewConvModal(false)
      setSelectedUserId('')
      await fetchConversations()
      await selectConversation(response.data.id)
    } catch {
      window.alert('Не удалось создать беседу')
    }
  }

  return (
    <div className="communications-page">
      <header className="communications-heading">
        <div>
          <span>Защищённый контур</span>
          <h1>Служебная связь</h1>
          <p>Сообщения, рабочие файлы и быстрые диалоги сотрудников в одном пространстве.</p>
        </div>
        <div className="communications-status"><IconWifi size={16} /><span><strong>СОНАР online</strong><small>Соединение защищено</small></span></div>
      </header>

      <section className="communications-workspace">
        <aside className="communications-inbox">
          <header>
            <div><span>Входящие</span><strong>{conversations.length} бесед</strong></div>
            <button type="button" onClick={() => setShowNewConvModal(true)} aria-label="Новая беседа"><IconPlus size={18} /></button>
          </header>
          <label className="communications-search">
            <IconSearch size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти беседу" />
          </label>
          <div className="communications-list">
            {filteredConversations.length === 0 && (
              <div className="communications-list-empty"><IconMessageCircle size={24} /><strong>Бесед не найдено</strong><span>Создайте новую или измените запрос.</span></div>
            )}
            {filteredConversations.map((conversation) => {
              const name = getConvName(conversation)
              const unread = isUnread(conversation)
              return (
                <button
                  type="button"
                  key={conversation.id}
                  className={`communications-thread${conversation.id === activeConvId ? ' is-active' : ''}`}
                  onClick={() => selectConversation(conversation.id)}
                >
                  <span className={conversation.type === 'GENERAL' ? 'is-channel' : ''}>
                    {conversation.type === 'GENERAL' ? <IconUsers size={18} /> : initials(name)}
                  </span>
                  <div><strong>{name}</strong><small>{getLastMessage(conversation)}</small></div>
                  {unread && <i />}
                </button>
              )
            })}
          </div>
        </aside>

        <main className="communications-conversation">
          {!activeConversation ? (
            <div className="communications-welcome">
              <span><IconMessageCircle size={31} /></span>
              <small>Служебная связь СОНАР</small>
              <h2>Выберите рабочую беседу</h2>
              <p>Здесь появится история сообщений, вложения и сведения об участниках защищённого канала.</p>
              <Button variant="primary" onClick={() => setShowNewConvModal(true)}><IconPlus size={16} />Новая беседа</Button>
            </div>
          ) : (
            <>
              <header className="communications-conversation-head">
                <span className="communications-avatar">{activeConversation.type === 'GENERAL' ? <IconUsers size={20} /> : initials(getConvName(activeConversation))}</span>
                <div><strong>{getConvName(activeConversation)}</strong><small><i /> Защищённая служебная беседа</small></div>
                <span className="communications-encryption"><IconShieldLock size={15} /> Внутренний контур</span>
              </header>

              <div className="communications-messages">
                {messagesLoading && <div className="communications-loading"><i /><span>Загружаем историю</span></div>}
                {!messagesLoading && messages.length === 0 && (
                  <div className="communications-day-zero"><span>Беседа создана</span><p>Отправьте первое служебное сообщение.</p></div>
                )}
                {messages.map((message) => {
                  const isOwn = message.sender_id === user?.id
                  return (
                    <article key={message.id} className={`communications-message${isOwn ? ' is-own' : ''}`}>
                      {!isOwn && <span className="communications-message-avatar">{initials(message.sender?.login ?? '?')}</span>}
                      <div>
                        <header><strong>{isOwn ? 'Вы' : message.sender?.login ?? 'Сотрудник'}</strong><time>{formatDateTime(message.created_at)}</time></header>
                        {message.body && <p>{message.body}</p>}
                        {message.attachments?.map((attachment) => (
                          attachment.mime_type.startsWith('image/') ? (
                            <button className="communications-image" type="button" key={attachment.id} onClick={() => window.open(attachment.url, '_blank')}>
                              <img src={attachment.url} alt={attachment.original_name} />
                              <span>{attachment.original_name}</span>
                            </button>
                          ) : (
                            <a className="communications-file" key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer">
                              <IconFile size={18} /><span><strong>{attachment.original_name}</strong><small>Открыть вложение</small></span>
                            </a>
                          )
                        ))}
                        {isOwn && <footer><IconCheck size={13} /> Доставлено</footer>}
                      </div>
                    </article>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <form className="communications-composer" onSubmit={handleSend}>
                <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileUpload} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Прикрепить файл"><IconPaperclip size={19} /></button>
                <label>
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Напишите служебное сообщение"
                    rows={1}
                    onInput={(event) => {
                      const textarea = event.currentTarget
                      textarea.style.height = 'auto'
                      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
                    }}
                  />
                  <small>Enter — отправить · Shift+Enter — новая строка</small>
                </label>
                <button className="communications-send" type="submit" disabled={!body.trim() || sending} aria-label="Отправить"><IconSend size={18} /></button>
              </form>
            </>
          )}
        </main>

        {activeConversation && (
          <aside className="communications-context">
            <div className="communications-context-seal"><IconShieldLock size={24} /></div>
            <span>Параметры канала</span>
            <h3>{activeConversation.type === 'GENERAL' ? 'Общий доступ' : 'Личный диалог'}</h3>
            <p>Переписка доступна только участникам этого служебного контура.</p>
            <dl>
              <div><dt>Шифрование</dt><dd><i /> Активно</dd></div>
              <div><dt>Вложения</dt><dd>до 20 МБ</dd></div>
              <div><dt>Участники</dt><dd>{activeParticipants.length}</dd></div>
            </dl>
            <div className="communications-participants">
              <strong>Участники</strong>
              {activeParticipants.slice(0, 6).map((participant) => (
                <div key={participant.id}><span>{initials(participant.user?.login ?? '?')}</span><b>{participant.user?.login ?? 'Сотрудник'}</b></div>
              ))}
            </div>
          </aside>
        )}
      </section>

      <Modal
        open={showNewConvModal}
        onClose={() => setShowNewConvModal(false)}
        title="Новая служебная беседа"
        description="Откройте общий канал или личный защищённый диалог."
        width={560}
        footer={<Button variant="secondary" onClick={() => setShowNewConvModal(false)}>Закрыть</Button>}
      >
        <div className="communications-new-options">
          <button type="button" onClick={() => handleCreateConversation('GENERAL')}>
            <span><IconUsers size={21} /></span><div><strong>Общий служебный канал</strong><small>Единое пространство для сотрудников</small></div>
          </button>
          <section>
            <div><span><IconShieldLock size={21} /></span><div><strong>Личный диалог</strong><small>Выберите одного получателя</small></div></div>
            <Select
              options={users.filter((item) => item.id !== user?.id).map((item) => ({ value: item.id, label: item.login }))}
              placeholder="Выберите сотрудника"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              searchable
            />
            <Button variant="primary" disabled={!selectedUserId} onClick={() => handleCreateConversation('DIRECT')}>Начать диалог</Button>
          </section>
        </div>
      </Modal>
    </div>
  )
}
