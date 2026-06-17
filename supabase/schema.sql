-- ═══════════════════════════════════════════════════════════════════════════════
-- OmniRad — Supabase Database Setup
-- Run this entire script in your Supabase SQL Editor to set up cloud sync.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Reports Table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  patient_id TEXT,
  patient_name TEXT,
  modality TEXT,
  urgency TEXT,
  report_status TEXT DEFAULT 'Pending',
  report_data JSONB NOT NULL,
  pacs_study_uid TEXT,
  pacs_series_uid TEXT,
  pacs_source TEXT
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_all_access" ON public.reports
  FOR ALL USING (true) WITH CHECK (true);

-- ─── 2. Patients Table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patients (
  id TEXT PRIMARY KEY,
  patient_id_number TEXT,
  patient_name TEXT NOT NULL,
  date_of_birth TEXT,
  gender TEXT,
  contact_info TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_all_access" ON public.patients
  FOR ALL USING (true) WITH CHECK (true);

-- ─── 3. Add patient_id FK to reports (if upgrading from older schema) ────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'patient_id'
  ) THEN
    ALTER TABLE public.reports ADD COLUMN patient_id TEXT;
  END IF;
END $$;

-- ─── 4. Add PACS columns to reports (if upgrading from older schema) ─────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'pacs_study_uid'
  ) THEN
    ALTER TABLE public.reports ADD COLUMN pacs_study_uid TEXT;
    ALTER TABLE public.reports ADD COLUMN pacs_series_uid TEXT;
    ALTER TABLE public.reports ADD COLUMN pacs_source TEXT;
  END IF;
END $$;
