-- Create drug_interactions table
CREATE TABLE IF NOT EXISTS drug_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_a_id TEXT NOT NULL,
  drug_b_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'serious', 'moderate', 'minor')),
  mechanism TEXT,
  description TEXT NOT NULL,
  clinical_recommendation TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(drug_a_id, drug_b_id)
);

-- Indexes for bidirectional searching
CREATE INDEX IF NOT EXISTS idx_interactions_drug_a ON drug_interactions(drug_a_id);
CREATE INDEX IF NOT EXISTS idx_interactions_drug_b ON drug_interactions(drug_b_id);

-- Enable RLS
ALTER TABLE drug_interactions ENABLE ROW LEVEL SECURITY;

-- Create public read policy
CREATE POLICY "Allow public read access to drug_interactions"
  ON drug_interactions
  FOR SELECT
  TO public
  USING (true);

-- Create service_role write policy
CREATE POLICY "Allow service_role complete access to drug_interactions"
  ON drug_interactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed data for common interactions (generic names should be lowercased to simplify matching)
INSERT INTO drug_interactions (drug_a_id, drug_b_id, severity, mechanism, description, clinical_recommendation, source)
VALUES
  ('paracetamol', 'warfarin', 'serious', 
   'Prolonged regular use of paracetamol may enhance the anticoagulant effect of warfarin, increasing the risk of bleeding.', 
   'Paracetamol may increase the blood-thinning effect of Warfarin.', 
   'Monitor INR closely if paracetamol is used regularly. Limit paracetamol use to short durations or lower doses if possible.', 
   'DrugBank'),
  ('aspirin', 'ibuprofen', 'moderate', 
   'NSAIDs like ibuprofen can interfere with the antiplatelet effect of low-dose aspirin and increase risk of gastrointestinal toxicity.', 
   'Concomitant use increases risk of stomach ulcers and bleeding.', 
   'Avoid concurrent use or take ibuprofen at least 8 hours after or 30 minutes before immediate-release aspirin.', 
   'NLM RxNav'),
  ('sildenafil', 'nitroglycerin', 'critical', 
   'Co-administration of sildenafil with organic nitrates can cause severe, life-threatening hypotension.', 
   'Nitroglycerin and Sildenafil combination can cause life-threatening drop in blood pressure.', 
   'Do NOT take Sildenafil if you are using nitroglycerin or any other nitrate medications.', 
   'CDSCO Safety Alert'),
  ('atorvastatin', 'clarithromycin', 'serious', 
   'Clarithromycin is a strong CYP3A4 inhibitor that can significantly increase atorvastatin concentration, raising risk of myopathy/rhabdomyolysis.', 
   'Clarithromycin can significantly increase Atorvastatin levels, increasing risk of muscle toxicity.', 
   'Suspend Atorvastatin therapy during Clarithromycin treatment or use a lower dose of Atorvastatin.', 
   'DrugBank')
ON CONFLICT (drug_a_id, drug_b_id) DO NOTHING;
