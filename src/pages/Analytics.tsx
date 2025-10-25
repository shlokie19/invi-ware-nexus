import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

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

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">ML-driven insights and predictions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Export Report</Button>
          <Button className="bg-primary hover:bg-primary/90">Refresh Data</Button>
        </div>
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
              <CardTitle>Stock Level Prediction (ML Model)</CardTitle>
              <p className="text-sm text-muted-foreground">
                7-day forecast using LSTM neural network
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={predictionData}>
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
                  Prediction Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">94.2%</div>
                <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
              </CardContent>
            </Card>
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Forecast Confidence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">89%</div>
                <p className="text-xs text-muted-foreground mt-1">Next 7 days</p>
              </CardContent>
            </Card>
            <Card className="border-warning/20 bg-warning/5">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Model Last Updated
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-warning">2h ago</div>
                <p className="text-xs text-muted-foreground mt-1">Auto-retrained daily</p>
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
