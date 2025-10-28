import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Plus, Edit, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
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

const FLASK_BASE_URL = "http://localhost:5000";
const RETRAIN_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trigger-model-retrain`;

const triggerModelRetrain = async (itemId: string, action: 'add' | 'update' | 'delete') => {
  try {
    // Call edge function
    const edgeFunctionResponse = await fetch(RETRAIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ itemId, action }),
    });
    
    if (!edgeFunctionResponse.ok) {
      console.error('Failed to trigger model retrain via edge function');
    }

    // Also call Flask backend directly to retrain ML model
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
    
    if (!flaskResponse.ok) {
      console.error('Failed to trigger ML retraining on Flask backend');
    }
  } catch (error) {
    console.error('Error triggering model retrain:', error);
  }
};

interface Batch {
  id: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
}

interface Item {
  id: string;
  name: string;
  quantity: number;
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

const mockData: Category[] = [
  {
    id: "1",
    name: "Electronics",
    subcategories: [
      {
        id: "1-1",
        name: "Smartphones",
        items: [
          {
            id: "1-1-1",
            name: "iPhone 15 Pro",
            quantity: 45,
            status: "normal",
            lastUpdated: "2 hours ago",
            batches: [
              { id: "b1", batchNumber: "BATCH-001", quantity: 25, expiryDate: "2025-12-31" },
              { id: "b2", batchNumber: "BATCH-002", quantity: 20, expiryDate: "2026-01-15" },
            ],
            predictedStock: 38,
            predictionTrend: "decreasing",
            predictionConfidence: 92,
            predictedStatus: "normal",
          },
          {
            id: "1-1-2",
            name: "Samsung Galaxy S24",
            quantity: 12,
            status: "low",
            lastUpdated: "5 hours ago",
            batches: [{ id: "b3", batchNumber: "BATCH-003", quantity: 12, expiryDate: "2025-11-20" }],
            predictedStock: 6,
            predictionTrend: "decreasing",
            predictionConfidence: 88,
            predictedStatus: "low",
          },
        ],
      },
      {
        id: "1-2",
        name: "Laptops",
        items: [
          {
            id: "1-2-1",
            name: "MacBook Pro 16",
            quantity: 30,
            status: "normal",
            lastUpdated: "1 day ago",
            batches: [{ id: "b4", batchNumber: "BATCH-004", quantity: 30, expiryDate: "2026-03-01" }],
            predictedStock: 35,
            predictionTrend: "increasing",
            predictionConfidence: 85,
            predictedStatus: "normal",
          },
        ],
      },
    ],
  },
  {
    id: "2",
    name: "Food Items",
    subcategories: [
      {
        id: "2-1",
        name: "Beverages",
        items: [
          {
            id: "2-1-1",
            name: "Bottled Water",
            quantity: 500,
            status: "normal",
            lastUpdated: "30 min ago",
            batches: [
              { id: "b5", batchNumber: "BATCH-005", quantity: 300, expiryDate: "2025-06-15" },
              { id: "b6", batchNumber: "BATCH-006", quantity: 200, expiryDate: "2025-07-20" },
            ],
            predictedStock: 485,
            predictionTrend: "stable",
            predictionConfidence: 95,
            predictedStatus: "normal",
          },
        ],
      },
    ],
  },
];

export default function Inventory() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>(mockData);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [expandedSubcategories, setExpandedSubcategories] = useState<string[]>([]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Dialog states
  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; mode: "add" | "edit"; data?: Category }>({ open: false, mode: "add" });
  const [subcategoryDialog, setSubcategoryDialog] = useState<{ open: boolean; mode: "add" | "edit"; categoryId?: string; data?: Subcategory }>({ open: false, mode: "add" });
  const [itemDialog, setItemDialog] = useState<{ open: boolean; mode: "add" | "edit"; categoryId?: string; subcategoryId?: string; data?: Item }>({ open: false, mode: "add" });
  const [batchDialog, setBatchDialog] = useState<{ open: boolean; categoryId?: string; subcategoryId?: string; itemId?: string }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type?: "category" | "subcategory" | "item"; id?: string; parentId?: string; subParentId?: string }>({ open: false });

  // Form states
  const [categoryForm, setCategoryForm] = useState({ name: "" });
  const [subcategoryForm, setSubcategoryForm] = useState({ name: "" });
  const [itemForm, setItemForm] = useState({ name: "", quantity: 0 });
  const [batchForm, setBatchForm] = useState({ batchNumber: "", quantity: 0, expiryDate: "" });

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
  const handleAddCategory = () => {
    if (!categoryForm.name.trim()) return;
    const newCategory: Category = {
      id: Date.now().toString(),
      name: categoryForm.name,
      subcategories: [],
    };
    setCategories([...categories, newCategory]);
    setCategoryDialog({ open: false, mode: "add" });
    setCategoryForm({ name: "" });
    toast({ title: "Category added successfully" });
  };

  const handleEditCategory = () => {
    if (!categoryForm.name.trim() || !categoryDialog.data) return;
    setCategories(categories.map(cat => 
      cat.id === categoryDialog.data!.id ? { ...cat, name: categoryForm.name } : cat
    ));
    setCategoryDialog({ open: false, mode: "add" });
    setCategoryForm({ name: "" });
    toast({ title: "Category updated successfully" });
  };

  const handleDeleteCategory = () => {
    if (!deleteDialog.id) return;
    setCategories(categories.filter(cat => cat.id !== deleteDialog.id));
    setDeleteDialog({ open: false });
    toast({ title: "Category deleted successfully" });
  };

  const handleAddSubcategory = () => {
    if (!subcategoryForm.name.trim() || !subcategoryDialog.categoryId) return;
    const newSubcategory: Subcategory = {
      id: Date.now().toString(),
      name: subcategoryForm.name,
      items: [],
    };
    setCategories(categories.map(cat => 
      cat.id === subcategoryDialog.categoryId ? {
        ...cat,
        subcategories: [...cat.subcategories, newSubcategory]
      } : cat
    ));
    setSubcategoryDialog({ open: false, mode: "add" });
    setSubcategoryForm({ name: "" });
    toast({ title: "Subcategory added successfully" });
  };

  const handleEditSubcategory = () => {
    if (!subcategoryForm.name.trim() || !subcategoryDialog.data) return;
    setCategories(categories.map(cat => ({
      ...cat,
      subcategories: cat.subcategories.map(sub =>
        sub.id === subcategoryDialog.data!.id ? { ...sub, name: subcategoryForm.name } : sub
      )
    })));
    setSubcategoryDialog({ open: false, mode: "add" });
    setSubcategoryForm({ name: "" });
    toast({ title: "Subcategory updated successfully" });
  };

  const handleDeleteSubcategory = () => {
    if (!deleteDialog.id) return;
    setCategories(categories.map(cat => ({
      ...cat,
      subcategories: cat.subcategories.filter(sub => sub.id !== deleteDialog.id)
    })));
    setDeleteDialog({ open: false });
    toast({ title: "Subcategory deleted successfully" });
  };

  const handleAddItem = () => {
    if (!itemForm.name.trim() || !itemDialog.categoryId || !itemDialog.subcategoryId) return;
    const newItem: Item = {
      id: Date.now().toString(),
      name: itemForm.name,
      quantity: itemForm.quantity,
      status: itemForm.quantity < 15 ? "low" : "normal",
      lastUpdated: "Just now",
      batches: [],
      predictedStock: itemForm.quantity,
      predictionTrend: "stable",
      predictionConfidence: 85,
      predictedStatus: "normal",
    };
    setCategories(categories.map(cat => 
      cat.id === itemDialog.categoryId ? {
        ...cat,
        subcategories: cat.subcategories.map(sub =>
          sub.id === itemDialog.subcategoryId ? {
            ...sub,
            items: [...sub.items, newItem]
          } : sub
        )
      } : cat
    ));
    setItemDialog({ open: false, mode: "add" });
    setItemForm({ name: "", quantity: 0 });
    
    // Trigger ML model retraining
    triggerModelRetrain(newItem.id, 'add');
    
    toast({ title: "Item added successfully" });
  };

  const handleEditItem = () => {
    if (!itemForm.name.trim() || !itemDialog.data) return;
    const itemId = itemDialog.data.id;
    
    setCategories(categories.map(cat => ({
      ...cat,
      subcategories: cat.subcategories.map(sub => ({
        ...sub,
        items: sub.items.map(item =>
          item.id === itemId ? {
            ...item,
            name: itemForm.name,
            quantity: itemForm.quantity,
            status: itemForm.quantity < 15 ? "low" : "normal",
          } : item
        )
      }))
    })));
    setItemDialog({ open: false, mode: "add" });
    setItemForm({ name: "", quantity: 0 });
    
    // Trigger ML model retraining
    triggerModelRetrain(itemId, 'update');
    
    toast({ title: "Item updated successfully" });
  };

  const handleDeleteItem = () => {
    if (!deleteDialog.id) return;
    const itemId = deleteDialog.id;
    
    setCategories(categories.map(cat => ({
      ...cat,
      subcategories: cat.subcategories.map(sub => ({
        ...sub,
        items: sub.items.filter(item => item.id !== itemId)
      }))
    })));
    setDeleteDialog({ open: false });
    
    // Trigger ML model retraining
    triggerModelRetrain(itemId, 'delete');
    
    toast({ title: "Item deleted successfully" });
  };

  const handleAddBatch = () => {
    if (!batchForm.batchNumber.trim() || !batchDialog.itemId) return;
    const newBatch: Batch = {
      id: Date.now().toString(),
      batchNumber: batchForm.batchNumber,
      quantity: batchForm.quantity,
      expiryDate: batchForm.expiryDate,
    };
    setCategories(categories.map(cat => 
      cat.id === batchDialog.categoryId ? {
        ...cat,
        subcategories: cat.subcategories.map(sub =>
          sub.id === batchDialog.subcategoryId ? {
            ...sub,
            items: sub.items.map(item =>
              item.id === batchDialog.itemId ? {
                ...item,
                batches: [...item.batches, newBatch]
              } : item
            )
          } : sub
        )
      } : cat
    ));
    setBatchDialog({ open: false });
    setBatchForm({ batchNumber: "", quantity: 0, expiryDate: "" });
    toast({ title: "Batch added successfully" });
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
                              setItemForm({ name: "", quantity: 0 });
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
                                    setItemForm({ name: item.name, quantity: item.quantity });
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
                                    className="flex items-center justify-between bg-muted/50 rounded p-2 text-sm"
                                  >
                                    <div>
                                      <span className="font-medium">{batch.batchNumber}</span>
                                      <span className="text-muted-foreground ml-2">
                                        Qty: {batch.quantity}
                                      </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
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
    </div>
  );
}
