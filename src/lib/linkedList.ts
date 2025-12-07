// Multi-level Linked List Data Structure for Inventory Management

export interface LinkedListNode<T = any> {
  id: string;
  data: T;
  next: string | null; // ID of next sibling node
  child: string | null; // ID of first child node
}

export interface CategoryData {
  name: string;
  created_at: string;
}

export interface SubcategoryData {
  name: string;
  category_id: string;
  created_at: string;
}

export interface ItemData {
  name: string;
  sku: string | null;
  unit: string | null;
  quantity: number;
  reorder_level: number;
  cost_price: number | null;
  selling_price: number | null;
  location_id: string | null;
  subcategory_id: string;
  supplier_id: string | null;
  predicted_stock: number | null;
  prediction_confidence: number | null;
  prediction_trend: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchData {
  batch_number: string;
  quantity: number;
  expiry_date: string | null;
  item_id: string;
  created_at: string;
}

export interface LocationData {
  label: string;
  zone: string | null;
  capacity: number;
  created_at: string;
}

export interface StockHistoryData {
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

// Storage keys
const STORAGE_KEYS = {
  CATEGORIES: 'inventory_categories_ll',
  SUBCATEGORIES: 'inventory_subcategories_ll',
  ITEMS: 'inventory_items_ll',
  BATCHES: 'inventory_batches_ll',
  LOCATIONS: 'inventory_locations_ll',
  STOCK_HISTORY: 'inventory_stock_history_ll',
  HEAD_POINTERS: 'inventory_head_pointers',
};

interface HeadPointers {
  categories: string | null;
  locations: string | null;
  stockHistory: string | null;
}

// Generate unique ID
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Generic Linked List Operations
class LinkedListManager<T> {
  private storageKey: string;
  private nodes: Map<string, LinkedListNode<T>>;

  constructor(storageKey: string) {
    this.storageKey = storageKey;
    this.nodes = new Map();
    this.load();
  }

  private load(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        this.nodes = new Map(Object.entries(parsed));
      }
    } catch (e) {
      console.error(`Error loading ${this.storageKey}:`, e);
      this.nodes = new Map();
    }
  }

  private save(): void {
    try {
      const obj = Object.fromEntries(this.nodes);
      localStorage.setItem(this.storageKey, JSON.stringify(obj));
    } catch (e) {
      console.error(`Error saving ${this.storageKey}:`, e);
    }
  }

  // Add a node to the list (at the end of siblings or as first child)
  addNode(id: string, data: T, parentId?: string, headPointer?: string | null): LinkedListNode<T> {
    const newNode: LinkedListNode<T> = {
      id,
      data,
      next: null,
      child: null,
    };

    this.nodes.set(id, newNode);
    this.save();
    return newNode;
  }

  // Get a node by ID
  getNode(id: string): LinkedListNode<T> | undefined {
    return this.nodes.get(id);
  }

  // Update node data
  updateNode(id: string, data: Partial<T>): LinkedListNode<T> | undefined {
    const node = this.nodes.get(id);
    if (node) {
      node.data = { ...node.data, ...data };
      this.nodes.set(id, node);
      this.save();
    }
    return node;
  }

  // Remove a node
  removeNode(id: string): boolean {
    const result = this.nodes.delete(id);
    if (result) {
      this.save();
    }
    return result;
  }

  // Get all nodes as array
  getAllNodes(): LinkedListNode<T>[] {
    return Array.from(this.nodes.values());
  }

  // Traverse from a head pointer and return all connected nodes
  traverse(headId: string | null): LinkedListNode<T>[] {
    const result: LinkedListNode<T>[] = [];
    let currentId = headId;
    
    while (currentId) {
      const node = this.nodes.get(currentId);
      if (node) {
        result.push(node);
        currentId = node.next;
      } else {
        break;
      }
    }
    
    return result;
  }

  // Set next pointer
  setNext(id: string, nextId: string | null): void {
    const node = this.nodes.get(id);
    if (node) {
      node.next = nextId;
      this.nodes.set(id, node);
      this.save();
    }
  }

  // Set child pointer
  setChild(id: string, childId: string | null): void {
    const node = this.nodes.get(id);
    if (node) {
      node.child = childId;
      this.nodes.set(id, node);
      this.save();
    }
  }

  // Clear all nodes
  clear(): void {
    this.nodes.clear();
    this.save();
  }
}

// Head pointers manager
class HeadPointersManager {
  private pointers: HeadPointers;

  constructor() {
    this.pointers = this.load();
  }

