/**
 * ML-powered inventory prediction system
 * Uses statistical analysis and time series forecasting
 * No external dependencies required - uses pure TypeScript
 */

interface StockHistoryData {
  item_id: string;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  action: string;
  change_type: string | null;
  note: string | null;
  notes: string | null;
  created_at: string;
}

interface PredictionResult {
  predicted_stock: number;
  prediction_confidence: number;
  prediction_trend: 'increasing' | 'decreasing' | 'stable';
  days_until_reorder: number | null;
  prediction_details: {
    daily_usage_rate: number;
    trend_direction: number;
    volatility: number;
  };
}

/**
 * Main class for inventory predictions
 */
export class InventoryPredictor {
  /**
   * Prepare time series data from stock history
   */
  private prepareTimeSeriesData(history: StockHistoryData[]): {
    dates: Date[];
    quantities: number[];
    changes: number[];
  } {
    // Sort by date
    const sorted = [...history].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const dates = sorted.map(h => new Date(h.created_at));
    const quantities = sorted.map(h => h.new_quantity);
    const changes = sorted.map(h => h.quantity_change);

    return { dates, quantities, changes };
  }

  /**
   * Calculate daily aggregated data (handles multiple transactions per day)
   */
  private aggregateDailyData(
    dates: Date[],
    quantities: number[],
    changes: number[]
  ): { dailyDates: Date[]; dailyQuantities: number[]; dailyChanges: number[] } {
    const dailyMap = new Map<string, { quantity: number; totalChange: number; count: number }>();

    dates.forEach((date, idx) => {
      const dateKey = date.toISOString().split('T')[0];
      const existing = dailyMap.get(dateKey) || { quantity: 0, totalChange: 0, count: 0 };
      
      dailyMap.set(dateKey, {
        quantity: quantities[idx], // Use latest quantity for that day
        totalChange: existing.totalChange + changes[idx],
        count: existing.count + 1
      });
    });

    const sortedEntries = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    return {
      dailyDates: sortedEntries.map(([dateStr]) => new Date(dateStr)),
      dailyQuantities: sortedEntries.map(([, data]) => data.quantity),
      dailyChanges: sortedEntries.map(([, data]) => data.totalChange)
    };
  }

  /**
   * Calculate statistics from historical data
   */
  private calculateStatistics(quantities: number[], changes: number[]) {
    // Average daily usage (negative changes = consumption)
    const salesChanges = changes.filter(c => c < 0);
    const avgDailyUsage = salesChanges.length > 0
      ? Math.abs(salesChanges.reduce((a, b) => a + b, 0) / salesChanges.length)
      : 0;

    // Trend calculation (linear regression slope)
    const n = quantities.length;
    if (n < 2) {
      return { avgDailyUsage, trend: 0, volatility: 0 };
    }

    const xMean = (n - 1) / 2;
    const yMean = quantities.reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (quantities[i] - yMean);
      denominator += (i - xMean) ** 2;
    }
    
    const trend = denominator !== 0 ? numerator / denominator : 0;

    // Volatility (standard deviation of changes)
    const changeMean = changes.reduce((a, b) => a + b, 0) / changes.length;
    const variance = changes.reduce((sum, c) => sum + (c - changeMean) ** 2, 0) / changes.length;
    const volatility = Math.sqrt(variance);

    return { avgDailyUsage, trend, volatility };
  }

  /**
   * Predict future stock levels using statistical forecasting
   */
  async predictStock(
    currentQuantity: number,
    reorderLevel: number,
    history: StockHistoryData[],
    daysAhead: number = 30
  ): Promise<PredictionResult> {
    // Need at least 3 data points for meaningful prediction
    if (history.length < 3) {
      return {
        predicted_stock: currentQuantity,
        prediction_confidence: 30,
        prediction_trend: 'stable',
        days_until_reorder: null,
        prediction_details: {
          daily_usage_rate: 0,
          trend_direction: 0,
          volatility: 0
        }
      };
    }

    // Prepare data
    const { dates, quantities, changes } = this.prepareTimeSeriesData(history);
    const { dailyDates, dailyQuantities, dailyChanges } = this.aggregateDailyData(
      dates,
      quantities,
      changes
    );

    // Calculate statistics
    const stats = this.calculateStatistics(dailyQuantities, dailyChanges);

    // Predict future stock using trend + usage rate
    const predictedStock = Math.max(
      0,
      Math.round(currentQuantity + (stats.trend * daysAhead) - (stats.avgDailyUsage * daysAhead))
    );

    // Calculate confidence based on data quality
    const dataPoints = dailyQuantities.length;
    const baseConfidence = Math.min(95, 40 + (dataPoints * 5)); // More data = higher confidence
    const volatilityPenalty = Math.min(30, stats.volatility * 2); // High volatility = lower confidence
    const confidence = Math.max(30, Math.round(baseConfidence - volatilityPenalty));

    // Determine trend
    let predictionTrend: 'increasing' | 'decreasing' | 'stable';
    if (stats.trend > 1) {
      predictionTrend = 'increasing';
    } else if (stats.trend < -1) {
      predictionTrend = 'decreasing';
    } else {
      predictionTrend = 'stable';
    }

    // Calculate days until reorder needed
    let daysUntilReorder: number | null = null;
    if (stats.avgDailyUsage > 0 && currentQuantity > reorderLevel) {
      const stockAboveReorder = currentQuantity - reorderLevel;
      daysUntilReorder = Math.round(stockAboveReorder / stats.avgDailyUsage);
    }

    return {
      predicted_stock: predictedStock,
      prediction_confidence: confidence,
      prediction_trend: predictionTrend,
      days_until_reorder: daysUntilReorder,
      prediction_details: {
        daily_usage_rate: Math.round(stats.avgDailyUsage * 10) / 10,
        trend_direction: Math.round(stats.trend * 100) / 100,
        volatility: Math.round(stats.volatility * 10) / 10
      }
    };
  }

  /**
   * Batch predict for all items
   */
  async predictAllItems(
    items: Array<{ id: string; quantity: number; reorder_level: number }>,
    historyMap: Map<string, StockHistoryData[]>
  ): Promise<Map<string, PredictionResult>> {
    const predictions = new Map<string, PredictionResult>();

    for (const item of items) {
      const history = historyMap.get(item.id) || [];
      const prediction = await this.predictStock(
        item.quantity,
        item.reorder_level,
        history
      );
      predictions.set(item.id, prediction);
    }

    return predictions;
  }
}
