/**
 * REAL Machine Learning Inventory Predictor
 * Uses TensorFlow.js with LSTM neural networks for time series forecasting
 */

import * as tf from '@tensorflow/tfjs';

interface StockHistoryData {
  item_id: string;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  action: string;
  change_type: string | null;
  created_at: string;
}

interface MLPredictionResult {
  predicted_stock: number;
  prediction_confidence: number;
  prediction_trend: 'increasing' | 'decreasing' | 'stable';
  days_until_reorder: number | null;
  model_metrics: {
    training_loss: number;
    training_time_ms: number;
    epochs: number;
    data_points: number;
  };
  method: 'neural_network' | 'statistical';
}

export class RealMLInventoryPredictor {
  private model: tf.LayersModel | null = null;
  
  /**
   * Prepare time series data for neural network training
   */
  private prepareNeuralNetworkData(history: StockHistoryData[]): {
    sequences: number[][];
    targets: number[];
    scaler: { min: number; max: number };
  } {
    // Sort by date and extract quantities
    const sorted = [...history].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    const quantities = sorted.map(h => h.new_quantity);
    
    // Normalize data (important for neural networks)
    const min = Math.min(...quantities);
    const max = Math.max(...quantities);
    const range = max - min || 1;
    
    const normalized = quantities.map(q => (q - min) / range);
    
    // Create sequences (use last 7 days to predict next day)
    const sequenceLength = 7;
    const sequences: number[][] = [];
    const targets: number[] = [];
    
    for (let i = 0; i < normalized.length - sequenceLength; i++) {
      sequences.push(normalized.slice(i, i + sequenceLength));
      targets.push(normalized[i + sequenceLength]);
    }
    
    return {
      sequences,
      targets,
      scaler: { min, max }
    };
  }
  
