import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, TrendingUp, Layers } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const stockData = [
  { name: "Mon", stock: 450 },
  { name: "Tue", stock: 420 },
  { name: "Wed", stock: 390 },
  { name: "Thu", stock: 370 },
  { name: "Fri", stock: 340 },
  { name: "Sat", stock: 310 },
  { name: "Sun", stock: 290 },
];

const categoryData = [
  { name: "Electronics", items: 145 },
  { name: "Food", items: 230 },
  { name: "Clothing", items: 180 },
  { name: "Medical", items: 95 },
  { name: "Hardware", items: 120 },
];

const recentAlerts = [
  { id: 1, message: "Low stock detected: Category Electronics", time: "5 min ago", severity: "warning" },
  { id: 2, message: "Fake product detected in verification", time: "12 min ago", severity: "error" },
  { id: 3, message: "Weight sensor triggered: Batch B-234", time: "1 hour ago", severity: "info" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Overview</h1>
        <p className="text-muted-foreground">Monitor your warehouse inventory in real-time</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Items" value="770" icon={Package} trend="+12% from last week" />
        <StatCard title="Categories" value="12" icon={Layers} variant="success" />
        <StatCard title="Low Stock Alerts" value="8" icon={AlertTriangle} variant="warning" />
        <StatCard title="Predicted Growth" value="+15%" icon={TrendingUp} variant="success" trend="Next 7 days" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Stock Prediction Trend</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Category Distribution</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentAlerts.map((alert) => (
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
        </CardContent>
      </Card>
    </div>
  );
}
