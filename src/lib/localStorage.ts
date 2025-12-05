// localStorage-based persistence layer

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Subcategory {
  id: string;
  name: string;
  category_id: string;
  created_at: string;
}

export interface Location {
  id: string;
  label: string;
  zone: string | null;
  capacity: number;
  created_at: string;
}

export interface Item {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  reorder_level: number;
  unit: string | null;
  cost_price: number | null;
  selling_price: number | null;
  supplier_id: string | null;
  subcategory_id: string;
  location_id: string | null;
  predicted_stock: number | null;
  prediction_confidence: number | null;
  prediction_trend: string | null;
  created_at: string;
  updated_at: string;
}

export interface Batch {
  id: string;
  item_id: string;
  batch_number: string;
  quantity: number;
  expiry_date: string | null;
  created_at: string;
}

export interface StockHistory {
  id: string;
  item_id: string;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  action: string;
  change_type: string | null;
  note: string | null;
  notes: string | null;
  created_at: string;
}

const STORAGE_KEYS = {
  categories: 'inventory_categories',
  subcategories: 'inventory_subcategories',
  items: 'inventory_items',
  batches: 'inventory_batches',
  locations: 'inventory_locations',
  stockHistory: 'inventory_stock_history',
};

// Generate UUID
export const generateId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Generic localStorage helpers
const getData = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const setData = <T>(key: string, data: T[]): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Event system for real-time updates
type Listener = () => void;
const listeners: Record<string, Listener[]> = {};

export const subscribe = (key: string, listener: Listener): (() => void) => {
  if (!listeners[key]) listeners[key] = [];
  listeners[key].push(listener);
  return () => {
    listeners[key] = listeners[key].filter((l) => l !== listener);
  };
};

const notify = (key: string) => {
  listeners[key]?.forEach((l) => l());
};

