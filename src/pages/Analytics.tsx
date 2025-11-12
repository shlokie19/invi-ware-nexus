import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ItemPredictionChart } from "@/components/ItemPredictionChart";

export default function Analytics() {
  const [selectedItem, setSelectedItem] = useState<string>("");
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [stockHistory, setStockHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const selectedItemInfo = items.find(item => item.id === selectedItem);

  // Fetch items and stock history from database
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch items with quantity and reorder_level
        const { data: itemsData, error: itemsError } = await supabase
          .from("items")
          .select(`
            id,
            name,
            quantity,
            reorder_level,
            subcategories (
              name,
              categories (
                name
              )
            )
          `)
          .order("name");

        if (itemsError) {
          console.error("Error fetching items:", itemsError);
          toast({
            title: "Error",
            description: "Failed to load items",
            variant: "destructive",
          });
        } else {
          setItems(itemsData || []);
          if (itemsData && itemsData.length > 0) {
            setSelectedItem(itemsData[0].id);
          }
        }

        // Fetch stock history
        const { data: historyData, error: historyError } = await supabase
          .from("stock_history")
          .select("item_id, created_at, quantity_changed, change_type")
          .order("created_at", { ascending: false });

        if (historyError) {
          console.error("Error fetching stock history:", historyError);
        } else {
          setStockHistory(historyData || []);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscription for items
    const itemsChannel = supabase
      .channel('items-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Set up real-time subscription for stock_history
    const historyChannel = supabase
      .channel('history-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stock_history'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(historyChannel);
    };
  }, [toast]);

  // Filter stock history for selected item
  const selectedItemHistory = stockHistory.filter(
    entry => entry.item_id === selectedItem
  );

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

      // Convert to CSV format
      let csvContent = "Analytics Report\n";
      csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
      csvContent += `Item: ${selectedItemInfo.name}\n`;
      csvContent += `Current Stock: ${selectedItemInfo.quantity} units\n`;
      csvContent += `Reorder Level: ${selectedItemInfo.reorder_level} units\n\n`;
      
      // Stock History
      csvContent += "Stock History\n";
      csvContent += "Date,Change Type,Quantity Changed\n";
      selectedItemHistory.forEach(entry => {
        csvContent += `${new Date(entry.created_at).toLocaleString()},${entry.change_type},${entry.quantity_changed}\n`;
      });

      // Create blob and download
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
                  {isLoading && (
                    <span className="text-xs font-normal text-muted-foreground">Loading...</span>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Real-time stock tracking with simulated 7-day forecast
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
          <div className="grid gap-4 md:grid-cols-3">
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
    </div>
  );
}
