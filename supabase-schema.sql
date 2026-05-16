-- Boss.AI Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('manager', 'employee')),
  phone TEXT,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles table (custom job roles)
CREATE TABLE IF NOT EXISTS roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, color) VALUES
  ('Manager', '#6366f1'),
  ('Cashier', '#22c55e'),
  ('Sales Associate', '#f97316'),
  ('Supervisor', '#8b5cf6'),
  ('Stock Associate', '#14b8a6')
ON CONFLICT (name) DO NOTHING;

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  hourly_rate DECIMAL(10,2),
  max_hours_per_week INTEGER DEFAULT 40,
  min_hours_per_week INTEGER DEFAULT 0,
  employment_type TEXT NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'seasonal', 'temporary')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- For existing databases where this column was added later
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_type TEXT
  DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'seasonal', 'temporary'));

-- Schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  published BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(week_start)
);

-- Shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Availability table (recurring weekly availability)
CREATE TABLE IF NOT EXISTS availability (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, day_of_week)
);

-- Availability exceptions (one-off overrides)
CREATE TABLE IF NOT EXISTS availability_exceptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN DEFAULT FALSE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

-- Time off requests
CREATE TABLE IF NOT EXISTS time_off_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Availability change requests
CREATE TABLE IF NOT EXISTS availability_change_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  new_start_time TIME NOT NULL,
  new_end_time TIME NOT NULL,
  new_is_available BOOLEAN DEFAULT TRUE,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coverage requests
CREATE TABLE IF NOT EXISTS coverage_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE NOT NULL,
  requester_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled')),
  filled_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store settings (singleton row)
CREATE TABLE IF NOT EXISTS store_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store hours per day of week
CREATE TABLE IF NOT EXISTS store_hours (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open BOOLEAN DEFAULT TRUE,
  open_time TIME NOT NULL DEFAULT '09:00',
  close_time TIME NOT NULL DEFAULT '17:00',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(day_of_week)
);

-- AI assistant conversation memory
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_conversations_user_idx ON ai_conversations(user_id, created_at DESC);

-- Persistent manager preferences learned by AI assistant
CREATE TABLE IF NOT EXISTS ai_memories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_memories_user_idx ON ai_memories(user_id);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;

-- Store settings policies
CREATE POLICY "Anyone can view store settings" ON store_settings FOR SELECT USING (true);
CREATE POLICY "Managers can manage store settings" ON store_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

-- Store hours policies
CREATE POLICY "Anyone can view store hours" ON store_hours FOR SELECT USING (true);
CREATE POLICY "Managers can manage store hours" ON store_hours FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

-- AI conversation policies (only owner)
CREATE POLICY "Users can view own AI conversations" ON ai_conversations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own AI conversations" ON ai_conversations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own AI conversations" ON ai_conversations FOR DELETE USING (user_id = auth.uid());

-- AI memory policies (only owner)
CREATE POLICY "Users can view own AI memories" ON ai_memories FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own AI memories" ON ai_memories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own AI memories" ON ai_memories FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own AI memories" ON ai_memories FOR DELETE USING (user_id = auth.uid());

-- Seed defaults: one store_settings row + 7 store_hours rows
INSERT INTO store_settings (store_name) VALUES ('')
ON CONFLICT DO NOTHING;

INSERT INTO store_hours (day_of_week, is_open, open_time, close_time) VALUES
  (0, TRUE, '10:00', '17:00'),
  (1, TRUE, '09:00', '18:00'),
  (2, TRUE, '09:00', '18:00'),
  (3, TRUE, '09:00', '18:00'),
  (4, TRUE, '09:00', '18:00'),
  (5, TRUE, '09:00', '20:00'),
  (6, TRUE, '10:00', '18:00')
ON CONFLICT (day_of_week) DO NOTHING;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Managers can update any profile" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

-- Roles policies
CREATE POLICY "Anyone can view roles" ON roles FOR SELECT USING (true);
CREATE POLICY "Managers can manage roles" ON roles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

-- Employees policies
CREATE POLICY "Anyone can view employees" ON employees FOR SELECT USING (true);
CREATE POLICY "Managers can manage employees" ON employees FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

-- Schedules policies
CREATE POLICY "Managers can view all schedules" ON schedules FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);
CREATE POLICY "Employees can view published schedules" ON schedules FOR SELECT USING (
  published = true
);
CREATE POLICY "Managers can manage schedules" ON schedules FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

-- Shifts policies
CREATE POLICY "Managers can view all shifts" ON shifts FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);
CREATE POLICY "Employees can view own shifts in published schedules" ON shifts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM employees e
    JOIN schedules s ON s.id = shifts.schedule_id
    WHERE e.profile_id = auth.uid() AND e.id = shifts.employee_id AND s.published = true
  )
);
CREATE POLICY "Managers can manage shifts" ON shifts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

