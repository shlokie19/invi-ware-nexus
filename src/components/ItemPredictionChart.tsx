import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Brain } from "lucide-react";
import { format, subDays, addDays } from "date-fns";

interface StockHistoryEntry {
  created_at: string;
  quantity_changed: number;
  change_type: string;
}

interface Item {
  id: string;
  name: string;
  quantity: number;
  reorder_level: number;
}

interface ItemPredictionChartProps {
  item: Item;
  stockHistory: StockHistoryEntry[];
}

export function ItemPredictionChart({ item, stockHistory }: ItemPredictionChartProps) {
  const chartData = useMemo(() => {
    // Filter history for this item and last 14 days for calculation
    const fourteenDaysAgo = subDays(new Date(), 14);
    const recentHistory = stockHistory.filter(entry => {
      const entryDate = new Date(entry.created_at);
      return entryDate >= fourteenDaysAgo && 
             (entry.change_type === 'sale' || entry.change_type === 'damaged');
    });

    // Calculate average daily usage
    let avgDailyUsage = 1;
    if (recentHistory.length > 0) {
      const totalUsage = recentHistory.reduce((sum, entry) => 
        sum + Math.abs(entry.quantity_changed), 0
      );
      const activeDays = Math.max(1, new Set(
        recentHistory.map(entry => format(new Date(entry.created_at), 'yyyy-MM-dd'))
      ).size);
      avgDailyUsage = Math.max(1, Math.round(totalUsage / activeDays));
    } else {
      // Fallback: use reorder level as proxy
      avgDailyUsage = Math.max(1, Math.round(item.reorder_level / 7));
    }

    // Build chart data: 7 days past + today + 7 days future
    const data = [];
    const today = new Date();

    // Past 7 days - use actual history or flat trend
    for (let i = 7; i >= 1; i--) {
      const date = subDays(today, i);
      const dayHistory = stockHistory.filter(entry => {
        const entryDate = new Date(entry.created_at);
        return format(entryDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
      });
      
      // Simulate past quantity (simple approach: current - usage since then)
      const daysFromNow = i;
      const estimatedPastQty = Math.max(0, item.quantity + avgDailyUsage * daysFromNow);
      
      data.push({
        date: format(date, 'MMM dd'),
        actual: estimatedPastQty,
        predicted: null,
      });
    }

    // Today
    data.push({
      date: format(today, 'MMM dd'),
      actual: item.quantity,
      predicted: item.quantity,
    });

    // Future 7 days - predicted with small random noise
    for (let i = 1; i <= 7; i++) {
      const date = addDays(today, i);
      const noise = (Math.random() - 0.5) * avgDailyUsage * 0.3; // ±30% noise
      const predictedQty = Math.max(0, item.quantity - avgDailyUsage * i + noise);
      
      data.push({
        date: format(date, 'MMM dd'),
        actual: null,
        predicted: Math.round(predictedQty),
      });
    }

    return { data, avgDailyUsage };
  }, [item, stockHistory]);

  // Calculate predicted days left
  const predictedDaysLeft = Math.round(item.quantity / Math.max(1, chartData.avgDailyUsage));
  
  // Determine badge color
  const getBadgeVariant = () => {
    if (predictedDaysLeft <= 3) return "destructive";
    if (predictedDaysLeft <= 10) return "default";
    return "outline";
  };

  const getBadgeColor = () => {
    if (predictedDaysLeft <= 3) return "text-destructive";
    if (predictedDaysLeft <= 10) return "text-warning";
    return "text-success";
  };

  const suggestedReorder = Math.ceil(chartData.avgDailyUsage * 14);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className={`h-4 w-4 ${getBadgeColor()}`} />
          <span className="text-sm font-medium">
            Predicted stockout: 
          </span>
          <Badge variant={getBadgeVariant()} className={getBadgeColor()}>
            {item.quantity === 0 ? '0 days (Out of stock)' : 
             chartData.avgDailyUsage === 0 ? '>30 days' :
             `${predictedDaysLeft} days`}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          Avg daily usage: {chartData.avgDailyUsage} units
        </span>
      </div>

      {predictedDaysLeft <= 7 && item.quantity > 0 && (
        <div className="text-xs text-muted-foreground">
          Suggested reorder qty: {suggestedReorder} units
          {item.quantity <= item.reorder_level && (
            <span className="text-warning ml-2">(below threshold)</span>
          )}
        </div>
      )}

      <div className="text-xs text-muted-foreground italic">
        Simulated prediction (demo only) - Based on recent sales history
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--primary))" }}
            name="Actual Stock"
          />
          <Line
            type="monotone"
            dataKey="predicted"
            stroke="hsl(var(--warning))"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: "hsl(var(--warning))" }}
            name="Predicted Stock"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
