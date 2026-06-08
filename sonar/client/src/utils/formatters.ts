import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd.MM.yyyy', { locale: ru })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd.MM.yyyy HH:mm', { locale: ru })
}

export function formatAmount(amount: number): string {
  return `${amount.toLocaleString('ru-RU')} у.е.`
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Активен',
  INACTIVE: 'Неактивен',
  UNDER_INVESTIGATION: 'Под следствием',
  EXILED: 'В изгнании',
  BANNED: 'Забанен',
  VALID: 'Действителен',
  REVOKED: 'Отозван',
  EXPIRED: 'Истёк',
  OPENED: 'Открыто',
  IN_PROGRESS: 'В процессе',
  CLOSED: 'Закрыто',
  ACQUITTED: 'Оправдан',
  CONVICTED: 'Осуждён',
  UNPAID: 'Не оплачен',
  PAID: 'Оплачен',
  CANCELLED: 'Отменён',
  BAN: 'Бан',
  WARNING: 'Предупреждение',
  FINE: 'Штраф',
  EXILE: 'Изгнание',
  OTHER: 'Иное',
  DEVELOPED: 'Освоена',
  UNDER_CONSTRUCTION: 'В строительстве',
  DISPUTED: 'Спорная',
  NEUTRAL: 'Нейтральная',
  ALLIANCE: 'Союз',
  TENSION: 'Напряжённость',
  WAR: 'Война',
  RESIDENTIAL: 'Жилое',
  GOVERNMENT: 'Государственное',
  COMMERCIAL: 'Коммерческое',
  MILITARY: 'Военное',
  ABANDONED: 'Заброшено',
  DEMOLISHED: 'Снесено',
  LAW: 'Закон',
  DECREE: 'Указ',
  CONSTITUTION: 'Конституционный акт',
  REGULATION: 'Постановление',
  ORDER: 'Распоряжение',
  REPEALED: 'Отменён',
  SUSPENDED: 'Приостановлен',
  NON_AGGRESSION: 'Пакт о ненападении',
  TRADE: 'Торговый',
  TERMINATED: 'Расторгнут',
  DIRECT: 'Личный',
  GENERAL: 'Общий',
}

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#16A34A',
  INACTIVE: '#6B7280',
  UNDER_INVESTIGATION: '#D97706',
  EXILED: '#EA580C',
  BANNED: '#DC2626',
  VALID: '#16A34A',
  REVOKED: '#DC2626',
  EXPIRED: '#6B7280',
  OPENED: '#3B82F6',
  IN_PROGRESS: '#D97706',
  CLOSED: '#6B7280',
  ACQUITTED: '#16A34A',
  CONVICTED: '#DC2626',
  UNPAID: '#DC2626',
  PAID: '#16A34A',
  CANCELLED: '#6B7280',
  BAN: '#DC2626',
  WARNING: '#D97706',
  FINE: '#EA580C',
  EXILE: '#7C3AED',
  DEVELOPED: '#16A34A',
  UNDER_CONSTRUCTION: '#D97706',
  DISPUTED: '#EA580C',
  NEUTRAL: '#6B7280',
  ALLIANCE: '#16A34A',
  TENSION: '#D97706',
  WAR: '#DC2626',
  ABANDONED: '#6B7280',
  DEMOLISHED: '#374151',
  REPEALED: '#DC2626',
  SUSPENDED: '#D97706',
  TERMINATED: '#DC2626',
  LAW: '#14715A',
  DECREE: '#14715A',
  CONSTITUTION: '#7C3AED',
  REGULATION: '#0E7490',
  ORDER: '#B45309',
}

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#6B7280'
}
