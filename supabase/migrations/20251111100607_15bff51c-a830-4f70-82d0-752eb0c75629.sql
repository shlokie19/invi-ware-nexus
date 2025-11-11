-- Fix search_path for all functions to prevent security issues

-- Update existing update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Update existing log_stock_change function
CREATE OR REPLACE FUNCTION public.log_stock_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Update transactional_adjust_stock function with proper search_path
CREATE OR REPLACE FUNCTION public.transactional_adjust_stock(
  p_item_id uuid,
  p_change_type text,
  p_quantity_changed integer,
  p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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