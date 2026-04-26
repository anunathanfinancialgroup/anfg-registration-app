-- Add connection type and selected slot columns for Zoom meeting scheduling
ALTER TABLE public.client_registrations
  ADD COLUMN IF NOT EXISTS connection_type text,
  ADD COLUMN IF NOT EXISTS selected_slot text,
  ADD COLUMN IF NOT EXISTS selected_slot_label text;

-- Make preferred_time nullable since zoom_meeting registrations won't use it
ALTER TABLE public.client_registrations
  ALTER COLUMN preferred_time DROP NOT NULL;
