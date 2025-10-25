import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Plus, Edit, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [expandedSubcategories, setExpandedSubcategories] = useState<string[]>([]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Hierarchical view of all inventory items</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      <div className="space-y-4">
        {mockData.map((category) => (
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
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {expandedCategories.includes(category.id) && (
              <CardContent className="space-y-3">
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
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Item
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
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
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
                                  <Button size="sm" variant="outline" className="h-7 text-xs">
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
    </div>
  );
}
