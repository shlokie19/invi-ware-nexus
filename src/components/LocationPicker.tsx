import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Location {
  id: string;
  label: string;
  zone: string;
  capacity: number;
  totalQuantity: number;
}

interface LocationPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (locationId: string, locationLabel: string) => void;
  currentLocationId?: string;
}

export function LocationPicker({ open, onOpenChange, onSelect, currentLocationId }: LocationPickerProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;

    const fetchLocations = async () => {
      try {
        const { data: locationData, error: locError } = await supabase
          .from("locations")
          .select("*")
          .order("label");

        if (locError) throw locError;

        const { data: itemData, error: itemError } = await supabase
          .from("items")
          .select("location_id, quantity");

        if (itemError) throw itemError;

        const enrichedLocations = locationData?.map(loc => {
          const locItems = itemData?.filter(item => item.location_id === loc.id) || [];
          const totalQty = locItems.reduce((sum, item) => sum + item.quantity, 0);
          return {
            ...loc,
            totalQuantity: totalQty,
          };
        }) || [];

        setLocations(enrichedLocations);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch locations:", error);
        toast({
          title: "Error",
          description: "Failed to load locations",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    };

    fetchLocations();
  }, [open, toast]);

  const getLocationColor = (location: Location) => {
    const utilizationPercent = (location.totalQuantity / location.capacity) * 100;
    if (location.id === currentLocationId) return "bg-primary/20 border-primary ring-2 ring-primary";
    if (utilizationPercent === 0) return "bg-muted hover:bg-muted/80";
    if (utilizationPercent < 75) return "bg-warning/30 hover:bg-warning/40 border-warning";
    return "bg-destructive/30 hover:bg-destructive/40 border-destructive";
  };

  const zones = ["Zone A", "Zone B", "Zone C"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Select Storage Location
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-4 items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-muted border rounded" />
                <span>Empty</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-warning/30 border border-warning rounded" />
                <span>&lt;75%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-destructive/30 border border-destructive rounded" />
                <span>≥75%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-primary/20 border-primary ring-2 ring-primary rounded" />
                <span>Current</span>
              </div>
            </div>

            {zones.map(zone => {
              const zoneLocations = locations.filter(loc => loc.zone === zone);
              return (
                <Card key={zone}>
                  <CardHeader>
                    <CardTitle className="text-base">{zone}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                      {zoneLocations.map(location => (
                        <button
                          key={location.id}
                          onClick={() => {
                            onSelect(location.id, location.label);
                            onOpenChange(false);
                          }}
                          className={`aspect-square rounded-lg border-2 p-2 transition-all ${getLocationColor(location)} flex flex-col items-center justify-center`}
                        >
                          <span className="font-bold text-xs">{location.label}</span>
                          <span className="text-[10px] text-muted-foreground mt-1">
                            {location.totalQuantity}/{location.capacity}
                          </span>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