  /**
   * Build and train LSTM neural network
   */
  async trainLSTMModel(history: StockHistoryData[]): Promise<{
    model: tf.LayersModel;
    loss: number;
    trainingTime: number;
    scaler: { min: number; max: number };
  }> {
    const startTime = Date.now();
    
    // Prepare data
    const { sequences, targets, scaler } = this.prepareNeuralNetworkData(history);
    
    if (sequences.length < 5) {
      throw new Error('Need at least 12 data points for neural network training');
    }
    
    // Build LSTM model
    const model = tf.sequential({
      layers: [
        // LSTM layer - specialized for time series
        tf.layers.lstm({
          units: 32,
          returnSequences: true,
          inputShape: [sequences[0].length, 1],
        }),
        tf.layers.dropout({ rate: 0.2 }), // Prevent overfitting
        tf.layers.lstm({
          units: 16,
          returnSequences: false,
        }),
        tf.layers.dropout({ rate: 0.2 }),
        // Dense layers for final prediction
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 1 }) // Output: predicted quantity
      ]
    });
    
    // Compile model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });
    
    // Prepare tensors - reshape sequences for LSTM input [samples, timesteps, features]
    const reshapedSequences: number[][][] = sequences.map(seq => seq.map(val => [val]));
    const xsTensor = tf.tensor3d(reshapedSequences);
    const ysTensor = tf.tensor2d(targets.map(t => [t]));
    
    // Train the model
    const history_training = await model.fit(xsTensor, ysTensor, {
      epochs: 50,
      batchSize: 4,
      validationSplit: 0.2,
      verbose: 0,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          // Can log progress here if needed
          if (epoch % 10 === 0) {
            console.log(`Epoch ${epoch}: loss = ${logs?.loss.toFixed(4)}`);
          }
        }
      }
    });
    
    // Get final loss
    const finalLoss = history_training.history.loss[history_training.history.loss.length - 1] as number;
    
    // Cleanup tensors
    xsTensor.dispose();
    ysTensor.dispose();
    
    const trainingTime = Date.now() - startTime;
    
    return {
      model,
      loss: finalLoss,
      trainingTime,
      scaler
    };
  }
  
  /**
   * Use trained model to predict future values
   */
  async predictWithNeuralNetwork(
    model: tf.LayersModel,
    recentData: number[],
    scaler: { min: number; max: number },
    daysAhead: number = 30
  ): Promise<number[]> {
    const predictions: number[] = [];
    let currentSequence = [...recentData];
    
    // Normalize current sequence
    const range = scaler.max - scaler.min || 1;
    currentSequence = currentSequence.map(val => (val - scaler.min) / range);
    
    // Predict future values one by one
    for (let i = 0; i < daysAhead; i++) {
      // Take last 7 values
      const inputSequence = currentSequence.slice(-7);
      
      // Create tensor - reshape for LSTM [batch, timesteps, features]
      const reshapedInput: number[][][] = [inputSequence.map(val => [val])];
      const inputTensor = tf.tensor3d(reshapedInput);
      
      // Predict
      const predictionTensor = model.predict(inputTensor) as tf.Tensor;
      const predictionNormalized = (await predictionTensor.data())[0];
      
      // Denormalize
      const predictionActual = predictionNormalized * range + scaler.min;
      predictions.push(Math.max(0, predictionActual));
      
      // Add prediction to sequence for next iteration
      currentSequence.push(predictionNormalized);
      
      // Cleanup
      inputTensor.dispose();
      predictionTensor.dispose();
    }
    
    return predictions;
  }
  
  /**
   * Statistical fallback method (for comparison or when data is insufficient)
   */
  private statisticalPredict(
    currentQuantity: number,
    history: StockHistoryData[],
    daysAhead: number
  ): { prediction: number; confidence: number } {
    if (history.length < 3) {
      return { prediction: currentQuantity, confidence: 30 };
    }
    
    // Calculate daily usage rate
    const sorted = [...history].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    const salesChanges = sorted
      .map(h => h.quantity_change)
      .filter(c => c < 0);
    
    const avgDailyUsage = salesChanges.length > 0
      ? Math.abs(salesChanges.reduce((a, b) => a + b, 0) / salesChanges.length)
      : 0;
    
    // Simple linear projection
    const prediction = Math.max(0, currentQuantity - (avgDailyUsage * daysAhead));
    const confidence = Math.min(95, 40 + (history.length * 3));
    
    return { prediction, confidence };
  }
  
  /**
   * Main prediction function - uses neural network with statistical fallback
   */
  async predictStock(
    currentQuantity: number,
    reorderLevel: number,
    history: StockHistoryData[],
    daysAhead: number = 30,
    useNeuralNetwork: boolean = true
  ): Promise<MLPredictionResult> {
    // Need sufficient data for neural network
    if (history.length < 12 || !useNeuralNetwork) {
      // Fallback to statistical method
      const { prediction, confidence } = this.statisticalPredict(
        currentQuantity,
        history,
        daysAhead
      );
      
      // Determine trend
      const recentData = history.slice(-5).map(h => h.new_quantity);
      const avgRecent = recentData.reduce((a, b) => a + b, 0) / recentData.length;
      let trend: 'increasing' | 'decreasing' | 'stable';
      
      if (avgRecent > currentQuantity + 5) {
        trend = 'increasing';
      } else if (avgRecent < currentQuantity - 5) {
        trend = 'decreasing';
      } else {
        trend = 'stable';
      }
      
      return {
        predicted_stock: Math.round(prediction),
        prediction_confidence: confidence,
        prediction_trend: trend,
        days_until_reorder: null,
        model_metrics: {
          training_loss: 0,
          training_time_ms: 0,
          epochs: 0,
          data_points: history.length
        },
        method: 'statistical'
      };
    }
    
    // Use Neural Network
    try {
      // Train model
      const { model, loss, trainingTime, scaler } = await this.trainLSTMModel(history);
      
      // Get recent data for prediction
      const sorted = [...history].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const recentQuantities = sorted.slice(-7).map(h => h.new_quantity);
      
      // Predict future
      const predictions = await this.predictWithNeuralNetwork(
        model,
        recentQuantities,
        scaler,
        daysAhead
      );
      
      const finalPrediction = predictions[predictions.length - 1];
      
      // Calculate confidence based on training loss
      // Lower loss = higher confidence
      const lossBasedConfidence = Math.max(60, Math.min(95, 100 - (loss * 100)));
      
      // Determine trend
      const trend: 'increasing' | 'decreasing' | 'stable' = 
        finalPrediction > currentQuantity + 5 ? 'increasing' :
        finalPrediction < currentQuantity - 5 ? 'decreasing' : 'stable';
      
      // Calculate days until reorder
      let daysUntilReorder: number | null = null;
      if (finalPrediction < reorderLevel && currentQuantity > reorderLevel) {
        // Estimate when it will hit reorder level
        const stockDecrease = currentQuantity - finalPrediction;
        const dailyDecrease = stockDecrease / daysAhead;
        const stockAboveReorder = currentQuantity - reorderLevel;
        daysUntilReorder = Math.round(stockAboveReorder / dailyDecrease);
      }
      
      // Cleanup model
      model.dispose();
      
      return {
        predicted_stock: Math.round(finalPrediction),
        prediction_confidence: Math.round(lossBasedConfidence),
        prediction_trend: trend,
        days_until_reorder: daysUntilReorder,
        model_metrics: {
          training_loss: parseFloat(loss.toFixed(4)),
          training_time_ms: trainingTime,
          epochs: 50,
          data_points: history.length
        },
        method: 'neural_network'
      };
      
    } catch (error) {
      console.error('Neural network prediction failed, using statistical fallback:', error);
      
      // Fallback to statistical method
      const { prediction, confidence } = this.statisticalPredict(
        currentQuantity,
        history,
        daysAhead
      );
      
      return {
        predicted_stock: Math.round(prediction),
        prediction_confidence: confidence,
        prediction_trend: 'stable',
        days_until_reorder: null,
        model_metrics: {
          training_loss: 0,
          training_time_ms: 0,
          epochs: 0,
          data_points: history.length
        },
        method: 'statistical'
      };
    }
  }
  
  /**
   * Batch prediction for all items
   */
  async predictAllItems(
    items: Array<{ id: string; quantity: number; reorder_level: number }>,
    historyMap: Map<string, StockHistoryData[]>,
    useNeuralNetwork: boolean = true,
    onProgress?: (current: number, total: number) => void
  ): Promise<Map<string, MLPredictionResult>> {
    const predictions = new Map<string, MLPredictionResult>();
    let processed = 0;
    
    for (const item of items) {
      const history = historyMap.get(item.id) || [];
      
      try {
        const prediction = await this.predictStock(
          item.quantity,
          item.reorder_level,
          history,
          30,
          useNeuralNetwork
        );
        predictions.set(item.id, prediction);
      } catch (error) {
        console.error(`Prediction failed for item ${item.id}:`, error);
        // Add fallback prediction
        predictions.set(item.id, {
          predicted_stock: item.quantity,
          prediction_confidence: 30,
          prediction_trend: 'stable',
          days_until_reorder: null,
          model_metrics: {
            training_loss: 0,
            training_time_ms: 0,
            epochs: 0,
            data_points: history.length
          },
          method: 'statistical'
        });
      }
      
      processed++;
      if (onProgress) {
        onProgress(processed, items.length);
      }
    }
    
    return predictions;
  }
}

/**
 * Example usage:
 * 
 * import { RealMLInventoryPredictor } from './real-ml-predictor';
 * 
 * const predictor = new RealMLInventoryPredictor();
 * 
 * // For single item with neural network
 * const result = await predictor.predictStock(
 *   currentQuantity: 100,
 *   reorderLevel: 20,
 *   history: itemHistory,
 *   daysAhead: 30,
 *   useNeuralNetwork: true  // Set false for statistical method
 * );
 * 
 * console.log(`Predicted: ${result.predicted_stock}`);
 * console.log(`Confidence: ${result.prediction_confidence}%`);
 * console.log(`Method: ${result.method}`);
 * console.log(`Training Loss: ${result.model_metrics.training_loss}`);
 */
