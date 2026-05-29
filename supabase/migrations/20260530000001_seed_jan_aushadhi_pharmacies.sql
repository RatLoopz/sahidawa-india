-- =============================================================================
-- SahiDawa — Seed Real Jan Aushadhi Kendra Pharmacy Locations
-- =============================================================================
-- Real Pradhan Mantri Bhartiya Jan Aushadhi Kendra (PMBJAK) locations
-- sourced from publicly available government data.
-- Coordinates are approximate street-level GPS positions.
--
-- Uses ON CONFLICT DO NOTHING so this migration is safe to re-run.
-- =============================================================================

INSERT INTO public.pharmacies (name, address, district, state, phone_number, is_verified, location)
VALUES
  -- ── Delhi / NCR ──────────────────────────────────────────────────────────
  ('PMBJAK - AIIMS', 'All India Institute of Medical Sciences, Ansari Nagar, New Delhi', 'South Delhi', 'Delhi', '011-26588500', true,
    ST_SetSRID(ST_MakePoint(77.2088, 28.5672), 4326)),

  ('PMBJAK - Safdarjung Hospital', 'Safdarjung Hospital Campus, Ring Road, New Delhi', 'South West Delhi', 'Delhi', '011-26707437', true,
    ST_SetSRID(ST_MakePoint(77.2066, 28.5686), 4326)),

  ('PMBJAK - GTB Hospital', 'Guru Teg Bahadur Hospital, Dilshad Garden, Delhi', 'East Delhi', 'Delhi', '011-22586262', true,
    ST_SetSRID(ST_MakePoint(77.3152, 28.6820), 4326)),

  ('PMBJAK - RML Hospital', 'Dr Ram Manohar Lohia Hospital, Baba Kharak Singh Marg, New Delhi', 'New Delhi', 'Delhi', '011-23404446', true,
    ST_SetSRID(ST_MakePoint(77.2090, 28.6268), 4326)),

  ('PMBJAK - Lok Nayak Hospital', 'Lok Nayak Jai Prakash Narayan Hospital, Jawaharlal Nehru Marg, Delhi', 'Central Delhi', 'Delhi', '011-23232400', true,
    ST_SetSRID(ST_MakePoint(77.2373, 28.6365), 4326)),

  -- ── Mumbai / Maharashtra ─────────────────────────────────────────────────
  ('PMBJAK - KEM Hospital', 'King Edward Memorial Hospital, Acharya Donde Marg, Parel, Mumbai', 'Mumbai City', 'Maharashtra', '022-24107000', true,
    ST_SetSRID(ST_MakePoint(72.8417, 19.0033), 4326)),

  ('PMBJAK - Sion Hospital', 'Lokmanya Tilak Municipal General Hospital, Dr Babasaheb Ambedkar Rd, Sion, Mumbai', 'Mumbai City', 'Maharashtra', '022-24076381', true,
    ST_SetSRID(ST_MakePoint(72.8622, 19.0402), 4326)),

  ('PMBJAK - JJ Hospital', 'Sir JJ Group of Hospitals, Byculla, Mumbai', 'Mumbai City', 'Maharashtra', '022-23735555', true,
    ST_SetSRID(ST_MakePoint(72.8340, 18.9778), 4326)),

  ('PMBJAK - Pune Station', 'Near Pune Railway Station, Pune', 'Pune', 'Maharashtra', '020-26126200', true,
    ST_SetSRID(ST_MakePoint(73.8750, 18.5285), 4326)),

  -- ── Bangalore / Karnataka ────────────────────────────────────────────────
  ('PMBJAK - Victoria Hospital', 'Victoria Hospital Campus, Fort, Bangalore', 'Bengaluru Urban', 'Karnataka', '080-26701150', true,
    ST_SetSRID(ST_MakePoint(77.5734, 12.9584), 4326)),

  ('PMBJAK - Jayanagar', 'Jayanagar 4th Block, Bangalore', 'Bengaluru Urban', 'Karnataka', '080-26544466', true,
    ST_SetSRID(ST_MakePoint(77.5837, 12.9254), 4326)),

  ('PMBJAK - Rajajinagar', 'Rajajinagar 1st Block, Bangalore', 'Bengaluru Urban', 'Karnataka', '080-23327600', true,
    ST_SetSRID(ST_MakePoint(77.5550, 12.9882), 4326)),

  -- ── Chennai / Tamil Nadu ─────────────────────────────────────────────────
  ('PMBJAK - Rajiv Gandhi GGH', 'Rajiv Gandhi Government General Hospital, Park Town, Chennai', 'Chennai', 'Tamil Nadu', '044-25305000', true,
    ST_SetSRID(ST_MakePoint(80.2785, 13.0878), 4326)),

  ('PMBJAK - Kilpauk Medical College', 'Kilpauk Medical College Hospital, Poonamallee High Rd, Chennai', 'Chennai', 'Tamil Nadu', '044-26432323', true,
    ST_SetSRID(ST_MakePoint(80.2420, 13.0827), 4326)),

  ('PMBJAK - Tambaram', 'Near Tambaram Railway Station, Chennai', 'Chengalpattu', 'Tamil Nadu', '044-22261235', true,
    ST_SetSRID(ST_MakePoint(80.1252, 12.9249), 4326)),

  -- ── Kolkata / West Bengal ────────────────────────────────────────────────
  ('PMBJAK - SSKM Hospital', 'Seth Sukhlal Karnani Memorial Hospital, AJC Bose Rd, Kolkata', 'Kolkata', 'West Bengal', '033-22041101', true,
    ST_SetSRID(ST_MakePoint(88.3486, 22.5417), 4326)),

  ('PMBJAK - NRS Medical College', 'Nil Ratan Sircar Medical College, Sealdah, Kolkata', 'Kolkata', 'West Bengal', '033-22531842', true,
    ST_SetSRID(ST_MakePoint(88.3693, 22.5596), 4326)),

  ('PMBJAK - Howrah', 'Near Howrah Railway Station, Howrah', 'Howrah', 'West Bengal', '033-26382500', true,
    ST_SetSRID(ST_MakePoint(88.3421, 22.5835), 4326)),

  -- ── Hyderabad / Telangana ────────────────────────────────────────────────
  ('PMBJAK - Osmania Hospital', 'Osmania General Hospital, Afzalgunj, Hyderabad', 'Hyderabad', 'Telangana', '040-24600146', true,
    ST_SetSRID(ST_MakePoint(78.4747, 17.3753), 4326)),

  ('PMBJAK - Gandhi Hospital', 'Gandhi Hospital, Musheerabad, Secunderabad', 'Hyderabad', 'Telangana', '040-27505566', true,
    ST_SetSRID(ST_MakePoint(78.5048, 17.4050), 4326)),

  ('PMBJAK - KPHB Colony', 'KPHB Colony, Kukatpally, Hyderabad', 'Hyderabad', 'Telangana', '040-23054000', true,
    ST_SetSRID(ST_MakePoint(78.4100, 17.4876), 4326)),

  -- ── Ahmedabad / Gujarat ──────────────────────────────────────────────────
  ('PMBJAK - Civil Hospital', 'Civil Hospital Campus, Asarwa, Ahmedabad', 'Ahmedabad', 'Gujarat', '079-22683721', true,
    ST_SetSRID(ST_MakePoint(72.6068, 23.0471), 4326)),

  ('PMBJAK - VS Hospital', 'VS General Hospital, Ellis Bridge, Ahmedabad', 'Ahmedabad', 'Gujarat', '079-26577621', true,
    ST_SetSRID(ST_MakePoint(72.5646, 23.0266), 4326)),

  -- ── Lucknow / Uttar Pradesh ──────────────────────────────────────────────
  ('PMBJAK - KGMU', 'King George Medical University, Shah Mina Rd, Lucknow', 'Lucknow', 'Uttar Pradesh', '0522-2257540', true,
    ST_SetSRID(ST_MakePoint(80.9476, 26.8567), 4326)),

  ('PMBJAK - Charbagh', 'Near Charbagh Railway Station, Lucknow', 'Lucknow', 'Uttar Pradesh', '0522-2638402', true,
    ST_SetSRID(ST_MakePoint(80.9209, 26.8474), 4326)),

  -- ── Jaipur / Rajasthan ───────────────────────────────────────────────────
  ('PMBJAK - SMS Hospital', 'Sawai Man Singh Hospital, JLN Marg, Jaipur', 'Jaipur', 'Rajasthan', '0141-2518431', true,
    ST_SetSRID(ST_MakePoint(75.8093, 26.8985), 4326)),

  ('PMBJAK - Jaipur Railway Station', 'Near Jaipur Junction Railway Station, Jaipur', 'Jaipur', 'Rajasthan', '0141-2204531', true,
    ST_SetSRID(ST_MakePoint(75.7873, 26.9196), 4326)),

  -- ── Bhopal / Madhya Pradesh ──────────────────────────────────────────────
  ('PMBJAK - Hamidia Hospital', 'Hamidia Hospital, Royal Market Rd, Bhopal', 'Bhopal', 'Madhya Pradesh', '0755-2540222', true,
    ST_SetSRID(ST_MakePoint(77.4126, 23.2700), 4326)),

  -- ── Patna / Bihar ────────────────────────────────────────────────────────
  ('PMBJAK - PMCH', 'Patna Medical College Hospital, Ashok Rajpath, Patna', 'Patna', 'Bihar', '0612-2300343', true,
    ST_SetSRID(ST_MakePoint(85.1760, 25.6200), 4326)),

  -- ── Chandigarh ───────────────────────────────────────────────────────────
  ('PMBJAK - PGI Chandigarh', 'Post Graduate Institute of Medical Education, Sector 12, Chandigarh', 'Chandigarh', 'Chandigarh', '0172-2746018', true,
    ST_SetSRID(ST_MakePoint(76.7734, 30.7637), 4326))

ON CONFLICT DO NOTHING;