  private load(): HeadPointers {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HEAD_POINTERS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Error loading head pointers:', e);
    }
    return { categories: null, locations: null, stockHistory: null };
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEYS.HEAD_POINTERS, JSON.stringify(this.pointers));
  }

  get(): HeadPointers {
    return this.pointers;
  }

  setCategoriesHead(id: string | null): void {
    this.pointers.categories = id;
    this.save();
  }

  setLocationsHead(id: string | null): void {
    this.pointers.locations = id;
    this.save();
  }

  setStockHistoryHead(id: string | null): void {
    this.pointers.stockHistory = id;
    this.save();
  }
}

// Initialize managers
const categoriesLL = new LinkedListManager<CategoryData>(STORAGE_KEYS.CATEGORIES);
const subcategoriesLL = new LinkedListManager<SubcategoryData>(STORAGE_KEYS.SUBCATEGORIES);
const itemsLL = new LinkedListManager<ItemData>(STORAGE_KEYS.ITEMS);
const batchesLL = new LinkedListManager<BatchData>(STORAGE_KEYS.BATCHES);
const locationsLL = new LinkedListManager<LocationData>(STORAGE_KEYS.LOCATIONS);
const stockHistoryLL = new LinkedListManager<StockHistoryData>(STORAGE_KEYS.STOCK_HISTORY);
const headPointers = new HeadPointersManager();

// Helper to append node to end of linked list
function appendToList<T>(
  manager: LinkedListManager<T>,
  headId: string | null,
  newNodeId: string
): string {
  if (!headId) {
    return newNodeId;
  }
  
  let currentId: string | null = headId;
  let lastId = headId;
  
  while (currentId) {
    const node = manager.getNode(currentId);
    if (node) {
      lastId = currentId;
      currentId = node.next;
    } else {
      break;
    }
  }
  
  manager.setNext(lastId, newNodeId);
  return headId;
}

// Helper to remove node from linked list
function removeFromList<T>(
  manager: LinkedListManager<T>,
  headId: string | null,
  targetId: string
): string | null {
  if (!headId) return null;
  
  if (headId === targetId) {
    const node = manager.getNode(headId);
    manager.removeNode(targetId);
    return node?.next || null;
  }
  
  let currentId: string | null = headId;
  let prevId: string | null = null;
  
  while (currentId) {
    if (currentId === targetId) {
      const node = manager.getNode(currentId);
      if (prevId) {
        manager.setNext(prevId, node?.next || null);
      }
      manager.removeNode(targetId);
      return headId;
    }
    prevId = currentId;
    const node = manager.getNode(currentId);
    currentId = node?.next || null;
  }
  
  return headId;
}

// Categories API
export const categoriesDB = {
  create: (name: string) => {
    const id = generateId();
    const data: CategoryData = {
      name,
      created_at: new Date().toISOString(),
    };
    categoriesLL.addNode(id, data);
    const heads = headPointers.get();
    const newHead = appendToList(categoriesLL, heads.categories, id);
    headPointers.setCategoriesHead(newHead);
    return { id, ...data };
  },
  
  getAll: () => {
    return categoriesLL.getAllNodes().map(node => ({
      id: node.id,
      ...node.data,
    }));
  },
  
  getById: (id: string) => {
    const node = categoriesLL.getNode(id);
    return node ? { id: node.id, ...node.data } : null;
  },
  
  update: (id: string, name: string) => {
    categoriesLL.updateNode(id, { name });
    const node = categoriesLL.getNode(id);
    return node ? { id: node.id, ...node.data } : null;
  },
  
  delete: (id: string) => {
    // Delete all subcategories and their items/batches
    const subcats = subcategoriesDB.getAll().filter(s => s.category_id === id);
    subcats.forEach(sub => subcategoriesDB.delete(sub.id));
    
    const heads = headPointers.get();
    const newHead = removeFromList(categoriesLL, heads.categories, id);
    headPointers.setCategoriesHead(newHead);
    return true;
  },
  
  subscribe: (callback: () => void) => {
    // Simple polling-based subscription (no-op for linked list, returns unsubscribe)
    return () => {};
  },
};

