-- Pharmacy owners can only update their own pharmacies
CREATE POLICY "pharmacy_owner_update" ON pharmacies
    FOR UPDATE USING (created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM auth.users WHERE id = auth.uid() 
        AND raw_app_meta_data->>'role' IN ('admin', 'moderator')
    ));