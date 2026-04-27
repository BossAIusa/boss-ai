-- Boss.AI Seed Data
-- Run this in Supabase SQL Editor

DO $$
DECLARE
  uid1 UUID := gen_random_uuid();
  uid2 UUID := gen_random_uuid();
  uid3 UUID := gen_random_uuid();
  uid4 UUID := gen_random_uuid();
  uid5 UUID := gen_random_uuid();
  uid6 UUID := gen_random_uuid();

  eid1 UUID;
  eid2 UUID;
  eid3 UUID;
  eid4 UUID;
  eid5 UUID;
  eid6 UUID;

  supervisor_role_id UUID;
  cashier_role_id UUID;
  sales_role_id UUID;
  stock_role_id UUID;

  sched_id UUID;
  ws DATE;
  manager_id UUID;
BEGIN
  -- Get role IDs
  SELECT id INTO supervisor_role_id FROM roles WHERE name = 'Supervisor';
  SELECT id INTO cashier_role_id FROM roles WHERE name = 'Cashier';
  SELECT id INTO sales_role_id FROM roles WHERE name = 'Sales Associate';
  SELECT id INTO stock_role_id FROM roles WHERE name = 'Stock Associate';

  -- Get the manager (your account)
  SELECT id INTO manager_id FROM profiles WHERE role = 'manager' LIMIT 1;

  -- Insert fake auth users
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data)
  VALUES
    (uid1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sarah.johnson@bossai.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{"full_name":"Sarah Johnson","role":"employee"}'),
    (uid2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mike.chen@bossai.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{"full_name":"Mike Chen","role":"employee"}'),
    (uid3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jessica.williams@bossai.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{"full_name":"Jessica Williams","role":"employee"}'),
    (uid4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'david.martinez@bossai.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{"full_name":"David Martinez","role":"employee"}'),
    (uid5, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emily.davis@bossai.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{"full_name":"Emily Davis","role":"employee"}'),
    (uid6, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'james.wilson@bossai.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{"full_name":"James Wilson","role":"employee"}');

  -- Insert identities for each user
  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  VALUES
    (uid1, uid1, uid1, 'email', jsonb_build_object('sub', uid1, 'email', 'sarah.johnson@bossai.com'), now(), now(), now()),
    (uid2, uid2, uid2, 'email', jsonb_build_object('sub', uid2, 'email', 'mike.chen@bossai.com'), now(), now(), now()),
    (uid3, uid3, uid3, 'email', jsonb_build_object('sub', uid3, 'email', 'jessica.williams@bossai.com'), now(), now(), now()),
    (uid4, uid4, uid4, 'email', jsonb_build_object('sub', uid4, 'email', 'david.martinez@bossai.com'), now(), now(), now()),
    (uid5, uid5, uid5, 'email', jsonb_build_object('sub', uid5, 'email', 'emily.davis@bossai.com'), now(), now(), now()),
    (uid6, uid6, uid6, 'email', jsonb_build_object('sub', uid6, 'email', 'james.wilson@bossai.com'), now(), now(), now());

  -- The trigger should have created profiles and employees, but let's update them with full data
  -- Update profiles with contact info
  UPDATE profiles SET phone = '(555) 234-5678', address = '456 Oak Ave, Springfield, IL', emergency_contact_name = 'Tom Johnson', emergency_contact_phone = '(555) 234-9999', emergency_contact_relationship = 'Spouse' WHERE id = uid1;
  UPDATE profiles SET phone = '(555) 345-6789', address = '789 Pine St, Springfield, IL', emergency_contact_name = 'Lisa Chen', emergency_contact_phone = '(555) 345-9999', emergency_contact_relationship = 'Mother' WHERE id = uid2;
  UPDATE profiles SET phone = '(555) 456-7890', address = '321 Elm Dr, Springfield, IL', emergency_contact_name = 'Robert Williams', emergency_contact_phone = '(555) 456-9999', emergency_contact_relationship = 'Father' WHERE id = uid3;
  UPDATE profiles SET phone = '(555) 567-8901', address = '654 Maple Ln, Springfield, IL', emergency_contact_name = 'Maria Martinez', emergency_contact_phone = '(555) 567-9999', emergency_contact_relationship = 'Wife' WHERE id = uid4;
  UPDATE profiles SET phone = '(555) 678-9012', address = '987 Cedar Rd, Springfield, IL', emergency_contact_name = 'James Davis', emergency_contact_phone = '(555) 678-9999', emergency_contact_relationship = 'Brother' WHERE id = uid5;
  UPDATE profiles SET phone = '(555) 789-0123', address = '147 Birch Ct, Springfield, IL', emergency_contact_name = 'Nancy Wilson', emergency_contact_phone = '(555) 789-9999', emergency_contact_relationship = 'Mother' WHERE id = uid6;

  -- Get employee IDs and assign roles
  SELECT id INTO eid1 FROM employees WHERE profile_id = uid1;
  SELECT id INTO eid2 FROM employees WHERE profile_id = uid2;
  SELECT id INTO eid3 FROM employees WHERE profile_id = uid3;
  SELECT id INTO eid4 FROM employees WHERE profile_id = uid4;
  SELECT id INTO eid5 FROM employees WHERE profile_id = uid5;
  SELECT id INTO eid6 FROM employees WHERE profile_id = uid6;

  UPDATE employees SET role_id = supervisor_role_id, hourly_rate = 22.00, max_hours_per_week = 40, min_hours_per_week = 20 WHERE id = eid1;
  UPDATE employees SET role_id = cashier_role_id, hourly_rate = 16.50, max_hours_per_week = 35, min_hours_per_week = 15 WHERE id = eid2;
  UPDATE employees SET role_id = sales_role_id, hourly_rate = 17.00, max_hours_per_week = 40, min_hours_per_week = 20 WHERE id = eid3;
  UPDATE employees SET role_id = stock_role_id, hourly_rate = 15.50, max_hours_per_week = 30, min_hours_per_week = 10 WHERE id = eid4;
  UPDATE employees SET role_id = cashier_role_id, hourly_rate = 16.00, max_hours_per_week = 25, min_hours_per_week = 10 WHERE id = eid5;
  UPDATE employees SET role_id = sales_role_id, hourly_rate = 17.50, max_hours_per_week = 40, min_hours_per_week = 20 WHERE id = eid6;

  -- Update availability (trigger created defaults, now customize)
  -- Sarah: Mon-Fri 8am-6pm, weekends off
  UPDATE availability SET start_time = '08:00', end_time = '18:00', is_available = true WHERE employee_id = eid1 AND day_of_week BETWEEN 1 AND 5;
  UPDATE availability SET is_available = false WHERE employee_id = eid1 AND day_of_week IN (0, 6);

  -- Mike: Mon-Sat 7am-3pm, Sun off
  UPDATE availability SET start_time = '07:00', end_time = '15:00', is_available = true WHERE employee_id = eid2 AND day_of_week BETWEEN 1 AND 6;
  UPDATE availability SET is_available = false WHERE employee_id = eid2 AND day_of_week = 0;

  -- Jessica: Mon-Fri 10am-7pm, weekends off
  UPDATE availability SET start_time = '10:00', end_time = '19:00', is_available = true WHERE employee_id = eid3 AND day_of_week BETWEEN 1 AND 5;
  UPDATE availability SET is_available = false WHERE employee_id = eid3 AND day_of_week IN (0, 6);

  -- David: Tue-Sat 6am-2pm, Sun/Mon off
  UPDATE availability SET start_time = '06:00', end_time = '14:00', is_available = true WHERE employee_id = eid4 AND day_of_week BETWEEN 2 AND 6;
  UPDATE availability SET is_available = false WHERE employee_id = eid4 AND day_of_week IN (0, 1);

  -- Emily: Wed-Sun 12pm-8pm, Mon/Tue off
  UPDATE availability SET start_time = '12:00', end_time = '20:00', is_available = true WHERE employee_id = eid5 AND day_of_week IN (0, 3, 4, 5, 6);
  UPDATE availability SET is_available = false WHERE employee_id = eid5 AND day_of_week IN (1, 2);

  -- James: Mon-Fri 9am-5pm, weekends off
  UPDATE availability SET start_time = '09:00', end_time = '17:00', is_available = true WHERE employee_id = eid6 AND day_of_week BETWEEN 1 AND 5;
  UPDATE availability SET is_available = false WHERE employee_id = eid6 AND day_of_week IN (0, 6);

  -- Current week schedule
  ws := date_trunc('week', CURRENT_DATE + interval '1 day')::date - interval '1 day';

  INSERT INTO schedules (week_start, week_end, published, created_by)
  VALUES (ws, ws + 6, true, manager_id)
  ON CONFLICT (week_start) DO UPDATE SET published = true
  RETURNING id INTO sched_id;

  -- Delete any existing shifts for this schedule
  DELETE FROM shifts WHERE schedule_id = sched_id;

  -- Monday shifts
  INSERT INTO shifts (schedule_id, employee_id, role_id, day_of_week, start_time, end_time, date) VALUES
    (sched_id, eid1, supervisor_role_id, 1, '08:00', '16:00', ws + 1),
    (sched_id, eid2, cashier_role_id, 1, '07:00', '15:00', ws + 1),
    (sched_id, eid3, sales_role_id, 1, '10:00', '18:00', ws + 1),
    (sched_id, eid6, sales_role_id, 1, '09:00', '17:00', ws + 1);

  -- Tuesday shifts
  INSERT INTO shifts (schedule_id, employee_id, role_id, day_of_week, start_time, end_time, date) VALUES
    (sched_id, eid1, supervisor_role_id, 2, '08:00', '16:00', ws + 2),
    (sched_id, eid4, stock_role_id, 2, '06:00', '14:00', ws + 2),
    (sched_id, eid3, sales_role_id, 2, '10:00', '18:00', ws + 2),
    (sched_id, eid2, cashier_role_id, 2, '07:00', '15:00', ws + 2);

  -- Wednesday shifts
  INSERT INTO shifts (schedule_id, employee_id, role_id, day_of_week, start_time, end_time, date) VALUES
    (sched_id, eid1, supervisor_role_id, 3, '08:00', '16:00', ws + 3),
    (sched_id, eid5, cashier_role_id, 3, '12:00', '20:00', ws + 3),
    (sched_id, eid6, sales_role_id, 3, '09:00', '17:00', ws + 3),
    (sched_id, eid4, stock_role_id, 3, '06:00', '14:00', ws + 3);

  -- Thursday shifts
  INSERT INTO shifts (schedule_id, employee_id, role_id, day_of_week, start_time, end_time, date) VALUES
    (sched_id, eid2, cashier_role_id, 4, '07:00', '15:00', ws + 4),
    (sched_id, eid3, sales_role_id, 4, '10:00', '18:00', ws + 4),
    (sched_id, eid5, cashier_role_id, 4, '12:00', '20:00', ws + 4),
    (sched_id, eid6, sales_role_id, 4, '09:00', '17:00', ws + 4);

  -- Friday shifts
  INSERT INTO shifts (schedule_id, employee_id, role_id, day_of_week, start_time, end_time, date) VALUES
    (sched_id, eid1, supervisor_role_id, 5, '08:00', '16:00', ws + 5),
    (sched_id, eid2, cashier_role_id, 5, '07:00', '15:00', ws + 5),
    (sched_id, eid3, sales_role_id, 5, '10:00', '18:00', ws + 5),
    (sched_id, eid4, stock_role_id, 5, '06:00', '14:00', ws + 5),
    (sched_id, eid5, cashier_role_id, 5, '12:00', '20:00', ws + 5);

  -- Saturday shifts
  INSERT INTO shifts (schedule_id, employee_id, role_id, day_of_week, start_time, end_time, date) VALUES
    (sched_id, eid2, cashier_role_id, 6, '08:00', '14:00', ws + 6),
    (sched_id, eid4, stock_role_id, 6, '06:00', '12:00', ws + 6),
    (sched_id, eid5, cashier_role_id, 6, '12:00', '20:00', ws + 6);

  -- Time off requests
  INSERT INTO time_off_requests (employee_id, start_date, end_date, reason, status) VALUES
    (eid3, ws + 9, ws + 11, 'Family vacation', 'pending'),
    (eid4, ws + 8, ws + 8, 'Doctor appointment', 'pending'),
    (eid5, ws - 3, ws - 1, 'Personal day', 'approved');

  -- Availability change requests
  INSERT INTO availability_change_requests (employee_id, day_of_week, new_start_time, new_end_time, new_is_available, reason, status) VALUES
    (eid2, 6, '08:00', '12:00', true, 'Can only do mornings on Saturdays now', 'pending'),
    (eid6, 1, '11:00', '19:00', true, 'Class schedule changed', 'pending');

  RAISE NOTICE 'Seed data created successfully!';
END $$;
