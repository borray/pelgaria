export interface Role {
  id: string
  name: string
  color: string
  is_system: boolean
  permissions: Record<string, boolean>
  created_at: string
  _count?: { users: number }
}

export interface User {
  id: string
  login: string
  role_id: string
  role: Pick<Role, 'id' | 'name' | 'color'>
  citizen_id?: string | null
  citizen?: Pick<Citizen, 'id' | 'reg_number' | 'nickname'> | null
  discord_id?: string | null
  discord_username?: string | null
  discord_avatar?: string | null
  is_active: boolean
  must_change_password: boolean
  created_at: string
  last_login_at?: string | null
  permissions: Record<string, boolean>
}

export type CitizenStatus = 'ACTIVE' | 'INACTIVE' | 'UNDER_INVESTIGATION' | 'EXILED' | 'BANNED'

export interface Citizen {
  id: string
  reg_number: string
  nickname: string
  discord_username?: string | null
  role_title: string
  status: CitizenStatus
  joined_at: string
  note?: string | null
  created_at: string
  user?: Pick<User, 'id' | 'login' | 'is_active'> | null
  passports?: Passport[]
  cases?: Case[]
  punishments?: Punishment[]
  tax_charges?: TaxCharge[]
  buildings?: Building[]
  _count?: { passports: number; cases: number; punishments: number }
}

export type PassportStatus = 'VALID' | 'REVOKED' | 'EXPIRED'

export interface Passport {
  id: string
  number: string
  registry_code?: string | null
  citizen_id: string
  citizen?: Pick<Citizen, 'id' | 'reg_number' | 'nickname'>
  issued_at: string
  expires_at?: string | null
  status: PassportStatus
  previous_numbers: string[]
  issued_by_id: string
  issued_by?: Pick<User, 'id' | 'login'>
}

export type LawType = 'LAW' | 'DECREE'
export type LawStatus = 'ACTIVE' | 'REPEALED' | 'SUSPENDED'

export interface Law {
  id: string
  number: string
  registry_code?: string | null
  type: LawType
  title: string
  body: string
  status: LawStatus
  adopted_at: string
  repealed_at?: string | null
}

export type CaseStatus = 'OPENED' | 'IN_PROGRESS' | 'CLOSED'
export type CaseOutcome = 'ACQUITTED' | 'CONVICTED'
export type VerdictType = 'FINE' | 'WARNING' | 'EXILE' | 'OTHER'

export interface Case {
  id: string
  number: string
  registry_code?: string | null
  accused_id: string
  accused?: Pick<Citizen, 'id' | 'reg_number' | 'nickname'>
  law_id?: string | null
  law?: Pick<Law, 'id' | 'number' | 'title'> | null
  description: string
  judge_id?: string | null
  judge?: Pick<User, 'id' | 'login'> | null
  status: CaseStatus
  outcome?: CaseOutcome | null
  verdict_type?: VerdictType | null
  verdict_amount?: number | null
  verdict_note?: string | null
  opened_at: string
  closed_at?: string | null
  punishments?: Punishment[]
}

export type PunishmentType = 'BAN' | 'WARNING' | 'FINE' | 'EXILE'
export type PunishmentStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED'

export interface Punishment {
  id: string
  number?: string | null
  registry_code?: string | null
  citizen_id: string
  citizen?: Pick<Citizen, 'id' | 'reg_number' | 'nickname'>
  type: PunishmentType
  reason: string
  case_id?: string | null
  case?: Pick<Case, 'id' | 'number'> | null
  issued_by_id: string
  issued_by?: Pick<User, 'id' | 'login'>
  issued_at: string
  expires_at?: string | null
  revoked_by_id?: string | null
  revoked_by?: Pick<User, 'id' | 'login'> | null
  revoked_at?: string | null
  status: PunishmentStatus
}

export type TaxChargeStatus = 'UNPAID' | 'PAID' | 'CANCELLED'

export interface TaxPeriod {
  id: string
  name: string
  starts_at: string
  ends_at: string
  created_at: string
}

