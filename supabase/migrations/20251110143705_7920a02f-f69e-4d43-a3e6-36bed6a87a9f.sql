-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subcategories table
CREATE TABLE IF NOT EXISTS public.subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create items table with reorder_level
CREATE TABLE IF NOT EXISTS public.items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subcategory_id UUID NOT NULL REFERENCES public.subcategories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 15,
  predicted_stock INTEGER,
  prediction_trend TEXT CHECK (prediction_trend IN ('increasing', 'decreasing', 'stable')),
  prediction_confidence INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create batches table
CREATE TABLE IF NOT EXISTS public.batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stock_history table
CREATE TABLE IF NOT EXISTS public.stock_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  quantity_change INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  action TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (public read/write for now - can be restricted later)
CREATE POLICY "Allow public read access on categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Allow public insert on categories" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on categories" ON public.categories FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on categories" ON public.categories FOR DELETE USING (true);

CREATE POLICY "Allow public read access on subcategories" ON public.subcategories FOR SELECT USING (true);
CREATE POLICY "Allow public insert on subcategories" ON public.subcategories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on subcategories" ON public.subcategories FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on subcategories" ON public.subcategories FOR DELETE USING (true);

CREATE POLICY "Allow public read access on items" ON public.items FOR SELECT USING (true);
CREATE POLICY "Allow public insert on items" ON public.items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on items" ON public.items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on items" ON public.items FOR DELETE USING (true);

CREATE POLICY "Allow public read access on batches" ON public.batches FOR SELECT USING (true);
CREATE POLICY "Allow public insert on batches" ON public.batches FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on batches" ON public.batches FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on batches" ON public.batches FOR DELETE USING (true);

CREATE POLICY "Allow public read access on stock_history" ON public.stock_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert on stock_history" ON public.stock_history FOR INSERT WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for items table
CREATE TRIGGER update_items_updated_at
BEFORE UPDATE ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to log stock changes
CREATE OR REPLACE FUNCTION public.log_stock_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.quantity != NEW.quantity) THEN
    INSERT INTO public.stock_history (item_id, quantity_change, previous_quantity, new_quantity, action)
    VALUES (NEW.id, NEW.quantity - OLD.quantity, OLD.quantity, NEW.quantity, 'UPDATE');
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.stock_history (item_id, quantity_change, previous_quantity, new_quantity, action)
    VALUES (NEW.id, NEW.quantity, 0, NEW.quantity, 'INSERT');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to log stock changes
CREATE TRIGGER log_item_stock_change
AFTER INSERT OR UPDATE ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.log_stock_change();

-- Create indexes for better performance
CREATE INDEX idx_subcategories_category_id ON public.subcategories(category_id);
CREATE INDEX idx_items_subcategory_id ON public.items(subcategory_id);
CREATE INDEX idx_items_reorder_level ON public.items(quantity, reorder_level);
CREATE INDEX idx_batches_item_id ON public.batches(item_id);
CREATE INDEX idx_batches_expiry_date ON public.batches(expiry_date);
CREATE INDEX idx_stock_history_item_id ON public.stock_history(item_id);
CREATE INDEX idx_stock_history_created_at ON public.stock_history(created_at DESC);