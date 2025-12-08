import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, MapPin } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { locationsDB, itemsDB, subcategoriesDB, categoriesDB, stockHistoryDB, initializeData } from "@/lib/linkedList";

interface Location {
  id: string;
  label: string;
  zone: string;
  capacity: number;
  items: any[];
  totalVolume: number;
}

export default function WarehouseMap() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [itemToMove, setItemToMove] = useState<any>(null);
  const [targetLocationId, setTargetLocationId] = useState<string>("");
  const { toast } = useToast();

  const fetchLocations = () => {
    try {
      initializeData();
      
      const locationData = locationsDB.getAll();
      const itemData = itemsDB.getAll();
      const subcategories = subcategoriesDB.getAll();
      const categories = categoriesDB.getAll();

      const enrichedLocations = locationData.map(loc => {
        const locItems = itemData
          .filter(item => item.location_id === loc.id)
          .map(item => {
            const subcategory = subcategories.find(s => s.id === item.subcategory_id);
            const category = subcategory ? categories.find(c => c.id === subcategory.category_id) : null;
            return {
              ...item,
              volumePerUnit: item.volume_per_unit || 1,
              subcategories: subcategory ? {
                name: subcategory.name,
                categories: category ? { name: category.name } : null
              } : null
            };
          });
        // Calculate total volume instead of quantity
        const totalVolume = locItems.reduce((sum, item) => sum + (item.quantity * (item.volumePerUnit || 1)), 0);
        return {
          ...loc,
          zone: loc.zone || 'Zone A',
          items: locItems,
          totalVolume: totalVolume,
        };
      });

      setLocations(enrichedLocations);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch warehouse data:", error);
      toast({
        title: "Error",
        description: "Failed to load warehouse map",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();

    const unsubItems = itemsDB.subscribe(fetchLocations);
    const unsubLocations = locationsDB.subscribe(fetchLocations);

    return () => {
      unsubItems();
      unsubLocations();
    };
  }, []);

  const getLocationColor = (location: Location) => {
    const utilizationPercent = (location.totalVolume / location.capacity) * 100;
    if (utilizationPercent === 0) return "bg-muted hover:bg-muted/80";
    if (utilizationPercent < 75) return "bg-warning/30 hover:bg-warning/40 border-warning";
    return "bg-destructive/30 hover:bg-destructive/40 border-destructive";
  };

  const handleMoveItem = () => {
    if (!itemToMove || !targetLocationId) return;

    try {
      const oldLocation = locations.find(loc => loc.id === itemToMove.location_id);
      const newLocation = locations.find(loc => loc.id === targetLocationId);

      if (!newLocation) {
        toast({
          title: "Error",
          description: "Target location not found",
          variant: "destructive",
        });
        return;
      }

      // Check if moving would exceed capacity (using volume)
      const itemVolume = itemToMove.quantity * (itemToMove.volumePerUnit || 1);
      const newTotalAfterMove = newLocation.totalVolume + itemVolume;
      if (newTotalAfterMove > newLocation.capacity) {
        const availableSpace = newLocation.capacity - newLocation.totalVolume;
        toast({
          title: "Capacity Exceeded",
          description: `Cannot move item (volume: ${itemVolume.toFixed(1)}). ${newLocation.label} only has ${availableSpace.toFixed(1)} units of space available.`,
          variant: "destructive",
        });
        return;
      }

      itemsDB.update(itemToMove.id, { location_id: targetLocationId });

      stockHistoryDB.create({
        item_id: itemToMove.id,
        quantity_change: 0,
        previous_quantity: itemToMove.quantity,
        new_quantity: itemToMove.quantity,
        action: "UPDATE",
        change_type: "move",
        note: `Moved from ${oldLocation?.label || "unassigned"} to ${newLocation.label}`,
        notes: null,
      });

      toast({
        title: "Success",
        description: `Item moved to ${newLocation.label}`,
      });

      setMoveDialogOpen(false);
      setItemToMove(null);
      setTargetLocationId("");
      fetchLocations();
    } catch (error) {
      console.error("Failed to move item:", error);
      toast({
        title: "Error",
        description: "Failed to move item",
        variant: "destructive",
      });
    }
  };

  // Get zones dynamically from categories
  const zones = [...new Set(locations.map(loc => loc.zone).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Warehouse Map</h1>
          <p className="text-muted-foreground">Visual layout of storage locations</p>
        </div>
        <div className="flex gap-4 items-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-muted border rounded" />
            <span className="text-foreground font-medium">Empty</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-warning/30 border border-warning rounded" />
            <span className="text-foreground font-medium">&lt;75% Full</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-destructive/30 border border-destructive rounded" />
            <span className="text-foreground font-medium">≥75% Full</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-8">
          {zones.map(zone => {
            const zoneLocations = locations.filter(loc => loc.zone === zone);
            return (
              <Card key={zone}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {zone}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                    {zoneLocations.map(location => (
                      <button
                        key={location.id}
                        onClick={() => setSelectedLocation(location)}
                        className={`aspect-square rounded-lg border-2 p-2 transition-all ${getLocationColor(location)} flex flex-col items-center justify-center`}
                      >
                        <span className="font-bold text-sm">{location.label}</span>
                        <span className="text-xs text-muted-foreground mt-1">
                          {location.totalVolume.toFixed(0)}/{location.capacity}
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

      <Sheet open={!!selectedLocation} onOpenChange={() => setSelectedLocation(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Location {selectedLocation?.label}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Zone</p>
                <p className="font-medium">{selectedLocation?.zone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Capacity (Volume)</p>
                <p className="font-medium">
                  {selectedLocation?.totalVolume.toFixed(1)} / {selectedLocation?.capacity}
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Items in this location</h3>
              {selectedLocation?.items && selectedLocation.items.length > 0 ? (
                <div className="space-y-3">
                  {selectedLocation.items.map((item: any) => (
                    <div key={item.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.sku && (
                            <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                          )}
                          <p className="text-xs text-muted-foreground">Vol/unit: {item.volumePerUnit || 1}</p>
                        </div>
                        <Badge variant="secondary">{item.quantity} units</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setItemToMove(item);
                          setMoveDialogOpen(true);
                        }}
                      >
                        Move Item
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No items in this location</p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Item</p>
              <p className="font-medium">{itemToMove?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Select new location</p>
              <Select value={targetLocationId} onValueChange={setTargetLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.label} - {loc.zone} ({loc.totalVolume.toFixed(0)}/{loc.capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleMoveItem}
                disabled={!targetLocationId}
              >
                Confirm Move
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => {
                  setMoveDialogOpen(false);
                  setItemToMove(null);
                  setTargetLocationId("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