// Subcategories API
export const subcategoriesDB = {
  create: (name: string, categoryId: string) => {
    const id = generateId();
    const data: SubcategoryData = {
      name,
      category_id: categoryId,
      created_at: new Date().toISOString(),
    };
    subcategoriesLL.addNode(id, data);
    
    // Link to parent category
    const catNode = categoriesLL.getNode(categoryId);
    if (catNode) {
      if (!catNode.child) {
        categoriesLL.setChild(categoryId, id);
      } else {
        appendToList(subcategoriesLL, catNode.child, id);
      }
    }
    
    return { id, ...data };
  },
  
  getAll: () => {
    return subcategoriesLL.getAllNodes().map(node => ({
      id: node.id,
      ...node.data,
    }));
  },
  
  getById: (id: string) => {
    const node = subcategoriesLL.getNode(id);
    return node ? { id: node.id, ...node.data } : null;
  },
  
  update: (id: string, name: string) => {
    subcategoriesLL.updateNode(id, { name });
    const node = subcategoriesLL.getNode(id);
    return node ? { id: node.id, ...node.data } : null;
  },
  
  delete: (id: string) => {
    // Delete all items and their batches
    const items = itemsDB.getAll().filter(i => i.subcategory_id === id);
    items.forEach(item => itemsDB.delete(item.id));
    
    // Get parent category and update its child pointer if needed
    const subNode = subcategoriesLL.getNode(id);
    if (subNode) {
      const catNode = categoriesLL.getNode(subNode.data.category_id);
      if (catNode && catNode.child === id) {
        categoriesLL.setChild(catNode.id, subNode.next);
      } else if (catNode && catNode.child) {
        // Find and update previous sibling
        let current = catNode.child;
        while (current) {
          const node = subcategoriesLL.getNode(current);
          if (node?.next === id) {
            subcategoriesLL.setNext(current, subNode.next);
            break;
          }
          current = node?.next || null;
        }
      }
    }
    
    subcategoriesLL.removeNode(id);
    return true;
  },
};

// Items API
export const itemsDB = {
  create: (item: Omit<ItemData, 'created_at' | 'updated_at'>) => {
    const id = generateId();
    const now = new Date().toISOString();
    const data: ItemData = {
      ...item,
      created_at: now,
      updated_at: now,
    };
    itemsLL.addNode(id, data);
    
    // Link to parent subcategory
    const subNode = subcategoriesLL.getNode(item.subcategory_id);
    if (subNode) {
      if (!subNode.child) {
        subcategoriesLL.setChild(item.subcategory_id, id);
      } else {
        appendToList(itemsLL, subNode.child, id);
      }
    }
    
    return { id, ...data };
  },
  
  getAll: () => {
    return itemsLL.getAllNodes().map(node => ({
      id: node.id,
      ...node.data,
    }));
  },
  
  getById: (id: string) => {
    const node = itemsLL.getNode(id);
    return node ? { id: node.id, ...node.data } : null;
  },
  
  update: (id: string, updates: Partial<ItemData>) => {
    itemsLL.updateNode(id, { ...updates, updated_at: new Date().toISOString() });
    const node = itemsLL.getNode(id);
    return node ? { id: node.id, ...node.data } : null;
  },
  
  delete: (id: string) => {
    // Delete all batches
    batchesDB.deleteByItem(id);
    
    // Get parent subcategory and update its child pointer if needed
    const itemNode = itemsLL.getNode(id);
    if (itemNode) {
      const subNode = subcategoriesLL.getNode(itemNode.data.subcategory_id);
      if (subNode && subNode.child === id) {
        subcategoriesLL.setChild(subNode.id, itemNode.next);
      } else if (subNode && subNode.child) {
        let current = subNode.child;
        while (current) {
          const node = itemsLL.getNode(current);
          if (node?.next === id) {
            itemsLL.setNext(current, itemNode.next);
            break;
          }
          current = node?.next || null;
        }
      }
    }
    
    itemsLL.removeNode(id);
    return true;
  },
  
  subscribe: (callback: () => void) => {
    return () => {};
  },
};

