-- Create a read-only view for stock history with all joined details
CREATE OR REPLACE VIEW vw_stock_history_detailed AS
SELECT 
  sh.id,
  sh.created_at,
  sh.item_id,
  i.name AS item_name,
  i.sku,
  i.unit,
  c.name AS category_name,
  sc.name AS subcategory_name,
  sh.change_type,
  sh.quantity_change AS quantity_changed,
  sh.new_quantity AS new_quantity_after_change,
  i.supplier_id AS supplier_name,
  sh.note
FROM stock_history sh
JOIN items i ON sh.item_id = i.id
JOIN subcategories sc ON i.subcategory_id = sc.id
JOIN categories c ON sc.category_id = c.id
ORDER BY sh.created_at DESC;