import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, TrendingUp, Layers, Loader2 } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

const FLASK_BASE_URL = "http://localhost:5000";

// Fallback dummy data
const fallbackStockData = [
  { name: "Mon", stock: 450 },
  { name: "Tue", stock: 420 },
  { name: "Wed", stock: 390 },
  { name: "Thu", stock: 370 },
  { name: "Fri", stock: 340 },
  { name: "Sat", stock: 310 },
  { name: "Sun", stock: 290 },
];

const fallbackCategoryData = [
  { name: "Electronics", items: 145 },
  { name: "Food", items: 230 },
  { name: "Clothing", items: 180 },
  { name: "Medical", items: 95 },
  { name: "Hardware", items: 120 },
];

const fallbackAlerts = [
  { id: 1, message: "Low stock detected: Category Electronics", time: "5 min ago", severity: "warning" },
  { id: 2, message: "Fake product detected in verification", time: "12 min ago", severity: "error" },
  { id: 3, message: "Weight sensor triggered: Batch B-234", time: "1 hour ago", severity: "info" },
];

export default function Dashboard() {
  const [stockData, setStockData] = useState(fallbackStockData);
  const [categoryData, setCategoryData] = useState(fallbackCategoryData);
  const [alerts, setAlerts] = useState(fallbackAlerts);
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(770);
  const [totalCategories, setTotalCategories] = useState(12);
  const [lowStockAlerts, setLowStockAlerts] = useState(8);
  const [predictedGrowth, setPredictedGrowth] = useState("+15%");
  const { toast } = useToast();

  // Sample item IDs for fetching predictions
  const sampleItemIds = ["smartwatch-001", "laptop-002", "phone-003"];

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch predictions for multiple items
        const predictionPromises = sampleItemIds.map(itemId =>
          fetch(`${FLASK_BASE_URL}/predict/${itemId}`)
            .then(res => res.ok ? res.json() : null)
            .catch(() => null)
        );
        const predictions = await Promise.all(predictionPromises);
        
        // Merge predictions into stock data
        if (predictions.some(p => p !== null)) {
          const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
          const mergedData = days.map((day, idx) => ({
            name: day,
            stock: predictions.reduce((sum, pred) => {
              if (pred?.prediction?.[idx]) return sum + pred.prediction[idx];
              return sum + fallbackStockData[idx]?.stock || 0;
            }, 0) / predictions.length
          }));
          setStockData(mergedData);
        }

        // Fetch categories
        const categoriesRes = await fetch(`${FLASK_BASE_URL}/categories`);
        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategoryData(categoriesData.categories || fallbackCategoryData);
          setTotalCategories(categoriesData.total || 12);
        }

        // Fetch alerts
        const alertsRes = await fetch(`${FLASK_BASE_URL}/alerts`);
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          setAlerts(alertsData.alerts || fallbackAlerts);
          setLowStockAlerts(alertsData.alerts?.filter((a: any) => a.severity === "warning").length || 8);
        }

        // Fetch hardware status for monitored items
        const hardwareRes = await fetch(`${FLASK_BASE_URL}/hardware-status/smartwatch-001`);
        if (hardwareRes.ok) {
          const hardwareData = await hardwareRes.json();
          if (hardwareData.weight_drop_detected) {
            setAlerts(prev => [{
              id: Date.now(),
              message: `Weight drop detected: ${hardwareData.item_name || 'Unknown Item'}`,
              time: "Just now",
              severity: "error"
            }, ...prev]);
            
            toast({
              title: "Hardware Alert",
              description: `Weight sensor triggered for ${hardwareData.item_name}`,
              variant: "destructive",
            });
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        // Use fallback data
        setStockData(fallbackStockData);
        setCategoryData(fallbackCategoryData);
        setAlerts(fallbackAlerts);
        setIsLoading(false);
      }
    };

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, [toast]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Overview</h1>
        <p className="text-muted-foreground">Monitor your warehouse inventory in real-time</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Items" value={totalItems.toString()} icon={Package} trend="+12% from last week" />
        <StatCard title="Categories" value={totalCategories.toString()} icon={Layers} variant="success" />
        <StatCard title="Low Stock Alerts" value={lowStockAlerts.toString()} icon={AlertTriangle} variant="warning" />
        <StatCard title="Predicted Growth" value={predictedGrowth} icon={TrendingUp} variant="success" trend="Next 7 days" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Stock Prediction Trend
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stockData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Line type="monotone" dataKey="stock" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Category Distribution
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Bar dataKey="items" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Recent Alerts
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-[100px]">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    alert.severity === "error"
                      ? "border-destructive/50 bg-destructive/10"
                      : alert.severity === "warning"
                      ? "border-warning/50 bg-warning/10"
                      : "border-primary/50 bg-primary/10"
                  }`}
                >
                  <div>
                    <p className="font-medium">{alert.message}</p>
                    <p className="text-sm text-muted-foreground">{alert.time}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      alert.severity === "error"
                        ? "bg-destructive text-destructive-foreground"
                        : alert.severity === "warning"
                        ? "bg-warning text-warning-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {alert.severity.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