-- Availability policies
CREATE POLICY "Anyone can view availability" ON availability FOR SELECT USING (true);
CREATE POLICY "Employees can manage own availability" ON availability FOR ALL USING (
  EXISTS (SELECT 1 FROM employees WHERE profile_id = auth.uid() AND id = employee_id)
);
CREATE POLICY "Managers can manage all availability" ON availability FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

-- Availability exceptions policies
CREATE POLICY "Anyone can view availability exceptions" ON availability_exceptions FOR SELECT USING (true);
CREATE POLICY "Managers can manage exceptions" ON availability_exceptions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

-- Time off requests policies
CREATE POLICY "Employees can view own time off" ON time_off_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM employees WHERE profile_id = auth.uid() AND id = employee_id)
);
CREATE POLICY "Managers can view all time off" ON time_off_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);
CREATE POLICY "Employees can create time off requests" ON time_off_requests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE profile_id = auth.uid() AND id = employee_id)
);
CREATE POLICY "Managers can update time off requests" ON time_off_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

-- Availability change requests policies
CREATE POLICY "Employees can view own change requests" ON availability_change_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM employees WHERE profile_id = auth.uid() AND id = employee_id)
);
CREATE POLICY "Managers can view all change requests" ON availability_change_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);
CREATE POLICY "Employees can create change requests" ON availability_change_requests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE profile_id = auth.uid() AND id = employee_id)
);
CREATE POLICY "Managers can update change requests" ON availability_change_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

-- Audit logs
CREATE POLICY "Managers can view audit logs" ON audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);
CREATE POLICY "System can insert audit logs" ON audit_logs FOR INSERT WITH CHECK (true);

-- Coverage requests
CREATE POLICY "Anyone can view coverage requests" ON coverage_requests FOR SELECT USING (true);
CREATE POLICY "Employees can create coverage requests" ON coverage_requests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE profile_id = auth.uid() AND id = requester_id)
);
CREATE POLICY "Managers can manage coverage requests" ON coverage_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  );

  -- Create employee record if role is employee
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'employee') = 'employee' THEN
    INSERT INTO public.employees (profile_id)
    VALUES (NEW.id);

    -- Create default availability (available all days 9-5)
    INSERT INTO public.availability (employee_id, day_of_week, start_time, end_time, is_available)
    SELECT
      (SELECT id FROM public.employees WHERE profile_id = NEW.id),
      generate_series(0, 6),
      '09:00',
      '17:00',
      true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_availability_updated_at BEFORE UPDATE ON availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Notifications table (in-app notifications, e.g. schedule_published)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_employee_idx ON notifications (employee_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own notifications" ON notifications FOR SELECT USING (
  EXISTS (SELECT 1 FROM employees WHERE employees.id = notifications.employee_id AND employees.profile_id = auth.uid())
);

CREATE POLICY "Employees can update own notifications" ON notifications FOR UPDATE USING (
  EXISTS (SELECT 1 FROM employees WHERE employees.id = notifications.employee_id AND employees.profile_id = auth.uid())
);

CREATE POLICY "Managers can insert notifications" ON notifications FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

CREATE POLICY "Managers can view notifications" ON notifications FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

-- Generic reference id so a notification can point to a writeup, praise, etc.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id UUID;

-- ============================================================
-- Phase 1: Invite-only auth + organizations
-- ============================================================

-- Organizations (one "store environment" per org)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view own organization" ON organizations;
CREATE POLICY "Members can view own organization" ON organizations FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND profiles.organization_id = organizations.id)
);

DROP POLICY IF EXISTS "Admin manager can update own organization" ON organizations;
CREATE POLICY "Admin manager can update own organization" ON organizations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND profiles.organization_id = organizations.id AND profiles.role = 'admin_manager')
);

-- Profiles: extend with organization + onboarding + admin_manager role + onboarding fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_street TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_state TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_zip TEXT;

-- Widen the role CHECK to include admin_manager (drop and recreate idempotently)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin_manager', 'manager', 'employee'));

-- Invitations
CREATE TABLE IF NOT EXISTS invitations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin_manager', 'manager', 'employee')),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

ALTER TABLE invitations ADD COLUMN IF NOT EXISTS recipient_name TEXT;

CREATE INDEX IF NOT EXISTS invitations_org_email_idx ON invitations (organization_id, lower(email));
CREATE INDEX IF NOT EXISTS invitations_token_idx ON invitations (token);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view own org invitations" ON invitations;
CREATE POLICY "Managers can view own org invitations" ON invitations FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND profiles.organization_id = invitations.organization_id
    AND profiles.role IN ('admin_manager', 'manager'))
);

