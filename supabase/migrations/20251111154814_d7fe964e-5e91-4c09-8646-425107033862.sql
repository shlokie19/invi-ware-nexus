-- Create locations table for warehouse map
CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  zone TEXT,
  capacity INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for locations
CREATE POLICY "Allow public read access on locations" 
ON public.locations 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert on locations" 
ON public.locations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update on locations" 
ON public.locations 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete on locations" 
ON public.locations 
FOR DELETE 
USING (true);

-- Add location_id to items table
ALTER TABLE public.items 
ADD COLUMN location_id UUID REFERENCES public.locations(id);

-- Insert demo warehouse locations (3 zones, 4 rows x 4 cols = 16 locations per zone)
INSERT INTO public.locations (label, zone, capacity) VALUES
-- Zone A (General Storage)
('A-01', 'Zone A', 100),
('A-02', 'Zone A', 100),
('A-03', 'Zone A', 150),
('A-04', 'Zone A', 100),
('A-05', 'Zone A', 100),
('A-06', 'Zone A', 100),
('A-07', 'Zone A', 150),
('A-08', 'Zone A', 100),
('A-09', 'Zone A', 100),
('A-10', 'Zone A', 100),
('A-11', 'Zone A', 150),
('A-12', 'Zone A', 100),
('A-13', 'Zone A', 100),
('A-14', 'Zone A', 100),
('A-15', 'Zone A', 150),
('A-16', 'Zone A', 100),
-- Zone B (Cold Storage)
('B-01', 'Zone B', 200),
('B-02', 'Zone B', 200),
('B-03', 'Zone B', 150),
('B-04', 'Zone B', 100),
('B-05', 'Zone B', 200),
('B-06', 'Zone B', 200),
('B-07', 'Zone B', 150),
('B-08', 'Zone B', 100),
('B-09', 'Zone B', 200),
('B-10', 'Zone B', 200),
('B-11', 'Zone B', 150),
('B-12', 'Zone B', 100),
('B-13', 'Zone B', 200),
('B-14', 'Zone B', 200),
('B-15', 'Zone B', 150),
('B-16', 'Zone B', 100),
-- Zone C (High-Value Items)
('C-01', 'Zone C', 100),
('C-02', 'Zone C', 100),
('C-03', 'Zone C', 100),
('C-04', 'Zone C', 100),
('C-05', 'Zone C', 100),
('C-06', 'Zone C', 100),
('C-07', 'Zone C', 100),
('C-08', 'Zone C', 100),
('C-09', 'Zone C', 100),
('C-10', 'Zone C', 100),
('C-11', 'Zone C', 100),
('C-12', 'Zone C', 100),
('C-13', 'Zone C', 100),
('C-14', 'Zone C', 100),
('C-15', 'Zone C', 100),
('C-16', 'Zone C', 100);