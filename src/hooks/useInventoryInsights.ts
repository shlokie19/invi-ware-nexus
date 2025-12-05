import { useState, useEffect } from "react";
import { stockHistoryDB } from "@/lib/localStorage";

interface ItemInsight {
  itemId: string;
  predictedDaysLeft: number;
  avgDailySales: number;
  suggestedReorderQty: number;
}

interface HealthScore {
  score: number;
  label: "Good" | "Watch" | "Critical";
  lowStockCount: number;
  expiringCount: number;
  avgDaysLeft: number;
}

interface InventoryInsights {
  itemInsights: Map<string, ItemInsight>;
  healthScore: HealthScore;
  loading: boolean;
}

const HISTORY_DAYS = 14;

export function useInventoryInsights(
  items: Array<{ id: string; quantity: number; reorderLevel: number }>,
  expiringBatchesCount: number
): InventoryInsights {
  const [itemInsights, setItemInsights] = useState<Map<string, ItemInsight>>(new Map());
  const [healthScore, setHealthScore] = useState<HealthScore>({
    score: 100,
    label: "Good",
    lowStockCount: 0,
    expiringCount: 0,
    avgDaysLeft: 30,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const computeInsights = () => {
      if (items.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - HISTORY_DAYS);

        const allHistory = stockHistoryDB.getAll();
        const historyData = allHistory.filter(
          (h) =>
            new Date(h.created_at) >= cutoffDate &&
            (h.change_type === "sale" || h.change_type === "damaged")
        );

        const insights = new Map<string, ItemInsight>();
        const daysLeftArray: number[] = [];

        for (const item of items) {
          const itemHistory = historyData.filter((h) => h.item_id === item.id);

          let avgDailySales = 0;
          if (itemHistory.length > 0) {
            const totalSold = itemHistory.reduce(
              (sum, h) => sum + Math.abs(h.quantity_change),
              0
            );
            const uniqueDays = new Set(
              itemHistory.map((h) => new Date(h.created_at).toDateString())
            ).size;
            avgDailySales = totalSold / Math.max(1, uniqueDays);
          } else {
            avgDailySales = Math.max(1, Math.round(item.reorderLevel / 7));
          }

          let predictedDaysLeft = 0;
          if (item.quantity === 0) {
            predictedDaysLeft = 0;
          } else if (avgDailySales === 0) {
            predictedDaysLeft = 30;
          } else {
            predictedDaysLeft = Math.round(item.quantity / avgDailySales);
            predictedDaysLeft = Math.min(predictedDaysLeft, 30);
          }

          const suggestedReorderQty = Math.ceil(avgDailySales * 14);

          insights.set(item.id, {
            itemId: item.id,
            predictedDaysLeft,
            avgDailySales,
            suggestedReorderQty,
          });

          daysLeftArray.push(predictedDaysLeft);
        }

        setItemInsights(insights);

        const totalItems = items.length;
        const lowStockItems = items.filter((i) => i.quantity <= i.reorderLevel).length;
        const avgDaysLeft = daysLeftArray.length > 0
          ? daysLeftArray.reduce((a, b) => a + b, 0) / daysLeftArray.length
          : 30;

        const penaltyLow = Math.min(40, (lowStockItems / Math.max(1, totalItems)) * 40);
        const penaltyExp = Math.min(30, (expiringBatchesCount / Math.max(1, totalItems)) * 30);
        const bonusDays = (Math.min(avgDaysLeft, 30) / 30) * 10;

        let score = Math.round(100 - penaltyLow - penaltyExp + bonusDays);
        score = Math.max(0, Math.min(100, score));

        let label: "Good" | "Watch" | "Critical";
        if (score >= 80) label = "Good";
        else if (score >= 60) label = "Watch";
        else label = "Critical";

        setHealthScore({
          score,
          label,
          lowStockCount: lowStockItems,
          expiringCount: expiringBatchesCount,
          avgDaysLeft: Math.round(avgDaysLeft),
        });
      } catch (error) {
        console.error("Error computing inventory insights:", error);
      } finally {
        setLoading(false);
      }
    };

    computeInsights();
  }, [items, expiringBatchesCount]);

  return { itemInsights, healthScore, loading };
}