-- Invited user (matched by email of authenticated user) can read their own
DROP POLICY IF EXISTS "Invitee can view own invitation by email" ON invitations;
CREATE POLICY "Invitee can view own invitation by email" ON invitations FOR SELECT USING (
  lower(email) = lower((auth.jwt() ->> 'email'))
);

-- Anyone with the token (cryptographically random uuid) can read by token — used by /api/invite/validate before user is authenticated
DROP POLICY IF EXISTS "Public can view invitation by token" ON invitations;
CREATE POLICY "Public can view invitation by token" ON invitations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Managers can insert invitations" ON invitations;
CREATE POLICY "Managers can insert invitations" ON invitations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND profiles.organization_id = invitations.organization_id
    AND profiles.role IN ('admin_manager', 'manager'))
);

DROP POLICY IF EXISTS "Managers can update org invitations" ON invitations;
CREATE POLICY "Managers can update org invitations" ON invitations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND profiles.organization_id = invitations.organization_id
    AND profiles.role IN ('admin_manager', 'manager'))
);

DROP POLICY IF EXISTS "Invitee can update own invitation by email" ON invitations;
CREATE POLICY "Invitee can update own invitation by email" ON invitations FOR UPDATE USING (
  lower(email) = lower((auth.jwt() ->> 'email'))
);

-- Employees: allow rows without a linked profile so a manager can pre-create
-- an employee record before the invitee accepts and creates their account.
ALTER TABLE employees ALTER COLUMN profile_id DROP NOT NULL;

-- During onboarding, a newly-authenticated user creates/links their own
-- employees row. Allow that without granting full manager privileges.
DROP POLICY IF EXISTS "Users can insert own employee row" ON employees;
CREATE POLICY "Users can insert own employee row" ON employees FOR INSERT
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own employee row" ON employees;
CREATE POLICY "Users can update own employee row" ON employees FOR UPDATE
  USING (profile_id = auth.uid());

-- Replace handle_new_user: invite-only means we do NOT auto-create an employee
-- record on signUp. The onboarding claim API explicitly creates or links the
-- employee row based on the invitation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Employee write-ups (manager-issued incident records)
CREATE TABLE IF NOT EXISTS employee_writeups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor', 'moderate', 'serious')),
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_writeups_employee_idx ON employee_writeups (employee_id, incident_date DESC);

ALTER TABLE employee_writeups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view all writeups" ON employee_writeups FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);
CREATE POLICY "Employees can view own writeups" ON employee_writeups FOR SELECT USING (
  EXISTS (SELECT 1 FROM employees WHERE profile_id = auth.uid() AND id = employee_writeups.employee_id)
);
CREATE POLICY "Managers can insert writeups" ON employee_writeups FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);
CREATE POLICY "Managers can update writeups" ON employee_writeups FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);
CREATE POLICY "Employees can acknowledge own writeups" ON employee_writeups FOR UPDATE USING (
  EXISTS (SELECT 1 FROM employees WHERE profile_id = auth.uid() AND id = employee_writeups.employee_id)
);

-- Employee praise (manager-issued recognition records)
CREATE TABLE IF NOT EXISTS employee_praise (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'performance' CHECK (category IN ('performance', 'teamwork', 'customer_service', 'attendance', 'other')),
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_praise_employee_idx ON employee_praise (employee_id, incident_date DESC);

ALTER TABLE employee_praise ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view all praise" ON employee_praise FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);
CREATE POLICY "Employees can view own praise" ON employee_praise FOR SELECT USING (
  EXISTS (SELECT 1 FROM employees WHERE profile_id = auth.uid() AND id = employee_praise.employee_id)
);
CREATE POLICY "Managers can insert praise" ON employee_praise FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);
CREATE POLICY "Managers can update praise" ON employee_praise FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);
CREATE POLICY "Employees can acknowledge own praise" ON employee_praise FOR UPDATE USING (
  EXISTS (SELECT 1 FROM employees WHERE profile_id = auth.uid() AND id = employee_praise.employee_id)
);

-- ============================================================
-- Phase 2 (employee schedule actions): time off, shift drops, shift trades
-- ============================================================

-- Time off: ensure organization_id and manager_note exist
ALTER TABLE time_off_requests ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE time_off_requests ADD COLUMN IF NOT EXISTS manager_note TEXT;

-- Shift drop requests (employee asks to drop one of their own shifts)
CREATE TABLE IF NOT EXISTS shift_drop_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS shift_drop_requests_employee_idx ON shift_drop_requests (employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shift_drop_requests_status_idx ON shift_drop_requests (status, created_at DESC);

ALTER TABLE shift_drop_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can view own drop requests" ON shift_drop_requests;
CREATE POLICY "Employees can view own drop requests" ON shift_drop_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM employees WHERE profile_id = auth.uid() AND id = shift_drop_requests.employee_id)
);

