-- Job Visits table: supports multiple scheduled visit dates per job
CREATE TABLE IF NOT EXISTS job_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  duration_hours NUMERIC(4,2),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE job_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their job visits"
  ON job_visits FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS job_visits_job_id_idx ON job_visits(job_id);
CREATE INDEX IF NOT EXISTS job_visits_scheduled_date_idx ON job_visits(scheduled_date);
