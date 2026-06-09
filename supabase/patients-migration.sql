-- Create the patients table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.patients (
    id TEXT PRIMARY KEY,
    patient_id_number TEXT,
    patient_name TEXT NOT NULL,
    date_of_birth TEXT,
    gender TEXT,
    contact_info TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Create policy for users (assuming similar policy to reports where anon can use it if configured)
-- Or you can just use true for now matching local SQLite freedom. OmniRad uses anon keys.
CREATE POLICY "Enable all for authenticated users" ON public.patients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon users" ON public.patients FOR ALL USING (true) WITH CHECK (true);

-- Add patient_id column to reports if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reports' AND column_name='patient_id') THEN
        ALTER TABLE public.reports ADD COLUMN patient_id TEXT REFERENCES public.patients(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Migrate existing report data to patients table
DO $$
DECLARE
    r RECORD;
    new_patient_id TEXT;
    match_patient_id TEXT;
BEGIN
    FOR r IN SELECT id, report_data->'patient'->>'name' as patient_name, 
                    report_data->'patient'->>'patient_id' as patient_id_number,
                    report_data->'patient'->>'gender' as gender 
             FROM public.reports 
             WHERE patient_id IS NULL AND report_data->'patient'->>'name' IS NOT NULL
    LOOP
        -- Look for an existing patient with this name
        SELECT id INTO match_patient_id FROM public.patients WHERE patient_name = r.patient_name LIMIT 1;
        
        IF match_patient_id IS NULL THEN
            -- Create new patient
            new_patient_id := gen_random_uuid()::text;
            INSERT INTO public.patients (id, patient_name, patient_id_number, gender, created_at)
            VALUES (new_patient_id, r.patient_name, r.patient_id_number, r.gender, timezone('utc'::text, now()));
            match_patient_id := new_patient_id;
        END IF;

        -- Update the report
        UPDATE public.reports SET patient_id = match_patient_id WHERE id = r.id;
    END LOOP;
END $$;
