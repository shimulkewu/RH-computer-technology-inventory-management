/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Database, 
  Download, 
  Upload, 
  CloudLightning, 
  ShieldAlert, 
  ShieldCheck, 
  RefreshCw, 
  Trash2,
  CheckCircle2,
  FileJson,
  FileSpreadsheet,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  User,
  AlertTriangle,
  FileText,
  Clock,
  Briefcase,
  Calendar,
  TrendingUp,
  Users,
  ShoppingCart,
  Moon,
  VolumeX
} from 'lucide-react';
import { Product, AuditLog, Sale, BackupData } from '../types';
import { generateManagementSummaryPDF } from '../utils/pdfGenerator';

const DEMO_AUDIT_LOGS: AuditLog[] = [
  {
    id: "demo-log-1",
    productId: "prod-1",
    productName: "Thermal Grizzly Kryonaut Extreme 2g",
    type: "STOCK_IN",
    delta: 30,
    quantityAfter: 48,
    employeeName: "Sarah Tan",
    timestamp: "2026-06-05T09:12:00Z",
    notes: "Regular restocking of core thermal compounds"
  },
  {
    id: "demo-log-2",
    productId: "prod-3",
    productName: "Noctua NH-D15 Chromax.Black Dual Tower",
    type: "STOCK_OUT",
    delta: -2,
    quantityAfter: 10,
    employeeName: "Sarah Tan",
    timestamp: "2026-06-05T09:42:00Z",
    notes: "Taken by Sarah Tan (Research & Development): QA Test Completed"
  },
  {
    id: "demo-log-3",
    productId: "prod-2",
    productName: "Logitech G Pro X Superlight Wireless Mech",
    type: "SALE",
    delta: -1,
    quantityAfter: 15,
    employeeName: "Karthik S.",
    timestamp: "2026-06-04T14:20:00Z",
    notes: "Sold 1x Logitech G Pro X Superlight via POS register"
  },
  {
    id: "demo-log-4",
    productId: "prod-1",
    productName: "Thermal Grizzly Kryonaut Extreme 2g",
    type: "SALE",
    delta: -4,
    quantityAfter: 44,
    employeeName: "Sarah Tan",
    timestamp: "2026-06-05T10:15:00Z",
    notes: "Sold 4 units from active POS counter"
  },
  {
    id: "demo-log-5",
    productId: "prod-4",
    productName: "ASUS ROG Swift PG279QM IPS display",
    type: "ADJUSTMENT",
    delta: 1,
    quantityAfter: 4,
    employeeName: "M. Fauzi",
    timestamp: "2026-06-06T11:05:00Z",
    notes: "Inventory reconciliation audit"
  }
];

const DEMO_SALES: Sale[] = [
  {
    id: "demo-sale-1",
    items: [
      {
        productId: "prod-1",
        name: "Thermal Grizzly Kryonaut Extreme 2g",
        barcode: "955123456701",
        quantity: 4,
        salePrice: 129.00,
        costPrice: 85.00
      }
    ],
    totalAmount: 516.00,
    profit: 176.00,
    employeeName: "Sarah Tan",
    timestamp: "2026-06-05T10:15:00Z"
  },
  {
    id: "demo-sale-2",
    items: [
      {
        productId: "prod-2",
        name: "Logitech G Pro X Superlight Wireless Mech",
        barcode: "955123456702",
        quantity: 1,
        salePrice: 650.00,
        costPrice: 480.00
      }
    ],
    totalAmount: 650.00,
    profit: 170.00,
    employeeName: "Karthik S.",
    timestamp: "2026-06-04T14:20:00Z"
  }
];

interface BackupControlProps {
  products: Product[];
  auditLogs: AuditLog[];
  sales: Sale[];
  isFirebaseSynced: boolean;
  onRestoreBackup: (backup: BackupData) => void;
  onClearDatabase: () => void;
  autoSyncEnabled?: boolean;
  onToggleAutoSync?: (enabled: boolean) => void;
  autoSyncInterval?: number;
  onSetAutoSyncInterval?: (interval: number) => void;
  lastSyncedTime?: string | null;
  onManualRefresh?: () => Promise<void>;
  quietHoursEnabled: boolean;
  onToggleQuietHours: (enabled: boolean) => void;
  quietHoursStart: string;
  onSetQuietHoursStart: (start: string) => void;
  quietHoursEnd: string;
  onSetQuietHoursEnd: (end: string) => void;
}

