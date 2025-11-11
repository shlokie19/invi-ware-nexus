-- Add new columns to items table
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS sku text UNIQUE,
ADD COLUMN IF NOT EXISTS unit text DEFAULT 'pcs',
ADD COLUMN IF NOT EXISTS supplier_id text,
ADD COLUMN IF NOT EXISTS cost_price numeric CHECK (cost_price >= 0),
ADD COLUMN IF NOT EXISTS selling_price numeric CHECK (selling_price >= 0);

-- Update stock_history to support different change types
ALTER TABLE public.stock_history
ADD COLUMN IF NOT EXISTS change_type text DEFAULT 'adjustment',
ADD COLUMN IF NOT EXISTS note text;

-- Create index on sku for faster lookups
CREATE INDEX IF NOT EXISTS idx_items_sku ON public.items(sku);

-- Create index on batches expiry_date for alert queries
CREATE INDEX IF NOT EXISTS idx_batches_expiry_date ON public.batches(expiry_date) WHERE expiry_date IS NOT NULL;

-- Create transactional RPC for stock adjustments
CREATE OR REPLACE FUNCTION public.transactional_adjust_stock(
  p_item_id uuid,
  p_change_type text,
  p_quantity_changed integer,
  p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_quantity integer;
  v_new_quantity integer;
  v_reorder_level integer;
  v_new_status text;
BEGIN
  -- Get current quantity and reorder level
  SELECT quantity, reorder_level INTO v_current_quantity, v_reorder_level
  FROM public.items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Item not found');
  END IF;

  -- Calculate new quantity
  v_new_quantity := v_current_quantity + p_quantity_changed;

  -- Validate new quantity
  IF v_new_quantity < 0 THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient stock');
  END IF;

  -- Determine new status
  IF v_new_quantity <= v_reorder_level THEN
    v_new_status := 'low';
  ELSE
    v_new_status := 'normal';
  END IF;

  -- Update item
  UPDATE public.items
  SET 
    quantity = v_new_quantity,
    updated_at = now()
  WHERE id = p_item_id;

  -- Insert stock history
  INSERT INTO public.stock_history (
    item_id,
    quantity_change,
    previous_quantity,
    new_quantity,
    action,
    change_type,
    note
  ) VALUES (
    p_item_id,
    p_quantity_changed,
    v_current_quantity,
    v_new_quantity,
    CASE 
      WHEN p_change_type = 'sale' THEN 'SALE'
      WHEN p_change_type = 'damaged' THEN 'DAMAGED'
      ELSE 'ADJUSTMENT'
    END,
    p_change_type,
    p_note
  );

  RETURN json_build_object(
    'success', true,
    'new_quantity', v_new_quantity,
    'status', v_new_status
  );
END;
$$;