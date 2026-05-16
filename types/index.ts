export type UserRole = 'admin_manager' | 'manager' | 'employee'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  phone?: string
  address?: string
  address_street?: string
  address_city?: string
  address_state?: string
  address_zip?: string
  date_of_birth?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relationship?: string
  avatar_url?: string
  organization_id?: string | null
  onboarding_complete?: boolean
  created_at: string
  updated_at: string
}

export interface Role {
  id: string
  name: string
  color: string
  created_at: string
}

export type EmploymentType = 'full_time' | 'part_time' | 'seasonal' | 'temporary'

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  seasonal: 'Seasonal',
  temporary: 'Temporary',
}

export const EMPLOYMENT_TYPE_COLORS: Record<EmploymentType, string> = {
  full_time: '#22c55e',
  part_time: '#3b82f6',
  seasonal: '#f97316',
  temporary: '#a855f7',
}

export interface Employee {
  id: string
  profile_id: string
  role_id?: string
  hourly_rate?: number
  max_hours_per_week?: number
  min_hours_per_week?: number
  employment_type?: EmploymentType
  created_at: string
  profile?: Profile
  role?: Role
}

export interface Schedule {
  id: string
  week_start: string
  week_end: string
  published: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface Shift {
  id: string
  schedule_id: string
  employee_id: string
  role_id?: string
  day_of_week: number // 0=Sun, 1=Mon, ... 6=Sat
  start_time: string // HH:MM
  end_time: string // HH:MM
  date: string // ISO date
  notes?: string
  created_at: string
  employee?: Employee & { profile: Profile }
  role?: Role
}

export interface Availability {
  id: string
  employee_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
  created_at: string
  updated_at: string
}

export interface AvailabilityException {
  id: string
  employee_id: string
  date: string
  start_time?: string
  end_time?: string
  is_available: boolean
  reason?: string
  created_at: string
}

export interface TimeOffRequest {
  id: string
  employee_id: string
  organization_id?: string | null
  start_date: string
  end_date: string
  reason?: string
  manager_note?: string | null
  status: 'pending' | 'approved' | 'denied'
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
  employee?: Employee & { profile: Profile }
}

export interface ShiftDropRequest {
  id: string
  shift_id: string
  employee_id: string
  organization_id?: string | null
  reason?: string | null
  status: 'pending' | 'approved' | 'denied'
  manager_id?: string | null
  created_at: string
  resolved_at?: string | null
  shift?: Shift
  employee?: Employee & { profile: Profile }
}

export type ShiftTradeStatus =
  | 'pending_recipient'
  | 'pending_manager'
  | 'approved'
  | 'denied'

export interface ShiftTradeRequest {
  id: string
  organization_id?: string | null
  requester_id: string
  requester_shift_id: string
  recipient_id: string
  recipient_shift_id: string
  status: ShiftTradeStatus
  recipient_response?: string | null
  manager_id?: string | null
  message?: string | null
  created_at: string
  updated_at: string
  requester?: Employee & { profile: Profile }
  recipient?: Employee & { profile: Profile }
  requester_shift?: Shift
  recipient_shift?: Shift
}

export interface AvailabilityChangeRequest {
  id: string
  employee_id: string
  day_of_week: number
  new_start_time: string
  new_end_time: string
  new_is_available: boolean
  reason?: string
  status: 'pending' | 'approved' | 'denied'
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
  employee?: Employee & { profile: Profile }
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  table_name: string
  record_id: string
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  created_at: string
}

export interface StoreSettings {
  id: string
  store_name: string
  created_at: string
  updated_at: string
}

export interface StoreHours {
  id: string
  day_of_week: number
  is_open: boolean
  open_time: string
  close_time: string
  updated_at: string
}

export interface AIConversationMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface AIMemory {
  id: string
  user_id: string
  kind: string
  content: string
  created_at: string
  updated_at: string
}

export interface WeekDay {
  date: Date
  dayName: string
  dateStr: string
  isToday: boolean
}

export const EMPLOYEE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#a855f7', '#d946ef',
]

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type WriteupSeverity = 'minor' | 'moderate' | 'serious'

export const WRITEUP_SEVERITY_LABELS: Record<WriteupSeverity, string> = {
  minor: 'Minor',
  moderate: 'Moderate',
  serious: 'Serious',
}

export const WRITEUP_SEVERITY_COLORS: Record<WriteupSeverity, string> = {
  minor: '#f59e0b',
  moderate: '#f97316',
  serious: '#ef4444',
}

export interface EmployeeWriteup {
  id: string
  employee_id: string
  manager_id?: string
  title: string
  description: string
  severity: WriteupSeverity
  incident_date: string
  acknowledged: boolean
  acknowledged_at?: string | null
  created_at: string
}

export type PraiseCategory = 'performance' | 'teamwork' | 'customer_service' | 'attendance' | 'other'

export const PRAISE_CATEGORY_LABELS: Record<PraiseCategory, string> = {
  performance: 'Performance',
  teamwork: 'Teamwork',
  customer_service: 'Customer Service',
  attendance: 'Attendance',
  other: 'Other',
}

export const PRAISE_CATEGORY_COLOR = '#6366f1'

export interface EmployeePraise {
  id: string
  employee_id: string
  manager_id?: string
  title: string
  description: string
  category: PraiseCategory
  incident_date: string
  acknowledged: boolean
  acknowledged_at?: string | null
  created_at: string
}
