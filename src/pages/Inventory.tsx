import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Plus, Edit, Trash2, TrendingUp, TrendingDown, Minus, History, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  quantity: number;
  reorderLevel: number;
  status: "normal" | "low";
  lastUpdated: string;
  batches: Batch[];
  predictedStock: number;
  predictionTrend: "increasing" | "decreasing" | "stable";
  predictionConfidence: number;
  predictedStatus: "normal" | "low";
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

const isExpiringSoon = (expiryDate: string) => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
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
  const [stockHistory, setStockHistory] = useState<StockHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form states
  const [categoryForm, setCategoryForm] = useState({ name: "" });
  const [subcategoryForm, setSubcategoryForm] = useState({ name: "" });
  const [itemForm, setItemForm] = useState({ name: "", quantity: 0, reorderLevel: 15 });
  const [batchForm, setBatchForm] = useState({ batchNumber: "", quantity: 0, expiryDate: "" });

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

      // Fetch items
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
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
                    isExpiringSoon: batch.expiry_date ? isExpiringSoon(batch.expiry_date) : false,
                  }));

                const status = item.quantity <= item.reorder_level ? "low" : "normal";
                const predictedStatus = (item.predicted_stock || item.quantity) <= item.reorder_level ? "low" : "normal";

                return {
                  id: item.id,
                  name: item.name,
                  quantity: item.quantity,
                  reorderLevel: item.reorder_level,
                  status,
                  lastUpdated: new Date(item.updated_at).toLocaleString(),
                  batches: itemBatches,
                  predictedStock: item.predicted_stock || item.quantity,
                  predictionTrend: (item.prediction_trend as "increasing" | "decreasing" | "stable") || "stable",
                  predictionConfidence: item.prediction_confidence || 0,
                  predictedStatus,
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

  const handleAddItem = async () => {
    if (!itemForm.name.trim() || !itemDialog.categoryId || !itemDialog.subcategoryId) return;
    try {
      const { data, error } = await supabase
        .from('items')
        .insert([{
          name: itemForm.name,
          quantity: itemForm.quantity,
          reorder_level: itemForm.reorderLevel,
          subcategory_id: itemDialog.subcategoryId,
        }])
        .select()
        .single();

      if (error) throw error;

      setItemDialog({ open: false, mode: "add" });
      setItemForm({ name: "", quantity: 0, reorderLevel: 15 });
      toast({ title: "Item added successfully" });
      loadData();

      // Trigger ML model retraining
      if (data) {
        triggerModelRetrain(data.id, 'add');
      }
    } catch (error) {
      console.error('Error adding item:', error);
      toast({ title: "Error adding item", variant: "destructive" });
    }
  };

  const handleEditItem = async () => {
    if (!itemForm.name.trim() || !itemDialog.data) return;
    const itemId = itemDialog.data.id;
    
    try {
      const { error } = await supabase
        .from('items')
        .update({
          name: itemForm.name,
          quantity: itemForm.quantity,
          reorder_level: itemForm.reorderLevel,
        })
        .eq('id', itemId);

      if (error) throw error;

      setItemDialog({ open: false, mode: "add" });
      setItemForm({ name: "", quantity: 0, reorderLevel: 15 });
      toast({ title: "Item updated successfully" });
      loadData();

      // Trigger ML model retraining
      triggerModelRetrain(itemId, 'update');
    } catch (error) {
      console.error('Error updating item:', error);
      toast({ title: "Error updating item", variant: "destructive" });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Hierarchical view of all inventory items</p>
        </div>
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
                              setItemForm({ name: "", quantity: 0, reorderLevel: 15 });
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
                                  </div>
                                  <div className="text-sm text-muted-foreground space-y-1">
                                    <div>Quantity: {item.quantity} • Updated {item.lastUpdated}</div>
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
                                    setItemForm({ name: item.name, quantity: item.quantity, reorderLevel: item.reorderLevel });
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
                                    setDeleteDialog({ open: true, type: "item", id: item.id });
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{itemDialog.mode === "add" ? "Add Item" : "Edit Item"}</DialogTitle>
            <DialogDescription>
              {itemDialog.mode === "add" ? "Add a new item to the inventory." : "Update item details."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item-name">Item Name</Label>
              <Input
                id="item-name"
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                placeholder="Enter item name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-quantity">Quantity</Label>
              <Input
                id="item-quantity"
                type="number"
                value={itemForm.quantity}
                onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 0 })}
                placeholder="Enter quantity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-reorder-level">Reorder Level (Low Stock Threshold)</Label>
              <Input
                id="item-reorder-level"
                type="number"
                value={itemForm.reorderLevel}
                onChange={(e) => setItemForm({ ...itemForm, reorderLevel: parseInt(e.target.value) || 15 })}
                placeholder="Enter reorder level"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog({ open: false, mode: "add" })}>
              Cancel
            </Button>
            <Button onClick={itemDialog.mode === "add" ? handleAddItem : handleEditItem}>
              {itemDialog.mode === "add" ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
