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
import { Skeleton } from "@/components/ui/skeleton";
import {
  categoriesDB,
  subcategoriesDB,
  itemsDB,
  batchesDB,
  locationsDB,
  stockHistoryDB,
  adjustStock,
  initializeData,
  generateId,
} from "@/lib/localStorage";

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

  const [categoryForm, setCategoryForm] = useState({ name: "" });
  const [subcategoryForm, setSubcategoryForm] = useState({ name: "" });
  const [itemForm, setItemForm] = useState({ 
    name: "", sku: "", unit: "pcs", reorderLevel: 15, supplierId: "", costPrice: 0, sellingPrice: 0, locationId: "", locationLabel: "",
    batches: [{ batchNumber: "", quantity: 0, expiryDate: "" }]
  });
  const [batchForm, setBatchForm] = useState({ batchNumber: "", quantity: 0, expiryDate: "" });
  const [removeStockForm, setRemoveStockForm] = useState({ mode: "sale", quantity: 0, note: "" });
  const [skuError, setSkuError] = useState("");
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    try {
      setLoading(true);
      initializeData();
      
      const categoriesData = categoriesDB.getAll();
      const subcategoriesData = subcategoriesDB.getAll();
      const itemsData = itemsDB.getAll();
      const batchesData = batchesDB.getAll();
      const locationsData = locationsDB.getAll();

      const transformedCategories: Category[] = categoriesData.map(cat => ({
        id: cat.id,
        name: cat.name,
        subcategories: subcategoriesData
          .filter(sub => sub.category_id === cat.id)
          .map(sub => ({
            id: sub.id,
            name: sub.name,
            items: itemsData
              .filter(item => item.subcategory_id === sub.id)
              .map(item => {
                const itemBatches = batchesData
                  .filter(batch => batch.item_id === item.id)
                  .map(batch => ({
                    id: batch.id,
                    batchNumber: batch.batch_number,
                    quantity: batch.quantity,
                    expiryDate: batch.expiry_date || '',
                    isExpiringSoon: batch.expiry_date ? isExpiringSoon(batch.expiry_date, expiryThreshold) : false,
                  }));

                const location = item.location_id ? locationsData.find(l => l.id === item.location_id) : null;
                const status = item.quantity <= item.reorder_level ? "low" : "normal";
                const predictedStatus = (item.predicted_stock || item.quantity) <= item.reorder_level ? "low" : "normal";

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
                  locationLabel: location?.label || undefined,
                  status,
                  lastUpdated: new Date(item.updated_at).toLocaleString(),
                  batches: itemBatches,
                  predictedStock: item.predicted_stock || item.quantity,
                  predictionTrend: (item.prediction_trend as "increasing" | "decreasing" | "stable") || "stable",
                  predictionConfidence: item.prediction_confidence || 0,
                  predictedStatus,
                  hasExpiringBatches: itemBatches.some(b => b.isExpiringSoon),
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

  const loadStockHistory = (itemId: string) => {
    setLoadingHistory(true);
    const history = stockHistoryDB.getByItem(itemId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);
    setStockHistory(history);
    setLoadingHistory(false);
  };

  const toggleCategory = (id: string) => setExpandedCategories(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSubcategory = (id: string) => setExpandedSubcategories(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleItem = (id: string) => setExpandedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleAddCategory = () => {
    if (!categoryForm.name.trim()) return;
    categoriesDB.create(categoryForm.name);
    setCategoryDialog({ open: false, mode: "add" });
    setCategoryForm({ name: "" });
    toast({ title: "Category added successfully" });
    loadData();
  };

  const handleEditCategory = () => {
    if (!categoryForm.name.trim() || !categoryDialog.data) return;
    categoriesDB.update(categoryDialog.data.id, categoryForm.name);
    setCategoryDialog({ open: false, mode: "add" });
    setCategoryForm({ name: "" });
    toast({ title: "Category updated successfully" });
    loadData();
  };

  const handleDeleteCategory = () => {
    if (!deleteDialog.id) return;
    categoriesDB.delete(deleteDialog.id);
    setDeleteDialog({ open: false });
    toast({ title: "Category deleted successfully" });
    loadData();
  };

  const handleAddSubcategory = () => {
    if (!subcategoryForm.name.trim() || !subcategoryDialog.categoryId) return;
    subcategoriesDB.create(subcategoryForm.name, subcategoryDialog.categoryId);
    setSubcategoryDialog({ open: false, mode: "add" });
    setSubcategoryForm({ name: "" });
    toast({ title: "Subcategory added successfully" });
    loadData();
  };

  const handleEditSubcategory = () => {
    if (!subcategoryForm.name.trim() || !subcategoryDialog.data) return;
    subcategoriesDB.update(subcategoryDialog.data.id, subcategoryForm.name);
    setSubcategoryDialog({ open: false, mode: "add" });
    setSubcategoryForm({ name: "" });
    toast({ title: "Subcategory updated successfully" });
    loadData();
  };

  const handleDeleteSubcategory = () => {
    if (!deleteDialog.id) return;
    subcategoriesDB.delete(deleteDialog.id);
    setDeleteDialog({ open: false });
    toast({ title: "Subcategory deleted successfully" });
    loadData();
  };

  const validateSku = (sku: string, currentItemId?: string) => {
    if (!sku.trim()) { setSkuError("SKU is required"); return false; }
    const existing = itemsDB.getAll().find(i => i.sku === sku && i.id !== currentItemId);
    if (existing) { setSkuError("SKU already exists"); return false; }
    setSkuError("");
    return true;
  };

  const handleAddItem = () => {
    if (!itemForm.name.trim() || !itemDialog.subcategoryId) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    if (!validateSku(itemForm.sku)) return;

    const validBatches = itemForm.batches.filter(b => b.batchNumber.trim() && b.quantity > 0);
    if (validBatches.length === 0) {
      toast({ title: "At least one valid batch is required", variant: "destructive" });
      return;
    }

    const totalQuantity = validBatches.reduce((sum, b) => sum + b.quantity, 0);
    const newItem = itemsDB.create({
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
      predicted_stock: null,
      prediction_confidence: null,
      prediction_trend: null,
    });

    validBatches.forEach(batch => {
      batchesDB.create({
        batch_number: batch.batchNumber,
        quantity: batch.quantity,
        expiry_date: batch.expiryDate || null,
        item_id: newItem.id,
      });
    });

    stockHistoryDB.create({
      item_id: newItem.id,
      quantity_change: totalQuantity,
      previous_quantity: 0,
      new_quantity: totalQuantity,
      action: 'INSERT',
      change_type: 'restock',
      note: 'Initial stock',
      notes: null,
    });

    setItemDialog({ open: false, mode: "add" });
    setItemForm({ name: "", sku: "", unit: "pcs", reorderLevel: 15, supplierId: "", costPrice: 0, sellingPrice: 0, locationId: "", locationLabel: "", batches: [{ batchNumber: "", quantity: 0, expiryDate: "" }] });
    setSkuError("");
    toast({ title: "Item added successfully" });
    loadData();
  };

  const handleEditItem = () => {
    if (!itemForm.name.trim() || !itemDialog.data) return;
    if (!validateSku(itemForm.sku, itemDialog.data.id)) return;

    itemsDB.update(itemDialog.data.id, {
      name: itemForm.name,
      sku: itemForm.sku,
      unit: itemForm.unit,
      reorder_level: itemForm.reorderLevel,
      supplier_id: itemForm.supplierId || null,
      cost_price: itemForm.costPrice || null,
      selling_price: itemForm.sellingPrice || null,
      location_id: itemForm.locationId || null,
    });

    const validNewBatches = itemForm.batches.filter(b => b.batchNumber.trim() && b.quantity > 0);
    if (validNewBatches.length > 0) {
      let totalAdded = 0;
      validNewBatches.forEach(batch => {
        batchesDB.create({
          batch_number: batch.batchNumber,
          quantity: batch.quantity,
          expiry_date: batch.expiryDate || null,
          item_id: itemDialog.data!.id,
        });
        totalAdded += batch.quantity;
      });

      const currentItem = itemsDB.getById(itemDialog.data.id);
      if (currentItem) {
        const newQty = currentItem.quantity + totalAdded;
        itemsDB.update(itemDialog.data.id, { quantity: newQty });
        stockHistoryDB.create({
          item_id: itemDialog.data.id,
          quantity_change: totalAdded,
          previous_quantity: currentItem.quantity,
          new_quantity: newQty,
          action: 'UPDATE',
          change_type: 'restock',
          note: 'Added new batches',
          notes: null,
        });
      }
    }

    setItemDialog({ open: false, mode: "add" });
    setItemForm({ name: "", sku: "", unit: "pcs", reorderLevel: 15, supplierId: "", costPrice: 0, sellingPrice: 0, locationId: "", locationLabel: "", batches: [{ batchNumber: "", quantity: 0, expiryDate: "" }] });
    setSkuError("");
    toast({ title: "Item updated successfully" });
    loadData();
  };

  const handleDeleteItem = () => {
    if (!deleteDialog.id) return;
    batchesDB.deleteByItem(deleteDialog.id);
    itemsDB.delete(deleteDialog.id);
    setDeleteDialog({ open: false });
    toast({ title: "Item deleted successfully" });
    loadData();
  };

  const handleRemoveStock = () => {
    if (!removeStockDialog.item || removeStockForm.quantity <= 0) return;
    if (removeStockForm.mode === "damaged" && !removeStockForm.note.trim()) {
      toast({ title: "Please provide a reason for damaged stock", variant: "destructive" });
      return;
    }

    const result = adjustStock(removeStockDialog.item.id, -removeStockForm.quantity, removeStockForm.mode, removeStockForm.note || undefined);
    if (!result.success) {
      toast({ title: result.error || "Failed to remove stock", variant: "destructive" });
      return;
    }

    setRemoveStockDialog({ open: false });
    setRemoveStockForm({ mode: "sale", quantity: 0, note: "" });
    toast({ title: "Stock removed successfully" });
    loadData();
  };

  const handleAddBatch = () => {
    if (!batchForm.batchNumber.trim() || batchForm.quantity <= 0 || !batchDialog.itemId) return;

    batchesDB.create({
      batch_number: batchForm.batchNumber,
      quantity: batchForm.quantity,
      expiry_date: batchForm.expiryDate || null,
      item_id: batchDialog.itemId,
    });

    const item = itemsDB.getById(batchDialog.itemId);
    if (item) {
      const newQty = item.quantity + batchForm.quantity;
      itemsDB.update(batchDialog.itemId, { quantity: newQty });
      stockHistoryDB.create({
        item_id: batchDialog.itemId,
        quantity_change: batchForm.quantity,
        previous_quantity: item.quantity,
        new_quantity: newQty,
        action: 'UPDATE',
        change_type: 'restock',
        note: `Added batch ${batchForm.batchNumber}`,
        notes: null,
      });
    }

    setBatchDialog({ open: false });
    setBatchForm({ batchNumber: "", quantity: 0, expiryDate: "" });
    toast({ title: "Batch added successfully" });
    loadData();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Manage your warehouse inventory</p>
        </div>
        <div className="flex gap-2">
          {expiringBatchesCount > 0 && (
            <Button variant="outline" onClick={() => setExpiryAlertsDialog(true)}>
              <Bell className="mr-2 h-4 w-4" />
              {expiringBatchesCount} Expiring
            </Button>
          )}
          <Button onClick={() => setCategoryDialog({ open: true, mode: "add" })}>
            <Plus className="mr-2 h-4 w-4" /> Add Category
          </Button>
        </div>
      </div>

      {/* Health Score Card */}
      <Card className={`border-2 ${healthScore.label === 'Good' ? 'border-success/50 bg-success/5' : healthScore.label === 'Watch' ? 'border-warning/50 bg-warning/5' : 'border-destructive/50 bg-destructive/5'}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Inventory Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className={`text-5xl font-bold ${healthScore.label === 'Good' ? 'text-success' : healthScore.label === 'Watch' ? 'text-warning' : 'text-destructive'}`}>
              {healthScore.score}
            </div>
            <div className="space-y-1 text-sm">
              <div>Low Stock Items: {healthScore.lowStockCount}</div>
              <div>Expiring Batches: {healthScore.expiringCount}</div>
              <div>Avg Days Left: {healthScore.avgDaysLeft}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <div className="space-y-4">
        {categories.map((category) => (
          <Card key={category.id} className="border-primary/20">
            <CardHeader className="cursor-pointer" onClick={() => toggleCategory(category.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {expandedCategories.includes(category.id) ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  <CardTitle>{category.name}</CardTitle>
                  <Badge variant="secondary">{category.subcategories.reduce((sum, sub) => sum + sub.items.length, 0)} items</Badge>
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline" onClick={() => setSubcategoryDialog({ open: true, mode: "add", categoryId: category.id })}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setCategoryDialog({ open: true, mode: "edit", data: category }); setCategoryForm({ name: category.name }); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleteDialog({ open: true, type: "category", id: category.id })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {expandedCategories.includes(category.id) && (
              <CardContent className="space-y-4">
                {category.subcategories.map((subcategory) => (
                  <Card key={subcategory.id}>
                    <CardHeader className="py-3 cursor-pointer" onClick={() => toggleSubcategory(subcategory.id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {expandedSubcategories.includes(subcategory.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="font-medium">{subcategory.name}</span>
                          <Badge variant="outline">{subcategory.items.length}</Badge>
                        </div>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={() => setItemDialog({ open: true, mode: "add", categoryId: category.id, subcategoryId: subcategory.id })}>
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setSubcategoryDialog({ open: true, mode: "edit", categoryId: category.id, data: subcategory }); setSubcategoryForm({ name: subcategory.name }); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteDialog({ open: true, type: "subcategory", id: subcategory.id, parentId: category.id })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {expandedSubcategories.includes(subcategory.id) && (
                      <CardContent>
                        <div className="space-y-2">
                          {subcategory.items.map((item) => (
                            <div key={item.id} className={`p-3 rounded-lg border ${item.status === 'low' ? 'border-warning bg-warning/10' : 'border-border'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <button onClick={() => toggleItem(item.id)}>
                                    {expandedItems.includes(item.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </button>
                                  <div>
                                    <div className="font-medium flex items-center gap-2">
                                      {item.name}
                                      {item.status === 'low' && <AlertTriangle className="h-4 w-4 text-warning" />}
                                      {item.hasExpiringBatches && <Bell className="h-4 w-4 text-destructive" />}
                                    </div>
                                    <div className="text-sm text-muted-foreground">SKU: {item.sku} | {item.quantity} {item.unit}</div>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="ghost" onClick={() => setRemoveStockDialog({ open: true, item })}>
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => { setHistoryDialog({ open: true, itemId: item.id, itemName: item.name }); loadStockHistory(item.id); }}>
                                    <History className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => { setItemDialog({ open: true, mode: "edit", categoryId: category.id, subcategoryId: subcategory.id, data: item }); setItemForm({ name: item.name, sku: item.sku || "", unit: item.unit, reorderLevel: item.reorderLevel, supplierId: item.supplierId || "", costPrice: item.costPrice || 0, sellingPrice: item.sellingPrice || 0, locationId: item.locationId || "", locationLabel: item.locationLabel || "", batches: [{ batchNumber: "", quantity: 0, expiryDate: "" }] }); }}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setDeleteDialog({ open: true, type: "item", id: item.id, parentId: category.id, subParentId: subcategory.id })}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              {expandedItems.includes(item.id) && (
                                <div className="mt-3 pt-3 border-t space-y-2">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div><span className="text-muted-foreground">Reorder Level:</span> {item.reorderLevel}</div>
                                    <div><span className="text-muted-foreground">Location:</span> {item.locationLabel || 'Unassigned'}</div>
                                    <div><span className="text-muted-foreground">Supplier:</span> {item.supplierId || 'N/A'}</div>
                                    <div><span className="text-muted-foreground">Last Updated:</span> {item.lastUpdated}</div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">Batches ({item.batches.length})</span>
                                    <Button size="sm" variant="outline" onClick={() => setBatchDialog({ open: true, categoryId: category.id, subcategoryId: subcategory.id, itemId: item.id })}>
                                      <Plus className="h-4 w-4 mr-1" /> Add Batch
                                    </Button>
                                  </div>
                                  <div className="space-y-1">
                                    {item.batches.map((batch) => (
                                      <div key={batch.id} className={`flex justify-between text-sm p-2 rounded ${batch.isExpiringSoon ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted'}`}>
                                        <span>{batch.batchNumber}</span>
                                        <span>{batch.quantity} {item.unit}</span>
                                        <span>{batch.expiryDate || 'No expiry'}</span>
                                        {batch.isExpiringSoon && <Badge variant="destructive" className="text-xs">Expiring Soon</Badge>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Dialogs */}
      <Dialog open={categoryDialog.open} onOpenChange={(open) => setCategoryDialog({ ...categoryDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{categoryDialog.mode === "add" ? "Add Category" : "Edit Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={categoryForm.name} onChange={(e) => setCategoryForm({ name: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog({ open: false, mode: "add" })}>Cancel</Button>
            <Button onClick={categoryDialog.mode === "add" ? handleAddCategory : handleEditCategory}>{categoryDialog.mode === "add" ? "Add" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={subcategoryDialog.open} onOpenChange={(open) => setSubcategoryDialog({ ...subcategoryDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{subcategoryDialog.mode === "add" ? "Add Subcategory" : "Edit Subcategory"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={subcategoryForm.name} onChange={(e) => setSubcategoryForm({ name: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubcategoryDialog({ open: false, mode: "add" })}>Cancel</Button>
            <Button onClick={subcategoryDialog.mode === "add" ? handleAddSubcategory : handleEditSubcategory}>{subcategoryDialog.mode === "add" ? "Add" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialog.open} onOpenChange={(open) => setItemDialog({ ...itemDialog, open })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{itemDialog.mode === "add" ? "Add Item" : "Edit Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Name *</Label><Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} /></div>
              <div><Label>SKU *</Label><Input value={itemForm.sku} onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })} />{skuError && <p className="text-destructive text-sm">{skuError}</p>}</div>
              <div><Label>Unit</Label><Input value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} /></div>
              <div><Label>Reorder Level</Label><Input type="number" value={itemForm.reorderLevel} onChange={(e) => setItemForm({ ...itemForm, reorderLevel: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Supplier</Label><Input value={itemForm.supplierId} onChange={(e) => setItemForm({ ...itemForm, supplierId: e.target.value })} /></div>
              <div><Label>Location</Label><div className="flex gap-2"><Input value={itemForm.locationLabel} readOnly placeholder="Select location" /><Button variant="outline" onClick={() => setLocationPickerOpen(true)}><MapPin className="h-4 w-4" /></Button></div></div>
            </div>
            <div><Label>Batches *</Label>
              {itemForm.batches.map((batch, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 mt-2">
                  <Input placeholder="Batch #" value={batch.batchNumber} onChange={(e) => { const newBatches = [...itemForm.batches]; newBatches[i].batchNumber = e.target.value; setItemForm({ ...itemForm, batches: newBatches }); }} />
                  <Input type="number" placeholder="Qty" value={batch.quantity || ''} onChange={(e) => { const newBatches = [...itemForm.batches]; newBatches[i].quantity = parseInt(e.target.value) || 0; setItemForm({ ...itemForm, batches: newBatches }); }} />
                  <Input type="date" value={batch.expiryDate} onChange={(e) => { const newBatches = [...itemForm.batches]; newBatches[i].expiryDate = e.target.value; setItemForm({ ...itemForm, batches: newBatches }); }} />
                  <Button variant="ghost" size="icon" onClick={() => { if (itemForm.batches.length > 1) setItemForm({ ...itemForm, batches: itemForm.batches.filter((_, idx) => idx !== i) }); }}><X className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" className="mt-2" onClick={() => setItemForm({ ...itemForm, batches: [...itemForm.batches, { batchNumber: "", quantity: 0, expiryDate: "" }] })}><Plus className="h-4 w-4 mr-1" /> Add Batch</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog({ open: false, mode: "add" })}>Cancel</Button>
            <Button onClick={itemDialog.mode === "add" ? handleAddItem : handleEditItem}>{itemDialog.mode === "add" ? "Add" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchDialog.open} onOpenChange={(open) => setBatchDialog({ ...batchDialog, open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Batch</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Batch Number</Label><Input value={batchForm.batchNumber} onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value })} /></div>
            <div><Label>Quantity</Label><Input type="number" value={batchForm.quantity || ''} onChange={(e) => setBatchForm({ ...batchForm, quantity: parseInt(e.target.value) || 0 })} /></div>
            <div><Label>Expiry Date</Label><Input type="date" value={batchForm.expiryDate} onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialog({ open: false })}>Cancel</Button>
            <Button onClick={handleAddBatch}>Add Batch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeStockDialog.open} onOpenChange={(open) => setRemoveStockDialog({ ...removeStockDialog, open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove Stock - {removeStockDialog.item?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={removeStockForm.mode} onValueChange={(v) => setRemoveStockForm({ ...removeStockForm, mode: v })}>
              <div className="flex items-center space-x-2"><RadioGroupItem value="sale" id="sale" /><Label htmlFor="sale">Sale</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="damaged" id="damaged" /><Label htmlFor="damaged">Damaged</Label></div>
            </RadioGroup>
            <div><Label>Quantity (Available: {removeStockDialog.item?.quantity})</Label><Input type="number" value={removeStockForm.quantity || ''} onChange={(e) => setRemoveStockForm({ ...removeStockForm, quantity: parseInt(e.target.value) || 0 })} max={removeStockDialog.item?.quantity} /></div>
            {removeStockForm.mode === "damaged" && <div><Label>Reason *</Label><Textarea value={removeStockForm.note} onChange={(e) => setRemoveStockForm({ ...removeStockForm, note: e.target.value })} /></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveStockDialog({ open: false })}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveStock}>Remove Stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialog.open} onOpenChange={(open) => setHistoryDialog({ ...historyDialog, open })}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Stock History - {historyDialog.itemName}</DialogTitle></DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {loadingHistory ? <div className="text-center py-4">Loading...</div> : stockHistory.length === 0 ? <div className="text-center py-4 text-muted-foreground">No history</div> : stockHistory.map((entry) => (
              <div key={entry.id} className="p-2 border rounded text-sm">
                <div className="flex justify-between"><span>{entry.action}</span><span className={entry.quantity_change > 0 ? 'text-success' : 'text-destructive'}>{entry.quantity_change > 0 ? '+' : ''}{entry.quantity_change}</span></div>
                <div className="text-muted-foreground text-xs">{new Date(entry.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteDialog.type}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteDialog.type === "category" ? handleDeleteCategory() : deleteDialog.type === "subcategory" ? handleDeleteSubcategory() : handleDeleteItem(); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LocationPicker open={locationPickerOpen} onOpenChange={setLocationPickerOpen} onSelect={(id, label) => setItemForm({ ...itemForm, locationId: id, locationLabel: label })} currentLocationId={itemForm.locationId} />
    </div>
  );
}
