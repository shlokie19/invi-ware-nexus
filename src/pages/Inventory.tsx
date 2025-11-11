import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Plus, Edit, Trash2, TrendingUp, TrendingDown, Minus, History, AlertTriangle, Bell, X, MapPin, Brain } from "lucide-react";
import { LocationPicker } from "@/components/LocationPicker";
import { useInventoryInsights } from "@/hooks/useInventoryInsights";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const FLASK_BASE_URL = "http://localhost:5000";
const RETRAIN_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trigger-model-retrain`;

const triggerModelRetrain = async (itemId: string, action: 'add' | 'update' | 'delete') => {
  try {
    // Call edge function (handles cloud-based Flask communication)
    const edgeFunctionResponse = await fetch(RETRAIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ itemId, action }),
    });
    
    const edgeResult = await edgeFunctionResponse.json();
    if (edgeResult.warning) {
      console.warn('ML retraining:', edgeResult.warning);
    }

    // Try to call Flask backend directly (only works if running locally)
    try {
      const flaskResponse = await fetch(`${FLASK_BASE_URL}/train-ml`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          item_id: itemId, 
          action,
          timestamp: new Date().toISOString()
        }),
      });
      
      if (flaskResponse.ok) {
        console.log('Successfully triggered local Flask ML retraining');
      }
    } catch (flaskError) {
      // Flask not available locally - this is okay, the edge function may handle it
      console.log('Local Flask backend not available (expected in production)');
    }
  } catch (error) {
    console.error('Error triggering model retrain:', error);
    // Don't throw - we don't want to block inventory operations if ML is unavailable
  }
};

interface Batch {
  id: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  isExpiringSoon?: boolean;
}

interface StockHistoryEntry {
  id: string;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  action: string;
  notes?: string;
  created_at: string;
}

interface Item {
  id: string;
  name: string;
  sku?: string;
  unit: string;
  quantity: number;
  reorderLevel: number;
  supplierId?: string;
  costPrice?: number;
  sellingPrice?: number;
  locationId?: string;
  locationLabel?: string;
  status: "normal" | "low";
  lastUpdated: string;
  batches: Batch[];
  predictedStock: number;
  predictionTrend: "increasing" | "decreasing" | "stable";
  predictionConfidence: number;
  predictedStatus: "normal" | "low";
  hasExpiringBatches?: boolean;
}

interface Subcategory {
  id: string;
  name: string;
  items: Item[];
}

interface Category {
  id: string;
  name: string;
  subcategories: Subcategory[];
}

const isExpiringSoon = (expiryDate: string, threshold: number = 7) => {
  if (!expiryDate) return false;
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return daysUntilExpiry <= threshold && daysUntilExpiry >= 0;
};

export default function Inventory() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [expandedSubcategories, setExpandedSubcategories] = useState<string[]>([]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Dialog states
  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; mode: "add" | "edit"; data?: Category }>({ open: false, mode: "add" });
  const [subcategoryDialog, setSubcategoryDialog] = useState<{ open: boolean; mode: "add" | "edit"; categoryId?: string; data?: Subcategory }>({ open: false, mode: "add" });
  const [itemDialog, setItemDialog] = useState<{ open: boolean; mode: "add" | "edit"; categoryId?: string; subcategoryId?: string; data?: Item }>({ open: false, mode: "add" });
  const [batchDialog, setBatchDialog] = useState<{ open: boolean; categoryId?: string; subcategoryId?: string; itemId?: string }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type?: "category" | "subcategory" | "item"; id?: string; parentId?: string; subParentId?: string }>({ open: false });
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; itemId?: string; itemName?: string }>({ open: false });
  const [removeStockDialog, setRemoveStockDialog] = useState<{ open: boolean; item?: Item }>({ open: false });
  const [expiryAlertsDialog, setExpiryAlertsDialog] = useState(false);
  const [stockHistory, setStockHistory] = useState<StockHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expiryThreshold, setExpiryThreshold] = useState(7);

  // Get all items for insights
  const allItems = categories.flatMap(cat => 
    cat.subcategories.flatMap(sub => 
      sub.items.map(item => ({
        id: item.id,
        quantity: item.quantity,
        reorderLevel: item.reorderLevel,
      }))
    )
  );

  const expiringBatchesCount = categories.flatMap(cat => 
    cat.subcategories.flatMap(sub => 
      sub.items.flatMap(item => item.batches.filter(b => b.isExpiringSoon))
    )
  ).length;

  const { itemInsights, healthScore, loading: insightsLoading } = useInventoryInsights(allItems, expiringBatchesCount);

  // Form states
  const [categoryForm, setCategoryForm] = useState({ name: "" });
  const [subcategoryForm, setSubcategoryForm] = useState({ name: "" });
  const [itemForm, setItemForm] = useState({ 
    name: "", 
    sku: "", 
    unit: "pcs", 
    quantity: 0, 
    reorderLevel: 15,
    supplierId: "",
    costPrice: 0,
    sellingPrice: 0,
    locationId: "",
    locationLabel: "",
    batches: [{ batchNumber: "", quantity: 0, expiryDate: "" }]
  });
  const [batchForm, setBatchForm] = useState({ batchNumber: "", quantity: 0, expiryDate: "" });
  const [removeStockForm, setRemoveStockForm] = useState({ mode: "sale", quantity: 0, note: "" });
  const [skuError, setSkuError] = useState("");
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  // Load data from database
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (categoriesError) throw categoriesError;

      // Fetch subcategories
      const { data: subcategoriesData, error: subcategoriesError } = await supabase
        .from('subcategories')
        .select('*')
        .order('name');

      if (subcategoriesError) throw subcategoriesError;

      // Fetch items with location info
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select(`
          *,
          locations (
            id,
            label
          )
        `)
        .order('name');

      if (itemsError) throw itemsError;

      // Fetch batches
      const { data: batchesData, error: batchesError } = await supabase
        .from('batches')
        .select('*')
        .order('expiry_date');

      if (batchesError) throw batchesError;

      // Transform data to match our interface
      const transformedCategories: Category[] = (categoriesData || []).map(cat => ({
        id: cat.id,
        name: cat.name,
        subcategories: (subcategoriesData || [])
          .filter(sub => sub.category_id === cat.id)
          .map(sub => ({
            id: sub.id,
            name: sub.name,
            items: (itemsData || [])
              .filter(item => item.subcategory_id === sub.id)
              .map(item => {
                const itemBatches = (batchesData || [])
                  .filter(batch => batch.item_id === item.id)
                  .map(batch => ({
                    id: batch.id,
                    batchNumber: batch.batch_number,
                    quantity: batch.quantity,
                    expiryDate: batch.expiry_date || '',
                    isExpiringSoon: batch.expiry_date ? isExpiringSoon(batch.expiry_date, expiryThreshold) : false,
                  }));

                const status = item.quantity <= item.reorder_level ? "low" : "normal";
                const predictedStatus = (item.predicted_stock || item.quantity) <= item.reorder_level ? "low" : "normal";
                const hasExpiringBatches = itemBatches.some(b => b.isExpiringSoon);

                return {
                  id: item.id,
                  name: item.name,
                  sku: item.sku || undefined,
                  unit: item.unit || 'pcs',
                  quantity: item.quantity,
                  reorderLevel: item.reorder_level,
                  supplierId: item.supplier_id || undefined,
                  costPrice: item.cost_price || undefined,
                  sellingPrice: item.selling_price || undefined,
                  locationId: item.location_id || undefined,
                  locationLabel: (item.locations as any)?.label || undefined,
                  status,
                  lastUpdated: new Date(item.updated_at).toLocaleString(),
                  batches: itemBatches,
                  predictedStock: item.predicted_stock || item.quantity,
                  predictionTrend: (item.prediction_trend as "increasing" | "decreasing" | "stable") || "stable",
                  predictionConfidence: item.prediction_confidence || 0,
                  predictedStatus,
                  hasExpiringBatches,
                };
              }),
          })),
      }));

      setCategories(transformedCategories);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadStockHistory = async (itemId: string) => {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('stock_history')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setStockHistory(data || []);
    } catch (error) {
      console.error('Error loading stock history:', error);
      toast({ title: "Error loading history", variant: "destructive" });
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) =>
      prev.includes(id) ? prev.filter((catId) => catId !== id) : [...prev, id]
    );
  };

  const toggleSubcategory = (id: string) => {
    setExpandedSubcategories((prev) =>
      prev.includes(id) ? prev.filter((subId) => subId !== id) : [...prev, id]
    );
  };

  const toggleItem = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  // CRUD handlers
  const handleAddCategory = async () => {
    if (!categoryForm.name.trim()) return;
    try {
      const { error } = await supabase
        .from('categories')
        .insert([{ name: categoryForm.name }]);

      if (error) throw error;

      setCategoryDialog({ open: false, mode: "add" });
      setCategoryForm({ name: "" });
      toast({ title: "Category added successfully" });
      loadData();
    } catch (error) {
      console.error('Error adding category:', error);
      toast({ title: "Error adding category", variant: "destructive" });
    }
  };

  const handleEditCategory = async () => {
    if (!categoryForm.name.trim() || !categoryDialog.data) return;
    try {
      const { error } = await supabase
        .from('categories')
        .update({ name: categoryForm.name })
        .eq('id', categoryDialog.data.id);

      if (error) throw error;

      setCategoryDialog({ open: false, mode: "add" });
      setCategoryForm({ name: "" });
      toast({ title: "Category updated successfully" });
      loadData();
    } catch (error) {
      console.error('Error updating category:', error);
      toast({ title: "Error updating category", variant: "destructive" });
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteDialog.id) return;
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', deleteDialog.id);

      if (error) throw error;

      setDeleteDialog({ open: false });
      toast({ title: "Category deleted successfully" });
      loadData();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({ title: "Error deleting category", variant: "destructive" });
    }
  };

  const handleAddSubcategory = async () => {
    if (!subcategoryForm.name.trim() || !subcategoryDialog.categoryId) return;
    try {
      const { error } = await supabase
        .from('subcategories')
        .insert([{ name: subcategoryForm.name, category_id: subcategoryDialog.categoryId }]);

      if (error) throw error;

      setSubcategoryDialog({ open: false, mode: "add" });
      setSubcategoryForm({ name: "" });
      toast({ title: "Subcategory added successfully" });
      loadData();
    } catch (error) {
      console.error('Error adding subcategory:', error);
      toast({ title: "Error adding subcategory", variant: "destructive" });
    }
  };

  const handleEditSubcategory = async () => {
    if (!subcategoryForm.name.trim() || !subcategoryDialog.data) return;
    try {
      const { error } = await supabase
        .from('subcategories')
        .update({ name: subcategoryForm.name })
        .eq('id', subcategoryDialog.data.id);

      if (error) throw error;

      setSubcategoryDialog({ open: false, mode: "add" });
      setSubcategoryForm({ name: "" });
      toast({ title: "Subcategory updated successfully" });
      loadData();
    } catch (error) {
      console.error('Error updating subcategory:', error);
      toast({ title: "Error updating subcategory", variant: "destructive" });
    }
  };

  const handleDeleteSubcategory = async () => {
    if (!deleteDialog.id) return;
    try {
      const { error } = await supabase
        .from('subcategories')
        .delete()
        .eq('id', deleteDialog.id);

      if (error) throw error;

      setDeleteDialog({ open: false });
      toast({ title: "Subcategory deleted successfully" });
      loadData();
    } catch (error) {
      console.error('Error deleting subcategory:', error);
      toast({ title: "Error deleting subcategory", variant: "destructive" });
    }
  };

  const validateSku = async (sku: string, currentItemId?: string) => {
    if (!sku.trim()) {
      setSkuError("SKU is required");
      return false;
    }
    
    const { data } = await supabase
      .from('items')
      .select('id')
      .eq('sku', sku);
    
    if (data && data.length > 0) {
      if (!currentItemId || data[0].id !== currentItemId) {
        setSkuError("SKU already exists");
        return false;
      }
    }
    
    setSkuError("");
    return true;
  };

  const handleAddItem = async () => {
    if (!itemForm.name.trim() || !itemDialog.categoryId || !itemDialog.subcategoryId) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    
    const isSkuValid = await validateSku(itemForm.sku);
    if (!isSkuValid) return;

    // Validate batches
    const validBatches = itemForm.batches.filter(b => b.batchNumber.trim() && b.quantity > 0);
    if (validBatches.length === 0) {
      toast({ title: "At least one valid batch is required", variant: "destructive" });
      return;
    }

    try {
      // Calculate total quantity from batches
      const totalQuantity = validBatches.reduce((sum, b) => sum + b.quantity, 0);

      const { data, error } = await supabase
        .from('items')
        .insert([{
          name: itemForm.name,
          sku: itemForm.sku,
          unit: itemForm.unit,
          quantity: totalQuantity,
          reorder_level: itemForm.reorderLevel,
          supplier_id: itemForm.supplierId || null,
          cost_price: itemForm.costPrice || null,
          selling_price: itemForm.sellingPrice || null,
          location_id: itemForm.locationId || null,
          subcategory_id: itemDialog.subcategoryId,
        }])
        .select()
        .single();

      if (error) throw error;

      // Add batches
      const batchInserts = validBatches.map(batch => ({
        batch_number: batch.batchNumber,
        quantity: batch.quantity,
        expiry_date: batch.expiryDate || null,
        item_id: data.id,
      }));

      const { error: batchError } = await supabase
        .from('batches')
        .insert(batchInserts);

      if (batchError) throw batchError;

      setItemDialog({ open: false, mode: "add" });
      setItemForm({ 
        name: "", 
        sku: "", 
        unit: "pcs", 
        quantity: 0, 
        reorderLevel: 15,
        supplierId: "",
        costPrice: 0,
        sellingPrice: 0,
        locationId: "",
        locationLabel: "",
        batches: [{ batchNumber: "", quantity: 0, expiryDate: "" }]
      });
      setSkuError("");
      toast({ title: "Item added successfully" });
      loadData();

      // Trigger ML model retraining
      if (data) {
        triggerModelRetrain(data.id, 'add');
      }
    } catch (error: any) {
      console.error('Error adding item:', error);
      toast({ title: error.message || "Error adding item", variant: "destructive" });
    }
  };

  const handleEditItem = async () => {
    if (!itemForm.name.trim() || !itemDialog.data) return;
    const itemId = itemDialog.data.id;
    
    const isSkuValid = await validateSku(itemForm.sku, itemId);
    if (!isSkuValid) return;
    
    try {
      const { error } = await supabase
        .from('items')
        .update({
          name: itemForm.name,
          sku: itemForm.sku,
          unit: itemForm.unit,
          reorder_level: itemForm.reorderLevel,
          supplier_id: itemForm.supplierId || null,
          cost_price: itemForm.costPrice || null,
          selling_price: itemForm.sellingPrice || null,
          location_id: itemForm.locationId || null,
        })
        .eq('id', itemId);

      if (error) throw error;

      setItemDialog({ open: false, mode: "add" });
      setItemForm({ 
        name: "", 
        sku: "", 
        unit: "pcs", 
        quantity: 0, 
        reorderLevel: 15,
        supplierId: "",
        costPrice: 0,
        sellingPrice: 0,
        locationId: "",
        locationLabel: "",
        batches: [{ batchNumber: "", quantity: 0, expiryDate: "" }]
      });
      setSkuError("");
      toast({ title: "Item updated successfully" });
      loadData();

      // Trigger ML model retraining
      triggerModelRetrain(itemId, 'update');
    } catch (error: any) {
      console.error('Error updating item:', error);
      toast({ title: error.message || "Error updating item", variant: "destructive" });
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteDialog.id) return;
    const itemId = deleteDialog.id;
    
    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setDeleteDialog({ open: false });
      toast({ title: "Item deleted successfully" });
      loadData();

      // Trigger ML model retraining
      triggerModelRetrain(itemId, 'delete');
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({ title: "Error deleting item", variant: "destructive" });
    }
  };

  const handleRemoveStock = async () => {
    if (!removeStockDialog.item || removeStockForm.quantity <= 0) {
      toast({ title: "Invalid quantity", variant: "destructive" });
      return;
    }

    if (removeStockForm.mode === "damaged" && !removeStockForm.note.trim()) {
      toast({ title: "Note is required for damaged items", variant: "destructive" });
      return;
    }

    if (removeStockForm.quantity > removeStockDialog.item.quantity) {
      toast({ title: "Quantity exceeds available stock", variant: "destructive" });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('transactional_adjust_stock', {
        p_item_id: removeStockDialog.item.id,
        p_change_type: removeStockForm.mode,
        p_quantity_changed: -removeStockForm.quantity,
        p_note: removeStockForm.note || null,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      setRemoveStockDialog({ open: false });
      setRemoveStockForm({ mode: "sale", quantity: 0, note: "" });
      toast({ 
        title: `Stock ${removeStockForm.mode === 'sale' ? 'sold' : 'removed'} successfully` 
      });
      loadData();
    } catch (error: any) {
      console.error('Error removing stock:', error);
      toast({ title: error.message || "Error removing stock", variant: "destructive" });
    }
  };

  const handleAddBatch = async () => {
    if (!batchForm.batchNumber.trim() || !batchDialog.itemId) return;
    try {
      const { error } = await supabase
        .from('batches')
        .insert([{
          batch_number: batchForm.batchNumber,
          quantity: batchForm.quantity,
          expiry_date: batchForm.expiryDate || null,
          item_id: batchDialog.itemId,
        }]);

      if (error) throw error;

      setBatchDialog({ open: false });
      setBatchForm({ batchNumber: "", quantity: 0, expiryDate: "" });
      toast({ title: "Batch added successfully" });
      loadData();
    } catch (error) {
      console.error('Error adding batch:', error);
      toast({ title: "Error adding batch", variant: "destructive" });
    }
  };

  const getExpiringBatches = () => {
    const expiringBatches: Array<{ 
      itemName: string; 
      batchNumber: string; 
      quantity: number; 
      expiryDate: string;
      daysRemaining: number;
    }> = [];

    categories.forEach(cat => {
      cat.subcategories.forEach(sub => {
        sub.items.forEach(item => {
          item.batches.forEach(batch => {
            if (batch.expiryDate && isExpiringSoon(batch.expiryDate, expiryThreshold)) {
              const today = new Date();
              const expiry = new Date(batch.expiryDate);
              const daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              
              expiringBatches.push({
                itemName: item.name,
                batchNumber: batch.batchNumber,
                quantity: batch.quantity,
                expiryDate: batch.expiryDate,
                daysRemaining,
              });
            }
          });
        });
      });
    });

    return expiringBatches.sort((a, b) => a.daysRemaining - b.daysRemaining);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Hierarchical view of all inventory items</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => setExpiryAlertsDialog(true)}
            className="relative"
          >
            <Bell className="mr-2 h-4 w-4" />
            Expiry Alerts
            {getExpiringBatches().length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                {getExpiringBatches().length}
              </Badge>
            )}
          </Button>
          <Button 
            className="bg-primary hover:bg-primary/90"
            onClick={() => {
              setCategoryForm({ name: "" });
              setCategoryDialog({ open: true, mode: "add" });
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Inventory Health Score */}
      {!loading && !insightsLoading && (
        <Card className={`border-2 ${
          healthScore.label === "Good" ? "border-success/40 bg-success/5" : 
          healthScore.label === "Watch" ? "border-warning/40 bg-warning/5" : 
          "border-destructive/40 bg-destructive/5"
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold">Inventory Health Score</h3>
                  <Badge 
                    variant={
                      healthScore.label === "Good" ? "default" : 
                      healthScore.label === "Watch" ? "secondary" : 
                      "destructive"
                    }
                    className={`text-2xl px-4 py-1 ${
                      healthScore.label === "Good" ? "bg-success text-white" : 
                      healthScore.label === "Watch" ? "bg-warning text-white" : 
                      ""
                    }`}
                  >
                    {healthScore.score}
                  </Badge>
                  <span className={`text-sm font-medium ${
                    healthScore.label === "Good" ? "text-success" : 
                    healthScore.label === "Watch" ? "text-warning" : 
                    "text-destructive"
                  }`}>
                    {healthScore.label}
                  </span>
                </div>
                <div className="flex gap-6 text-sm text-muted-foreground">
                  <span>Low stock: <strong>{healthScore.lowStockCount}</strong> / {allItems.length}</span>
                  <span>Expiring soon: <strong>{healthScore.expiringCount}</strong></span>
                  <span>Avg days left: <strong>{healthScore.avgDaysLeft}</strong></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
        {categories.map((category) => (
          <Card key={category.id} className="border-primary/20">
            <CardHeader
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => toggleCategory(category.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {expandedCategories.includes(category.id) ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                  <CardTitle className="text-xl">{category.name}</CardTitle>
                  <Badge variant="outline">{category.subcategories.length} subcategories</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategoryForm({ name: category.name });
                      setCategoryDialog({ open: true, mode: "edit", data: category });
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteDialog({ open: true, type: "category", id: category.id });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {expandedCategories.includes(category.id) && (
              <CardContent className="space-y-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSubcategoryForm({ name: "" });
                    setSubcategoryDialog({ open: true, mode: "add", categoryId: category.id });
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Subcategory
                </Button>
                {category.subcategories.map((subcategory) => (
                  <Card key={subcategory.id} className="border-secondary">
                    <CardHeader
                      className="cursor-pointer hover:bg-accent/30 transition-colors py-3"
                      onClick={() => toggleSubcategory(subcategory.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {expandedSubcategories.includes(subcategory.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-medium">{subcategory.name}</span>
                          <Badge variant="secondary">{subcategory.items.length} items</Badge>
                        </div>
                        <div className="flex gap-2">
                           <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemForm({ 
                                name: "", 
                                sku: "", 
                                unit: "pcs", 
                                quantity: 0, 
                                reorderLevel: 15,
                                supplierId: "",
                                costPrice: 0,
                                sellingPrice: 0,
                                locationId: "",
                                locationLabel: "",
                                batches: [{ batchNumber: "", quantity: 0, expiryDate: "" }]
                              });
                              setItemDialog({ open: true, mode: "add", categoryId: category.id, subcategoryId: subcategory.id });
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Item
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSubcategoryForm({ name: subcategory.name });
                              setSubcategoryDialog({ open: true, mode: "edit", data: subcategory });
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteDialog({ open: true, type: "subcategory", id: subcategory.id });
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {expandedSubcategories.includes(subcategory.id) && (
                      <CardContent className="space-y-2 pt-0">
                        {subcategory.items.map((item) => (
                          <div key={item.id} className="border rounded-lg p-3 space-y-2">
                            <div
                              className="flex items-center justify-between cursor-pointer"
                              onClick={() => toggleItem(item.id)}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                {expandedItems.includes(item.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                   <div className="flex-1">
                                   <div className="flex items-center gap-2 flex-wrap">
                                     <span className="font-medium">{item.name}</span>
                                     {item.sku && (
                                       <Badge variant="outline" className="text-xs">
                                         SKU: {item.sku}
                                       </Badge>
                                     )}
                                     <Badge
                                       variant={item.status === "low" ? "destructive" : "secondary"}
                                       className="text-xs"
                                     >
                                       {item.status === "low" ? "Low Stock" : "Normal"}
                                     </Badge>
                                     {item.predictedStatus === "low" && (
                                       <Badge variant="outline" className="text-xs border-warning text-warning">
                                         Predicted Low Stock
                                       </Badge>
                                     )}
                                     {item.hasExpiringBatches && (
                                       <Badge variant="destructive" className="text-xs">
                                         <AlertTriangle className="h-3 w-3 mr-1" />
                                         Expiring Soon
                                       </Badge>
                                     )}
                                     {/* Predicted Stockout Badge */}
                                     {itemInsights.has(item.id) && (() => {
                                       const insight = itemInsights.get(item.id)!;
                                       const daysLeft = insight.predictedDaysLeft;
                                       const badgeVariant = daysLeft <= 3 ? "destructive" : daysLeft <= 10 ? "secondary" : "default";
                                       const badgeColor = daysLeft <= 3 ? "bg-destructive text-white" : daysLeft <= 10 ? "bg-warning text-white" : "bg-success text-white";
                                       return (
                                         <Badge 
                                           variant={badgeVariant}
                                           className={`text-xs ${badgeColor}`}
                                           title="Based on average daily usage from recent sales"
                                         >
                                           <Brain className="h-3 w-3 mr-1" />
                                           {daysLeft === 0 ? "Out of stock" : daysLeft >= 30 ? "30+ days" : `${daysLeft} days left`}
                                         </Badge>
                                       );
                                     })()}
                                   </div>
                                   <div className="text-sm text-muted-foreground space-y-1">
                                     <div className="flex items-center gap-2 flex-wrap">
                                       <span>Quantity: {item.quantity} {item.unit}</span>
                                       {itemInsights.has(item.id) && (() => {
                                         const insight = itemInsights.get(item.id)!;
                                         if (insight.predictedDaysLeft <= 7 && item.quantity > 0) {
                                           return (
                                             <span className="text-xs text-warning">
                                               • Suggested reorder: {insight.suggestedReorderQty} {item.unit}
                                             </span>
                                           );
                                         }
                                         return null;
                                       })()}
                                       {item.quantity <= item.reorderLevel && (
                                         <span className="text-xs text-destructive font-medium">
                                           (below threshold)
                                         </span>
                                       )}
                                     </div>
                                     <div className="flex items-center gap-2">
                                       <span className="font-medium text-primary">
                                         ML Prediction: {item.predictedStock} units (7d)
                                       </span>
                                       {item.predictionTrend === "increasing" && (
                                         <TrendingUp className="h-3 w-3 text-success" />
                                       )}
                                       {item.predictionTrend === "decreasing" && (
                                         <TrendingDown className="h-3 w-3 text-warning" />
                                       )}
                                       {item.predictionTrend === "stable" && (
                                         <Minus className="h-3 w-3 text-muted-foreground" />
                                       )}
                                       <Badge variant="secondary" className="text-xs">
                                         {item.predictionConfidence}% confidence
                                       </Badge>
                                     </div>
                                   </div>
                                 </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setItemForm({ 
                                      name: item.name, 
                                      sku: item.sku || "", 
                                      unit: item.unit || "pcs", 
                                      quantity: item.quantity, 
                                      reorderLevel: item.reorderLevel,
                                      supplierId: item.supplierId || "",
                                      costPrice: item.costPrice || 0,
                                      sellingPrice: item.sellingPrice || 0,
                                      locationId: item.locationId || "",
                                      locationLabel: item.locationLabel || "",
                                      batches: [{ batchNumber: "", quantity: 0, expiryDate: "" }]
                                    });
                                    setItemDialog({ open: true, mode: "edit", data: item });
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRemoveStockForm({ mode: "sale", quantity: 0, note: "" });
                                    setRemoveStockDialog({ open: true, item });
                                  }}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    loadStockHistory(item.id);
                                    setHistoryDialog({ open: true, itemId: item.id, itemName: item.name });
                                  }}
                                >
                                  <History className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            {expandedItems.includes(item.id) && (
                              <div className="ml-7 space-y-2 pt-2 border-t">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">Batches</span>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      setBatchForm({ batchNumber: "", quantity: 0, expiryDate: "" });
                                      setBatchDialog({ open: true, categoryId: category.id, subcategoryId: subcategory.id, itemId: item.id });
                                    }}
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Batch
                                  </Button>
                                </div>
                                 {item.batches.map((batch) => (
                                   <div
                                     key={batch.id}
                                     className={`flex items-center justify-between rounded p-2 text-sm ${
                                       batch.isExpiringSoon ? 'bg-destructive/10 border border-destructive' : 'bg-muted/50'
                                     }`}
                                   >
                                     <div className="flex items-center gap-2">
                                       <span className="font-medium">{batch.batchNumber}</span>
                                       <span className="text-muted-foreground">
                                         Qty: {batch.quantity}
                                       </span>
                                       {batch.isExpiringSoon && (
                                         <Badge variant="destructive" className="text-xs">
                                           <AlertTriangle className="h-3 w-3 mr-1" />
                                           Expiring Soon
                                         </Badge>
                                       )}
                                     </div>
                                     <span className={`text-xs ${batch.isExpiringSoon ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                       Exp: {batch.expiryDate}
                                     </span>
                                   </div>
                                 ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </CardContent>
            )}
          </Card>
        ))}
        </div>
      )}

      {/* Category Dialog */}
      <Dialog open={categoryDialog.open} onOpenChange={(open) => setCategoryDialog({ ...categoryDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{categoryDialog.mode === "add" ? "Add Category" : "Edit Category"}</DialogTitle>
            <DialogDescription>
              {categoryDialog.mode === "add" ? "Create a new category for organizing items." : "Update category details."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name</Label>
              <Input
                id="category-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ name: e.target.value })}
                placeholder="Enter category name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog({ open: false, mode: "add" })}>
              Cancel
            </Button>
            <Button onClick={categoryDialog.mode === "add" ? handleAddCategory : handleEditCategory}>
              {categoryDialog.mode === "add" ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={subcategoryDialog.open} onOpenChange={(open) => setSubcategoryDialog({ ...subcategoryDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{subcategoryDialog.mode === "add" ? "Add Subcategory" : "Edit Subcategory"}</DialogTitle>
            <DialogDescription>
              {subcategoryDialog.mode === "add" ? "Create a new subcategory" : "Update subcategory details"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subcategory-name">Subcategory Name</Label>
              <Input
                id="subcategory-name"
                value={subcategoryForm.name}
                onChange={(e) => setSubcategoryForm({ name: e.target.value })}
                placeholder="e.g., Smartphones"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubcategoryDialog({ open: false, mode: "add" })}>
              Cancel
            </Button>
            <Button onClick={subcategoryDialog.mode === "add" ? handleAddSubcategory : handleEditSubcategory}>
              {subcategoryDialog.mode === "add" ? "Add" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={itemDialog.open} onOpenChange={(open) => setItemDialog({ ...itemDialog, open })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{itemDialog.mode === "add" ? "Add Item" : "Edit Item"}</DialogTitle>
            <DialogDescription>
              {itemDialog.mode === "add" ? "Add a new item with batches to the inventory." : "Update item details."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Core Fields Section */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm">Core Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="item-name">Item Name *</Label>
                  <Input
                    id="item-name"
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    placeholder="Enter item name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-sku">SKU *</Label>
                  <Input
                    id="item-sku"
                    value={itemForm.sku}
                    onChange={(e) => {
                      setItemForm({ ...itemForm, sku: e.target.value });
                      setSkuError("");
                    }}
                    placeholder="Enter SKU"
                  />
                  {skuError && <p className="text-xs text-destructive">{skuError}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="item-unit">Unit</Label>
                  <Input
                    id="item-unit"
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    placeholder="e.g., pcs, kg, liter"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-reorder-level">Reorder Level</Label>
                  <Input
                    id="item-reorder-level"
                    type="number"
                    value={itemForm.reorderLevel}
                    onChange={(e) => setItemForm({ ...itemForm, reorderLevel: parseInt(e.target.value) || 15 })}
                    placeholder="Low stock threshold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="item-supplier">Supplier ID</Label>
                  <Input
                    id="item-supplier"
                    value={itemForm.supplierId}
                    onChange={(e) => setItemForm({ ...itemForm, supplierId: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-cost">Cost Price</Label>
                  <Input
                    id="item-cost"
                    type="number"
                    step="0.01"
                    value={itemForm.costPrice}
                    onChange={(e) => setItemForm({ ...itemForm, costPrice: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-selling">Selling Price</Label>
                  <Input
                    id="item-selling"
                    type="number"
                    step="0.01"
                    value={itemForm.sellingPrice}
                    onChange={(e) => setItemForm({ ...itemForm, sellingPrice: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Location Section */}
              <div className="border-t pt-4 space-y-2">
                <Label>Storage Location</Label>
                <div className="flex gap-2">
                  <Input
                    value={itemForm.locationLabel}
                    placeholder="No location assigned"
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocationPickerOpen(true)}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Pick on Map
                  </Button>
                </div>
              </div>
            </div>

            {/* Batches Section - Only for Add Mode */}
            {itemDialog.mode === "add" && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">Batches *</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setItemForm({
                        ...itemForm,
                        batches: [...itemForm.batches, { batchNumber: "", quantity: 0, expiryDate: "" }]
                      });
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Batch
                  </Button>
                </div>
                {itemForm.batches.map((batch, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4 space-y-2">
                      <Label htmlFor={`batch-number-${index}`}>Batch Number</Label>
                      <Input
                        id={`batch-number-${index}`}
                        value={batch.batchNumber}
                        onChange={(e) => {
                          const newBatches = [...itemForm.batches];
                          newBatches[index].batchNumber = e.target.value;
                          setItemForm({ ...itemForm, batches: newBatches });
                        }}
                        placeholder="Batch #"
                      />
                    </div>
                    <div className="col-span-3 space-y-2">
                      <Label htmlFor={`batch-qty-${index}`}>Quantity</Label>
                      <Input
                        id={`batch-qty-${index}`}
                        type="number"
                        value={batch.quantity}
                        onChange={(e) => {
                          const newBatches = [...itemForm.batches];
                          newBatches[index].quantity = parseInt(e.target.value) || 0;
                          setItemForm({ ...itemForm, batches: newBatches });
                        }}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-4 space-y-2">
                      <Label htmlFor={`batch-expiry-${index}`}>Expiry Date (Optional)</Label>
                      <Input
                        id={`batch-expiry-${index}`}
                        type="date"
                        value={batch.expiryDate}
                        onChange={(e) => {
                          const newBatches = [...itemForm.batches];
                          newBatches[index].expiryDate = e.target.value;
                          setItemForm({ ...itemForm, batches: newBatches });
                        }}
                      />
                    </div>
                    {itemForm.batches.length > 1 && (
                      <div className="col-span-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const newBatches = itemForm.batches.filter((_, i) => i !== index);
                            setItemForm({ ...itemForm, batches: newBatches });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setItemDialog({ open: false, mode: "add" });
              setSkuError("");
            }}>
              Cancel
            </Button>
            <Button onClick={itemDialog.mode === "add" ? handleAddItem : handleEditItem}>
              {itemDialog.mode === "add" ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Picker Modal */}
      <LocationPicker
        open={locationPickerOpen}
        onOpenChange={setLocationPickerOpen}
        onSelect={(locationId, locationLabel) => {
          setItemForm({ ...itemForm, locationId, locationLabel });
        }}
        currentLocationId={itemForm.locationId}
      />

      {/* Batch Dialog */}
      <Dialog open={batchDialog.open} onOpenChange={(open) => setBatchDialog({ ...batchDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Batch</DialogTitle>
            <DialogDescription>Add a new batch with expiry tracking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batch-number">Batch Number</Label>
              <Input
                id="batch-number"
                value={batchForm.batchNumber}
                onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value })}
                placeholder="Enter batch number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-quantity">Quantity</Label>
              <Input
                id="batch-quantity"
                type="number"
                value={batchForm.quantity}
                onChange={(e) => setBatchForm({ ...batchForm, quantity: parseInt(e.target.value) || 0 })}
                placeholder="Enter quantity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-expiry">Expiry Date</Label>
              <Input
                id="batch-expiry"
                type="date"
                value={batchForm.expiryDate}
                onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialog({ open: false })}>
              Cancel
            </Button>
            <Button onClick={handleAddBatch}>Add Batch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {deleteDialog.type}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialog.type === "category") handleDeleteCategory();
                else if (deleteDialog.type === "subcategory") handleDeleteSubcategory();
                else if (deleteDialog.type === "item") handleDeleteItem();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stock History Dialog */}
      <Dialog open={historyDialog.open} onOpenChange={(open) => setHistoryDialog({ ...historyDialog, open })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Stock History - {historyDialog.itemName}</DialogTitle>
            <DialogDescription>
              View all stock changes for this item
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {loadingHistory ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : stockHistory.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No stock history available
              </div>
            ) : (
              stockHistory.map((entry) => (
                <Card key={entry.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={entry.quantity_change > 0 ? "default" : "destructive"}>
                          {entry.action}
                        </Badge>
                        <span className="text-sm font-medium">
                          {entry.quantity_change > 0 ? '+' : ''}{entry.quantity_change} units
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.previous_quantity} → {entry.new_quantity} units
                      </div>
                      {entry.notes && (
                        <div className="text-xs text-muted-foreground">
                          Note: {entry.notes}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialog({ open: false })}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expiry Alerts Dialog */}
      <Dialog open={expiryAlertsDialog} onOpenChange={setExpiryAlertsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Expiry Alerts</DialogTitle>
            <DialogDescription>
              Batches expiring within {expiryThreshold} days
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="expiry-threshold" className="whitespace-nowrap">Alert Threshold (days):</Label>
              <Input
                id="expiry-threshold"
                type="number"
                value={expiryThreshold}
                onChange={(e) => setExpiryThreshold(parseInt(e.target.value) || 7)}
                className="w-20"
              />
            </div>

            {getExpiringBatches().length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No batches expiring soon
              </div>
            ) : (
              <div className="space-y-2">
                {getExpiringBatches().map((batch, index) => (
                  <Card key={index} className="p-3 border-destructive">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">
                            {batch.daysRemaining === 0 ? 'Expires Today' : `${batch.daysRemaining} days left`}
                          </Badge>
                          <span className="font-medium">{batch.itemName}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Batch: {batch.batchNumber} • Quantity: {batch.quantity}
                        </div>
                      </div>
                      <div className="text-sm text-destructive font-medium">
                        Exp: {new Date(batch.expiryDate).toLocaleDateString()}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpiryAlertsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove/Adjust Stock Dialog */}
      <Dialog open={removeStockDialog.open} onOpenChange={(open) => setRemoveStockDialog({ ...removeStockDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove/Adjust Stock - {removeStockDialog.item?.name}</DialogTitle>
            <DialogDescription>
              Record a sale or damaged/other stock removal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Removal Type</Label>
              <RadioGroup 
                value={removeStockForm.mode}
                onValueChange={(value) => setRemoveStockForm({ ...removeStockForm, mode: value as "sale" | "damaged" })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sale" id="sale" />
                  <Label htmlFor="sale" className="font-normal cursor-pointer">Sale</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="damaged" id="damaged" />
                  <Label htmlFor="damaged" className="font-normal cursor-pointer">Damaged/Other</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remove-quantity">Quantity to Remove *</Label>
              <Input
                id="remove-quantity"
                type="number"
                min="1"
                max={removeStockDialog.item?.quantity || 0}
                value={removeStockForm.quantity}
                onChange={(e) => setRemoveStockForm({ ...removeStockForm, quantity: parseInt(e.target.value) || 0 })}
                placeholder="Enter quantity"
              />
              <p className="text-xs text-muted-foreground">
                Available: {removeStockDialog.item?.quantity || 0} {removeStockDialog.item?.unit || 'units'}
              </p>
            </div>

            {removeStockForm.mode === "damaged" && (
              <div className="space-y-2">
                <Label htmlFor="remove-note">Note * (Required for damaged items)</Label>
                <Textarea
                  id="remove-note"
                  value={removeStockForm.note}
                  onChange={(e) => setRemoveStockForm({ ...removeStockForm, note: e.target.value })}
                  placeholder="Explain reason for removal"
                  rows={3}
                />
              </div>
            )}

            {removeStockForm.mode === "sale" && (
              <div className="space-y-2">
                <Label htmlFor="sale-note">Note (Optional)</Label>
                <Textarea
                  id="sale-note"
                  value={removeStockForm.note}
                  onChange={(e) => setRemoveStockForm({ ...removeStockForm, note: e.target.value })}
                  placeholder="Add optional note"
                  rows={2}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveStockDialog({ open: false })}>
              Cancel
            </Button>
            <Button onClick={handleRemoveStock} variant={removeStockForm.mode === "damaged" ? "destructive" : "default"}>
              Confirm {removeStockForm.mode === "sale" ? "Sale" : "Removal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