export default function BackupControl({ 
  products, 
  auditLogs, 
  sales, 
  isFirebaseSynced, 
  onRestoreBackup,
  onClearDatabase,
  autoSyncEnabled = false,
  onToggleAutoSync = () => {},
  autoSyncInterval = 30,
  onSetAutoSyncInterval = () => {},
  lastSyncedTime = null,
  onManualRefresh = async () => {},
  quietHoursEnabled,
  onToggleQuietHours,
  quietHoursStart,
  onSetQuietHoursStart,
  quietHoursEnd,
  onSetQuietHoursEnd
}: BackupControlProps) {
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [secondsUntilNextSync, setSecondsUntilNextSync] = useState<number>(autoSyncInterval);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  React.useEffect(() => {
    if (!autoSyncEnabled) {
      setSecondsUntilNextSync(autoSyncInterval);
      return;
    }

    setSecondsUntilNextSync(autoSyncInterval);

    const countdownTimer = setInterval(() => {
      setSecondsUntilNextSync((prev) => {
        if (prev <= 1) {
          return autoSyncInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownTimer);
  }, [autoSyncEnabled, autoSyncInterval]);

  const handleManualSyncClick = async () => {
    setIsManualRefreshing(true);
    try {
      await onManualRefresh();
      setSecondsUntilNextSync(autoSyncInterval);
    } finally {
      setIsManualRefreshing(false);
    }
  };

  // Employee Session Analytics Report State
  const [rptEmployee, setRptEmployee] = useState<string>('');
  const [rptStartDate, setRptStartDate] = useState<string>(() => {
    const d = new Date("2026-06-09T04:51:39Z");
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [rptEndDate, setRptEndDate] = useState<string>("2026-06-15");
  const [includeDemoData, setIncludeDemoData] = useState<boolean>(true);

  // PDF Management Report Setup
  const [pdfDateMode, setPdfDateMode] = useState<'weekly' | 'all'>('weekly');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);

  const handleGeneratePDF = () => {
    setIsGeneratingPDF(true);
    setPdfSuccessMessage(null);
    setImportError(null);
    setTimeout(() => {
      try {
        const doc = generateManagementSummaryPDF(products, sales, auditLogs, pdfDateMode);
        doc.save(`rh_management_summary_${pdfDateMode}_${new Date().toISOString().split('T')[0]}.pdf`);
        setPdfSuccessMessage(`Report compiled successfully!`);
      } catch (err) {
        console.error("PDF generation error", err);
        setImportError("Failed to calculate PDF vectors: audit logs parsing mismatch.");
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 1000);
  };

  // Admin security authentication mechanism
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // States for Restore Backup Confirmation Modal
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [restoreConfirmInput, setRestoreConfirmInput] = useState('');
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null);

  const handleAdminAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (adminUsername.trim().toLowerCase() !== 'admin') {
      setAuthError('Unauthorized username access. Authentication failed.');
      return;
    }

    if (adminPassword !== 'admin1234') {
      setAuthError('Invalid system administration security code.');
      return;
    }

    if (confirmPhrase !== 'RESET') {
      setAuthError('Safety key phrase mismatch! Type "RESET" to override system safety state and authorize factory reset.');
      return;
    }

    // Success - trigger reset
    setIsResetting(true);
    setTimeout(() => {
      onClearDatabase();
      setIsResetting(false);
      setIsAuthModalOpen(false);
      // Reset state inputs
      setAdminUsername('');
      setAdminPassword('');
      setConfirmPhrase('');
      setImportSuccess('System Factory Reset: Wiped all custom registers and synchronized initial default hardware states.');
    }, 1550);
  };

  // 1. Export trigger
  const triggerExport = () => {
    const backup: BackupData = {
      products,
      auditLogs,
      sales,
      exportedAt: new Date().toISOString(),
      businessName: "RH COMPUTER TECHNOLOGY"
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rh_computer_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 1b. CSV Export trigger
  const triggerCSVExport = (type: 'all' | 'inventory' | 'sales') => {
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      str = str.replace(/"/g, '""');
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str}"`;
      }
      return str;
    };

    const downloadFile = (content: string, filename: string) => {
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    if (type === 'inventory' || type === 'all') {
      const headers = [
        'Product ID',
        'Product Name',
        'Barcode SKU Code',
        'Category',
        'Description',
        'Cost Price ($)',
        'Sale Price ($)',
        'Current Stock Quantity',
        'Min Reorder Threshold',
        'Last Updated Timestamp',
        'Last Updated Author'
      ];

      const rows = products.map(p => [
        p.id,
        p.name,
        p.barcode,
        p.category,
        p.description || '',
        p.costPrice,
        p.salePrice,
        p.quantity,
        p.minStockThreshold,
        p.updatedAt,
        p.updatedBy || 'System'
      ]);

      const csvContent = "\uFEFF" + [headers, ...rows]
        .map(row => row.map(cell => escapeCSV(cell)).join(','))
        .join('\n');

      downloadFile(csvContent, `rh_inventory_report_${new Date().toISOString().split('T')[0]}.csv`);
    }

    if (type === 'sales' || type === 'all') {
      const executeSalesDownload = () => {
        const headers = [
          'Sale ID',
          'Receipt Date & Time',
          'Cashier Employee Name',
          'Total Paid Amount ($)',
          'Total Net Profit ($)',
          'Sold Product ID',
          'Sold Product Name',
          'Sold Product SKU Barcode',
          'Sold Item Quantity',
          'Sold Item Unit Cost Price ($)',
          'Sold Item Unit Sale Price ($)',
          'Total Row Revenue ($)',
          'Total Row Cost ($)',
          'Total Row Gross Profit ($)'
        ];

        const rows: any[] = [];
        sales.forEach(s => {
          s.items.forEach(item => {
            const rowRevenue = item.quantity * item.salePrice;
            const rowCost = item.quantity * item.costPrice;
            const rowProfit = rowRevenue - rowCost;
            rows.push([
              s.id,
              s.timestamp,
              s.employeeName || 'Staff Cashier',
              s.totalAmount,
              s.profit,
              item.productId,
              item.name,
              item.barcode,
              item.quantity,
              item.costPrice,
              item.salePrice,
              rowRevenue,
              rowCost,
              rowProfit
            ]);
          });
        });

        const csvContent = "\uFEFF" + [headers, ...rows]
          .map(row => row.map(cell => escapeCSV(cell)).join(','))
          .join('\n');

        downloadFile(csvContent, `rh_sales_report_${new Date().toISOString().split('T')[0]}.csv`);
      };

      if (type === 'all') {
        setTimeout(executeSalesDownload, 150);
      } else {
        executeSalesDownload();
      }
    }
  };

  // 2. Import / Upload trigger
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as BackupData;

        // Structured Schema Validation
        if (!parsed.products || !Array.isArray(parsed.products)) {
          throw new Error('Invalid Backup File: "products" array not found.');
        }
        if (!parsed.auditLogs || !Array.isArray(parsed.auditLogs)) {
          throw new Error('Invalid Backup File: "auditLogs" array not found.');
        }
        if (!parsed.sales || !Array.isArray(parsed.sales)) {
          throw new Error('Invalid Backup File: "sales" array not found.');
        }

        // Validate first product if exists
        if (parsed.products.length > 0) {
          const first = parsed.products[0];
          if (!first.id || !first.barcode || !first.name || first.costPrice === undefined || first.salePrice === undefined) {
            throw new Error('Schema Mismatch: Products are missing mandatory barcode fields.');
          }
        }

        // Set pending backup for validation confirmation modal
        setPendingBackup(parsed);
        setIsRestoreConfirmOpen(true);
        setRestoreConfirmInput('');
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (err) {
        console.error("Backup restoration failed.", err);
        setImportError(err instanceof Error ? err.message : 'Invalid backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  // Combine real database records + optional demo records
  const effectiveSales = [...sales, ...(includeDemoData ? DEMO_SALES : [])];
  const effectiveAuditLogs = [...auditLogs, ...(includeDemoData ? DEMO_AUDIT_LOGS : [])];

  const parsedLogs = effectiveAuditLogs.map(log => {
    let employee = log.employeeName || 'System';
    let department = 'Operations Section';
    let reason = log.notes || '';
    
    if (log.notes) {
      if (log.notes.startsWith('Taken by')) {
        const match = log.notes.match(/Taken by\s+([^(]+)\s+\(([^)]+)\):\s*(.*)/i);
        if (match) {
          employee = match[1].trim();
          department = match[2].trim();
          reason = match[3].trim();
        }
      } else if (log.notes.startsWith('Returned by')) {
        const match = log.notes.match(/Returned by\s+([^(]+)\s+\(([^)]+)\):\s*(.*)/i);
        if (match) {
          employee = match[1].trim();
          department = match[2].trim();
          reason = match[3].trim();
        }
      }
    }
    
    return {
      ...log,
      employee,
      department,
      notesParsed: reason
    };
  });

  // Unique list of employees
  const uniqueEmployeeList = Array.from(new Set([
    ...effectiveSales.map(s => s.employeeName?.trim()),
    ...parsedLogs.map(log => log.employee?.trim())
  ].filter(name => name && name.toLowerCase() !== 'system' && name.toLowerCase() !== 'unknown staff'))).sort();

  // Set default employee if not set
  React.useEffect(() => {
    if (!rptEmployee && uniqueEmployeeList.length > 0) {
      setRptEmployee(uniqueEmployeeList[0]);
    }
  }, [uniqueEmployeeList, rptEmployee]);

  // Bound filters
  const startMs = rptStartDate ? new Date(rptStartDate + "T00:00:00").getTime() : 0;
  const endMs = rptEndDate ? new Date(rptEndDate + "T23:59:59").getTime() : Infinity;

  const filteredEmployeeSales = effectiveSales.filter(s => {
    const isEmployee = s.employeeName?.trim().toLowerCase() === rptEmployee.toLowerCase();
    const timeMs = new Date(s.timestamp).getTime();
    return isEmployee && timeMs >= startMs && timeMs <= endMs;
  });

  const filteredEmployeeLogs = parsedLogs.filter(log => {
    const isEmployee = log.employee?.trim().toLowerCase() === rptEmployee.toLowerCase();
    const timeMs = new Date(log.timestamp).getTime();
    return isEmployee && timeMs >= startMs && timeMs <= endMs;
  });

  // Calculate Metrics
  const totalSalesRevenue = filteredEmployeeSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalSalesProfit = filteredEmployeeSales.reduce((sum, s) => sum + s.profit, 0);
  
  const totalSalesItemsCount = filteredEmployeeSales.reduce((sum, s) => {
    return sum + s.items.reduce((acc, item) => acc + item.quantity, 0);
  }, 0);

  const totalLogsItemsCount = filteredEmployeeLogs.reduce((sum, log) => {
    return sum + Math.abs(log.delta || 0);
  }, 0);

  const totalItemsProcessed = totalSalesItemsCount + totalLogsItemsCount;

  // Extract all timestamps
  const timestamps = [
    ...filteredEmployeeSales.map(s => new Date(s.timestamp).getTime()),
    ...filteredEmployeeLogs.map(log => new Date(log.timestamp).getTime())
  ].sort((a, b) => a - b);

  let totalDurationMinutes = 0;
  let activeSessionsCount = 0;
  const sessionsList: Array<{ start: number, end: number, count: number }> = [];

  if (timestamps.length > 0) {
    let currentSessionStart = timestamps[0];
    let currentSessionLast = timestamps[0];
    let actionsInSession = 1;

    for (let i = 1; i < timestamps.length; i++) {
      const currentTimestamp = timestamps[i];
      const gapMs = currentTimestamp - currentSessionLast;

      if (gapMs <= 30 * 60 * 1000) {
        // Same session
        currentSessionLast = currentTimestamp;
        actionsInSession++;
      } else {
        // Close previous session
        const sessDurMin = (currentSessionLast - currentSessionStart) / (1000 * 60) + 15; // 15 mins padding
        totalDurationMinutes += sessDurMin;
        activeSessionsCount++;
        sessionsList.push({
          start: currentSessionStart,
          end: currentSessionLast,
          count: actionsInSession
        });

        // Start new session
        currentSessionStart = currentTimestamp;
        currentSessionLast = currentTimestamp;
        actionsInSession = 1;
      }
    }

    // Close last remaining session
    const lastSessDurMin = (currentSessionLast - currentSessionStart) / (1000 * 60) + 15;
    totalDurationMinutes += lastSessDurMin;
    activeSessionsCount++;
    sessionsList.push({
      start: currentSessionStart,
      end: currentSessionLast,
      count: actionsInSession
    });
  }

  // Format total active time elegantly
  const formatPlatformTime = (minutes: number) => {
    if (minutes === 0) return '0 minutes';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    if (hours > 0) {
      return `${hours} hr${hours > 1 ? 's' : ''} ${mins} min${mins > 1 ? 's' : ''}`;
    }
    return `${mins} minute${mins > 1 ? 's' : ''}`;
  };

  const formattedActiveTime = formatPlatformTime(totalDurationMinutes);

  // Combine chronological actions list for beautiful UI timeline list
  const combinedUserActionsList = [
    ...filteredEmployeeSales.map(s => ({
      key: `sale-${s.id}`,
      type: 'SALE' as const,
      timestamp: s.timestamp,
      title: `POS Customer Invoice #${s.id.slice(0, 8)}`,
      subtitle: `Invoice #${s.id.slice(0, 6)}`,
      units: s.items.reduce((acc, item) => acc + item.quantity, 0),
      money: s.totalAmount,
      notes: s.items.map(i => `${i.quantity}x ${i.name}`).join(', ')
    })),
    ...filteredEmployeeLogs.map(log => ({
      key: `log-${log.id}`,
      type: log.type,
      timestamp: log.timestamp,
      title: `${log.type.replace('_', ' ')}: ${log.productName.length > 32 ? log.productName.slice(0, 30) + '...' : log.productName}`,
      subtitle: log.department || 'Operations Team',
      units: Math.abs(log.delta || 0),
      money: null,
      notes: log.notesParsed || log.notes
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-6" id="backup-management-control">
      {/* Structural Headers */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Database size={22} className="text-indigo-600" />
          Cloud Synchronisation & Secure Database Backups
        </h2>
        <p className="text-sm text-slate-400">Perform seamless complete state captures, restore backups, or inspect secure cloud connection stats</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Sync Status Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between" id="backup-connection-info">
          <div>
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mb-2">
              <CloudLightning size={16} className="text-indigo-500" />
              Cloud Synchronisation Check
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-normal">Monitor server coordinates and secure continuous backup routines</p>

            {isFirebaseSynced ? (
              <div className="bg-emerald-50 border border-emerald-150 p-4 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                  <ShieldCheck size={18} className="text-emerald-600" />
                  <span>SECURE FIRESTORE SYNC ACTIVE</span>
                </div>
                <p className="text-[10px] text-emerald-600 font-sans leading-relaxed">
                  RH Computer Technology database is actively mirroring events directly to standard secure Firestores for remote multi-user synchronization.
                </p>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2 text-slate-800 text-xs font-bold">
                  <ShieldAlert size={18} className="text-indigo-600" />
                  <span>CLIENT-SIDE SECURE OFFLINE ARCHIVE</span>
                </div>
                <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                  Vanguard sandbox is running in secure standalone local persistence. Data is safely cached inside client offline sandboxes. Trigger full firebase setup to bind cloud sync.
                </p>
              </div>
            )}
          </div>

          <div className="text-[10px] font-mono text-slate-400 border-t border-slate-100 pt-3 mt-4 flex items-center justify-between">
            <span>AUDIT LOG TRACKED</span>
            <span>STANDBY STATE</span>
          </div>
        </div>

        {/* 🔄 Firebase Background Auto-Sync settings card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between" id="database-auto-sync-card">
          <div>
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mb-2">
              <RefreshCw size={16} className={`text-indigo-600 ${autoSyncEnabled ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
              Firebase Auto-Sync Settings
            </h3>
            <p className="text-xs text-slate-400 mb-4">Automatically query and refresh product lists, invoice registries, and signed logs from Firebase Firestore.</p>

            {/* Toggle Setting Switch */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-150 rounded-xl">
                <div className="text-left">
                  <span className="text-xs font-bold text-slate-700 block">Auto-Sync Status</span>
                  <span className="text-[10px] text-slate-400 block font-normal">
                    {autoSyncEnabled ? 'Background polling is active' : 'Offline persistence and manual trigger'}
                  </span>
                </div>
                {/* Modern Switch */}
                <button
                  type="button"
                  onClick={() => onToggleAutoSync(!autoSyncEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none cursor-pointer ${
                    autoSyncEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                  id="btn-toggle-auto-sync"
                  title={autoSyncEnabled ? "Disable auto sync" : "Enable auto sync"}
                >
                  <span 
                    className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                      autoSyncEnabled ? 'transform translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Interval Durations selection */}
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                  Auto-Sync Interval Timeout
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={autoSyncInterval}
                    onChange={(e) => onSetAutoSyncInterval(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-indigo-500"
                    disabled={!isFirebaseSynced}
                  >
                    <option value={10}>10 Seconds (Debug)</option>
                    <option value={30}>30 Seconds (Default)</option>
                    <option value={60}>1 Minute</option>
                    <option value={300}>5 Minutes</option>
                    <option value={900}>15 Minutes</option>
                  </select>

                  {/* Fully User-defined custom second input option */}
                  <div className="relative">
                    <input
                      type="number"
                      min={5}
                      max={7200}
                      value={autoSyncInterval}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 5;
                        onSetAutoSyncInterval(Math.max(5, val));
                      }}
                      className="w-full bg-slate-50 border border-slate-200 pl-3 pr-7 py-2 rounded-xl text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-indigo-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      disabled={!isFirebaseSynced}
                      title="Set custom seconds interval"
                      placeholder="Custom"
                    />
                    <span className="absolute right-2.5 top-2.5 text-[9px] font-bold text-slate-400">sec</span>
                  </div>
                </div>
                <p className="text-[9.5px] text-slate-400 font-sans">
                  Minimum security threshold: 5 seconds. Custom inputs can be defined instantly.
                </p>
              </div>

              {/* Real-time Status indicators */}
              <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl font-mono text-[9px] space-y-1 text-slate-500 text-left">
                <div className="flex justify-between">
                  <span>Last Cloud Pull:</span>
                  <span className="font-bold text-slate-700">
                    {lastSyncedTime 
                      ? new Date(lastSyncedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
                      : 'Never (Standby)'
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Next Sync loop:</span>
                  {autoSyncEnabled ? (
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-550"></span>
                      </span>
                      t-minus {secondsUntilNextSync}s
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Loop disabled</span>
                  )}
                </div>
                {!isFirebaseSynced && (
                  <div className="text-[8.5px] text-rose-500 font-semibold mt-1">
                    ⚠️ Configure Firestore sync to unlock interval timing hooks.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={handleManualSyncClick}
              disabled={isManualRefreshing || !isFirebaseSynced}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isManualRefreshing
                  ? 'bg-slate-100 text-slate-400'
                  : 'bg-emerald-50/55 hover:bg-emerald-100 text-emerald-750 hover:text-emerald-850'
              }`}
            >
              <RefreshCw size={11} className={`${isManualRefreshing ? 'animate-spin' : ''}`} />
              {isManualRefreshing ? 'Retrieving tables...' : 'Manual Sync Now'}
            </button>
          </div>
        </div>

        {/* Export Backups */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between" id="database-backup-saver">
          <div>
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mb-2">
              <Download size={16} className="text-emerald-600" />
              Export Database State
            </h3>
            <p className="text-xs text-slate-400 mb-4">Export all notebook inventories, checkout transactions, and signed employee records as a single download</p>

            <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl font-mono text-[10px] space-y-1.5 text-slate-505">
              <div className="flex justify-between">
                <span>Products Lines:</span>
                <span className="font-bold text-slate-800">{products.length} registered</span>
              </div>
              <div className="flex justify-between">
                <span>Sale Transactions:</span>
                <span className="font-bold text-slate-800">{sales.length} invoices</span>
              </div>
              <div className="flex justify-between">
                <span>Audit Logs Count:</span>
                <span className="font-bold text-slate-800">{auditLogs.length} actions</span>
              </div>
            </div>
          </div>

          <button
            onClick={triggerExport}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold p-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-4"
          >
            <Download size={14} />
            Download JSON Backup Archive
          </button>
        </div>

        {/* Export External CSV Reports */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between" id="database-csv-exporter">
          <div>
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mb-2">
              <FileSpreadsheet size={16} className="text-emerald-600" />
              Export Data to CSV
            </h3>
            <p className="text-xs text-slate-400 mb-4">Download spreadsheet-ready CSV files of your active systems for spreadsheets and external financial systems</p>

            <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl font-mono text-[10px] space-y-1.5">
              <div className="flex justify-between">
                <span>Inventory Rows:</span>
                <span className="font-bold text-slate-800">{products.length} items</span>
              </div>
              <div className="flex justify-between">
                <span>Sales Ledger Rows:</span>
                <span className="font-bold text-slate-800 text-emerald-700 font-extrabold">
                  {sales.reduce((total, sale) => total + sale.items.length, 0)} items
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <button
              onClick={() => triggerCSVExport('all')}
              className="w-full bg-emerald-600 hover:bg-emerald-750 text-white text-xs font-bold p-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs shadow-emerald-600/10"
              id="btn-export-all-csv"
            >
              <FileSpreadsheet size={14} />
              Export All to CSV
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => triggerCSVExport('inventory')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-705 text-[10px] font-bold p-2.5 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                title="Export Products Only"
                id="btn-export-inventory-csv"
              >
                Inventory CSV
              </button>
              <button
                type="button"
                onClick={() => triggerCSVExport('sales')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-705 text-[10px] font-bold p-2.5 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                title="Export Sales Ledger Only"
                id="btn-export-sales-csv"
              >
                Sales CSV
              </button>
            </div>
          </div>
        </div>

        {/* Generate Management Summary PDF */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between" id="database-pdf-reporter">
          <div>
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mb-2">
              <FileText size={16} className="text-emerald-600" />
              Management PDF Reports
            </h3>
            <p className="text-xs text-slate-400 mb-4">Compile high-fidelity multi-page PDF summaries containing margins, revenues, and transaction velocities.</p>

            <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                  Select Report Date Range
                </label>
                <div className="grid grid-cols-2 gap-1 bg-slate-150/60 p-1 rounded-lg border border-slate-200/50">
                  <button
                    type="button"
                    onClick={() => setPdfDateMode('weekly')}
                    className={`py-1 text-[9.5px] font-extrabold rounded-md transition-all uppercase tracking-tight text-center cursor-pointer ${
                      pdfDateMode === 'weekly'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    Weekly Summary
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfDateMode('all')}
                    className={`py-1 text-[9.5px] font-extrabold rounded-md transition-all uppercase tracking-tight text-center cursor-pointer ${
                      pdfDateMode === 'all'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    All-Time Logs
                  </button>
                </div>
              </div>

              <div className="font-mono text-[9.5px] space-y-1 pt-1.5 border-t border-slate-200/40 text-slate-505">
                <div className="flex justify-between">
                  <span>Scope Mode:</span>
                  <span className="font-bold text-emerald-700 uppercase">{pdfDateMode === 'weekly' ? '7-Day window' : 'Full system'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Date:</span>
                  <span className="font-bold text-slate-805">09-Jun-2026</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <button
              onClick={handleGeneratePDF}
              disabled={isGeneratingPDF}
              className={`w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold p-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                isGeneratingPDF ? 'opacity-80 cursor-wait' : ''
              }`}
              id="btn-generate-summary-pdf"
            >
              {isGeneratingPDF ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Compiling PDF Ledger...
                </>
              ) : (
                <>
                  <FileText size={14} />
                  Generate Summary PDF
                </>
              )}
            </button>

            {pdfSuccessMessage && (
              <p className="text-[10px] text-emerald-700 font-bold leading-tight animate-fade-in text-center mt-1">
                ✓ {pdfSuccessMessage}
              </p>
            )}
          </div>
        </div>

        {/* Restore Backups */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between" id="database-backup-restorer">
          <div>
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mb-2">
              <Upload size={16} className="text-emerald-600" />
              Restore Database State
            </h3>
            <p className="text-xs text-slate-400 mb-4">Upload a valid exported .json file to restore RH Computer Tech's full database state instantly</p>

            {/* Input pointer */}
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 px-2.5 border border-dashed border-slate-300 hover:border-emerald-500 rounded-xl bg-slate-50/50 hover:bg-emerald-50/10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5"
            >
              <FileJson size={28} className="text-slate-400" />
              <span className="text-xs font-semibold text-emerald-600 hover:text-emerald-850">Select Backup File</span>
              <span className="text-[10px] text-slate-400">Must be a valid rh_computer_backup_.json file</span>
            </button>
          </div>

          {importError && (
            <div className="mt-3 text-xs text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-lg">
              {importError}
            </div>
          )}

          {importSuccess && (
            <div className="mt-3 text-xs text-emerald-850 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg flex items-start gap-1.5">
              <CheckCircle2 size={14} className="shrink-0 text-emerald-600 mt-0.5" />
              <span className="leading-tight">{importSuccess}</span>
            </div>
          )}
        </div>

        {/* 🌙 Audio Quiet Hours Settings Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between" id="low-stock-quiet-hours-card">
          <div>
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mb-2">
              <Moon size={16} className="text-emerald-600 animate-[pulse_3s_infinite]" />
              Alarm Quiet Hours
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-normal">Define automatic blockout schedules to suppress low-stock audible alarm tones entirely during night or off-peak hours.</p>

            <div className="space-y-4 text-left">
              {/* Toggle Setting Switch */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-150 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Quiet Hours Status</span>
                  <span className="text-[10px] text-slate-400 block font-normal">
                    {quietHoursEnabled ? 'Schedule is active and mutes audio alerts' : 'Automatic scheduled muting is disabled'}
                  </span>
                </div>
                {/* Switch */}
                <button
                  type="button"
                  onClick={() => onToggleQuietHours(!quietHoursEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none cursor-pointer shrink-0 ${
                    quietHoursEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                  id="btn-toggle-quiet-hours"
                  title={quietHoursEnabled ? "Disable Quiet Hours" : "Enable Quiet Hours"}
                >
                  <span 
                    className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                      quietHoursEnabled ? 'transform translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Time Interval Inputs */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                  Active Quiet Hours Span
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 block mb-1">Starts At (Quiet)</span>
                    <input
                      type="time"
                      value={quietHoursStart}
                      onChange={(e) => onSetQuietHoursStart(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-emerald-500"
                      disabled={!quietHoursEnabled}
                      id="input-quiet-hours-start"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate-400 block mb-1">Ends At (Resumes)</span>
                    <input
                      type="time"
                      value={quietHoursEnd}
                      onChange={(e) => onSetQuietHoursEnd(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-emerald-500"
                      disabled={!quietHoursEnabled}
                      id="input-quiet-hours-end"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Status / Visual preview */}
              <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                quietHoursEnabled 
                  ? 'bg-emerald-50/40 border-emerald-150/40' 
                  : 'bg-slate-50 border-slate-200/60'
              }`}>
                <div className="shrink-0">
                  {quietHoursEnabled ? (
                    <div className="relative flex h-2 w-2 m-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </div>
                  ) : (
                    <div className="h-2 w-2 m-1 rounded-full bg-slate-300"></div>
                  )}
                </div>
                <div className="font-sans text-[10px] leading-normal">
                  {quietHoursEnabled ? (
                    <>
                      <p className="font-bold text-slate-700">Automatic blockout active</p>
                      <p className="text-slate-405 text-[9px]">Audible tones are muted between <span className="font-mono font-bold text-emerald-600">{quietHoursStart}</span> and <span className="font-mono font-bold text-emerald-600">{quietHoursEnd}</span> daily.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-slate-500">Muting schedule inactive</p>
                      <p className="text-slate-400 text-[9.5px]">Configure spans to prevent sudden alert alarms during off-hours.</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[9px] font-mono text-slate-400 text-left uppercase flex justify-between">
            <span>Scheduler State:</span>
            <span className={quietHoursEnabled ? "text-emerald-600 font-extrabold" : "text-slate-400 font-bold"}>
              {quietHoursEnabled ? 'monitoring live' : 'idle'}
            </span>
          </div>
        </div>

      </div>

      {/* 📊 Employee Sessions & Productivity Analytics Summary Report */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 animate-fade-in" id="employee-session-analytics-panel">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Users size={18} className="text-emerald-600" />
              Employee Platform Session Summary Report
            </h3>
            <p className="text-xs text-slate-405">
              Audit active sessions, operational counts of hardware processed, and cashier ring-ins within a custom date framework.
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
            <input 
              type="checkbox" 
              id="includeDemoDataCheckbox"
              checked={includeDemoData}
              onChange={(e) => setIncludeDemoData(e.target.checked)}
              className="rounded text-emerald-600 h-3.5 w-3.5 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="includeDemoDataCheckbox" className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block cursor-pointer select-none">
              Include Preset Demo Datasets
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Section A: Selection Filters & Parameters */}
          <div className="lg:col-span-4 bg-slate-50/50 border border-slate-200/60 p-5 rounded-2xl space-y-4">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-slate-200/40">
              <Calendar size={13} className="text-slate-500" />
              Audit Bounds Configuration
            </h4>

            {/* Employee Dropdown Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Select Attending Operator
              </label>
              {uniqueEmployeeList.length === 0 ? (
                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 p-3 rounded-xl text-left">
                  No active personnel recorded. Check the checkbox above to load demo operators.
                </div>
              ) : (
                <select
                  value={rptEmployee}
                  onChange={(e) => setRptEmployee(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600 text-slate-800"
                >
                  {uniqueEmployeeList.map((emp) => (
                    <option key={emp} value={emp}>
                      {emp}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Date Range Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Date From
                </label>
                <input
                  type="date"
                  value={rptStartDate}
                  onChange={(e) => setRptStartDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600 text-slate-800"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Date To
                </label>
                <input
                  type="date"
                  value={rptEndDate}
                  onChange={(e) => setRptEndDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600 text-slate-800"
                />
              </div>
            </div>

            {/* Heuristic Details */}
            <div className="bg-emerald-50/45 border border-emerald-100/50 p-4 rounded-xl space-y-1 text-left">
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block">Heuristic Time Calculation</span>
              <p className="text-[10.5px] text-slate-500 leading-normal font-sans">
                Active platform session calculation aggregates consecutive cashier checkouts or stock movements within a sliding **30-minute logout threshold**. Isolated single actions register a nominal **15-minute active block**.
              </p>
            </div>
          </div>

          {/* Section B: Results KPIs & Logs Timeline */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* KPI metrics row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              
              {/* Card 1: Time Spent */}
              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl text-left">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Platform Time</span>
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Clock size={13} />
                  </div>
                </div>
                <p className="text-sm font-extrabold text-slate-800 truncate" title={formattedActiveTime}>
                  {timestamps.length === 0 ? '0 mins' : formattedActiveTime}
                </p>
                <span className="text-[8.5px] text-slate-400 font-mono mt-0.5 block">Aggregated active time</span>
              </div>

              {/* Card 2: Work Sessions */}
              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl text-left">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Work Sessions</span>
                  <div className="p-1.5 bg-slate-100 text-slate-500 rounded-lg">
                    <Briefcase size={13} />
                  </div>
                </div>
                <p className="text-sm font-extrabold text-slate-800">
                  {timestamps.length === 0 ? '0 sessions' : `${activeSessionsCount} blocks`}
                </p>
                <span className="text-[8.5px] text-slate-400 font-mono mt-0.5 block">Distinct activity spans</span>
              </div>

              {/* Card 3: Items Processed */}
              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl text-left">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Items Processed</span>
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                    <ShoppingCart size={13} />
                  </div>
                </div>
                <p className="text-sm font-extrabold text-emerald-700">
                  {totalItemsProcessed} units
                </p>
                <span className="text-[8.5px] text-slate-400 font-mono mt-0.5 block">Direct stock units moved</span>
              </div>

              {/* Card 4: Sales Volume */}
              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl text-left">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block font-sans">Sales Generated</span>
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                    <TrendingUp size={13} />
                  </div>
                </div>
                <p className="text-sm font-extrabold text-emerald-650 font-mono">
                  ${totalSalesRevenue.toFixed(2)}
                </p>
                <span className="text-[8.5px] text-slate-400 font-mono mt-0.5 block">Total register value</span>
              </div>

            </div>

            {/* Audit log list */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden" id="employee-operations-ledger-list">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center text-left">
                <h5 className="text-[10px] font-black text-slate-655 uppercase tracking-widest">
                  Chronological Transaction Audit stream ({combinedUserActionsList.length} counts)
                </h5>
                <span className="text-[8.5px] bg-emerald-600 text-white font-mono font-extrabold px-1.5 py-0.5 rounded-full uppercase">
                  ACTIVE RANGE BOUNDED
                </span>
              </div>

              {combinedUserActionsList.length === 0 ? (
                <div className="p-8 text-center bg-white space-y-2">
                  <p className="text-xs text-slate-400 font-bold">No registered work events found within this date threshold.</p>
                  <p className="text-[10px] text-slate-405">Deploy products or trigger POS cash checkouts under cashier: "{rptEmployee}" to populate logs.</p>
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-150 bg-white shadow-inner">
                  {combinedUserActionsList.map((action, idx) => (
                    <div key={action.key} className="p-3.5 hover:bg-slate-50/50 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 transition-colors text-left font-sans">
                      <div className="space-y-1 min-w-0 flex-1 pr-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 text-[8.5px] font-extrabold tracking-tight rounded-md ${
                            action.type === 'SALE' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : action.type === 'STOCK_IN'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                              : action.type === 'STOCK_OUT'
                              ? 'bg-amber-50 text-amber-850 border border-amber-100'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {action.type}
                          </span>
                          <span className="font-extrabold text-slate-700 text-xs truncate">
                            {action.title}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-slate-500 truncate" title={action.notes}>
                          <strong>Payload/Notes:</strong> {action.notes}
                        </p>
                      </div>

                      <div className="flex flex-row md:flex-col items-start md:items-end justify-between md:justify-center shrink-0 border-t md:border-t-0 border-slate-150 pt-2 md:pt-0">
                        <span className="text-[9.5px] text-slate-400 font-mono">
                          {new Date(action.timestamp).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                        
                        <div className="flex items-center gap-2 mt-0.5 font-mono text-[9.5px]">
                          <span className="bg-slate-100 text-slate-655 font-bold px-1 rounded">
                            {action.units} units
                          </span>
                          {action.money !== null && (
                            <span className="bg-emerald-50 text-emerald-800 font-black px-1 rounded border border-emerald-100">
                              ${action.money.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Dangerous Actions panel */}
      <div className="bg-rose-50/20 border border-rose-100/80 p-5 rounded-2xl" id="database-[danger]-zone">
        <h3 className="text-sm font-black text-rose-800 flex items-center gap-1.5 mb-1 uppercase tracking-tight">
          <Trash2 size={16} className="text-rose-600 animate-pulse" />
          Enterprise Administration Clearance
        </h3>
        <p className="text-xs text-slate-400 mb-3 font-medium">Perform authoritative, root-level cache clearance, cloud de-registrations, and system resets.</p>
        
        <button
          type="button"
          onClick={() => {
            setAuthError(null);
            setIsAuthModalOpen(true);
          }}
          className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-2"
          id="btn-trigger-factory-reset"
        >
          <Lock size={12} />
          Factory Reset Database Settings
        </button>
      </div>

      {/* 🔐 Admin Security Checkpoint Modal Overlay */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="admin-auth-overlay">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden"
          >
            {/* Header branding */}
            <div className="bg-rose-600 p-5 text-white flex items-center gap-3">
              <div className="p-2 bg-rose-700/50 rounded-xl border border-white/20">
                <Lock size={20} className="text-white shrink-0 animate-bounce" />
              </div>
              <div className="text-left flex-1">
                <h3 className="text-xs font-black tracking-wider uppercase">System Security Officer</h3>
                <p className="text-[10px] text-rose-100 font-medium">Authority Credential Auditing Terminal</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsAuthModalOpen(false);
                  setAdminUsername('');
                  setAdminPassword('');
                  setConfirmPhrase('');
                }}
                className="p-1 px-2.5 rounded-lg bg-rose-700/50 hover:bg-rose-700 text-white text-[10px] font-bold border border-white/10 uppercase cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAdminAuthSubmit} className="p-6 space-y-4 text-left">
              <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl space-y-1.5 flex items-start gap-3">
                <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[10.5px] text-rose-800 font-bold leading-normal">
                    You are initializing a global database purge. This operation completely wipes all local cache tables, inventories, Sales receipts, and cash tickets.
                  </p>
                  <p className="text-[9.5px] text-rose-500 font-mono">
                    Development Bypass Code - User: <span className="font-bold underline text-rose-700">admin</span> / Passcode: <span className="font-bold underline text-rose-700">admin1234</span>
                  </p>
                </div>
              </div>

              {authError && (
                <div className="p-3 bg-red-50 border border-red-150 text-[10.5px] text-red-700 font-bold rounded-lg flex items-start gap-1.5 animate-pulse">
                  <span>⚠️</span>
                  <span>{authError}</span>
                </div>
              )}

              {/* Username field */}
              <div className="space-y-1.5">
                <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block">
                  Admin Authority ID
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-2.5 text-slate-450 shrink-0" size={14} />
                  <input
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="E.g., admin"
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-805"
                    disabled={isResetting}
                  />
                </div>
              </div>

              {/* Password credentials */}
              <div className="space-y-1.5">
                <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block">
                  Administration Security Code / Passcode
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 text-slate-455 shrink-0" size={14} />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter security override code"
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-10 pr-10 py-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-805 font-mono"
                    disabled={isResetting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              {/* Direct override key phrase validation */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="text-[9.5px] font-black text-rose-700 uppercase tracking-wider block">
                  Override Key-Phrase (Type <span className="font-extrabold select-all italic underline">RESET</span>)
                </label>
                <input
                  type="text"
                  required
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder="Type RESET exactly"
                  className="w-full bg-rose-50/20 border border-rose-200 rounded-xl px-4 py-2.5 text-xs font-extrabold text-rose-800 focus:outline-none focus:ring-1 focus:ring-rose-550 uppercase text-center"
                  disabled={isResetting}
                />
              </div>

              {/* Perform Clear action button */}
              <button
                type="submit"
                disabled={isResetting}
                className={`w-full py-3 px-4 rounded-xl text-white font-black text-xs uppercase tracking-wider font-sans mt-4 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                  isResetting 
                    ? 'bg-rose-800 opacity-85 cursor-not-allowed animate-pulse' 
                    : 'bg-rose-600 hover:bg-slate-900 border border-rose-700/10'
                }`}
                id="btn-admin-auth-submit"
              >
                {isResetting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Resetting Cloud Matrix Registry...
                  </>
                ) : (
                  <>
                    <Unlock size={13} />
                    De-classify & Purge Database
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* 📥 Restore Backup Security Confirmation Modal */}
      {isRestoreConfirmOpen && pendingBackup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="restore-backup-overlay">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden"
          >
            {/* Header branding */}
            <div className="bg-emerald-600 p-5 text-white flex items-center gap-3">
              <div className="p-2 bg-emerald-700/50 rounded-xl border border-white/20">
                <Upload size={20} className="text-white shrink-0 animate-bounce" />
              </div>
              <div className="text-left flex-1">
                <h3 className="text-xs font-black tracking-wider uppercase">Database Restore Guard</h3>
                <p className="text-[10px] text-emerald-100 font-medium font-sans">Overwrite Active System Parameters</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsRestoreConfirmOpen(false);
                  setPendingBackup(null);
                  setRestoreConfirmInput('');
                }}
                className="p-1 px-2.5 rounded-lg bg-emerald-700/50 hover:bg-emerald-700 text-white text-[10px] font-bold border border-white/10 uppercase cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="p-6 space-y-4 text-left">
              <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl space-y-1.5 flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[10.5px] text-amber-800 font-bold leading-normal">
                    WARNING: This action is destructive. You are restoring a system backup database which will completely overwrite all current products, inventory counts, images, audit history logs, and sales invoice registers. This operation cannot be undone.
                  </p>
                </div>
              </div>

              {/* Uploaded File Statistics */}
              <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl font-mono text-[10px] space-y-1 text-slate-600">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Backup Contents Preview:</span>
                <div className="flex justify-between">
                  <span>Product Records:</span>
                  <span className="font-bold text-slate-800">{pendingBackup.products?.length || 0} items</span>
                </div>
                <div className="flex justify-between">
                  <span>Sales Ledger Invoices:</span>
                  <span className="font-bold text-slate-800">{pendingBackup.sales?.length || 0} invoices</span>
                </div>
                <div className="flex justify-between">
                  <span>Signed Audit Logs:</span>
                  <span className="font-bold text-slate-800">{pendingBackup.auditLogs?.length || 0} entries</span>
                </div>
                {pendingBackup.exportedAt && (
                  <div className="flex justify-between pt-1.5 border-t border-slate-250 mt-1">
                    <span>Export Date:</span>
                    <span className="font-semibold text-emerald-600">
                      {new Date(pendingBackup.exportedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirmation validation input */}
              <div className="space-y-1.5">
                <label className="text-[9.5px] font-black text-emerald-700 uppercase tracking-wider block">
                  Confirm Restoration (Type <span className="font-extrabold select-all italic underline">RESTORE</span>)
                </label>
                <input
                  type="text"
                  required
                  value={restoreConfirmInput}
                  onChange={(e) => setRestoreConfirmInput(e.target.value)}
                  placeholder="Type RESTORE exactly to apply"
                  className="w-full bg-emerald-50/15 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs font-extrabold text-emerald-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase text-center placeholder-emerald-300"
                  id="restore-confirm-input"
                />
              </div>

              {/* Action trigger button */}
              <button
                type="button"
                onClick={() => {
                  if (restoreConfirmInput !== 'RESTORE') return;
                  onRestoreBackup(pendingBackup);
                  setImportSuccess(`Database restored successfully from backup containing ${pendingBackup.products.length} products, ${pendingBackup.sales.length} sales records!`);
                  setIsRestoreConfirmOpen(false);
                  setPendingBackup(null);
                  setRestoreConfirmInput('');
                }}
                disabled={restoreConfirmInput !== 'RESTORE'}
                className={`w-full py-3 px-4 rounded-xl text-white font-black text-xs uppercase tracking-wider font-sans mt-2 transition-all flex items-center justify-center gap-2 border border-emerald-700/10 cursor-pointer shadow-md ${
                  restoreConfirmInput === 'RESTORE'
                    ? 'bg-emerald-600 hover:bg-slate-900'
                    : 'bg-slate-300 pointer-events-none opacity-50 shadow-none'
                }`}
                id="btn-confirm-restore-backup"
              >
                <Unlock size={13} />
                Confirm & Overwrite Active Database
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
