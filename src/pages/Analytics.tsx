import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const FLASK_BASE_URL = "http://localhost:5000";

export default function Analytics() {
  const [selectedItem, setSelectedItem] = useState<string>("");
  const { toast } = useToast();
  const [liveItemData, setLiveItemData] = useState<any[]>([]);
  const [isLoadingPrediction, setIsLoadingPrediction] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  
  const selectedItemData = liveItemData;
  const selectedItemInfo = items.find(item => item.id === selectedItem);

  // Fetch items from database
  useEffect(() => {
    const fetchItems = async () => {
      const { data, error } = await supabase
        .from("items")
        .select(`
          id,
          name,
          subcategories (
            name,
            categories (
              name
            )
          )
        `)
        .order("name");

      if (error) {
        console.error("Error fetching items:", error);
        toast({
          title: "Error",
          description: "Failed to load items",
          variant: "destructive",
        });
      } else {
        setItems(data || []);
        if (data && data.length > 0) {
          setSelectedItem(data[0].id);
        }
      }
    };

    fetchItems();
  }, [toast]);

  // Fetch live prediction from Flask backend
  useEffect(() => {
    const fetchPrediction = async () => {
      setIsLoadingPrediction(true);
      try {
        const response = await fetch(`${FLASK_BASE_URL}/predict/${selectedItem}`);
        
        if (response.ok) {
          const data = await response.json();
          // Transform Flask response to match our chart data format
          if (data.predictions && Array.isArray(data.predictions)) {
            setLiveItemData(data.predictions);
          }
        } else {
          console.error('Failed to fetch predictions from Flask backend');
          // Fall back to static data
          setLiveItemData([]);
        }
      } catch (error) {
        console.error('Error fetching predictions:', error);
        // Fall back to static data on error
        setLiveItemData([]);
      } finally {
        setIsLoadingPrediction(false);
      }
    };

    fetchPrediction();
  }, [selectedItem]);

  const handleExportReport = () => {
    try {
      // Compile all analytics data
      const report = {
        generatedAt: new Date().toISOString(),
        selectedItem: selectedItemInfo?.name || "Unknown",
        stockPredictions: selectedItemData,
      };

      // Convert to CSV format
      let csvContent = "Analytics Report\n";
      csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
      
      // Stock Predictions for Selected Item
      if (selectedItemInfo) {
        csvContent += `Stock Predictions - ${selectedItemInfo.name}\n`;
        csvContent += "Date,Actual Stock,Predicted Stock\n";
        selectedItemData.forEach(row => {
          csvContent += `${row.date},${row.actual || ""},${row.predicted}\n`;
        });
      }

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `analytics-report-${new Date().toISOString().split('T')[0]}.csv`);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">ML-driven insights and predictions</p>
        </div>
        <Button variant="outline" onClick={handleExportReport}>
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      <div className="space-y-4">
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    Item-Specific Stock Prediction
                    {liveItemData.length > 0 && (
                      <span className="text-xs font-normal text-success">🔴 Live from Flask API</span>
                    )}
                    {isLoadingPrediction && (
                      <span className="text-xs font-normal text-muted-foreground">Loading...</span>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    7-day forecast using LSTM neural network • API: /predict/&#123;item_id&#125;
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
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={selectedItemData}>
                  <defs>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorActual)"
                  />
                  <Area
                    type="monotone"
                    dataKey="predicted"
                    stroke="hsl(var(--success))"
                    strokeDasharray="5 5"
                    fillOpacity={1}
                    fill="url(#colorPredicted)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-success/20 bg-success/5">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Item Prediction Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">94.2%</div>
                <p className="text-xs text-muted-foreground mt-1">{selectedItemInfo?.name || "N/A"}</p>
              </CardContent>
            </Card>
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Current Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  {selectedItemData.find(d => d.actual)?.actual || "N/A"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Units available</p>
              </CardContent>
            </Card>
            <Card className="border-warning/20 bg-warning/5">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  7-Day Forecast
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-warning">
                  {selectedItemData[selectedItemData.length - 1]?.predicted || "N/A"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Predicted units</p>
              </CardContent>
            </Card>
          </div>
      </div>
    </div>
  );
}
