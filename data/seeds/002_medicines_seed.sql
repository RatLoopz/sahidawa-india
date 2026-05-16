-- Seed data for the medicines lookup table
-- I have used realistic Indian medicine brands and future expiry dates for verification testing.

INSERT INTO medicines (
    name,
    manufacturer,
    batch_number,
    expiry_date,
    is_verified,
    category
)
VALUES
  ('Amoxyclav 625 Duo', 'Sun Pharmaceutical Industries Ltd', 'AMX101A', '2027-11-30', TRUE, 'antibiotic'),
  ('Azee 500', 'Cipla Ltd', 'AZI102B', '2028-03-31', TRUE, 'antibiotic'),
  ('Cifran 500', 'Zydus Lifesciences Ltd', 'CIF103C', '2027-09-30', TRUE, 'antibiotic'),
  ('Taxim-O 200', 'Alkem Laboratories Ltd', 'TAX104D', '2028-01-31', TRUE, 'antibiotic'),
  ('Mox 500', 'Abbott India Ltd', 'MOX105E', '2027-12-31', TRUE, 'antibiotic'),
  ('Zithro 500', 'Dr. Reddy''s Laboratories Ltd', 'ZIT106F', '2028-06-30', TRUE, 'antibiotic'),
  ('Cefix 200', 'Lupin Ltd', 'CEF107G', '2027-08-31', TRUE, 'antibiotic'),
  ('Oflox 200', 'Sun Pharmaceutical Industries Ltd', 'OFL108H', '2028-05-31', TRUE, 'antibiotic'),
  ('Monocef-O 200', 'Aristo Pharmaceuticals Pvt Ltd', 'MON109I', '2027-10-31', TRUE, 'antibiotic'),
  ('Lupiflox 500', 'Lupin Ltd', 'LUF110J', '2027-07-31', TRUE, 'antibiotic'),

  ('Dolo 650', 'Micro Labs Ltd', 'DOL201A', '2027-12-31', TRUE, 'painkiller'),
  ('Brufen 400', 'Abbott India Ltd', 'BRU202B', '2028-04-30', TRUE, 'painkiller'),
  ('Voveran 50', 'Sun Pharmaceutical Industries Ltd', 'VOV203C', '2027-11-30', TRUE, 'painkiller'),
  ('Zerodol-P', 'Ipca Laboratories Ltd', 'ZER204D', '2028-02-29', TRUE, 'painkiller'),
  ('Combiflam', 'Sanofi India Ltd', 'COM205E', '2027-10-31', TRUE, 'painkiller'),
  ('Calpol 650', 'GlaxoSmithKline Pharmaceuticals Ltd', 'CAL206F', '2028-08-31', TRUE, 'painkiller'),
  ('Flexon', 'Aristo Pharmaceuticals Pvt Ltd', 'FLX207G', '2027-09-30', TRUE, 'painkiller'),
  ('Paracip 500', 'Cipla Ltd', 'PAR208H', '2028-12-31', TRUE, 'painkiller'),
  ('Aceclo-S', 'Intas Pharmaceuticals Ltd', 'ACE209I', '2027-06-30', TRUE, 'painkiller'),
  ('Nucoxia P', 'Dr. Reddy''s Laboratories Ltd', 'NUC210J', '2028-07-31', TRUE, 'painkiller'),

  ('Uprise-D3 60K', 'Alkem Laboratories Ltd', 'UPR301A', '2028-03-31', TRUE, 'vitamin'),
  ('Neurobion Forte', 'Procter & Gamble Health Ltd', 'NEU302B', '2027-12-31', TRUE, 'vitamin'),
  ('Shelcal 500', 'Torrent Pharmaceuticals Ltd', 'SHE303C', '2028-05-31', TRUE, 'vitamin'),
  ('Becosules', 'Pfizer Ltd', 'BEC304D', '2027-11-30', TRUE, 'vitamin'),
  ('Zincovit', 'Apex Laboratories Pvt Ltd', 'ZIN305E', '2028-09-30', TRUE, 'vitamin'),
  ('Limcee', 'Abbott India Ltd', 'LIM306F', '2027-07-31', TRUE, 'vitamin'),
  ('Fericip XT', 'Cipla Ltd', 'FER307G', '2028-01-31', TRUE, 'vitamin'),
  ('Revital H', 'Sun Pharmaceutical Industries Ltd', 'REV308H', '2027-10-31', TRUE, 'vitamin'),
  ('A to Z NS', 'Alkem Laboratories Ltd', 'ATZ309I', '2028-06-30', TRUE, 'vitamin'),
  ('Orofer XT', 'Troikaa Pharmaceuticals Pvt Ltd', 'ORO310J', '2027-09-30', TRUE, 'vitamin'),

  ('Glycomet 500', 'USV Pvt Ltd', 'GLY401A', '2027-12-31', TRUE, 'diabetes'),
  ('Glycomet GP 1', 'USV Pvt Ltd', 'GLP402B', '2028-04-30', TRUE, 'diabetes'),
  ('Amaryl M 1', 'Sanofi India Ltd', 'AMA403C', '2027-11-30', TRUE, 'diabetes'),
  ('Jalra M 50/500', 'Sun Pharmaceutical Industries Ltd', 'JAL404D', '2028-02-29', TRUE, 'diabetes'),
  ('Gluconorm-G 1', 'Lupin Ltd', 'GLU405E', '2027-10-31', TRUE, 'diabetes'),
  ('Istamet 50/500', 'MSD Pharmaceuticals Pvt Ltd', 'IST406F', '2028-08-31', TRUE, 'diabetes'),
  ('Zoryl-M 1', 'Intas Pharmaceuticals Ltd', 'ZOR407G', '2027-06-30', TRUE, 'diabetes'),
  ('Vogli 0.3', 'Micro Labs Ltd', 'VOG408H', '2028-12-31', TRUE, 'diabetes'),
  ('Dianorm M 80/500', 'Torrent Pharmaceuticals Ltd', 'DIA409I', '2027-09-30', TRUE, 'diabetes'),
  ('Glynase MF 1', 'USV Pvt Ltd', 'GLN410J', '2028-07-31', TRUE, 'diabetes'),

  ('Pan 40', 'Alkem Laboratories Ltd', 'PAN501A', '2027-12-31', TRUE, 'antacid'),
  ('Omez 20', 'Dr. Reddy''s Laboratories Ltd', 'OME502B', '2028-03-31', TRUE, 'antacid'),
  ('Razo 20', 'Dr. Reddy''s Laboratories Ltd', 'RAZ503C', '2027-11-30', TRUE, 'antacid'),
  ('Rantac 150', 'J.B. Chemicals & Pharmaceuticals Ltd', 'RAN504D', '2028-05-31', TRUE, 'antacid'),
  ('Sompraz 40', 'Sun Pharmaceutical Industries Ltd', 'SOM505E', '2027-10-31', TRUE, 'antacid'),
  ('Nexpro RD 40', 'Torrent Pharmaceuticals Ltd', 'NEX506F', '2028-09-30', TRUE, 'antacid'),
  ('Rabicip 20', 'Cipla Ltd', 'RAB507G', '2027-08-31', TRUE, 'antacid'),
  ('Lanzol 30', 'Sun Pharmaceutical Industries Ltd', 'LAN508H', '2028-01-31', TRUE, 'antacid'),
  ('Aciloc 150', 'Cadila Pharmaceuticals Ltd', 'ACI509I', '2027-06-30', TRUE, 'antacid'),
  ('Peptac 10', 'Mankind Pharma Ltd', 'PEP510J', '2028-12-31', TRUE, 'antacid')
ON CONFLICT (batch_number) DO NOTHING;