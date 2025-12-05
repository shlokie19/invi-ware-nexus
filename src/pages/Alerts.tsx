import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, AlertCircle, Info, CheckCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { itemsDB, batchesDB, initializeData } from "@/lib/linkedList";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  timestamp: string;
  category: string;
  resolved: boolean;
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchAlerts = () => {
    try {
      initializeData();
      const alertsList: Alert[] = [];

      // Get low stock items
      const items = itemsDB.getAll();
      items.forEach((item) => {
        if (item.quantity <= item.reorder_level) {
          alertsList.push({
            id: `item-${item.id}`,
            title: `Low Stock: ${item.name}`,
            description: `Current stock: ${item.quantity} units (Reorder level: ${item.reorder_level})`,
            severity: item.quantity === 0 ? "critical" : "warning",
            timestamp: new Date().toLocaleString(),
            category: "Inventory",
            resolved: false,
          });
        }
      });

      // Get expiring batches (within 7 days)
      const expiringBatches = batchesDB.getExpiringSoon(7);
      expiringBatches.forEach((batch) => {
        const item = items.find(i => i.id === batch.item_id);
        if (batch.expiry_date) {
          const daysUntilExpiry = Math.ceil(
            (new Date(batch.expiry_date).getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24)
          );
          alertsList.push({
            id: `batch-${batch.id}`,
            title: `Expiring Soon: ${item?.name || "Unknown Item"}`,
            description: `Batch ${batch.batch_number} expires in ${daysUntilExpiry} day(s) (${batch.quantity} units)`,
            severity: daysUntilExpiry <= 3 ? "critical" : "warning",
            timestamp: new Date().toLocaleString(),
            category: "Expiry",
            resolved: false,
          });
        }
      });

      // Sort by severity (critical first)
      alertsList.sort((a, b) => {
        if (a.severity === "critical" && b.severity !== "critical") return -1;
        if (a.severity !== "critical" && b.severity === "critical") return 1;
        return 0;
      });

      setAlerts(alertsList);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
      toast({
        title: "Error",
        description: "Failed to load alerts",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    const unsubItems = itemsDB.subscribe(fetchAlerts);
    const unsubBatches = batchesDB.subscribe(fetchAlerts);

    return () => {
      unsubItems();
      unsubBatches();
    };
  }, []);

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

  const handleViewDetails = (alert: Alert) => {
    setSelectedAlert(alert);
  };

  const handleAcknowledge = (alertId: string) => {
    setAcknowledgedAlerts(prev => new Set(prev).add(alertId));
    toast({
      title: "Alert Acknowledged",
      description: "The alert has been marked as resolved.",
    });
  };

  const handleGoToInventory = () => {
    setSelectedAlert(null);
    navigate("/inventory");
  };

  const isAlertResolved = (alert: Alert) => {
    return alert.resolved || acknowledgedAlerts.has(alert.id);
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
            {alerts.filter((a) => a.severity === "critical" && !isAlertResolved(a)).length} Critical
          </Badge>
          <Badge variant="outline" className="h-8 border-warning text-warning">
            {alerts.filter((a) => a.severity === "warning" && !isAlertResolved(a)).length} Warning
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <Card className="border-primary/20">
            <CardContent className="p-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        ) : alerts.length === 0 ? (
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
              isAlertResolved(alert) ? "opacity-60" : getSeverityStyles(alert.severity)
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-1">{getSeverityIcon(alert.severity)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{alert.title}</h3>
                      {isAlertResolved(alert) && (
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
                  {!isAlertResolved(alert) && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleViewDetails(alert)}>
                        View Details
                      </Button>
                      <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => handleAcknowledge(alert.id)}>
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

      {/* Alert Details Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAlert && getSeverityIcon(selectedAlert.severity)}
              {selectedAlert?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedAlert?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Category:</span>
                <p className="font-medium">{selectedAlert?.category}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Severity:</span>
                <p className="font-medium capitalize">{selectedAlert?.severity}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Detected:</span>
                <p className="font-medium">{selectedAlert?.timestamp}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setSelectedAlert(null)}>
                Close
              </Button>
              <Button onClick={handleGoToInventory}>
                Go to Inventory
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
