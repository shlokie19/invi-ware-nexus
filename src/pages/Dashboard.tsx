import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, Layers, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { 
  categoriesDB, 
  subcategoriesDB, 
  itemsDB, 
  stockHistoryDB, 
  initializeData 
} from "@/lib/linkedList";

export default function Dashboard() {
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [totalCategories, setTotalCategories] = useState(0);
  const [lowStockAlerts, setLowStockAlerts] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [stockHistoryData, setStockHistoryData] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const { toast } = useToast();

  const fetchDashboardData = () => {
    try {
      initializeData();
      
      const allItems = itemsDB.getAll();
      const allCategories = categoriesDB.getAll();
      const allSubcategories = subcategoriesDB.getAll();
      
      setTotalItems(allItems.length);
      setTotalCategories(allCategories.length);
      
      const lowStock = allItems.filter(item => item.quantity <= item.reorder_level).length;
      setLowStockAlerts(lowStock);
      
      // Category distribution
      const catData = allCategories.map(cat => {
        const catSubcategories = allSubcategories.filter(sub => sub.category_id === cat.id);
        const itemCount = catSubcategories.reduce((sum, sub) => {
          return sum + allItems.filter(item => item.subcategory_id === sub.id).length;
        }, 0);
        return { name: cat.name, items: itemCount };
      });
      setCategoryData(catData);
      
      // Items with subcategory info
      const itemsWithInfo = allItems.map(item => {
        const subcategory = allSubcategories.find(s => s.id === item.subcategory_id);
        return { ...item, subcategories: subcategory ? { name: subcategory.name } : null };
      }).sort((a, b) => a.quantity - b.quantity);
      
      setItems(itemsWithInfo);
      
      if (itemsWithInfo.length > 0 && !selectedItemId) {
        setSelectedItemId(itemsWithInfo[0].id);
      }
      
      // Low stock alerts
      const lowStockItems = itemsWithInfo.filter(item => item.quantity <= item.reorder_level).slice(0, 5);
      const alertData = lowStockItems.map(item => ({
        id: item.id,
        message: `${item.name} is low on stock (${item.quantity} units)`,
        time: "Just now",
        severity: item.quantity === 0 ? "error" : "warning"
      }));
      setAlerts(alertData);
      
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Subscribe to changes
    const unsubItems = itemsDB.subscribe(fetchDashboardData);
    const unsubCategories = categoriesDB.subscribe(fetchDashboardData);
    
    return () => {
      unsubItems();
      unsubCategories();
    };
  }, []);

  // Fetch stock history function
  const fetchStockHistory = () => {
    if (!selectedItemId) return;
    
    setIsLoadingHistory(true);
    try {
      const history = stockHistoryDB.getByItem(selectedItemId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(-50);
      
      const chartData = history.map(record => ({
        date: format(new Date(record.created_at), "MMM dd HH:mm"),
        quantity: record.new_quantity,
        change: record.quantity_change,
      }));
      
      setStockHistoryData(chartData);
    } catch (error) {
      console.error("Failed to fetch stock history:", error);
      toast({
        title: "Error",
        description: "Failed to load stock history",
        variant: "destructive",
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fetch stock history when selected item changes
  useEffect(() => {
    fetchStockHistory();
  }, [selectedItemId]);

  // Also refresh stock history when items data changes
  useEffect(() => {
    if (selectedItemId) {
      fetchStockHistory();
    }
  }, [items]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Overview</h1>
        <p className="text-muted-foreground">Monitor your warehouse inventory in real-time</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Items" value={totalItems.toString()} icon={Package} />
        <StatCard title="Categories" value={totalCategories.toString()} icon={Layers} variant="success" />
        <StatCard title="Low Stock Alerts" value={lowStockAlerts.toString()} icon={AlertTriangle} variant="warning" />
      </div>

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
          ) : alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No alerts</div>
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

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Item Stock Level History
            {isLoadingHistory && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardTitle>
          <div className="mt-4">
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Select an item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} {item.sku ? `(${item.sku})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : stockHistoryData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No stock history available for this item
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stockHistoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="quantity" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
