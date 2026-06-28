CREATE TABLE IF NOT EXISTS public.health_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_name TEXT NOT NULL,
    scheme_name TEXT NOT NULL,
    description TEXT NOT NULL,
    coverage TEXT NOT NULL,
    how_to_apply TEXT NOT NULL,
    link TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.health_schemes ENABLE ROW LEVEL SECURITY;

-- Allow public read access to health_schemes
CREATE POLICY "Allow public read access to health_schemes"
ON public.health_schemes
FOR SELECT
TO public
USING (true);

-- Seed initial data
INSERT INTO public.health_schemes (state_name, scheme_name, description, coverage, how_to_apply, link)
VALUES
('Maharashtra', 'Mahatma Jyotirao Phule Jan Arogya Yojana (MJPJAY)', 'Cashless health insurance scheme by the Government of Maharashtra for low-income families and identified vulnerable categories.', 'Cashless healthcare services for identified specialty services up to ₹1.5 Lakh to ₹5 Lakh per family per year.', 'Visit a network hospital or District General Hospital. Speak to the ''Arogyamitra'' helper desk with your yellow/orange ration card, Aadhaar card, and income certificate.', 'https://www.jeevandayee.gov.in/'),
('Gujarat', 'Mukhyamantri Amrutam (MA) Yojana', 'Cashless tertiary care treatment program for Below Poverty Line (BPL) and middle-income families in Gujarat.', 'Cashless treatment up to ₹5 Lakh per family per year for major illnesses including cardiac surgery, oncology, and renal diseases.', 'Visit the civic center or taluka office. Submit your income certificate, Aadhaar card, and family details to get your MA Card.', 'http://www.magujarat.com/'),
('Tamil Nadu', 'Chief Minister''s Comprehensive Health Insurance Scheme (CMCHIS)', 'State-funded cashless hospital services program in Tamil Nadu for eligible low-income families.', 'Quality medical care up to ₹5 Lakh per family per year through empaneled government and private hospitals.', 'Apply at the District Collectorate Office. Bring your Smart Family Card, Income Certificate, and Identity Proof to receive your biometric CMCHIS card.', 'https://www.cmchistn.com/'),
('Karnataka', 'Ayushman Bharat - Arogya Karnataka (AB-Ark)', 'Integrated health insurance scheme combining PM-JAY and state benefits for residents of Karnataka.', 'Cashless treatment up to ₹5 Lakh per year for BPL (eligible) families, and co-payment benefits for APL (general) families.', 'Visit any government primary health center or hospital. Present your Ration Card (BPL/APL) and Aadhaar card to generate your AB-Ark Health ID.', 'https://arogya.karnataka.gov.in/'),
('Kerala', 'Karunya Arogya Suraksha Padhathi (KASP)', 'Universal healthcare scheme of Kerala offering cashless treatments for families in need.', 'Comprehensive coverage of up to ₹5 Lakh per family per year for secondary and tertiary care treatments.', 'Register at any government hospital or empaneled private hospital. Bring your Aadhaar Card, Ration Card, and RSBY legacy card.', 'https://sha.kerala.gov.in/'),
('West Bengal', 'Swasthya Sathi', 'Universal healthcare scheme of West Bengal offering cashless healthcare to state residents.', 'Comprehensive coverage of up to ₹5 Lakh per family per year, covering secondary and tertiary care with no family size cap.', 'Register at any Common Service Center (CSC), Sewa Kendra, or directly through the official scheme portal. Bring your Aadhaar Card and family details to receive your Swasthya Sathi Smart Card.', 'https://swasthyasathi.gov.in/'),
('Punjab', 'Mukh Mantri Sehat Yojana', 'Universal cashless health insurance scheme of Punjab covering all residents regardless of income.', 'Cashless treatment of up to ₹10 Lakh per family per year at government and empaneled private hospitals.', 'Visit your nearest Sewa Kendra or Common Service Center with Aadhaar Card and Voter ID, or register via the Ayushman App. You will receive a Mukh Mantri Sehat Card for cashless treatment.', 'https://sha.punjab.gov.in/'),
('Rajasthan', 'Mukhyamantri Ayushman Arogya Yojana (MAAY)', 'Rajasthan government''s flagship health insurance scheme (formerly Chiranjeevi Yojana) providing cashless treatment for all residents.', 'Cashless treatment of up to ₹25 Lakh per family per year, including pre and post-hospitalization expenses.', 'Register via the Rajasthan SSO portal or visit your nearest e-Mitra center with your Jan Aadhaar or Aadhaar card. Most BPL, NFSA, and SECC families are enrolled automatically.', 'https://maayojana.rajasthan.gov.in/'),
('Andhra Pradesh', 'Dr. YSR Aarogyasri Health Scheme', 'Flagship cashless healthcare scheme targeting poor and middle-income families in Andhra Pradesh/Telangana.', 'Cashless treatment for listed therapies and procedures up to ₹5 Lakh per year per family.', 'Visit any YSR Aarogyasri kiosk at network hospitals. Present your rice card (Ration card) or health card along with your Aadhaar card.', 'https://www.aarogyasri.ap.gov.in/'),
('Telangana', 'Dr. YSR Aarogyasri Health Scheme', 'Flagship cashless healthcare scheme targeting poor and middle-income families in Andhra Pradesh/Telangana.', 'Cashless treatment for listed therapies and procedures up to ₹5 Lakh per year per family.', 'Visit any YSR Aarogyasri kiosk at network hospitals. Present your rice card (Ration card) or health card along with your Aadhaar card.', 'https://www.aarogyasri.ap.gov.in/');