// Batches API
export const batchesDB = {
  create: (batch: Omit<BatchData, 'created_at'>) => {
    const id = generateId();
    const data: BatchData = {
      ...batch,
      created_at: new Date().toISOString(),
    };
    batchesLL.addNode(id, data);
    
    // Link to parent item
    const itemNode = itemsLL.getNode(batch.item_id);
    if (itemNode) {
      if (!itemNode.child) {
        itemsLL.setChild(batch.item_id, id);
      } else {
        appendToList(batchesLL, itemNode.child, id);
      }
    }
    
    return { id, ...data };
  },
  
  getAll: () => {
    return batchesLL.getAllNodes().map(node => ({
      id: node.id,
      ...node.data,
    }));
  },
  
  getByItem: (itemId: string) => {
    return batchesLL.getAllNodes()
      .filter(node => node.data.item_id === itemId)
      .map(node => ({ id: node.id, ...node.data }));
  },
  
  update: (id: string, updates: Partial<BatchData>) => {
    batchesLL.updateNode(id, updates);
    const node = batchesLL.getNode(id);
    return node ? { id: node.id, ...node.data } : null;
  },
  
  delete: (id: string) => {
    const batchNode = batchesLL.getNode(id);
    if (batchNode) {
      const itemNode = itemsLL.getNode(batchNode.data.item_id);
      if (itemNode && itemNode.child === id) {
        itemsLL.setChild(itemNode.id, batchNode.next);
      } else if (itemNode && itemNode.child) {
        let current = itemNode.child;
        while (current) {
          const node = batchesLL.getNode(current);
          if (node?.next === id) {
            batchesLL.setNext(current, batchNode.next);
            break;
          }
          current = node?.next || null;
        }
      }
    }
    batchesLL.removeNode(id);
    return true;
  },
  
  deleteByItem: (itemId: string) => {
    const batches = batchesDB.getByItem(itemId);
    batches.forEach(b => batchesLL.removeNode(b.id));
    const itemNode = itemsLL.getNode(itemId);
    if (itemNode) {
      itemsLL.setChild(itemId, null);
    }
    return true;
  },
  
  getExpiringSoon: (days: number) => {
    const today = new Date();
    const threshold = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    return batchesLL.getAllNodes()
      .filter(node => {
        if (!node.data.expiry_date) return false;
        const expiryDate = new Date(node.data.expiry_date);
        return expiryDate <= threshold && expiryDate >= today;
      })
      .map(node => ({ id: node.id, ...node.data }));
  },
  
  subscribe: (callback: () => void) => {
    return () => {};
  },
};

// Locations API
export const locationsDB = {
  create: (location: Omit<LocationData, 'created_at'>) => {
    const id = generateId();
    const data: LocationData = {
      ...location,
      created_at: new Date().toISOString(),
    };
    locationsLL.addNode(id, data);
    const heads = headPointers.get();
    const newHead = appendToList(locationsLL, heads.locations, id);
    headPointers.setLocationsHead(newHead);
    return { id, ...data };
  },
  
  getAll: () => {
    return locationsLL.getAllNodes().map(node => ({
      id: node.id,
      ...node.data,
    }));
  },
  
  getById: (id: string) => {
    const node = locationsLL.getNode(id);
    return node ? { id: node.id, ...node.data } : null;
  },
  
  update: (id: string, updates: Partial<LocationData>) => {
    locationsLL.updateNode(id, updates);
    const node = locationsLL.getNode(id);
    return node ? { id: node.id, ...node.data } : null;
  },
  
  delete: (id: string) => {
    const heads = headPointers.get();
    const newHead = removeFromList(locationsLL, heads.locations, id);
    headPointers.setLocationsHead(newHead);
    return true;
  },
  
  subscribe: (callback: () => void) => {
    return () => {};
  },
};

// Stock History API
export const stockHistoryDB = {
  create: (entry: Omit<StockHistoryData, 'created_at'>) => {
    const id = generateId();
    const data: StockHistoryData = {
      ...entry,
      created_at: new Date().toISOString(),
    };
    stockHistoryLL.addNode(id, data);
    const heads = headPointers.get();
    const newHead = appendToList(stockHistoryLL, heads.stockHistory, id);
    headPointers.setStockHistoryHead(newHead);
    return { id, ...data };
  },
  
  getAll: () => {
    return stockHistoryLL.getAllNodes().map(node => ({
      id: node.id,
      ...node.data,
    }));
  },
  
  getByItem: (itemId: string) => {
    return stockHistoryLL.getAllNodes()
      .filter(node => node.data.item_id === itemId)
      .map(node => ({ id: node.id, ...node.data }));
  },
  
  getDetailed: () => {
    const items = itemsDB.getAll();
    const subcategories = subcategoriesDB.getAll();
    const categories = categoriesDB.getAll();
    
    return stockHistoryLL.getAllNodes().map(node => {
      const item = items.find(i => i.id === node.data.item_id);
      const subcategory = item ? subcategories.find(s => s.id === item.subcategory_id) : null;
      const category = subcategory ? categories.find(c => c.id === subcategory.category_id) : null;
      
      return {
        id: node.id,
        created_at: node.data.created_at,
        item_id: node.data.item_id,
        item_name: item?.name || 'Unknown',
        sku: item?.sku || '',
        unit: item?.unit || '',
        category_name: category?.name || '',
        subcategory_name: subcategory?.name || '',
        change_type: node.data.change_type || '',
        quantity_changed: node.data.quantity_change,
        new_quantity_after_change: node.data.new_quantity,
        supplier_name: item?.supplier_id || null,
        note: node.data.note,
      };
    });
  },
  
  subscribe: (callback: () => void) => {
    return () => {};
  },
};

