/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Package, 
  Scan, 
  ShoppingCart, 
  Database,
  Cloud,
  CloudOff,
  User,
  Power,
  ServerCrash,
  RefreshCw,
  UserCheck,
  X,
  Mail,
  Send,
  Check,
  Volume2,
  VolumeX,
  Clock
} from 'lucide-react';

import { Product, AuditLog, Sale, BackupData, SaleItem } from './types';
import { isFirebaseConfigured, db, auth, handleFirestoreError, OperationType } from './firebase';
import { collection, onSnapshot, setDoc, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';

import Dashboard from './components/Dashboard';
import InventoryList from './components/InventoryList';
import BarcodeScanner from './components/BarcodeScanner';
import POSSales from './components/POSSales';
import BackupControl from './components/BackupControl';
import EmployeeTake from './components/EmployeeTake';

// 1. Core High-Quality Demo Products pre-population for RH Computer Technology
const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "HP ProBook 450 G10 Ryzen 7 16GB",
    barcode: "690250002131",
    description: "Business Class 15.6 Inch laptop, Octa-Core Zen 4 Processor, 512GB NVMe Premium Enterprise Drive.",
    category: "Laptops & PCs",
    costPrice: 2850.00,
    salePrice: 3499.00,
    quantity: 12,
    minStockThreshold: 4,
    maxStockThreshold: 40,
    reorderQuantity: 10,
    storageLocation: "Aisle A, Shelf 2",
    supplierName: "HP Malaysia Distributors",
    updatedAt: new Date().toISOString(),
    updatedBy: "System Init"
  },
  {
    id: "p2",
    name: "Gigabyte RTX 4070 SUPER Windforce OC",
    barcode: "4719331314278",
    description: "Desktop Discrete GPU with 12GB GDDR6X, Ada Lovelace gaming Architecture, DLSS 3 frame generator.",
    category: "Computer Components",
    costPrice: 2600.00,
    salePrice: 3200.00,
    quantity: 8,
    minStockThreshold: 3,
    maxStockThreshold: 20,
    reorderQuantity: 5,
    storageLocation: "Aisle C, Rack 4",
    supplierName: "Gigabyte Tek Ind",
    updatedAt: new Date().toISOString(),
    updatedBy: "System Init"
  },
  {
    id: "p3",
    name: "Lenovo ThinkPad X1 Carbon Gen 11 EVO",
    barcode: "888965007261",
    description: "Ultrabook i7 Elite edition, 16GB DDR5 soldered, Intel Iris graphics, 1TB lightning drive, Carbon Fiber chassis.",
    category: "Laptops & PCs",
    costPrice: 6200.00,
    salePrice: 7599.00,
    quantity: 2,
    minStockThreshold: 3,
    maxStockThreshold: 15,
    reorderQuantity: 4,
    storageLocation: "Aisle A, Shelf 1",
    supplierName: "Lenovo Premium Supply",
    updatedAt: new Date().toISOString(),
    updatedBy: "System Init"
  },
  {
    id: "p4",
    name: "TP-Link Deco XE75 Pro AXE5400 Mesh Wi-Fi 6E",
    barcode: "6935364023249",
    description: "Multi-room Mesh router, tri-band coverage up to 5500 sq ft, absolute lowest latency wireless nodes.",
    category: "Networking Devices",
    costPrice: 650.00,
    salePrice: 899.00,
    quantity: 15,
    minStockThreshold: 5,
    maxStockThreshold: 50,
    reorderQuantity: 15,
    storageLocation: "Aisle B, Cabinet 1",
    supplierName: "TP-Link Direct SEA",
    updatedAt: new Date().toISOString(),
    updatedBy: "System Init"
  },
  {
    id: "p5",
    name: "Samsung 990 PRO M.2 PCIe 4.0 NVMe 2TB SSD",
    barcode: "887276711416",
    description: "External heatsink ready high speed solid state disk, 7450MB/s sequential read, tailored for servers & consoles.",
    category: "Computer Components",
    costPrice: 580.00,
    salePrice: 749.00,
    quantity: 34,
    minStockThreshold: 8,
    maxStockThreshold: 120,
    reorderQuantity: 50,
    storageLocation: "Aisle C, Drawer 3",
    supplierName: "Samsung Global Storage",
    updatedAt: new Date().toISOString(),
    updatedBy: "System Init"
  },
  {
    id: "p6",
    name: "Logitech MX Master 3S Graphite wireless mouse",
    barcode: "097855171120",
    description: "Ergonomic designer mouse, 8000 DPI tracks on any-glass surface, magspeed electromagnetic wheel.",
    category: "Accessories",
    costPrice: 320.00,
    salePrice: 429.00,
    quantity: 0,
    minStockThreshold: 6,
    maxStockThreshold: 80,
    reorderQuantity: 20,
    storageLocation: "Aisle D, Peg 12",
    supplierName: "Logitech Tech MY",
    updatedAt: new Date().toISOString(),
    updatedBy: "System Init"
  },
  {
    id: "p7",
    name: "APC Back-UPS Pro BR1600SI",
    barcode: "731304347200",
    description: "Sinewave emergency power backup system, 1600VA / 960W capacity, LCD visual status screen.",
    category: "Power Backups",
    costPrice: 1100.00,
    salePrice: 1399.00,
    quantity: 5,
    minStockThreshold: 2,
    maxStockThreshold: 10,
    reorderQuantity: 3,
    storageLocation: "Aisle E, Floor Space",
    supplierName: "APC Schneider Corp",
    updatedAt: new Date().toISOString(),
    updatedBy: "System Init"
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  // Pending POS Cart transferred from Employee Take page
  const [pendingPOSCart, setPendingPOSCart] = useState<SaleItem[]>([]);
  const [pendingPOSEmployee, setPendingPOSEmployee] = useState('');
  
  // Real-time Auth details
  const [user, setUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFirebaseLive, setIsFirebaseLive] = useState(false);

  // Mute alerts status for Low Stock Warning Audio Chimes
  const [muteAlerts, setMuteAlerts] = useState<boolean>(() => {
    return localStorage.getItem('muteAlerts') === 'true';
  });

  const handleToggleMuteAlerts = () => {
    setMuteAlerts(prev => {
      const next = !prev;
      localStorage.setItem('muteAlerts', String(next));
      return next;
    });
  };

  // Quiet Hours states configuration
  const [quietHoursEnabled, setQuietHoursEnabled] = useState<boolean>(() => {
    return localStorage.getItem('quietHoursEnabled') === 'true';
  });
  const [quietHoursStart, setQuietHoursStart] = useState<string>(() => {
    return localStorage.getItem('quietHoursStart') || '22:00';
  });
  const [quietHoursEnd, setQuietHoursEnd] = useState<string>(() => {
    return localStorage.getItem('quietHoursEnd') || '06:00';
  });

  const handleToggleQuietHours = (enabled: boolean) => {
    setQuietHoursEnabled(enabled);
    localStorage.setItem('quietHoursEnabled', String(enabled));
  };

  const handleSetQuietHoursStart = (start: string) => {
    setQuietHoursStart(start);
    localStorage.setItem('quietHoursStart', start);
  };

  const handleSetQuietHoursEnd = (end: string) => {
    setQuietHoursEnd(end);
    localStorage.setItem('quietHoursEnd', end);
  };

  const isCurrentlyQuietHours = (): boolean => {
    if (!quietHoursEnabled) return false;
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = quietHoursStart.split(':').map(Number);
    const [endHour, endMinute] = quietHoursEnd.split(':').map(Number);

    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    if (startTotalMinutes <= endTotalMinutes) {
      return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
    } else {
      // Overnights, e.g. 22:00 to 06:00
      return currentTotalMinutes >= startTotalMinutes || currentTotalMinutes <= endTotalMinutes;
    }
  };

  // Background Auto-Sync settings
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem('autoSyncEnabled') === 'true';
  });
  const [autoSyncInterval, setAutoSyncInterval] = useState<number>(() => {
    const saved = localStorage.getItem('autoSyncInterval');
    return saved ? parseInt(saved, 10) : 30; // 30s as default
  });
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(() => {
    return localStorage.getItem('lastSyncedTime') || null;
  });

  const refreshFirebaseData = async () => {
    if (!isFirebaseConfigured || !db) return;
    setIsSyncing(true);
    try {
      const productsPromise = getDocs(collection(db, 'products'));
      const auditsPromise = getDocs(collection(db, 'auditLogs'));
      const salesPromise = getDocs(collection(db, 'sales'));
      
      const [prodSnap, auditSnap, salesSnap] = await Promise.all([
        productsPromise,
        auditsPromise,
        salesPromise
      ]);

      const prodData: Product[] = [];
      prodSnap.forEach((docSnap) => {
        prodData.push(docSnap.data() as Product);
      });

      const auditData: AuditLog[] = [];
      auditSnap.forEach((docSnap) => {
        auditData.push(docSnap.data() as AuditLog);
      });
      auditData.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const salesData: Sale[] = [];
      salesSnap.forEach((docSnap) => {
        salesData.push(docSnap.data() as Sale);
      });
      salesData.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setProducts(prodData);
      setAuditLogs(auditData);
      setSales(salesData);
      saveStateLocally(prodData, auditData, salesData);

      const timestampWord = new Date().toISOString();
      setLastSyncedTime(timestampWord);
      localStorage.setItem('lastSyncedTime', timestampWord);
      console.log(`[Auto-Sync] Pulled active tables successfully from firestore: ${new Date().toLocaleTimeString()}`);
    } catch (err: any) {
      console.error("Auto Sync Refresh Failed: ", err);
      setToasts(prev => [
        {
          id: Math.random().toString(),
          productId: '',
          name: 'Firebase Auto-Sync Failure',
          quantity: 0,
          threshold: 0,
          type: 'critical'
        },
        ...prev
      ]);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !autoSyncEnabled) return;

    const timer = setInterval(() => {
      refreshFirebaseData();
    }, autoSyncInterval * 1000);

    return () => clearInterval(timer);
  }, [autoSyncEnabled, autoSyncInterval, isFirebaseConfigured, db]);

  // Global Restock state & Toast warnings
  const [globalRestockId, setGlobalRestockId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ 
    id: string; 
    productId: string; 
    name: string; 
    quantity: number; 
    threshold: number; 
    type: 'warning' | 'critical';
    emailStatus?: 'idle' | 'sending' | 'sent';
  }>>([]);

  const handleSendProcurementEmail = (toastId: string) => {
    setToasts(prev => prev.map(t => t.id === toastId ? { ...t, emailStatus: 'sending' } : t));
    
    // Simulate email dispatch delay
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === toastId ? { ...t, emailStatus: 'sent' } : t));
    }, 1500);
  };
  
  // Track product stock adjustments and drop transitions for browser-based alarm
  const prevQuantitiesRef = useRef<Record<string, number>>({});
  
  // Custom synthetic low stock warning tone using Web Audio API
  const playAlertAlarm = () => {
    if (muteAlerts) {
      console.log('Audio low-stock alert alarm is currently muted by user action.');
      return;
    }
    if (isCurrentlyQuietHours()) {
      console.log('Audio low-stock alert alarm is automatically muted during Quiet Hours.');
      return;
    }
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playBeep = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.06, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration - 0.02);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      
      // Dual high-pitch alert beep pattern
      playBeep(987.77, audioCtx.currentTime, 0.12); // B5
      playBeep(987.77, audioCtx.currentTime + 0.16, 0.20); 
    } catch (e) {
      console.log('Audio alert chimes muted/unsupported by browser user gesture policies', e);
    }
  };

  const triggerDesktopNotification = (productName: string, quantity: number, threshold: number) => {
    if (!('Notification' in window)) return;
    if (window.Notification.permission === 'granted') {
      new window.Notification("⚠️ Critical Stock Alert", {
        body: `${productName} has dropped to ${quantity} units (Threshold: ${threshold})!`,
      });
    } else if (window.Notification.permission !== 'denied') {
      window.Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new window.Notification("⚠️ Critical Stock Alert", {
            body: `${productName} has dropped to ${quantity} units (Threshold: ${threshold})!`,
          });
        }
      });
    }
  };

  useEffect(() => {
    if (!products || products.length === 0) return;
    
    // Check for stock drop transitions
    products.forEach(p => {
      const prevQty = prevQuantitiesRef.current[p.id];
      const newQty = p.quantity || 0;
      const thresh = p.minStockThreshold || 0;
      
      // Detect if it transitioned from above to BELOW OR EQUAL to minimum threshold
      if (prevQty !== undefined && prevQty > thresh && newQty <= thresh) {
        // Trigger Toast in-app
        const toastId = 'toast_' + Math.floor(Math.random() * 1000000).toString();
        const newToast = {
          id: toastId,
          productId: p.id,
          name: p.name,
          quantity: newQty,
          threshold: thresh,
          type: (newQty === 0 ? 'critical' : 'warning') as 'critical' | 'warning',
          emailStatus: 'idle' as const
        };
        
        setToasts(prev => [newToast, ...prev]);
        
        // Auto remove toast after 18s unless sending or sent
        setTimeout(() => {
          setToasts(prev => prev.filter(t => {
            if (t.id === toastId) {
              return t.emailStatus === 'sending' || t.emailStatus === 'sent';
            }
            return true;
          }));
        }, 18000);
        
        // Chime audio synthesiser Core
        playAlertAlarm();
        
        // Fire actual browser notification API if granted
        triggerDesktopNotification(p.name, newQty, thresh);
      }
      
      // Update our tracker
      prevQuantitiesRef.current[p.id] = newQty;
    });
  }, [products]);

  // 1. Initial State Load - Hydrate LocalStorage or Firebase rules
  useEffect(() => {
    // If Firebase is NOT active / configured, run standard LocalStorage Hydration
    if (!isFirebaseConfigured) {
      const storedProducts = localStorage.getItem('rh_products');
      const storedAudit = localStorage.getItem('rh_audit_logs');
      const storedSales = localStorage.getItem('rh_sales');

      if (storedProducts) {
        setProducts(JSON.parse(storedProducts));
      } else {
        setProducts(DEFAULT_PRODUCTS);
        localStorage.setItem('rh_products', JSON.stringify(DEFAULT_PRODUCTS));
      }

      if (storedAudit) {
        setAuditLogs(JSON.parse(storedAudit));
      } else {
        setAuditLogs([]);
      }

      if (storedSales) {
        setSales(JSON.parse(storedSales));
      } else {
        setSales([]);
      }
    }
  }, []);

  // 2. Firebase Cloud Listener Syncer
  useEffect(() => {
    if (isFirebaseConfigured && db) {
      setIsSyncing(true);
      
      // Setup Firebase Auth observer
      const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          setIsFirebaseLive(true);
          
          // Setup real-time firestore queries
          const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
            const data: Product[] = [];
            snapshot.forEach((doc) => {
              data.push(doc.data() as Product);
            });
            setProducts(data);
          }, (err) => {
            handleFirestoreError(err, OperationType.LIST, 'products');
          });

          const unsubAudits = onSnapshot(collection(db, 'auditLogs'), (snapshot) => {
            const data: AuditLog[] = [];
            snapshot.forEach((doc) => {
              data.push(doc.data() as AuditLog);
            });
            // Sort audits showing chronologically newest first
            data.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setAuditLogs(data);
          }, (err) => {
            handleFirestoreError(err, OperationType.LIST, 'auditLogs');
          });

          const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
            const data: Sale[] = [];
            snapshot.forEach((doc) => {
              data.push(doc.data() as Sale);
            });
            data.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setSales(data);
            setIsSyncing(false);
          }, (err) => {
            handleFirestoreError(err, OperationType.LIST, 'sales');
          });

          return () => {
            unsubProducts();
            unsubAudits();
            unsubSales();
          };
        } else {
          setIsFirebaseLive(false);
          setIsSyncing(false);
          // Fallback to offline local copy immediately
          const storedProducts = localStorage.getItem('rh_products');
          const storedAudit = localStorage.getItem('rh_audit_logs');
          const storedSales = localStorage.getItem('rh_sales');
          setProducts(storedProducts ? JSON.parse(storedProducts) : DEFAULT_PRODUCTS);
          setAuditLogs(storedAudit ? JSON.parse(storedAudit) : []);
          setSales(storedSales ? JSON.parse(storedSales) : []);
        }
      });

      return () => unsubscribeAuth();
    }
  }, []);

  // 3. Sync State Helper (Saves to client localStorage cache)
  const saveStateLocally = (newProducts: Product[], newAudits: AuditLog[], newSales: Sale[]) => {
    localStorage.setItem('rh_products', JSON.stringify(newProducts));
    localStorage.setItem('rh_audit_logs', JSON.stringify(newAudits));
    localStorage.setItem('rh_sales', JSON.stringify(newSales));
  };

  // Google SSO provider
  const handleGoogleLogin = async () => {
    if (!isFirebaseConfigured) return;
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Google Auth SignIn Failed:", err);
    }
  };

  const handleLogout = async () => {
    if (!isFirebaseConfigured) return;
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout Failed:", err);
    }
  };

  // 4. Core Write Transaction Mutators
  
  // A. Add product category item to database catalog
  const handleAddProduct = async (productData: Omit<Product, 'id' | 'updatedAt'>, employeeName: string) => {
    const newId = 'prod_' + Math.floor(Math.random() * 1000000 + 100000).toString();
    const newProduct: Product = {
      ...productData,
      id: newId,
      updatedAt: new Date().toISOString()
    };

    const newLog: AuditLog = {
      id: 'log_' + Math.floor(Math.random() * 1000000).toString(),
      productId: newId,
      productName: productData.name,
      type: 'CREATE',
      delta: productData.quantity,
      quantityAfter: productData.quantity,
      employeeName,
      timestamp: new Date().toISOString(),
      notes: `Registered initial catalog entry @ Cost RM ${productData.costPrice.toFixed(2)}`
    };

    const updatedProducts = [...products, newProduct];
    const updatedAudits = [newLog, ...auditLogs];
    
    setProducts(updatedProducts);
    setAuditLogs(updatedAudits);
    saveStateLocally(updatedProducts, updatedAudits, sales);

    // Sync upward to Firestore database if online
    if (isFirebaseLive && db) {
      try {
        await setDoc(doc(db, 'products', newId), newProduct);
        await setDoc(doc(db, 'auditLogs', newLog.id), newLog);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `products/${newId}`);
      }
    }
  };

  // B. Update product specs or pricing information in catalog
  const handleUpdateProduct = async (productId: string, updatedFields: Partial<Product>, employeeName: string) => {
    const original = products.find(p => p.id === productId);
    if (!original) return;

    const modifiedProduct: Product = {
      ...original,
      ...updatedFields,
      updatedAt: new Date().toISOString(),
      updatedBy: employeeName
    };

    // Calculate delta differences for audit logs if stock shifts
    let stockDelta = 0;
    let eventType: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' = 'ADJUSTMENT';
    
    if (updatedFields.quantity !== undefined && updatedFields.quantity !== original.quantity) {
      stockDelta = updatedFields.quantity - original.quantity;
      eventType = stockDelta > 0 ? 'STOCK_IN' : 'STOCK_OUT';
    }

    const logsToAdd: AuditLog[] = [];
    if (stockDelta !== 0) {
      logsToAdd.push({
        id: 'log_' + Math.floor(Math.random() * 1000000).toString(),
        productId,
        productName: modifiedProduct.name,
        type: eventType,
        delta: stockDelta,
        quantityAfter: modifiedProduct.quantity,
        employeeName,
        timestamp: new Date().toISOString(),
        notes: `Manual stock level override adjustment by ${employeeName}.`
      });
    }

    // Standard specs modification notification log
    logsToAdd.push({
      id: 'log_' + Math.floor(Math.random() * 1000000).toString(),
      productId,
      productName: modifiedProduct.name,
      type: 'ADJUSTMENT',
      delta: 0,
      quantityAfter: modifiedProduct.quantity,
      employeeName,
      timestamp: new Date().toISOString(),
      notes: `Modified general parameters & retail pricing to RM ${modifiedProduct.salePrice.toFixed(2)}.`
    });

    const updatedProducts = products.map(p => p.id === productId ? modifiedProduct : p);
    const updatedAudits = [...logsToAdd, ...auditLogs];

    setProducts(updatedProducts);
    setAuditLogs(updatedAudits);
    saveStateLocally(updatedProducts, updatedAudits, sales);

    // Sync upstream
    if (isFirebaseLive && db) {
      try {
        await setDoc(doc(db, 'products', productId), modifiedProduct);
        for (const log of logsToAdd) {
          await setDoc(doc(db, 'auditLogs', log.id), log);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `products/${productId}`);
      }
    }
  };

  // B2. Bulk Update products specs or inventory levels in catalog
  const handleBulkUpdateProducts = async (
    updates: { id: string; fields: Partial<Product> }[],
    employeeName: string
  ) => {
    let currentProducts = [...products];
    let currentAudits = [...auditLogs];
    const logsToAdd: AuditLog[] = [];
    const modifiedProducts: Product[] = [];

    for (const update of updates) {
      const original = currentProducts.find(p => p.id === update.id);
      if (!original) continue;

      const modifiedProduct: Product = {
        ...original,
        ...update.fields,
        updatedAt: new Date().toISOString(),
        updatedBy: employeeName
      };

      // Calculate delta differences for audit logs if stock shifts
      let stockDelta = 0;
      let eventType: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' = 'ADJUSTMENT';

      if (update.fields.quantity !== undefined && update.fields.quantity !== original.quantity) {
        stockDelta = update.fields.quantity - original.quantity;
        eventType = stockDelta > 0 ? 'STOCK_IN' : 'STOCK_OUT';
      }

      if (stockDelta !== 0) {
        logsToAdd.push({
          id: 'log_' + Math.floor(Math.random() * 1000000).toString(),
          productId: update.id,
          productName: modifiedProduct.name,
          type: eventType,
          delta: stockDelta,
          quantityAfter: modifiedProduct.quantity,
          employeeName,
          timestamp: new Date().toISOString(),
          notes: `Bulk stock level adjustment by ${employeeName}.`
        });
      }

      // Specs modification notification log
      logsToAdd.push({
        id: 'log_' + Math.floor(Math.random() * 1000000).toString(),
        productId: update.id,
        productName: modifiedProduct.name,
        type: 'ADJUSTMENT',
        delta: 0,
        quantityAfter: modifiedProduct.quantity,
        employeeName,
        timestamp: new Date().toISOString(),
        notes: `Bulk dynamic adjustment update (Cost: RM ${modifiedProduct.costPrice.toFixed(2)}, Retail: RM ${modifiedProduct.salePrice.toFixed(2)}) by ${employeeName}.`
      });

      currentProducts = currentProducts.map(p => p.id === update.id ? modifiedProduct : p);
      modifiedProducts.push(modifiedProduct);
    }

    const updatedAudits = [...logsToAdd, ...currentAudits];

    setProducts(currentProducts);
    setAuditLogs(updatedAudits);
    saveStateLocally(currentProducts, updatedAudits, sales);

    // Sync upstream
    if (isFirebaseLive && db) {
      try {
        for (const p of modifiedProducts) {
          await setDoc(doc(db, 'products', p.id), p);
        }
        for (const log of logsToAdd) {
          await setDoc(doc(db, 'auditLogs', log.id), log);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `products/bulk_update`);
      }
    }
  };

  // C. Quick restock addition trigger (e.g. from alert dashboard)
  const handleQuickRestock = async (productId: string, quantityToIncrease: number, employeeName: string) => {
    const original = products.find(p => p.id === productId);
    if (!original) return;

    const updatedQty = original.quantity + quantityToIncrease;
    
    const modifiedProduct: Product = {
      ...original,
      quantity: updatedQty,
      updatedAt: new Date().toISOString(),
      updatedBy: employeeName
    };

    const newLog: AuditLog = {
      id: 'log_' + Math.floor(Math.random() * 1000000).toString(),
      productId,
      productName: original.name,
      type: 'STOCK_IN',
      delta: quantityToIncrease,
      quantityAfter: updatedQty,
      employeeName,
      timestamp: new Date().toISOString(),
      notes: `Restock shipment of ${quantityToIncrease} units checked in.`
    };

    const updatedProducts = products.map(p => p.id === productId ? modifiedProduct : p);
    const updatedAudits = [newLog, ...auditLogs];

    setProducts(updatedProducts);
    setAuditLogs(updatedAudits);
    saveStateLocally(updatedProducts, updatedAudits, sales);

    if (isFirebaseLive && db) {
      try {
        await setDoc(doc(db, 'products', productId), modifiedProduct);
        await setDoc(doc(db, 'auditLogs', newLog.id), newLog);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `products/${productId}`);
      }
    }
  };

  // D. Checkout item purchase (POS)
  const handleRecordSale = async (cartItems: SaleItem[], employeeName: string, customTimestamp?: string) => {
    const saleId = 'sale_' + Math.floor(Math.random() * 1000000).toString();
    const totalAmount = cartItems.reduce((acc, i) => acc + (i.quantity * i.salePrice), 0);
    const totalProfit = cartItems.reduce((acc, i) => acc + (i.quantity * (i.salePrice - i.costPrice)), 0);

    const saleTime = customTimestamp || new Date().toISOString();

    const newSale: Sale = {
      id: saleId,
      items: cartItems,
      totalAmount,
      profit: totalProfit,
      employeeName,
      timestamp: saleTime
    };

    // Decrement item levels across all sold products
    const logsToAdd: AuditLog[] = [];
    const updatedProducts = products.map(p => {
      const soldItem = cartItems.find(item => item.productId === p.id);
      if (soldItem) {
        const remainingQty = p.quantity - soldItem.quantity;
        
        logsToAdd.push({
          id: 'log_' + Math.floor(Math.random() * 1000000).toString(),
          productId: p.id,
          productName: p.name,
          type: 'SALE',
          delta: -soldItem.quantity,
          quantityAfter: remainingQty,
          employeeName,
          timestamp: saleTime,
          notes: `Sold ${soldItem.quantity} units to customer POS.`
        });

        return {
          ...p,
          quantity: remainingQty,
          updatedAt: new Date().toISOString(),
          updatedBy: employeeName
        };
      }
      return p;
    });

    const updatedSales = [newSale, ...sales];
    const updatedAudits = [...logsToAdd, ...auditLogs];

    setProducts(updatedProducts);
    setSales(updatedSales);
    setAuditLogs(updatedAudits);
    saveStateLocally(updatedProducts, updatedAudits, updatedSales);

    // Cloud firestore write sync batching
    if (isFirebaseLive && db) {
      try {
        await setDoc(doc(db, 'sales', saleId), newSale);
        for (const p of updatedProducts) {
          await setDoc(doc(db, 'products', p.id), p);
        }
        for (const log of logsToAdd) {
          await setDoc(doc(db, 'auditLogs', log.id), log);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `sales/${saleId}`);
      }
    }
  };

  // D1. Undo / Reverse latest sale transaction
  const handleUndoLatestSale = async () => {
    if (sales.length === 0) return;
    const latestSale = sales[0];

    // Restore item stock levels of all products in this transaction
    const updatedProducts = products.map(p => {
      const soldItem = latestSale.items.find(item => item.productId === p.id);
      if (soldItem) {
        const restoredQty = p.quantity + soldItem.quantity;
        return {
          ...p,
          quantity: restoredQty,
          updatedAt: new Date().toISOString(),
          updatedBy: 'System Reversal'
        };
      }
      return p;
    });

    // Remove matching audit logs
    const updatedAudits = [...auditLogs];
    const logIdsToDelete: string[] = [];
    for (const item of latestSale.items) {
      const index = updatedAudits.findIndex(log => 
        log.type === 'SALE' && 
        log.productId === item.productId && 
        log.delta === -item.quantity
      );
      if (index !== -1) {
        logIdsToDelete.push(updatedAudits[index].id);
        updatedAudits.splice(index, 1);
      }
    }

    const updatedSales = sales.slice(1);

    setProducts(updatedProducts);
    setSales(updatedSales);
    setAuditLogs(updatedAudits);
    saveStateLocally(updatedProducts, updatedAudits, updatedSales);

    // Sync deletion & updates with Firebase
    if (isFirebaseLive && db) {
      try {
        await deleteDoc(doc(db, 'sales', latestSale.id));
        for (const p of updatedProducts) {
          const originalProd = products.find(op => op.id === p.id);
          if (originalProd && originalProd.quantity !== p.quantity) {
            await setDoc(doc(db, 'products', p.id), p);
          }
        }
        for (const logId of logIdsToDelete) {
          await deleteDoc(doc(db, 'auditLogs', logId));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `sales/undo/${latestSale.id}`);
      }
    }
  };

  // D1b. Delete specific sale transaction by ID and restore inventory stock
  const handleDeleteSale = async (saleId: string) => {
    const targetSale = sales.find(s => s.id === saleId);
    if (!targetSale) return;

    // Restore item stock levels of all products in this transaction
    const updatedProducts = products.map(p => {
      const soldItem = targetSale.items.find(item => item.productId === p.id);
      if (soldItem) {
        const restoredQty = p.quantity + soldItem.quantity;
        return {
          ...p,
          quantity: restoredQty,
          updatedAt: new Date().toISOString(),
          updatedBy: 'Sale Deleted / Reversal'
        };
      }
      return p;
    });

    // Remove matching audit logs
    const updatedAudits = [...auditLogs];
    const logIdsToDelete: string[] = [];
    for (const item of targetSale.items) {
      const index = updatedAudits.findIndex(log => 
        log.type === 'SALE' && 
        log.productId === item.productId && 
        log.delta === -item.quantity &&
        log.timestamp === targetSale.timestamp
      );
      if (index !== -1) {
        logIdsToDelete.push(updatedAudits[index].id);
        updatedAudits.splice(index, 1);
      }
    }

    const updatedSales = sales.filter(s => s.id !== saleId);

    setProducts(updatedProducts);
    setSales(updatedSales);
    setAuditLogs(updatedAudits);
    saveStateLocally(updatedProducts, updatedAudits, updatedSales);

    // Sync deletion & updates with Firebase
    if (isFirebaseLive && db) {
      try {
        await deleteDoc(doc(db, 'sales', targetSale.id));
        for (const p of updatedProducts) {
          const originalProd = products.find(op => op.id === p.id);
          if (originalProd && originalProd.quantity !== p.quantity) {
            await setDoc(doc(db, 'products', p.id), p);
          }
        }
        for (const logId of logIdsToDelete) {
          await deleteDoc(doc(db, 'auditLogs', logId));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `sales/delete/${targetSale.id}`);
      }
    }
  };

  // D1. Update existing sale transaction (edit date, name, and/or items)
  const handleUpdateSale = async (updatedSale: Sale) => {
    const updatedSales = sales.map(s => s.id === updatedSale.id ? updatedSale : s);
    setSales(updatedSales);
    saveStateLocally(products, auditLogs, updatedSales);

    if (isFirebaseLive && db) {
      try {
        await setDoc(doc(db, 'sales', updatedSale.id), updatedSale);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `sales/${updatedSale.id}`);
      }
    }
  };

  // D2. Withdraw/Take products for employee allocation
  const handleEmployeeTake = async (
    items: Array<{ productId: string; name: string; quantity: number }>,
    employeeName: string,
    department: string,
    reason: string
  ) => {
    const logsToAdd: AuditLog[] = [];
    const updatedProducts = products.map(p => {
      const takenItem = items.find(item => item.productId === p.id);
      if (takenItem) {
        const remainingQty = p.quantity - takenItem.quantity;
        const logId = 'log_' + Math.floor(Math.random() * 1000000).toString();
        
        logsToAdd.push({
          id: logId,
          productId: p.id,
          productName: p.name,
          type: 'STOCK_OUT',
          delta: -takenItem.quantity,
          quantityAfter: remainingQty,
          employeeName,
          timestamp: new Date().toISOString(),
          notes: `Taken by ${employeeName} (${department}): ${reason}`
        });

        return {
          ...p,
          quantity: remainingQty,
          updatedAt: new Date().toISOString(),
          updatedBy: employeeName
        };
      }
      return p;
    });

    const updatedAudits = [...logsToAdd, ...auditLogs];
    setProducts(updatedProducts);
    setAuditLogs(updatedAudits);
    saveStateLocally(updatedProducts, updatedAudits, sales);

    // Sync to Firestore
    if (isFirebaseLive && db) {
      try {
        for (const p of updatedProducts) {
          const takenItem = items.find(item => item.productId === p.id);
          if (takenItem) {
            await setDoc(doc(db, 'products', p.id), p);
          }
        }
        for (const log of logsToAdd) {
          await setDoc(doc(db, 'auditLogs', log.id), log);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `employeeTake`);
      }
    }
  };

  // D3. Return products taken for employee display/allocation
  const handleEmployeeReturn = async (
    items: Array<{ productId: string; name: string; quantity: number }>,
    employeeName: string,
    department: string,
    reason: string
  ) => {
    const logsToAdd: AuditLog[] = [];
    const updatedProducts = products.map(p => {
      const returnedItem = items.find(item => item.productId === p.id);
      if (returnedItem) {
        const afterQty = p.quantity + returnedItem.quantity;
        const logId = 'log_' + Math.floor(Math.random() * 1000000).toString();
        
        logsToAdd.push({
          id: logId,
          productId: p.id,
          productName: p.name,
          type: 'STOCK_IN',
          delta: returnedItem.quantity,
          quantityAfter: afterQty,
          employeeName,
          timestamp: new Date().toISOString(),
          notes: `Returned by ${employeeName} (${department}): ${reason}`
        });

        return {
          ...p,
          quantity: afterQty,
          updatedAt: new Date().toISOString(),
          updatedBy: employeeName
        };
      }
      return p;
    });

    const updatedAudits = [...logsToAdd, ...auditLogs];
    setProducts(updatedProducts);
    setAuditLogs(updatedAudits);
    saveStateLocally(updatedProducts, updatedAudits, sales);

    // Sync to Firestore
    if (isFirebaseLive && db) {
      try {
        for (const p of updatedProducts) {
          const returnedItem = items.find(item => item.productId === p.id);
          if (returnedItem) {
            await setDoc(doc(db, 'products', p.id), p);
          }
        }
        for (const log of logsToAdd) {
          await setDoc(doc(db, 'auditLogs', log.id), log);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `employeeReturn`);
      }
    }
  };

  // D4. Delete outstanding employee takeout/loan allocation and restore stock
  const handleDeleteOutstandingTakeout = async (employeeName: string, productId: string, outstandingQty: number) => {
    // 1. Restore item stock level for this product
    const updatedProducts = products.map(p => {
      if (p.id === productId) {
        const restoredQty = p.quantity + outstandingQty;
        return {
          ...p,
          quantity: restoredQty,
          updatedAt: new Date().toISOString(),
          updatedBy: 'Takeout Deleted / Reversal'
        };
      }
      return p;
    });

    // 2. Find and remove all TAKEOUT and RETURN audit logs for this employee and product
    const updatedAudits = [...auditLogs];
    const logIdsToDelete: string[] = [];

    for (let i = updatedAudits.length - 1; i >= 0; i--) {
      const log = updatedAudits[i];
      if (log.productId === productId && (log.notes.startsWith('Taken by') || log.notes.startsWith('Returned by'))) {
        let logEmp = log.employeeName || 'Authorized staff';
        const match = log.notes.match(/Taken by\s+([^(]+)\s+\(([^)]+)\):/i);
        if (match) {
          logEmp = match[1].trim();
        } else {
          const returnMatch = log.notes.match(/Returned by\s+([^(]+)\s+\(([^)]+)\):/i);
          if (returnMatch) {
            logEmp = returnMatch[1].trim();
          }
        }
        if (logEmp.toLowerCase() === employeeName.toLowerCase()) {
          logIdsToDelete.push(log.id);
          updatedAudits.splice(i, 1);
        }
      }
    }

    setProducts(updatedProducts);
    setAuditLogs(updatedAudits);
    saveStateLocally(updatedProducts, updatedAudits, sales);

    // Sync with Firebase
    if (isFirebaseLive && db) {
      try {
        const prodToSave = updatedProducts.find(p => p.id === productId);
        if (prodToSave) {
          await setDoc(doc(db, 'products', productId), prodToSave);
        }
        for (const logId of logIdsToDelete) {
          await deleteDoc(doc(db, 'auditLogs', logId));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `takeout/delete/${productId}`);
      }
    }
  };

  // E. Delete Product Card Entirely from index list
  const handleDeleteProduct = async (productId: string, employeeName: string = "Manager") => {
    const original = products.find(p => p.id === productId);
    if (!original) return;

    const newLog: AuditLog = {
      id: 'log_' + Math.floor(Math.random() * 1000000).toString(),
      productId,
      productName: original.name,
      type: 'DELETE',
      delta: -original.quantity,
      quantityAfter: 0,
      employeeName: employeeName || "Manager",
      timestamp: new Date().toISOString(),
      notes: `De-registered entire product line "${original.name}" from database. Authorized by ${employeeName || "Manager"}.`
    };

    const updatedProducts = products.filter(p => p.id !== productId);
    const updatedAudits = [newLog, ...auditLogs];

    setProducts(updatedProducts);
    setAuditLogs(updatedAudits);
    saveStateLocally(updatedProducts, updatedAudits, sales);

    if (isFirebaseLive && db) {
      try {
        await deleteDoc(doc(db, 'products', productId));
        await setDoc(doc(db, 'auditLogs', newLog.id), newLog);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
      }
    }
  };

  // F. Restore complete database JSON Backups
  const handleRestoreBackup = async (backup: BackupData) => {
    setProducts(backup.products);
    setAuditLogs(backup.auditLogs);
    setSales(backup.sales);
    saveStateLocally(backup.products, backup.auditLogs, backup.sales);

    // If live write cloud backup syncing
    if (isFirebaseLive && db) {
      try {
        for (const prod of backup.products) {
          await setDoc(doc(db, 'products', prod.id), prod);
        }
        for (const log of backup.auditLogs) {
          await setDoc(doc(db, 'auditLogs', log.id), log);
        }
        for (const sale of backup.sales) {
          await setDoc(doc(db, 'sales', sale.id), sale);
        }
      } catch (err) {
        console.error("Firebase cloud restore upload errored:", err);
      }
    }
  };

  // G. Factory reset/clear memory cache database completely
  const handleClearDatabase = async () => {
    setProducts(DEFAULT_PRODUCTS);
    setAuditLogs([]);
    setSales([]);
    saveStateLocally(DEFAULT_PRODUCTS, [], []);

    if (isFirebaseLive && db) {
      try {
        for (const prod of products) {
          await deleteDoc(doc(db, 'products', prod.id));
        }
        for (const log of auditLogs) {
          await deleteDoc(doc(db, 'auditLogs', log.id));
        }
        for (const sale of sales) {
          await deleteDoc(doc(db, 'sales', sale.id));
        }
        // Repopulate firestore initial defaults
        for (const prod of DEFAULT_PRODUCTS) {
          await setDoc(doc(db, 'products', prod.id), prod);
        }
      } catch (err) {
        console.error("Firebase database purge interrupted:", err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row antialiased font-sans">
      
      {/* Interactive Left Side Navigation Rail */}
      <aside className="w-full md:w-68 bg-white text-slate-700 flex flex-col border-r border-slate-200 shrink-0 select-none">
        
        {/* Company Branding Logo Block */}
        <div className="p-6 border-b border-slate-200 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-md">
              <Database size={18} />
            </div>
            <div>
              <h1 className="font-extrabold text-sm text-slate-900 tracking-wide">RH COMPUTER TECH</h1>
              <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase block mt-0.5">Inventory Core</span>
            </div>
          </div>
          
          {/* Cloud Sync Level Badge */}
          <div className="mt-4 flex items-center justify-between bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              {isFirebaseLive ? (
                <Cloud size={14} className="text-emerald-600 shrink-0" />
              ) : (
                <CloudOff size={14} className="text-slate-400 shrink-0" />
              )}
              <span className="truncate text-[10px] text-slate-500 font-semibold">
                {isFirebaseLive ? 'Cloud Synced' : 'Sandbox Storage'}
              </span>
            </div>
            <span className={`h-1.5 w-1.5 rounded-full ${isFirebaseLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
          </div>
        </div>

        {/* Action Link Buttons */}
        <nav className="flex-1 p-4 space-y-1" id="nav-actions">
          
          <button 
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
              activeTab === 'dashboard' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10' 
                : 'hover:bg-slate-50 hover:text-slate-900 text-slate-600'
            }`}
          >
            <LayoutDashboard size={16} />
            Control Dashboard
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
              activeTab === 'inventory' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10' 
                : 'hover:bg-slate-50 hover:text-slate-900 text-slate-600'
            }`}
          >
            <Package size={16} />
            Inventory Catalog
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('pos')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
              activeTab === 'pos' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10' 
                : 'hover:bg-slate-50 hover:text-slate-900 text-slate-600'
            }`}
          >
            <ShoppingCart size={16} />
            POS Checkout Register
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('scanner')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
              activeTab === 'scanner' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10' 
                : 'hover:bg-slate-50 hover:text-slate-900 text-slate-600'
            }`}
          >
            <Scan size={16} />
            Barcode Scanner
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('take')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
              activeTab === 'take' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10' 
                : 'hover:bg-slate-50 hover:text-slate-900 text-slate-600'
            }`}
          >
            <UserCheck size={16} />
            Employee Takeout Portal
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
              activeTab === 'backup' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10' 
                : 'hover:bg-slate-50 hover:text-slate-900 text-slate-600'
            }`}
          >
            <Database size={16} />
            Cloud Database & Backup
          </button>

          {/* Mute Alerts Toggle */}
          <div className="pt-2 border-t border-slate-200 mt-2" id="mute-alerts-container">
            <button
              type="button"
              onClick={handleToggleMuteAlerts}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                muteAlerts || isCurrentlyQuietHours()
                  ? 'bg-rose-50 text-rose-750 border border-rose-200/80 hover:bg-rose-100/80' 
                  : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
              }`}
              id="btn-toggle-mute-alerts"
              title={muteAlerts || isCurrentlyQuietHours() ? "Unmute low-stock audio alerts" : "Mute low-stock audio alerts"}
            >
              <div className="flex items-center gap-3">
                {muteAlerts || isCurrentlyQuietHours() ? <VolumeX size={16} className="text-rose-600" /> : <Volume2 size={16} className="text-emerald-600" />}
                <span>Mute Audio Alarm</span>
              </div>
              <div className="flex items-center">
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md uppercase tracking-wider font-bold ${
                  muteAlerts || isCurrentlyQuietHours() ? 'bg-rose-200 text-rose-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  {muteAlerts || isCurrentlyQuietHours() ? (isCurrentlyQuietHours() ? 'AUTO' : 'ON') : 'OFF'}
                </span>
              </div>
            </button>

            {quietHoursEnabled && (
              <div className={`mt-1.5 px-3 py-1.5 rounded-lg flex items-center justify-between text-[10px] font-medium border ${
                isCurrentlyQuietHours()
                  ? 'bg-rose-50 border-rose-200/60 text-rose-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`} id="quiet-hours-sidebar-badge">
                <span className="flex items-center gap-1.5">
                  <Clock size={11} className={isCurrentlyQuietHours() ? "animate-pulse text-rose-500" : "text-emerald-600"} />
                  <span>{isCurrentlyQuietHours() ? 'Auto-Muted (Quiet)' : 'Quiet Scheduled'}</span>
                </span>
                <span className="font-mono text-[9px] bg-white leading-none px-1 py-0.5 rounded border border-slate-200 text-slate-600">
                  {quietHoursStart} - {quietHoursEnd}
                </span>
              </div>
            )}
          </div>
        </nav>

        {/* Database SSO login check indicators */}
        <div className="p-4 border-t border-slate-200 text-xs font-mono">
          {isFirebaseConfigured ? (
            <div className="space-y-3">
              {user ? (
                <div className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200 p-2 rounded-lg">
                  <div className="min-w-0 pr-1 flex items-center gap-1.5">
                    <User size={14} className="text-emerald-600 shrink-0" />
                    <span className="truncate text-[10px] uppercase font-bold text-slate-700">{user.email?.split('@')[0]}</span>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="p-1 hover:text-rose-600 rounded transition-colors cursor-pointer text-slate-400"
                    title="Logout Authorized System"
                  >
                    <Power size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-emerald-700 border border-slate-200 p-2 rounded-xl text-[10px] font-bold tracking-wide uppercase transition-colors"
                >
                  Remote Admin Sign In
                </button>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-slate-500 bg-slate-50/50 p-2.5 rounded-lg border border-slate-200/60 text-left leading-normal">
              ⚡ Local Independent Cache Mode Activated. Trigger firebase build rules to sync cloud databases.
            </div>
          )}
        </div>
      </aside>

      {/* Main Viewport Content Panel */}
      <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full">
        
        {/* Simple loader if Firebase reads state */}
        {isSyncing ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <RefreshCw size={36} className="text-emerald-650 animate-spin" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Synchronizing Remote Cloud Inventory...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.18 }}
            >
              {activeTab === 'dashboard' && (
                <Dashboard 
                  products={products}
                  auditLogs={auditLogs}
                  sales={sales}
                  onQuickRestock={handleQuickRestock}
                  onSetTab={setActiveTab}
                  initialRestockId={globalRestockId}
                  onClearInitialRestock={() => setGlobalRestockId(null)}
                />
              )}

              {activeTab === 'inventory' && (
                <InventoryList 
                  products={products}
                  auditLogs={auditLogs}
                  onAddProduct={handleAddProduct}
                  onUpdateProduct={handleUpdateProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onBulkUpdateProducts={handleBulkUpdateProducts}
                />
              )}

              {activeTab === 'pos' && (
                <POSSales 
                  products={products}
                  sales={sales}
                  onRecordSale={handleRecordSale}
                  initialCart={pendingPOSCart}
                  initialEmployee={pendingPOSEmployee}
                  onClearInitialPOS={() => {
                    setPendingPOSCart([]);
                    setPendingPOSEmployee('');
                  }}
                  onUpdateSale={handleUpdateSale}
                  onUndoSale={handleUndoLatestSale}
                  onDeleteSale={handleDeleteSale}
                  onUpdateProductPrice={(productId, newPrice) => {
                    handleUpdateProduct(productId, { salePrice: newPrice }, 'POS Checkout Override');
                  }}
                />
              )}

              {activeTab === 'scanner' && (
                <BarcodeScanner 
                  products={products}
                  onBarcodeScanned={(code) => {
                    // When scanner reads code, open inventory list instantly filtered to view that item!
                    setActiveTab('inventory');
                  }}
                />
              )}

              {activeTab === 'take' && (
                <EmployeeTake 
                  products={products}
                  auditLogs={auditLogs}
                  onEmployeeTake={handleEmployeeTake}
                  onEmployeeReturn={handleEmployeeReturn}
                  onSellRedirect={(items, name) => {
                    setPendingPOSCart(items);
                    setPendingPOSEmployee(name);
                    setActiveTab('pos');
                  }}
                  onDeleteOutstanding={handleDeleteOutstandingTakeout}
                />
              )}

              {activeTab === 'backup' && (
                <BackupControl 
                  products={products}
                  auditLogs={auditLogs}
                  sales={sales}
                  isFirebaseSynced={isFirebaseLive}
                  onRestoreBackup={handleRestoreBackup}
                  onClearDatabase={handleClearDatabase}
                  autoSyncEnabled={autoSyncEnabled}
                  onToggleAutoSync={(enabled) => {
                    setAutoSyncEnabled(enabled);
                    localStorage.setItem('autoSyncEnabled', String(enabled));
                  }}
                  autoSyncInterval={autoSyncInterval}
                  onSetAutoSyncInterval={(interval) => {
                    setAutoSyncInterval(interval);
                    localStorage.setItem('autoSyncInterval', String(interval));
                  }}
                  lastSyncedTime={lastSyncedTime}
                  onManualRefresh={refreshFirebaseData}
                  quietHoursEnabled={quietHoursEnabled}
                  onToggleQuietHours={handleToggleQuietHours}
                  quietHoursStart={quietHoursStart}
                  onSetQuietHoursStart={handleSetQuietHoursStart}
                  quietHoursEnd={quietHoursEnd}
                  onSetQuietHoursEnd={handleSetQuietHoursEnd}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Global Browser-Based Toast Notifications Center Layer */}
      <div className="fixed top-4 right-4 z-[9999] space-y-3 max-w-sm w-full pointer-events-none no-print">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ type: 'spring', damping: 15, stiffness: 180 }}
              className="p-4 rounded-xl shadow-xl border flex flex-col gap-2 text-left pointer-events-auto transition-shadow hover:shadow-2xl relative overflow-hidden bg-slate-900 border-slate-800 text-white"
              style={{
                background: toast.type === 'critical' ? 'linear-gradient(135deg, #1e1b4b 0%, #111827 100%)' : 'linear-gradient(135deg, #111827 0%, #030712 100%)'
              }}
            >
              {/* Colored Side Strip for Severity indication */}
              <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${toast.type === 'critical' ? 'bg-rose-500' : 'bg-amber-500'}`}></div>

              <div className="flex justify-between items-start gap-3 pl-1.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      toast.type === 'critical' ? 'bg-rose-500' : 'bg-amber-500'
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      toast.type === 'critical' ? 'bg-rose-500' : 'bg-amber-500'
                    }`}></span>
                  </div>
                  <h4 className="font-extrabold text-[10px] uppercase tracking-widest text-slate-400 font-sans">
                    {toast.type === 'critical' ? 'Critical Out of Stock' : 'Low Stock Alert'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="pl-1.5 space-y-1">
                <p className="text-xs font-black text-slate-100 leading-tight">
                  {toast.name}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <span className="text-slate-400 font-bold">Qty:</span>
                  <span className={`font-black p-0.5 px-1 rounded-md ${
                    toast.type === 'critical' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {toast.quantity} units left
                  </span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-400">Min: {toast.threshold}</span>
                </div>
              </div>

              <div className="pl-1.5 flex flex-wrap gap-1.5 pt-1 font-sans">
                <button
                  type="button"
                  onClick={() => {
                    setGlobalRestockId(toast.productId);
                    setActiveTab('dashboard');
                    setToasts(prev => prev.filter(t => t.id !== toast.id));
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[9px] py-1.5 px-2.5 rounded-lg uppercase tracking-wider transition-all cursor-pointer shadow-sm shadow-emerald-600/15"
                >
                  Quick Restock →
                </button>

                {(!toast.emailStatus || toast.emailStatus === 'idle') && (
                  <button
                    type="button"
                    onClick={() => handleSendProcurementEmail(toast.id)}
                    className="border border-emerald-550 hover:border-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 hover:text-emerald-200 font-extrabold text-[9px] py-1.5 px-2.5 rounded-lg uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Mail size={10} />
                    <span>Send Email</span>
                  </button>
                )}

                {toast.emailStatus === 'sending' && (
                  <button
                    type="button"
                    disabled
                    className="border border-emerald-750 bg-emerald-950/20 text-emerald-400 font-extrabold text-[9px] py-1.5 px-2.5 rounded-lg uppercase tracking-wider transition-all flex items-center gap-1.5"
                  >
                    <svg className="animate-spin h-2.5 w-2.5 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Sending...</span>
                  </button>
                )}

                {toast.emailStatus === 'sent' && (
                  <div className="flex items-center gap-1 px-2 py-1.5 border border-emerald-500/30 bg-emerald-950/40 text-emerald-400 rounded-lg shrink-0">
                    <Check size={11} className="shrink-0 text-emerald-400" />
                    <span className="font-extrabold text-[9px] uppercase tracking-wider">Sent to Procurement!</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-extrabold text-[9px] py-1.5 px-2.5 rounded-lg uppercase tracking-wider transition-all cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