DROP POLICY IF EXISTS "Managers can view org drop requests" ON shift_drop_requests;
CREATE POLICY "Managers can view org drop requests" ON shift_drop_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

DROP POLICY IF EXISTS "Employees can insert own drop requests" ON shift_drop_requests;
CREATE POLICY "Employees can insert own drop requests" ON shift_drop_requests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE profile_id = auth.uid() AND id = shift_drop_requests.employee_id)
);

DROP POLICY IF EXISTS "Employees can delete own pending drop requests" ON shift_drop_requests;
CREATE POLICY "Employees can delete own pending drop requests" ON shift_drop_requests FOR DELETE USING (
  status = 'pending'
  AND EXISTS (SELECT 1 FROM employees WHERE profile_id = auth.uid() AND id = shift_drop_requests.employee_id)
);

DROP POLICY IF EXISTS "Managers can update drop requests" ON shift_drop_requests;
CREATE POLICY "Managers can update drop requests" ON shift_drop_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

-- Shift trade requests
CREATE TABLE IF NOT EXISTS shift_trade_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  requester_shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  recipient_shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_recipient'
    CHECK (status IN ('pending_recipient', 'pending_manager', 'approved', 'denied')),
  recipient_response TEXT,
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shift_trade_requests_requester_idx ON shift_trade_requests (requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shift_trade_requests_recipient_idx ON shift_trade_requests (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shift_trade_requests_status_idx ON shift_trade_requests (status, created_at DESC);

ALTER TABLE shift_trade_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can view trades involving them" ON shift_trade_requests;
CREATE POLICY "Employees can view trades involving them" ON shift_trade_requests FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE profile_id = auth.uid()
      AND id IN (shift_trade_requests.requester_id, shift_trade_requests.recipient_id)
  )
);

DROP POLICY IF EXISTS "Managers can view org trades" ON shift_trade_requests;
CREATE POLICY "Managers can view org trades" ON shift_trade_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

DROP POLICY IF EXISTS "Employees can insert own trade requests" ON shift_trade_requests;
CREATE POLICY "Employees can insert own trade requests" ON shift_trade_requests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM employees WHERE profile_id = auth.uid() AND id = shift_trade_requests.requester_id)
);

DROP POLICY IF EXISTS "Recipient can update trade response" ON shift_trade_requests;
CREATE POLICY "Recipient can update trade response" ON shift_trade_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM employees WHERE profile_id = auth.uid() AND id = shift_trade_requests.recipient_id)
);

DROP POLICY IF EXISTS "Managers can update trade requests" ON shift_trade_requests;
CREATE POLICY "Managers can update trade requests" ON shift_trade_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin_manager'))
);

CREATE TRIGGER update_shift_trade_requests_updated_at BEFORE UPDATE ON shift_trade_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Notifications: extend to support manager-targeted notifications and reference
-- the new request tables. employee_id becomes nullable; either employee_id OR
-- profile_id identifies the recipient.
ALTER TABLE notifications ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS shift_drop_request_id UUID REFERENCES shift_drop_requests(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS shift_trade_request_id UUID REFERENCES shift_trade_requests(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS time_off_request_id UUID REFERENCES time_off_requests(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_profile_idx ON notifications (profile_id, created_at DESC);

DROP POLICY IF EXISTS "Profile recipient can view own notifications" ON notifications;
CREATE POLICY "Profile recipient can view own notifications" ON notifications FOR SELECT USING (
  profile_id = auth.uid()
);

DROP POLICY IF EXISTS "Profile recipient can update own notifications" ON notifications;
CREATE POLICY "Profile recipient can update own notifications" ON notifications FOR UPDATE USING (
  profile_id = auth.uid()
);

-- Authenticated employees can insert notifications (for request/response flows).
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;
CREATE POLICY "Authenticated users can insert notifications" ON notifications FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Shifts: employees can now see every shift in a published schedule (needed for
-- the Full Schedule view and the shift-trade flow). The legacy
-- "own shifts in published schedules" policy can stay alongside this one.
DROP POLICY IF EXISTS "Employees can view all shifts in published schedules" ON shifts;
CREATE POLICY "Employees can view all shifts in published schedules" ON shifts FOR SELECT USING (
  EXISTS (SELECT 1 FROM schedules WHERE id = shifts.schedule_id AND published = true)
);

-- Managers + admin_managers are schedulable too — backfill an employees row for
-- any existing manager profile that doesn't have one. The onboarding/claim
-- API creates these going forward.
INSERT INTO employees (profile_id)
SELECT id FROM profiles
WHERE role IN ('manager', 'admin_manager')
  AND id NOT IN (SELECT profile_id FROM employees WHERE profile_id IS NOT NULL)
ON CONFLICT (profile_id) DO NOTHING;
