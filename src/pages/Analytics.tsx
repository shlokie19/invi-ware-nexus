import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { Download } from "lucide-react";

const FLASK_BASE_URL = "http://localhost:5000";

const predictionData = [
  { date: "Oct 18", actual: 850, predicted: 845 },
  { date: "Oct 19", actual: 920, predicted: 915 },
  { date: "Oct 20", actual: 880, predicted: 890 },
  { date: "Oct 21", actual: 950, predicted: 945 },
  { date: "Oct 22", actual: 1020, predicted: 1010 },
  { date: "Oct 23", actual: 980, predicted: 990 },
  { date: "Oct 24", actual: 1050, predicted: 1045 },
  { date: "Oct 25", predicted: 1100 },
  { date: "Oct 26", predicted: 1150 },
  { date: "Oct 27", predicted: 1120 },
];

const categoryPerformance = [
  { category: "Electronics", sales: 45000, growth: 15 },
  { category: "Food Items", sales: 38000, growth: 8 },
  { category: "Clothing", sales: 32000, growth: 12 },
  { category: "Medical", sales: 28000, growth: 6 },
  { category: "Hardware", sales: 25000, growth: 10 },
];

const reorderPatterns = [
  { week: "Week 1", electronics: 45, food: 62, clothing: 38 },
  { week: "Week 2", electronics: 52, food: 58, clothing: 42 },
  { week: "Week 3", electronics: 48, food: 65, clothing: 45 },
  { week: "Week 4", electronics: 61, food: 71, clothing: 51 },
];

const itemSpecificData: Record<string, any[]> = {
  "1-1-1": [ // iPhone 15 Pro
    { date: "Oct 18", actual: 52, predicted: 51 },
    { date: "Oct 19", actual: 48, predicted: 49 },
    { date: "Oct 20", actual: 47, predicted: 46 },
    { date: "Oct 21", actual: 45, predicted: 45 },
    { date: "Oct 22", predicted: 42 },
    { date: "Oct 23", predicted: 40 },
    { date: "Oct 24", predicted: 38 },
  ],
  "1-1-2": [ // Samsung Galaxy S24
    { date: "Oct 18", actual: 18, predicted: 17 },
    { date: "Oct 19", actual: 15, predicted: 16 },
    { date: "Oct 20", actual: 14, predicted: 13 },
    { date: "Oct 21", actual: 12, predicted: 12 },
    { date: "Oct 22", predicted: 10 },
    { date: "Oct 23", predicted: 8 },
    { date: "Oct 24", predicted: 6 },
  ],
  "1-2-1": [ // MacBook Pro 16
    { date: "Oct 18", actual: 28, predicted: 29 },
    { date: "Oct 19", actual: 29, predicted: 28 },
    { date: "Oct 20", actual: 30, predicted: 30 },
    { date: "Oct 21", actual: 30, predicted: 31 },
    { date: "Oct 22", predicted: 32 },
    { date: "Oct 23", predicted: 34 },
    { date: "Oct 24", predicted: 35 },
  ],
  "2-1-1": [ // Bottled Water
    { date: "Oct 18", actual: 505, predicted: 502 },
    { date: "Oct 19", actual: 502, predicted: 501 },
    { date: "Oct 20", actual: 500, predicted: 500 },
    { date: "Oct 21", actual: 500, predicted: 498 },
    { date: "Oct 22", predicted: 495 },
    { date: "Oct 23", predicted: 490 },
    { date: "Oct 24", predicted: 485 },
  ],
};

const items = [
  { id: "1-1-1", name: "iPhone 15 Pro", subcategory: "Smartphones" },
  { id: "1-1-2", name: "Samsung Galaxy S24", subcategory: "Smartphones" },
  { id: "1-2-1", name: "MacBook Pro 16", subcategory: "Laptops" },
  { id: "2-1-1", name: "Bottled Water", subcategory: "Beverages" },
];

export default function Analytics() {
  const [selectedItem, setSelectedItem] = useState<string>("1-1-1");
  const { toast } = useToast();
  const [liveItemData, setLiveItemData] = useState<any[]>([]);
  const [isLoadingPrediction, setIsLoadingPrediction] = useState(false);
  
  const selectedItemData = liveItemData.length > 0 ? liveItemData : (itemSpecificData[selectedItem] || itemSpecificData["1-1-1"]);
  const selectedItemInfo = items.find(item => item.id === selectedItem) || items[0];

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
        selectedItem: selectedItemInfo.name,
        stockPredictions: selectedItemData,
        categoryPerformance,
        reorderPatterns,
        allItemPredictions: itemSpecificData
      };

      // Convert to CSV format
      let csvContent = "Analytics Report\n";
      csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
      
      // Stock Predictions for Selected Item
      csvContent += `Stock Predictions - ${selectedItemInfo.name}\n`;
      csvContent += "Date,Actual Stock,Predicted Stock\n";
      selectedItemData.forEach(row => {
        csvContent += `${row.date},${row.actual || ""},${row.predicted}\n`;
      });
      
      csvContent += "\n\nCategory Performance\n";
      csvContent += "Category,Sales (₹),Growth (%)\n";
      categoryPerformance.forEach(row => {
        csvContent += `${row.category},${row.sales},${row.growth}\n`;
      });
      
      csvContent += "\n\nReorder Patterns\n";
      csvContent += "Week,Electronics,Food Items,Clothing\n";
      reorderPatterns.forEach(row => {
        csvContent += `${row.week},${row.electronics},${row.food},${row.clothing}\n`;
      });

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

      <Tabs defaultValue="prediction" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="prediction">Stock Prediction</TabsTrigger>
          <TabsTrigger value="performance">Category Performance</TabsTrigger>
          <TabsTrigger value="patterns">Reorder Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="prediction" className="space-y-4">
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
                        {item.name} ({item.subcategory})
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
                <p className="text-xs text-muted-foreground mt-1">{selectedItemInfo.name}</p>
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
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>Category-wise Sales Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={categoryPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="category" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" name="Sales (₹)" />
                  <Bar dataKey="growth" fill="hsl(var(--success))" name="Growth (%)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>Reorder Patterns by Category</CardTitle>
              <p className="text-sm text-muted-foreground">
                Weekly reorder frequency trends
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={reorderPatterns}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="electronics"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="Electronics"
                  />
                  <Line
                    type="monotone"
                    dataKey="food"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    name="Food Items"
                  />
                  <Line
                    type="monotone"
                    dataKey="clothing"
                    stroke="hsl(var(--warning))"
                    strokeWidth={2}
                    name="Clothing"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
