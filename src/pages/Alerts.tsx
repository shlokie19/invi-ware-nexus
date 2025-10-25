import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, AlertCircle, Info, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Alert {
  id: number;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  timestamp: string;
  category: string;
  resolved: boolean;
}

const mockAlerts: Alert[] = [
  {
    id: 1,
    title: "Critical Low Stock Alert",
    description: "Samsung Galaxy S24 stock has dropped below minimum threshold (12 units remaining)",
    severity: "critical",
    timestamp: "2024-10-25 14:30",
    category: "Inventory",
    resolved: false,
  },
  {
    id: 2,
    title: "Fake Product Detected",
    description: "CNN verification system flagged product ID PRD-8821 as potentially counterfeit",
    severity: "critical",
    timestamp: "2024-10-25 13:15",
    category: "Verification",
    resolved: false,
  },
  {
    id: 3,
    title: "Weight Sensor Triggered",
    description: "Unexpected weight change detected in Batch B-234 (Electronics section)",
    severity: "warning",
    timestamp: "2024-10-25 12:45",
    category: "Hardware",
    resolved: false,
  },
  {
    id: 4,
    title: "Batch Expiry Approaching",
    description: "Batch BATCH-005 (Bottled Water) will expire in 7 days",
    severity: "warning",
    timestamp: "2024-10-25 10:00",
    category: "Inventory",
    resolved: false,
  },
  {
    id: 5,
    title: "Stock Prediction Update",
    description: "ML model predicts 15% growth in Electronics category over next 7 days",
    severity: "info",
    timestamp: "2024-10-25 09:00",
    category: "Analytics",
    resolved: false,
  },
  {
    id: 6,
    title: "Unauthorized Access Attempt",
    description: "Multiple failed login attempts detected from IP 192.168.1.105",
    severity: "critical",
    timestamp: "2024-10-24 18:20",
    category: "Security",
    resolved: true,
  },
];

export default function Alerts() {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-5 w-5" />;
      case "warning":
        return <AlertCircle className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "critical":
        return "border-destructive/50 bg-destructive/10 text-destructive";
      case "warning":
        return "border-warning/50 bg-warning/10 text-warning";
      default:
        return "border-primary/50 bg-primary/10 text-primary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Alerts & Notifications</h1>
          <p className="text-muted-foreground">Real-time system alerts and warnings</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="destructive" className="h-8">
            {mockAlerts.filter((a) => a.severity === "critical" && !a.resolved).length} Critical
          </Badge>
          <Badge variant="outline" className="h-8 border-warning text-warning">
            {mockAlerts.filter((a) => a.severity === "warning" && !a.resolved).length} Warning
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        {mockAlerts.map((alert) => (
          <Card
            key={alert.id}
            className={`border-2 transition-all hover:shadow-lg ${
              alert.resolved ? "opacity-60" : getSeverityStyles(alert.severity)
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-1">{getSeverityIcon(alert.severity)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{alert.title}</h3>
                      {alert.resolved && (
                        <Badge variant="outline" className="border-success text-success">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Resolved
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 mb-2">{alert.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{alert.timestamp}</span>
                      <Badge variant="secondary" className="text-xs">
                        {alert.category}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!alert.resolved && (
                    <>
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                      <Button size="sm" className="bg-primary hover:bg-primary/90">
                        Acknowledge
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
