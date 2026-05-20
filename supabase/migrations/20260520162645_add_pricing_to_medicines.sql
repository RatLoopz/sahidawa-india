ALTER TABLE medicines
ADD COLUMN mrp NUMERIC(10,2)
NULL
CHECK (mrp >= 0),

ADD COLUMN jan_aushadhi_price NUMERIC(10,2)
NULL
CHECK (jan_aushadhi_price >= 0);