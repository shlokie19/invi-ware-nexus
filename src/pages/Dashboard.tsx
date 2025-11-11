import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, TrendingUp, Layers, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [totalCategories, setTotalCategories] = useState(0);
  const [lowStockAlerts, setLowStockAlerts] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch total items
        const { count: itemCount, error: itemError } = await supabase
          .from("items")
          .select("*", { count: "exact", head: true });

        if (itemError) throw itemError;
        setTotalItems(itemCount || 0);

        // Fetch total categories
        const { count: categoryCount, error: categoryError } = await supabase
          .from("categories")
          .select("*", { count: "exact", head: true });

        if (categoryError) throw categoryError;
        setTotalCategories(categoryCount || 0);

        // Fetch low stock alerts
        const { data: items, error: lowStockError } = await supabase
          .from("items")
          .select("id, quantity, reorder_level");

        if (lowStockError) throw lowStockError;
        const lowStock = items?.filter(item => item.quantity <= item.reorder_level).length || 0;
        setLowStockAlerts(lowStock);

        // Fetch category distribution
        const { data: categories, error: catError } = await supabase
          .from("categories")
          .select(`
            id,
            name,
            subcategories (
              items (
                id
              )
            )
          `);

        if (catError) throw catError;
        
        const catData = categories?.map(cat => ({
          name: cat.name,
          items: cat.subcategories?.reduce((sum: number, sub: any) => sum + (sub.items?.length || 0), 0) || 0
        })) || [];
        setCategoryData(catData);

        // Fetch recent low stock alerts
        const { data: allItems, error: alertError } = await supabase
          .from("items")
          .select(`
            id,
            name,
            quantity,
            reorder_level,
            subcategories (
              name
            )
          `)
          .order("quantity", { ascending: true });

        if (!alertError && allItems) {
          const lowStockItems = allItems
            .filter(item => item.quantity <= item.reorder_level)
            .slice(0, 5);
          
          const alertData = lowStockItems.map(item => ({
            id: item.id,
            message: `${item.name} is low on stock (${item.quantity} units)`,
            time: "Just now",
            severity: item.quantity === 0 ? "error" : "warning"
          }));
          setAlerts(alertData);
        }

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

    fetchDashboardData();

    // Set up real-time subscriptions
    const itemsChannel = supabase
      .channel("dashboard-items")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    const categoriesChannel = supabase
      .channel("dashboard-categories")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "categories",
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(categoriesChannel);
    };
  }, [toast]);

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