// Adjust stock helper
export const adjustStock = (
  itemId: string,
  quantityChange: number,
  changeType: string,
  note?: string
): { success: boolean; error?: string } => {
  const item = itemsDB.getById(itemId);
  if (!item) {
    return { success: false, error: 'Item not found' };
  }
  
  const newQuantity = item.quantity + quantityChange;
  if (newQuantity < 0) {
    return { success: false, error: 'Insufficient stock' };
  }
  
  // Update item quantity
  itemsDB.update(itemId, { quantity: newQuantity });
  
  // Create history entry
  stockHistoryDB.create({
    item_id: itemId,
    quantity_change: quantityChange,
    previous_quantity: item.quantity,
    new_quantity: newQuantity,
    action: quantityChange > 0 ? 'RESTOCK' : 'REMOVE',
    change_type: changeType,
    note: note || null,
    notes: null,
  });
  
  // Update batch quantities proportionally (simplified: reduce from first batches)
  if (quantityChange < 0) {
    let remaining = Math.abs(quantityChange);
    const batches = batchesDB.getByItem(itemId);
    for (const batch of batches) {
      if (remaining <= 0) break;
      const reduction = Math.min(batch.quantity, remaining);
      batchesDB.update(batch.id, { quantity: batch.quantity - reduction });
      remaining -= reduction;
    }
  }
  
  return { success: true };
};