export interface TaxCharge {
  id: string
  citizen_id: string
  citizen?: Pick<Citizen, 'id' | 'reg_number' | 'nickname'>
  period_id: string
  period?: TaxPeriod
  amount: number
  status: TaxChargeStatus
  paid_at?: string | null
  marked_by_id?: string | null
  marked_by?: Pick<User, 'id' | 'login'> | null
  building_id?: string | null
  building?: Pick<Building, 'id' | 'reg_number' | 'name'> | null
}

export interface Treasury {
  id: string
  balance: number
}

export interface TreasuryTransaction {
  id: string
  amount: number
  description: string
  performed_by_id: string
  performed_by?: Pick<User, 'id' | 'login'>
  created_at: string
}

export type BuildingType = 'RESIDENTIAL' | 'GOVERNMENT' | 'COMMERCIAL' | 'MILITARY'
export type BuildingStatus = 'ACTIVE' | 'UNDER_CONSTRUCTION' | 'ABANDONED' | 'DEMOLISHED'

export interface Building {
  id: string
  reg_number: string
  name: string
  type: BuildingType
  coord_x: number
  coord_y: number
  coord_z: number
  owner_id: string
  owner?: Pick<Citizen, 'id' | 'reg_number' | 'nickname'>
  status: BuildingStatus
  description?: string | null
  area?: number | null
  dimensions?: string | null
  materials?: string | null
  screenshot_url?: string | null
  tax_rate: number
  built_at?: string | null
  created_at: string
}

export type TerritoryStatus = 'DEVELOPED' | 'UNDER_CONSTRUCTION' | 'DISPUTED' | 'NEUTRAL'

export interface Territory {
  id: string
  name: string
  description?: string | null
  minister_id?: string | null
  minister?: Pick<User, 'id' | 'login'> | null
  coordinates?: string | null
  status: TerritoryStatus
  created_at: string
}

export type RelationStatus = 'ALLIANCE' | 'NEUTRAL' | 'TENSION' | 'WAR'

export interface DiplomaticState {
  id: string
  name: string
  relation_status: RelationStatus
  description?: string | null
  treaties?: DiplomaticTreaty[]
  created_at: string
}

export type TreatyType = 'NON_AGGRESSION' | 'ALLIANCE' | 'TRADE' | 'OTHER'
export type TreatyStatus = 'ACTIVE' | 'TERMINATED'

export interface DiplomaticTreaty {
  id: string
  number: string
  registry_code?: string | null
  state_id: string
  state?: Pick<DiplomaticState, 'id' | 'name'>
  type: TreatyType
  body: string
  signed_at: string
  status: TreatyStatus
}

export type ConversationType = 'DIRECT' | 'GENERAL'

export interface ChatConversation {
  id: string
  type: ConversationType
  participants?: ChatParticipant[]
  messages?: ChatMessage[]
  created_at: string
}

export interface ChatParticipant {
  id: string
  conversation_id: string
  user_id: string
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  sender?: Pick<User, 'id' | 'login' | 'discord_username' | 'discord_avatar'>
  body?: string | null
  created_at: string
  read_by: string[]
  attachments?: ChatAttachment[]
}

export interface ChatAttachment {
  id: string
  message_id: string
  filename: string
  original_name: string
  mime_type: string
  size: number
  url: string
}

export type Permission =
  | 'citizens.view'
  | 'citizens.create'
  | 'citizens.edit'
  | 'citizens.delete'
  | 'passports.view'
  | 'passports.issue'
  | 'passports.reissue'
  | 'laws.view'
  | 'laws.create'
  | 'laws.edit'
  | 'laws.repeal'
  | 'cases.view'
  | 'cases.create'
  | 'cases.manage'
  | 'cases.close'
  | 'punishments.view'
  | 'punishments.issue'
  | 'punishments.revoke'
  | 'taxes.view'
  | 'taxes.charge'
  | 'taxes.mark_paid'
  | 'treasury.view'
  | 'treasury.edit'
  | 'relict.view'
  | 'relict.create'
  | 'relict.edit'
  | 'relict.delete'
  | 'territories.view'
  | 'territories.manage'
  | 'diplomacy.view'
  | 'diplomacy.manage'
  | 'accounts.manage'
  | 'roles.manage'
  | 'chat.send'
