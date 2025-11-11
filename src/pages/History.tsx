import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Download, Search, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";

interface HistoryRecord {
  id: string;
  created_at: string;
  item_id: string;
  item_name: string;
  sku: string;
  unit: string;
  category_name: string;
  subcategory_name: string;
  change_type: string;
  quantity_changed: number;
  new_quantity_after_change: number;
  supplier_name: string | null;
  note: string | null;
}

interface Filters {
  dateFrom: string;
  dateTo: string;
  changeTypes: string[];
  category: string;
  subcategory: string;
  item: string;
  supplier: string;
  search: string;
}

interface Totals {
  totalSales: number;
  totalRestocks: number;
  netMovement: number;
}

const ITEMS_PER_PAGE = 25;

export default function History() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [totals, setTotals] = useState<Totals>({ totalSales: 0, totalRestocks: 0, netMovement: 0 });

  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [subcategories, setSubcategories] = useState<Array<{ id: string; name: string }>>([]);
  const [items, setItems] = useState<Array<{ id: string; name: string; sku: string }>>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);

  const [filters, setFilters] = useState<Filters>({
    dateFrom: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    dateTo: format(new Date(), "yyyy-MM-dd"),
    changeTypes: [],
    category: "all",
    subcategory: "all",
    item: "all",
    supplier: "all",
    search: "",
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [records, filters]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load categories
      const { data: categoriesData } = await supabase.from("categories").select("id, name").order("name");
      if (categoriesData) setCategories(categoriesData);

      // Load subcategories
      const { data: subcategoriesData } = await supabase.from("subcategories").select("id, name").order("name");
      if (subcategoriesData) setSubcategories(subcategoriesData);

      // Load items
      const { data: itemsData } = await supabase.from("items").select("id, name, sku").order("name");
      if (itemsData) setItems(itemsData);

      // Load history
      await loadHistory();
    } catch (error) {
      console.error("Error loading data:", error);
      toast({ title: "Error", description: "Failed to load history data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("vw_stock_history_detailed")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        setRecords(data as HistoryRecord[]);
        // Extract unique suppliers
        const uniqueSuppliers = Array.from(new Set(data.map((r: any) => r.supplier_name).filter(Boolean))) as string[];
        setSuppliers(uniqueSuppliers);
      }
    } catch (error) {
      console.error("Error loading history:", error);
      toast({ title: "Error", description: "Failed to load transaction history", variant: "destructive" });
    }
  };

  const applyFilters = () => {
    let filtered = [...records];

    // Date range
    if (filters.dateFrom) {
      filtered = filtered.filter((r) => new Date(r.created_at) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((r) => new Date(r.created_at) <= endDate);
    }

    // Change types
    if (filters.changeTypes.length > 0) {
      filtered = filtered.filter((r) => filters.changeTypes.includes(r.change_type));
    }

    // Category
    if (filters.category && filters.category !== "all") {
      filtered = filtered.filter((r) => r.category_name === filters.category);
    }

    // Subcategory
    if (filters.subcategory && filters.subcategory !== "all") {
      filtered = filtered.filter((r) => r.subcategory_name === filters.subcategory);
    }

    // Item
    if (filters.item && filters.item !== "all") {
      filtered = filtered.filter((r) => r.item_id === filters.item);
    }

    // Supplier
    if (filters.supplier && filters.supplier !== "all") {
      filtered = filtered.filter((r) => r.supplier_name === filters.supplier);
    }

    // Search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.item_name.toLowerCase().includes(searchLower) ||
          r.sku.toLowerCase().includes(searchLower) ||
          (r.note && r.note.toLowerCase().includes(searchLower))
      );
    }

    setFilteredRecords(filtered);
    setCurrentPage(1);
    calculateTotals(filtered);
  };

  const calculateTotals = (data: HistoryRecord[]) => {
    const totalSales = Math.abs(
      data.filter((r) => r.change_type === "sale").reduce((sum, r) => sum + r.quantity_changed, 0)
    );
    const totalRestocks = data
      .filter((r) => r.change_type === "restock" || r.quantity_changed > 0)
      .reduce((sum, r) => sum + Math.abs(r.quantity_changed), 0);
    const netMovement = data.reduce((sum, r) => sum + r.quantity_changed, 0);

    setTotals({ totalSales, totalRestocks, netMovement });
  };

  const handleExportCSV = () => {
    const headers = [
      "Date/Time",
      "Item",
      "SKU",
      "Category",
      "Subcategory",
      "Change Type",
      "Qty Change",
      "New Qty",
      "Supplier",
      "Note",
    ];

    const rows = filteredRecords.map((r) => [
      format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss"),
      r.item_name,
      r.sku,
      r.category_name,
      r.subcategory_name,
      r.change_type,
      r.quantity_changed.toString(),
      r.new_quantity_after_change.toString(),
      r.supplier_name || "",
      r.note || "",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: "Success", description: "History exported successfully" });
  };

  const getChangeTypeBadge = (type: string) => {
    const styles: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      sale: { variant: "destructive", label: "Sale" },
      restock: { variant: "default", label: "Restock" },
      damaged: { variant: "destructive", label: "Damaged" },
      adjustment: { variant: "secondary", label: "Adjustment" },
    };
    const config = styles[type] || { variant: "outline" as const, label: type };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getQuantityDisplay = (qty: number) => {
    const isNegative = qty < 0;
    return (
      <span className={isNegative ? "text-destructive font-semibold" : "text-success font-semibold"}>
        {qty > 0 ? `+${qty}` : qty}
      </span>
    );
  };

  const toggleChangeType = (type: string) => {
    setFilters((prev) => ({
      ...prev,
      changeTypes: prev.changeTypes.includes(type)
        ? prev.changeTypes.filter((t) => t !== type)
        : [...prev.changeTypes, type],
    }));
  };

  const paginatedRecords = filteredRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Transaction History</h1>
          <p className="text-muted-foreground">View all stock movements, sales, and adjustments</p>
        </div>
        <Button onClick={handleExportCSV} disabled={filteredRecords.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{totals.totalSales}</div>
            <p className="text-xs text-muted-foreground">Units sold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Restocks</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{totals.totalRestocks}</div>
            <p className="text-xs text-muted-foreground">Units added</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Movement</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.netMovement >= 0 ? "text-success" : "text-destructive"}`}>
              {totals.netMovement > 0 ? `+${totals.netMovement}` : totals.netMovement}
            </div>
            <p className="text-xs text-muted-foreground">Overall change</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Refine your search to find specific transactions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date From</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date To</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={filters.category} onValueChange={(value) => setFilters({ ...filters, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Subcategory</label>
              <Select
                value={filters.subcategory}
                onValueChange={(value) => setFilters({ ...filters, subcategory: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All subcategories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subcategories</SelectItem>
                  {subcategories.map((sub) => (
                    <SelectItem key={sub.id} value={sub.name}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Item</label>
              <Select value={filters.item} onValueChange={(value) => setFilters({ ...filters, item: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All items" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items</SelectItem>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Supplier</label>
              <Select value={filters.supplier} onValueChange={(value) => setFilters({ ...filters, supplier: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All suppliers</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier} value={supplier}>
                      {supplier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search item name, SKU, or note..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Change Type</label>
            <div className="flex flex-wrap gap-2">
              {["sale", "restock", "damaged", "adjustment"].map((type) => (
                <Badge
                  key={type}
                  variant={filters.changeTypes.includes(type) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleChangeType(type)}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Badge>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() =>
              setFilters({
                dateFrom: format(subDays(new Date(), 30), "yyyy-MM-dd"),
                dateTo: format(new Date(), "yyyy-MM-dd"),
                changeTypes: [],
                category: "all",
                subcategory: "all",
                item: "all",
                supplier: "all",
                search: "",
              })
            }
          >
            Reset Filters
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions ({filteredRecords.length})</CardTitle>
          <CardDescription>Click on a row to view full details</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No transactions match your filters.</div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date/Time</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty Change</TableHead>
                      <TableHead className="text-right">New Qty</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRecords.map((record) => (
                      <TableRow
                        key={record.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedRecord(record)}
                      >
                        <TableCell className="font-medium">
                          {format(new Date(record.created_at), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{record.item_name}</div>
                            <div className="text-xs text-muted-foreground">{record.sku}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {record.category_name} › {record.subcategory_name}
                          </div>
                        </TableCell>
                        <TableCell>{getChangeTypeBadge(record.change_type)}</TableCell>
                        <TableCell className="text-right">{getQuantityDisplay(record.quantity_changed)}</TableCell>
                        <TableCell className="text-right">{record.new_quantity_after_change}</TableCell>
                        <TableCell>{record.supplier_name || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={record.note || ""}>
                          {record.note || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)} of {filteredRecords.length}{" "}
                    transactions
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Details Sheet */}
      <Sheet open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Transaction Details</SheetTitle>
            <SheetDescription>Full information about this stock movement</SheetDescription>
          </SheetHeader>
          {selectedRecord && (
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Date & Time</label>
                <p className="text-sm">{format(new Date(selectedRecord.created_at), "PPpp")}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Item</label>
                <p className="text-sm font-medium">{selectedRecord.item_name}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">SKU</label>
                <p className="text-sm">{selectedRecord.sku}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Unit</label>
                <p className="text-sm">{selectedRecord.unit}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Category</label>
                <p className="text-sm">
                  {selectedRecord.category_name} › {selectedRecord.subcategory_name}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Change Type</label>
                <div className="mt-1">{getChangeTypeBadge(selectedRecord.change_type)}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Quantity Changed</label>
                <p className="text-sm">{getQuantityDisplay(selectedRecord.quantity_changed)}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">New Quantity After Change</label>
                <p className="text-sm">{selectedRecord.new_quantity_after_change}</p>
              </div>

              {selectedRecord.supplier_name && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Supplier</label>
                  <p className="text-sm">{selectedRecord.supplier_name}</p>
                </div>
              )}

              {selectedRecord.note && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Note</label>
                  <p className="text-sm">{selectedRecord.note}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-muted-foreground">Transaction ID</label>
                <p className="text-xs font-mono text-muted-foreground">{selectedRecord.id}</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