// Initialize with seed data if empty
export const initializeData = () => {
  const categories = categoriesDB.getAll();
  if (categories.length > 0) return;
  
  // Seed categories
  const electronics = categoriesDB.create('Electronics');
  const office = categoriesDB.create('Office Supplies');
  
  // Seed subcategories
  const phones = subcategoriesDB.create('Mobile Phones', electronics.id);
  const laptops = subcategoriesDB.create('Laptops', electronics.id);
  const paper = subcategoriesDB.create('Paper Products', office.id);
  
  // Seed locations - 10+ per zone
  // Zone A locations
  const locA1 = locationsDB.create({ label: 'A-1', zone: 'Zone A', capacity: 100 });
  const locA2 = locationsDB.create({ label: 'A-2', zone: 'Zone A', capacity: 100 });
  const locA3 = locationsDB.create({ label: 'A-3', zone: 'Zone A', capacity: 120 });
  const locA4 = locationsDB.create({ label: 'A-4', zone: 'Zone A', capacity: 80 });
  const locA5 = locationsDB.create({ label: 'A-5', zone: 'Zone A', capacity: 100 });
  const locA6 = locationsDB.create({ label: 'A-6', zone: 'Zone A', capacity: 150 });
  const locA7 = locationsDB.create({ label: 'A-7', zone: 'Zone A', capacity: 100 });
  const locA8 = locationsDB.create({ label: 'A-8', zone: 'Zone A', capacity: 90 });
  const locA9 = locationsDB.create({ label: 'A-9', zone: 'Zone A', capacity: 110 });
  const locA10 = locationsDB.create({ label: 'A-10', zone: 'Zone A', capacity: 100 });
  
  // Zone B locations
  const locB1 = locationsDB.create({ label: 'B-1', zone: 'Zone B', capacity: 150 });
  const locB2 = locationsDB.create({ label: 'B-2', zone: 'Zone B', capacity: 150 });
  const locB3 = locationsDB.create({ label: 'B-3', zone: 'Zone B', capacity: 120 });
  const locB4 = locationsDB.create({ label: 'B-4', zone: 'Zone B', capacity: 100 });
  const locB5 = locationsDB.create({ label: 'B-5', zone: 'Zone B', capacity: 130 });
  const locB6 = locationsDB.create({ label: 'B-6', zone: 'Zone B', capacity: 150 });
  const locB7 = locationsDB.create({ label: 'B-7', zone: 'Zone B', capacity: 140 });
  const locB8 = locationsDB.create({ label: 'B-8', zone: 'Zone B', capacity: 100 });
  const locB9 = locationsDB.create({ label: 'B-9', zone: 'Zone B', capacity: 110 });
  const locB10 = locationsDB.create({ label: 'B-10', zone: 'Zone B', capacity: 150 });
  
  // Zone C locations
  const locC1 = locationsDB.create({ label: 'C-1', zone: 'Zone C', capacity: 200 });
  const locC2 = locationsDB.create({ label: 'C-2', zone: 'Zone C', capacity: 200 });
  const locC3 = locationsDB.create({ label: 'C-3', zone: 'Zone C', capacity: 180 });
  const locC4 = locationsDB.create({ label: 'C-4', zone: 'Zone C', capacity: 150 });
  const locC5 = locationsDB.create({ label: 'C-5', zone: 'Zone C', capacity: 200 });
  const locC6 = locationsDB.create({ label: 'C-6', zone: 'Zone C', capacity: 220 });
  const locC7 = locationsDB.create({ label: 'C-7', zone: 'Zone C', capacity: 180 });
  const locC8 = locationsDB.create({ label: 'C-8', zone: 'Zone C', capacity: 160 });
  const locC9 = locationsDB.create({ label: 'C-9', zone: 'Zone C', capacity: 200 });
  const locC10 = locationsDB.create({ label: 'C-10', zone: 'Zone C', capacity: 200 });
  
  // Seed items
  const iphone = itemsDB.create({
    name: 'iPhone 15 Pro',
    sku: 'IPH-15-PRO',
    unit: 'pcs',
    quantity: 25,
    reorder_level: 10,
    cost_price: 999,
    selling_price: 1199,
    location_id: locA1.id,
    subcategory_id: phones.id,
    supplier_id: 'Apple Inc.',
    predicted_stock: 20,
    prediction_confidence: 85,
    prediction_trend: 'decreasing',
  });
  
  const macbook = itemsDB.create({
    name: 'MacBook Pro 14"',
    sku: 'MBP-14-M3',
    unit: 'pcs',
    quantity: 8,
    reorder_level: 5,
    cost_price: 1999,
    selling_price: 2399,
    location_id: locA2.id,
    subcategory_id: laptops.id,
    supplier_id: 'Apple Inc.',
    predicted_stock: 6,
    prediction_confidence: 75,
    prediction_trend: 'decreasing',
  });
  
  const printer_paper = itemsDB.create({
    name: 'A4 Printer Paper',
    sku: 'PPR-A4-500',
    unit: 'reams',
    quantity: 200,
    reorder_level: 50,
    cost_price: 5,
    selling_price: 8,
    location_id: locB1.id,
    subcategory_id: paper.id,
    supplier_id: 'Paper Co.',
    predicted_stock: 180,
    prediction_confidence: 90,
    prediction_trend: 'stable',
  });
  
  // Seed batches
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  batchesDB.create({
    batch_number: 'IPH-2024-001',
    quantity: 15,
    expiry_date: null,
    item_id: iphone.id,
  });
  
  batchesDB.create({
    batch_number: 'IPH-2024-002',
    quantity: 10,
    expiry_date: null,
    item_id: iphone.id,
  });
  
  batchesDB.create({
    batch_number: 'MBP-2024-001',
    quantity: 8,
    expiry_date: null,
    item_id: macbook.id,
  });
  
  batchesDB.create({
    batch_number: 'PPR-2024-001',
    quantity: 100,
    expiry_date: nextWeek.toISOString().split('T')[0],
    item_id: printer_paper.id,
  });
  
  batchesDB.create({
    batch_number: 'PPR-2024-002',
    quantity: 100,
    expiry_date: nextMonth.toISOString().split('T')[0],
    item_id: printer_paper.id,
  });
  
  // Seed stock history
  stockHistoryDB.create({
    item_id: iphone.id,
    quantity_change: 25,
    previous_quantity: 0,
    new_quantity: 25,
    action: 'INSERT',
    change_type: 'restock',
    note: 'Initial stock',
    notes: null,
  });
  
  stockHistoryDB.create({
    item_id: macbook.id,
    quantity_change: 8,
    previous_quantity: 0,
    new_quantity: 8,
    action: 'INSERT',
    change_type: 'restock',
    note: 'Initial stock',
    notes: null,
  });
  
  stockHistoryDB.create({
    item_id: printer_paper.id,
    quantity_change: 200,
    previous_quantity: 0,
    new_quantity: 200,
    action: 'INSERT',
    change_type: 'restock',
    note: 'Initial stock',
    notes: null,
  });
  
  console.log('Inventory data initialized with linked list structure');
};