// Initialize with seed data if empty
export const initializeData = () => {
  if (getData<Category>(STORAGE_KEYS.categories).length === 0) {
    const categories: Category[] = [
      { id: generateId(), name: 'Electronics', created_at: new Date().toISOString() },
      { id: generateId(), name: 'Office Supplies', created_at: new Date().toISOString() },
      { id: generateId(), name: 'Food & Beverages', created_at: new Date().toISOString() },
    ];
    setData(STORAGE_KEYS.categories, categories);

    const subcategories: Subcategory[] = [
      { id: generateId(), name: 'Laptops', category_id: categories[0].id, created_at: new Date().toISOString() },
      { id: generateId(), name: 'Phones', category_id: categories[0].id, created_at: new Date().toISOString() },
      { id: generateId(), name: 'Paper', category_id: categories[1].id, created_at: new Date().toISOString() },
      { id: generateId(), name: 'Snacks', category_id: categories[2].id, created_at: new Date().toISOString() },
    ];
    setData(STORAGE_KEYS.subcategories, subcategories);

    const locations: Location[] = [
      { id: generateId(), label: 'A1', zone: 'Zone A', capacity: 100, created_at: new Date().toISOString() },
      { id: generateId(), label: 'A2', zone: 'Zone A', capacity: 100, created_at: new Date().toISOString() },
      { id: generateId(), label: 'B1', zone: 'Zone B', capacity: 150, created_at: new Date().toISOString() },
    ];
    setData(STORAGE_KEYS.locations, locations);

    const items: Item[] = [
      {
        id: generateId(),
        name: 'MacBook Pro 14"',
        sku: 'ELEC-001',
        quantity: 25,
        reorder_level: 10,
        unit: 'pcs',
        cost_price: 1500,
        selling_price: 1999,
        supplier_id: 'Apple Inc',
        subcategory_id: subcategories[0].id,
        location_id: locations[0].id,
        predicted_stock: 20,
        prediction_confidence: 85,
        prediction_trend: 'down',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: generateId(),
        name: 'iPhone 15 Pro',
        sku: 'ELEC-002',
        quantity: 8,
        reorder_level: 15,
        unit: 'pcs',
        cost_price: 800,
        selling_price: 999,
        supplier_id: 'Apple Inc',
        subcategory_id: subcategories[1].id,
        location_id: locations[0].id,
        predicted_stock: 5,
        prediction_confidence: 90,
        prediction_trend: 'down',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: generateId(),
        name: 'A4 Paper (500 sheets)',
        sku: 'OFF-001',
        quantity: 200,
        reorder_level: 50,
        unit: 'packs',
        cost_price: 5,
        selling_price: 8,
        supplier_id: 'Office Depot',
        subcategory_id: subcategories[2].id,
        location_id: locations[1].id,
        predicted_stock: 180,
        prediction_confidence: 75,
        prediction_trend: 'stable',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: generateId(),
        name: 'Protein Bars (Box)',
        sku: 'FOOD-001',
        quantity: 5,
        reorder_level: 20,
        unit: 'boxes',
        cost_price: 15,
        selling_price: 25,
        supplier_id: 'HealthCo',
        subcategory_id: subcategories[3].id,
        location_id: locations[2].id,
        predicted_stock: 3,
        prediction_confidence: 80,
        prediction_trend: 'down',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    setData(STORAGE_KEYS.items, items);

    const batches: Batch[] = [
      { id: generateId(), item_id: items[0].id, batch_number: 'B001', quantity: 25, expiry_date: null, created_at: new Date().toISOString() },
      { id: generateId(), item_id: items[1].id, batch_number: 'B002', quantity: 8, expiry_date: null, created_at: new Date().toISOString() },
      { id: generateId(), item_id: items[2].id, batch_number: 'B003', quantity: 200, expiry_date: null, created_at: new Date().toISOString() },
      { 
        id: generateId(), 
        item_id: items[3].id, 
        batch_number: 'B004', 
        quantity: 5, 
        expiry_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
        created_at: new Date().toISOString() 
      },
    ];
    setData(STORAGE_KEYS.batches, batches);

    const stockHistory: StockHistory[] = items.map((item) => ({
      id: generateId(),
      item_id: item.id,
      quantity_change: item.quantity,
      previous_quantity: 0,
      new_quantity: item.quantity,
      action: 'INSERT',
      change_type: 'restock',
      note: 'Initial stock',
      notes: null,
      created_at: new Date().toISOString(),
    }));
    setData(STORAGE_KEYS.stockHistory, stockHistory);
  }
};

// Categories CRUD
export const categoriesDB = {
  getAll: (): Category[] => getData<Category>(STORAGE_KEYS.categories),
  getById: (id: string): Category | undefined => getData<Category>(STORAGE_KEYS.categories).find((c) => c.id === id),
  create: (name: string): Category => {
    const categories = getData<Category>(STORAGE_KEYS.categories);
    const newCategory: Category = { id: generateId(), name, created_at: new Date().toISOString() };
    setData(STORAGE_KEYS.categories, [...categories, newCategory]);
    notify(STORAGE_KEYS.categories);
    return newCategory;
  },
  update: (id: string, name: string): Category | undefined => {
    const categories = getData<Category>(STORAGE_KEYS.categories);
    const index = categories.findIndex((c) => c.id === id);
    if (index === -1) return undefined;
    categories[index] = { ...categories[index], name };
    setData(STORAGE_KEYS.categories, categories);
    notify(STORAGE_KEYS.categories);
    return categories[index];
  },
  delete: (id: string): boolean => {
    const categories = getData<Category>(STORAGE_KEYS.categories);
    const filtered = categories.filter((c) => c.id !== id);
    setData(STORAGE_KEYS.categories, filtered);
    notify(STORAGE_KEYS.categories);
    return true;
  },
  subscribe: (listener: Listener) => subscribe(STORAGE_KEYS.categories, listener),
};

// Subcategories CRUD
export const subcategoriesDB = {
  getAll: (): Subcategory[] => getData<Subcategory>(STORAGE_KEYS.subcategories),
  getByCategory: (categoryId: string): Subcategory[] =>
    getData<Subcategory>(STORAGE_KEYS.subcategories).filter((s) => s.category_id === categoryId),
  create: (name: string, category_id: string): Subcategory => {
    const subcategories = getData<Subcategory>(STORAGE_KEYS.subcategories);
    const newSubcategory: Subcategory = { id: generateId(), name, category_id, created_at: new Date().toISOString() };
    setData(STORAGE_KEYS.subcategories, [...subcategories, newSubcategory]);
    notify(STORAGE_KEYS.subcategories);
    return newSubcategory;
  },
  update: (id: string, name: string): Subcategory | undefined => {
    const subcategories = getData<Subcategory>(STORAGE_KEYS.subcategories);
    const index = subcategories.findIndex((s) => s.id === id);
    if (index === -1) return undefined;
    subcategories[index] = { ...subcategories[index], name };
    setData(STORAGE_KEYS.subcategories, subcategories);
    notify(STORAGE_KEYS.subcategories);
    return subcategories[index];
  },
  delete: (id: string): boolean => {
    const subcategories = getData<Subcategory>(STORAGE_KEYS.subcategories);
    setData(STORAGE_KEYS.subcategories, subcategories.filter((s) => s.id !== id));
    notify(STORAGE_KEYS.subcategories);
    return true;
  },
  subscribe: (listener: Listener) => subscribe(STORAGE_KEYS.subcategories, listener),
};

// Items CRUD
export const itemsDB = {
  getAll: (): Item[] => getData<Item>(STORAGE_KEYS.items),
  getById: (id: string): Item | undefined => getData<Item>(STORAGE_KEYS.items).find((i) => i.id === id),
  getBySubcategory: (subcategoryId: string): Item[] =>
    getData<Item>(STORAGE_KEYS.items).filter((i) => i.subcategory_id === subcategoryId),
  getLowStock: (): Item[] => getData<Item>(STORAGE_KEYS.items).filter((i) => i.quantity <= i.reorder_level),
  create: (item: Omit<Item, 'id' | 'created_at' | 'updated_at'>): Item => {
    const items = getData<Item>(STORAGE_KEYS.items);
    const newItem: Item = {
      ...item,
      id: generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setData(STORAGE_KEYS.items, [...items, newItem]);
    notify(STORAGE_KEYS.items);
    return newItem;
  },
  update: (id: string, updates: Partial<Item>): Item | undefined => {
    const items = getData<Item>(STORAGE_KEYS.items);
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) return undefined;
    items[index] = { ...items[index], ...updates, updated_at: new Date().toISOString() };
    setData(STORAGE_KEYS.items, items);
    notify(STORAGE_KEYS.items);
    return items[index];
  },
  delete: (id: string): boolean => {
    const items = getData<Item>(STORAGE_KEYS.items);
    setData(STORAGE_KEYS.items, items.filter((i) => i.id !== id));
    notify(STORAGE_KEYS.items);
    return true;
  },
  subscribe: (listener: Listener) => subscribe(STORAGE_KEYS.items, listener),
};

// Batches CRUD
export const batchesDB = {
  getAll: (): Batch[] => getData<Batch>(STORAGE_KEYS.batches),
  getByItem: (itemId: string): Batch[] => getData<Batch>(STORAGE_KEYS.batches).filter((b) => b.item_id === itemId),
  getExpiringSoon: (days: number = 7): Batch[] => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const today = new Date();
    return getData<Batch>(STORAGE_KEYS.batches).filter((b) => {
      if (!b.expiry_date) return false;
      const expiry = new Date(b.expiry_date);
      return expiry >= today && expiry <= futureDate;
    });
  },
  create: (batch: Omit<Batch, 'id' | 'created_at'>): Batch => {
    const batches = getData<Batch>(STORAGE_KEYS.batches);
    const newBatch: Batch = { ...batch, id: generateId(), created_at: new Date().toISOString() };
    setData(STORAGE_KEYS.batches, [...batches, newBatch]);
    notify(STORAGE_KEYS.batches);
    return newBatch;
  },
  update: (id: string, updates: Partial<Batch>): Batch | undefined => {
    const batches = getData<Batch>(STORAGE_KEYS.batches);
    const index = batches.findIndex((b) => b.id === id);
    if (index === -1) return undefined;
    batches[index] = { ...batches[index], ...updates };
    setData(STORAGE_KEYS.batches, batches);
    notify(STORAGE_KEYS.batches);
    return batches[index];
  },
  delete: (id: string): boolean => {
    const batches = getData<Batch>(STORAGE_KEYS.batches);
    setData(STORAGE_KEYS.batches, batches.filter((b) => b.id !== id));
    notify(STORAGE_KEYS.batches);
    return true;
  },
  deleteByItem: (itemId: string): boolean => {
    const batches = getData<Batch>(STORAGE_KEYS.batches);
    setData(STORAGE_KEYS.batches, batches.filter((b) => b.item_id !== itemId));
    notify(STORAGE_KEYS.batches);
    return true;
  },
  subscribe: (listener: Listener) => subscribe(STORAGE_KEYS.batches, listener),
};

// Locations CRUD
export const locationsDB = {
  getAll: (): Location[] => getData<Location>(STORAGE_KEYS.locations),
  getById: (id: string): Location | undefined => getData<Location>(STORAGE_KEYS.locations).find((l) => l.id === id),
  create: (location: Omit<Location, 'id' | 'created_at'>): Location => {
    const locations = getData<Location>(STORAGE_KEYS.locations);
    const newLocation: Location = { ...location, id: generateId(), created_at: new Date().toISOString() };
    setData(STORAGE_KEYS.locations, [...locations, newLocation]);
    notify(STORAGE_KEYS.locations);
    return newLocation;
  },
  update: (id: string, updates: Partial<Location>): Location | undefined => {
    const locations = getData<Location>(STORAGE_KEYS.locations);
    const index = locations.findIndex((l) => l.id === id);
    if (index === -1) return undefined;
    locations[index] = { ...locations[index], ...updates };
    setData(STORAGE_KEYS.locations, locations);
    notify(STORAGE_KEYS.locations);
    return locations[index];
  },
  delete: (id: string): boolean => {
    const locations = getData<Location>(STORAGE_KEYS.locations);
    setData(STORAGE_KEYS.locations, locations.filter((l) => l.id !== id));
    notify(STORAGE_KEYS.locations);
    return true;
  },
  subscribe: (listener: Listener) => subscribe(STORAGE_KEYS.locations, listener),
};

// Stock History CRUD
export const stockHistoryDB = {
  getAll: (): StockHistory[] => getData<StockHistory>(STORAGE_KEYS.stockHistory),
  getByItem: (itemId: string): StockHistory[] =>
    getData<StockHistory>(STORAGE_KEYS.stockHistory).filter((h) => h.item_id === itemId),
  getDetailed: () => {
    const history = getData<StockHistory>(STORAGE_KEYS.stockHistory);
    const items = getData<Item>(STORAGE_KEYS.items);
    const subcategories = getData<Subcategory>(STORAGE_KEYS.subcategories);
    const categories = getData<Category>(STORAGE_KEYS.categories);

    return history.map((h) => {
      const item = items.find((i) => i.id === h.item_id);
      const subcategory = item ? subcategories.find((s) => s.id === item.subcategory_id) : null;
      const category = subcategory ? categories.find((c) => c.id === subcategory.category_id) : null;
      return {
        ...h,
        item_name: item?.name || 'Unknown',
        sku: item?.sku || '',
        unit: item?.unit || 'pcs',
        category_name: category?.name || '',
        subcategory_name: subcategory?.name || '',
        supplier_name: item?.supplier_id || null,
        quantity_changed: h.quantity_change,
        new_quantity_after_change: h.new_quantity,
      };
    });
  },
  create: (entry: Omit<StockHistory, 'id' | 'created_at'>): StockHistory => {
    const history = getData<StockHistory>(STORAGE_KEYS.stockHistory);
    const newEntry: StockHistory = { ...entry, id: generateId(), created_at: new Date().toISOString() };
    setData(STORAGE_KEYS.stockHistory, [...history, newEntry]);
    notify(STORAGE_KEYS.stockHistory);
    return newEntry;
  },
  subscribe: (listener: Listener) => subscribe(STORAGE_KEYS.stockHistory, listener),
};

// Utility: Adjust stock with history logging
export const adjustStock = (
  itemId: string,
  quantityChange: number,
  changeType: string,
  note?: string
): { success: boolean; error?: string; new_quantity?: number } => {
  const item = itemsDB.getById(itemId);
  if (!item) return { success: false, error: 'Item not found' };

  const newQuantity = item.quantity + quantityChange;
  if (newQuantity < 0) return { success: false, error: 'Insufficient stock' };

  itemsDB.update(itemId, { quantity: newQuantity });

  stockHistoryDB.create({
    item_id: itemId,
    quantity_change: quantityChange,
    previous_quantity: item.quantity,
    new_quantity: newQuantity,
    action: changeType === 'sale' ? 'SALE' : changeType === 'damaged' ? 'DAMAGED' : 'ADJUSTMENT',
    change_type: changeType,
    note: note || null,
    notes: null,
  });

  return { success: true, new_quantity: newQuantity };
};
