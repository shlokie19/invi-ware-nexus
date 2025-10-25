import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Gauge, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const sensorData = [
  { time: "10:00", weight: 245, threshold: 250 },
  { time: "10:15", weight: 243, threshold: 250 },
  { time: "10:30", weight: 241, threshold: 250 },
  { time: "10:45", weight: 238, threshold: 250 },
  { time: "11:00", weight: 235, threshold: 250 },
  { time: "11:15", weight: 220, threshold: 250 },
  { time: "11:30", weight: 225, threshold: 250 },
];

const hardwareStatus = [
  {
    id: "sensor-1",
    name: "Weight Sensor Alpha",
    location: "Shelf A-12, Electronics Section",
    status: "warning",
    currentWeight: 225,
    expectedWeight: 250,
    lastReading: "2 min ago",
  },
  {
    id: "sensor-2",
    name: "Weight Sensor Beta",
    location: "Shelf B-08, Food Section",
    status: "normal",
    currentWeight: 480,
    expectedWeight: 490,
    lastReading: "1 min ago",
  },
  {
    id: "sensor-3",
    name: "Weight Sensor Gamma",
    location: "Shelf C-15, Medical Section",
    status: "normal",
    currentWeight: 320,
    expectedWeight: 325,
    lastReading: "3 min ago",
  },
];

export default function Hardware() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Hardware Status Monitor</h1>
        <p className="text-muted-foreground">Real-time sensor data and Arduino integration</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Sensors
            </CardTitle>
            <Activity className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">3/3</div>
            <p className="text-xs text-muted-foreground mt-1">All systems operational</p>
          </CardContent>
        </Card>

        <Card className="border-warning/20 bg-warning/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Alerts
            </CardTitle>
            <AlertCircle className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">1</div>
            <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
          </CardContent>
        </Card>

        <Card className="border-success/20 bg-success/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              System Uptime
            </CardTitle>
            <Gauge className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">99.8%</div>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle>Weight Sensor Readings (Sensor Alpha)</CardTitle>
          <p className="text-sm text-muted-foreground">Real-time monitoring of shelf weight</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={sensorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                name="Current Weight (kg)"
              />
              <Line
                type="monotone"
                dataKey="threshold"
                stroke="hsl(var(--destructive))"
                strokeDasharray="5 5"
                strokeWidth={2}
                name="Alert Threshold"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Sensor Status Overview</h2>
        {hardwareStatus.map((sensor) => (
          <Card
            key={sensor.id}
            className={`border-2 ${
              sensor.status === "warning"
                ? "border-warning/50 bg-warning/5"
                : "border-primary/20"
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{sensor.name}</h3>
                    <Badge
                      variant={sensor.status === "warning" ? "destructive" : "secondary"}
                      className={
                        sensor.status === "warning"
                          ? "bg-warning text-warning-foreground"
                          : ""
                      }
                    >
                      {sensor.status === "warning" ? "Alert" : "Normal"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{sensor.location}</p>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Current Weight:</span>
                      <span className="font-medium ml-2">{sensor.currentWeight} kg</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expected:</span>
                      <span className="font-medium ml-2">{sensor.expectedWeight} kg</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last Reading:</span>
                      <span className="font-medium ml-2">{sensor.lastReading}</span>
                    </div>
                  </div>
                </div>
                {sensor.status === "warning" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      View Details
                    </Button>
                    <Button size="sm" className="bg-warning hover:bg-warning/90">
                      Acknowledge
                    </Button>
                  </div>
                )}
              </div>
              {sensor.status === "warning" && (
                <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    <span>
                      <strong>Alert:</strong> Weight dropped below threshold. Possible unauthorized
                      item removal detected. Buzzer activated.
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
