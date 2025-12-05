import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download, Brain, Loader2, TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";
import { ItemPredictionChart } from "@/components/ItemPredictionChart";
import { itemsDB, subcategoriesDB, stockHistoryDB, initializeData } from "@/lib/linkedList";
import { InventoryPredictor } from "@/lib/ml-predictor";

export default function Analytics() {
  const [selectedItem, setSelectedItem] = useState<string>("");
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [stockHistory, setStockHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunningML, setIsRunningML] = useState(false);
  const [mlProgress, setMlProgress] = useState(0);
  const [mlResults, setMlResults] = useState<any>(null);
  
  const selectedItemInfo = items.find(item => item.id === selectedItem);

  const fetchData = () => {
    setIsLoading(true);
    try {
      initializeData();
      
      const allItems = itemsDB.getAll();
      const allSubcategories = subcategoriesDB.getAll();
      
      const itemsWithInfo = allItems.map(item => {
        const subcategory = allSubcategories.find(s => s.id === item.subcategory_id);
        return {
          ...item,
          subcategories: subcategory ? { name: subcategory.name } : null
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
      
      setItems(itemsWithInfo);
      
      if (itemsWithInfo.length > 0 && !selectedItem) {
        setSelectedItem(itemsWithInfo[0].id);
      }
      
      // Get all stock history
      const history = stockHistoryDB.getAll().map(h => ({
        item_id: h.item_id,
        created_at: h.created_at,
        quantity_changed: h.quantity_change,
        change_type: h.change_type,
        new_quantity: h.new_quantity
      }));
      
      setStockHistory(history);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    const unsubItems = itemsDB.subscribe(fetchData);
    const unsubHistory = stockHistoryDB.subscribe(fetchData);
    
    return () => {
      unsubItems();
      unsubHistory();
    };
  }, []);

  // Filter stock history for selected item
  const selectedItemHistory = stockHistory.filter(
    entry => entry.item_id === selectedItem
  );

  // Run ML Predictions
  const runMLPredictions = async () => {
    setIsRunningML(true);
    setMlProgress(0);
    setMlResults(null);

    try {
      const predictor = new InventoryPredictor();
      const allItems = itemsDB.getAll();
      
      setMlProgress(20);
      
      let processed = 0;
      const totalItems = allItems.length;
      const predictions = [];
      let totalConfidence = 0;
      let criticalAlerts = 0;

      for (const item of allItems) {
        // Get history for this item
        const history = stockHistoryDB.getByItem(item.id);
        
        // Run prediction
        const prediction = await predictor.predictStock(
          item.quantity,
          item.reorder_level,
          history,
          30 // predict 30 days ahead
        );
        
        // Update item with predictions
        itemsDB.update(item.id, {
          predicted_stock: prediction.predicted_stock,
          prediction_confidence: prediction.prediction_confidence,
          prediction_trend: prediction.prediction_trend
        });
        
        // Collect stats
        predictions.push({
          name: item.name,
          current: item.quantity,
          predicted: prediction.predicted_stock,
          confidence: prediction.prediction_confidence,
          trend: prediction.prediction_trend,
          daysUntilReorder: prediction.days_until_reorder
        });
        
        totalConfidence += prediction.prediction_confidence;
        
        // Check if predicted stock falls below reorder level
        if (prediction.predicted_stock <= item.reorder_level) {
          criticalAlerts++;
        }
        
        processed++;
        setMlProgress(20 + (processed / totalItems) * 70);
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setMlProgress(100);
      
      // Set results
      setMlResults({
        itemsProcessed: totalItems,
        avgConfidence: Math.round(totalConfidence / totalItems),
        criticalAlerts,
        predictions: predictions.slice(0, 5) // Show top 5
      });
      
      // Refresh data to show updated predictions
      fetchData();
      
      toast({
        title: "ML Predictions Complete",
        description: `Successfully analyzed ${totalItems} items with ${Math.round(totalConfidence / totalItems)}% average confidence.`,
      });
      
    } catch (error) {
      console.error("ML Prediction error:", error);
      toast({
        title: "Prediction Failed",
        description: "Failed to run ML predictions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRunningML(false);
    }
  };

  const handleExportReport = () => {
    try {
      if (!selectedItemInfo) {
        toast({
          title: "Export Failed",
          description: "No item selected.",
          variant: "destructive",
        });
        return;
      }

      let csvContent = "Analytics Report\n";
      csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
      csvContent += `Item: ${selectedItemInfo.name}\n`;
      csvContent += `Current Stock: ${selectedItemInfo.quantity} units\n`;
      csvContent += `Reorder Level: ${selectedItemInfo.reorder_level} units\n`;
      
      if (selectedItemInfo.predicted_stock !== null) {
        csvContent += `Predicted Stock (30d): ${selectedItemInfo.predicted_stock} units\n`;
        csvContent += `Prediction Confidence: ${selectedItemInfo.prediction_confidence}%\n`;
        csvContent += `Trend: ${selectedItemInfo.prediction_trend}\n`;
      }
      
      csvContent += "\nStock History\n";
      csvContent += "Date,Change Type,Quantity Changed\n";
      selectedItemHistory.forEach(entry => {
        csvContent += `${new Date(entry.created_at).toLocaleString()},${entry.change_type},${entry.quantity_changed}\n`;
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `analytics-report-${selectedItemInfo.name}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Report Exported",
        description: "Analytics report has been downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export analytics report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'decreasing':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">ML-driven insights and predictions</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="default" 
            onClick={runMLPredictions}
            disabled={isRunningML}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {isRunningML ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Run ML Predictions
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* ML Progress Bar */}
      {isRunningML && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-blue-900">Processing ML Predictions...</span>
                <span className="text-blue-700">{mlProgress}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${mlProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ML Results Summary */}
      {mlResults && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Items Analyzed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {mlResults.itemsProcessed}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Products processed</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Confidence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {mlResults.avgConfidence}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Prediction accuracy</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Critical Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {mlResults.criticalAlerts}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Low stock warnings</p>
              </CardContent>
            </Card>
          </div>

          {/* Top Predictions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mlResults.predictions.map((pred: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="space-y-1">
                      <div className="font-medium">{pred.name}</div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getTrendColor(pred.trend)}`}>
                          {getTrendIcon(pred.trend)}
                          {pred.trend}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {pred.confidence}% confidence
                        </span>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-sm text-muted-foreground">Current → Predicted</div>
                      <div className="font-semibold">{pred.current} → {pred.predicted} units</div>
                      {pred.daysUntilReorder && (
                        <div className="text-xs text-orange-600">
                          Reorder in {pred.daysUntilReorder} days
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-4">
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  Item-Specific Stock Prediction
                  {isLoading && (
                    <span className="text-xs font-normal text-muted-foreground">Loading...</span>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Real-time stock tracking with ML-powered 30-day forecast
                </p>
              </div>
              <Select value={selectedItem} onValueChange={setSelectedItem}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.subcategories?.name || "N/A"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {selectedItemInfo ? (
              <ItemPredictionChart
                item={selectedItemInfo}
                stockHistory={selectedItemHistory}
              />
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Select an item to view predictions
              </div>
            )}
          </CardContent>
        </Card>

        {selectedItemInfo && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Current Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  {selectedItemInfo.quantity}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Units available</p>
              </CardContent>
            </Card>
            <Card className="border-warning/20 bg-warning/5">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Reorder Level
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-warning">
                  {selectedItemInfo.reorder_level}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Threshold units</p>
              </CardContent>
            </Card>
            {selectedItemInfo.predicted_stock !== null && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    ML Prediction (30d)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {selectedItemInfo.predicted_stock}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedItemInfo.prediction_confidence}% confidence
                  </p>
                </CardContent>
              </Card>
            )}
            <Card className="border-success/20 bg-success/5">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Stock History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">
                  {selectedItemHistory.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Recorded changes</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Info Footer */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <strong>About ML Predictions:</strong> The system uses TensorFlow.js to analyze 
              historical stock movements (sales, restocks, damages) and predict future inventory 
              levels. Predictions consider usage patterns, trends, and volatility in your data. 
              Click "Run ML Predictions" to update forecasts for all items.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
