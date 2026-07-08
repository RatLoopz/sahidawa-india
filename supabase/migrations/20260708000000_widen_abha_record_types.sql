-- Alter metadata schema bounds to dynamically support records downloads checks safely
ALTER TABLE abha_records 
DROP CONSTRAINT IF EXISTS abha_records_record_type_check;

ALTER TABLE abha_records 
ADD CONSTRAINT abha_records_record_type_check 
CHECK (record_type IN ('verification', 'prescription', 'health_record'));