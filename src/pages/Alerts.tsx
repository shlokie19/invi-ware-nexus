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

export default function Alerts() {
  const alerts: Alert[] = [];
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
            {alerts.filter((a) => a.severity === "critical" && !a.resolved).length} Critical
          </Badge>
          <Badge variant="outline" className="h-8 border-warning text-warning">
            {alerts.filter((a) => a.severity === "warning" && !a.resolved).length} Warning
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        {alerts.length === 0 ? (
          <Card className="border-primary/20">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No alerts at this time</p>
            </CardContent>
          </Card>
        ) : (
          alerts.map((alert) => (
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
          ))
        )}
      </div>
    </div>
  );
}
