/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  TrendingUp, 
  AlertTriangle, 
  Package, 
  DollarSign, 
  Clock, 
  ArrowUpRight, 
  User, 
  CheckCircle2,
  Bookmark,
  Bell,
  BellRing,
  Sparkles,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { Product, AuditLog, Sale } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface OutstandingItem {
  id: string; // employee_productId lowercase
  employee: string;
  department: string;
  productId: string;
  productName: string;
  barcode: string;
  quantity: number;
}

interface DashboardProps {
  products: Product[];
  auditLogs: AuditLog[];
  sales: Sale[];
  onQuickRestock: (productId: string, quantityToIncrease: number, employeeName: string) => void;
  onSetTab: (tab: string) => void;
  initialRestockId?: string | null;
  onClearInitialRestock?: () => void;
}

export default function Dashboard({ 
  products, 
  auditLogs, 
  sales, 
  onQuickRestock,
  onSetTab,
  initialRestockId,
  onClearInitialRestock
}: DashboardProps) {
  const [restockItem, setRestockItem] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState<number>(10);
  const [employeeName, setEmployeeName] = useState<string>('');
  const [restockError, setRestockError] = useState<string>('');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('All');
  const [valMetric, setValMetric] = useState<'retail' | 'cost' | 'quantity'>('retail');
  const [invDistMetric, setInvDistMetric] = useState<'units' | 'skus'>('units');
  const [dashboardDateRange, setDashboardDateRange] = useState<'7D' | '30D' | '1Y'>('7D');
  const [currentViewMode, setCurrentViewMode] = useState<'overview' | 'analytics'>('overview');

  // AI-Powered Diagnostics States
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(() => {
    return localStorage.getItem('rh_ai_analysis');
  });
  const [aiTimestamp, setAiTimestamp] = useState<string | null>(() => {
    return localStorage.getItem('rh_ai_analysis_timestamp');
  });
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const generateAIAnalysis = async () => {
    setIsGeneratingAI(true);
    setAiError(null);
    try {
      const response = await fetch('/api/analyze-inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products,
          sales,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to generate AI analysis. Server returned status ${response.status}`);
      }
      
      const data = await response.json();
      if (data.analysis) {
        setAiAnalysis(data.analysis);
        const nowStr = new Date().toISOString();
        setAiTimestamp(nowStr);
        localStorage.setItem('rh_ai_analysis', data.analysis);
        localStorage.setItem('rh_ai_analysis_timestamp', nowStr);
      } else {
        throw new Error('Invalid response structure from backend.');
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'An unexpected error occurred while contacting the analysis server.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const parseInlineBold = (str: string) => {
    const parts = str.split('**');
    if (parts.length <= 1) return str;
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="text-slate-900 font-extrabold">{part}</strong>;
      }
      return part;
    });
  };

  const renderAIResponse = (text: string) => {
    if (!text) return null;
    
    // Split response by sections (usually headers start with '#' or '**')
    const lines = text.split('\n');
    return (
      <div className="space-y-3.5 text-left text-slate-700 leading-relaxed text-xs">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-2"></div>;
          
          if (trimmed.startsWith('###')) {
            return (
              <h4 key={idx} className="text-xs font-black text-slate-800 uppercase tracking-wide mt-4 first:mt-0 border-b border-slate-100 pb-1 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                {trimmed.replace(/^###\s*/, '')}
              </h4>
            );
          }
          if (trimmed.startsWith('##') || trimmed.startsWith('#')) {
            return (
              <h3 key={idx} className="text-sm font-black text-indigo-700 uppercase tracking-tight mt-5 first:mt-0 border-b border-indigo-150 pb-1.5">
                {trimmed.replace(/^##?\s*/, '')}
              </h3>
            );
          }
          
          if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
            const content = trimmed.replace(/^[-*]\s*/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-indigo-550 font-bold shrink-0 mt-0.5">•</span>
                <p className="flex-1 text-[11px] font-medium text-slate-650">
                  {parseInlineBold(content)}
                </p>
              </div>
            );
          }
          
          return (
            <p key={idx} className="text-[11px] text-slate-600 font-medium pl-1 leading-normal">
              {parseInlineBold(trimmed)}
            </p>
          );
        })}
      </div>
    );
  };

  // Trigger quick restock modal if redirected from external notifications / toasts
  useEffect(() => {
    if (initialRestockId) {
      setRestockItem(initialRestockId);
      setRestockQty(10);
      if (onClearInitialRestock) {
        onClearInitialRestock();
      }
    }
  }, [initialRestockId, onClearInitialRestock]);

  // 1. Calculations
  const totalStockItems = products.reduce((acc, p) => acc + (p.quantity || 0), 0);
  
  // Total Valuation
  const totalCostValuation = products.reduce((acc, p) => acc + ((p.quantity || 0) * (p.costPrice || 0)), 0);
  const totalSaleValuation = products.reduce((acc, p) => acc + ((p.quantity || 0) * (p.salePrice || 0)), 0);
  
  // Low stock items
  const lowStockItems = products.filter(p => (p.quantity || 0) <= (p.minStockThreshold || 0));

  // Category Retail Value calculations
  const getCategoryRetailValueData = () => {
    const distribution: { [category: string]: number } = {};
    products.forEach((p) => {
      const cat = p.category || 'Uncategorized';
      distribution[cat] = (distribution[cat] || 0) + (Math.max(0, p.quantity || 0) * (p.salePrice || 0));
    });
    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);
  };

  // Category Cost Value calculations
  const getCategoryCostValueData = () => {
    const distribution: { [category: string]: number } = {};
    products.forEach((p) => {
      const cat = p.category || 'Uncategorized';
      distribution[cat] = (distribution[cat] || 0) + (Math.max(0, p.quantity || 0) * (p.costPrice || 0));
    });
    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);
  };

  // Category Distribution calculations
  const getCategoryDistributionData = () => {
    const distribution: { [category: string]: number } = {};
    products.forEach((p) => {
      const cat = p.category || 'Uncategorized';
      distribution[cat] = (distribution[cat] || 0) + Math.max(0, p.quantity || 0);
    });
    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);
  };

  // Category SKU Items Count calculations
  const getCategorySkuCountData = () => {
    const distribution: { [category: string]: number } = {};
    products.forEach((p) => {
      const cat = p.category || 'Uncategorized';
      distribution[cat] = (distribution[cat] || 0) + 1;
    });
    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);
  };

  const categoryRetailData = getCategoryRetailValueData();
  const categoryCostData = getCategoryCostValueData();
  const categoryQuantityData = getCategoryDistributionData();
  const categorySkuData = getCategorySkuCountData();

  const totalRetailSum = categoryRetailData.reduce((sum, item) => sum + item.value, 0);
  const totalCostSum = categoryCostData.reduce((sum, item) => sum + item.value, 0);
  const totalQuantitySumMetric = categoryQuantityData.reduce((sum, item) => sum + item.value, 0);
  const totalSkuSumMetric = categorySkuData.reduce((sum, item) => sum + item.value, 0);

  const inventoryCategoryChartData = invDistMetric === 'units' ? categoryQuantityData : categorySkuData;
  const totalInvChartSum = invDistMetric === 'units' ? totalQuantitySumMetric : totalSkuSumMetric;

  const categoryData = valMetric === 'retail' 
    ? categoryRetailData 
    : valMetric === 'cost' 
      ? categoryCostData 
      : categoryQuantityData;

  const totalQuantitySum = valMetric === 'retail'
    ? totalRetailSum
    : valMetric === 'cost'
      ? totalCostSum
      : totalQuantitySumMetric;

  const getCategoryMetrics = () => {
    const catMap: Record<string, {
      name: string;
      skusCount: number;
      totalQuantity: number;
      totalCostValue: number;
      totalSaleValue: number;
    }> = {};

    products.forEach((p) => {
      const cat = p.category || 'Uncategorized';
      if (!catMap[cat]) {
        catMap[cat] = {
          name: cat,
          skusCount: 0,
          totalQuantity: 0,
          totalCostValue: 0,
          totalSaleValue: 0,
        };
      }
      catMap[cat].skusCount += 1;
      catMap[cat].totalQuantity += Math.max(0, p.quantity || 0);
      catMap[cat].totalCostValue += Math.max(0, p.quantity || 0) * (p.costPrice || 0);
      catMap[cat].totalSaleValue += Math.max(0, p.quantity || 0) * (p.salePrice || 0);
    });

    return Object.values(catMap).sort((a, b) => b.totalQuantity - a.totalQuantity);
  };

  // Top 5 lowest-stock items for visual alerts
  const lowestStockData = [...products]
    .sort((a, b) => (a.quantity || 0) - (b.quantity || 0))
    .slice(0, 5)
    .map(p => ({
      name: p.name.length > 12 ? p.name.substring(0, 10) + '...' : p.name,
      fullName: p.name,
      quantity: Math.max(0, p.quantity || 0),
      threshold: p.minStockThreshold || 0,
    }));

  const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4', '#14b8a6'];

  // Outstanding Live Display & Loan Calculations
  const parseTakeoutNote = (noteStr: string, logEmployee: string) => {
    const match = noteStr.match(/Taken by\s+([^(]+)\s+\(([^)]+)\):\s*(.*)/i);
    if (match) {
      return {
        type: 'TAKEOUT',
        employee: match[1].trim(),
        department: match[2].trim(),
        reason: match[3].trim()
      };
    }
    const returnMatch = noteStr.match(/Returned by\s+([^(]+)\s+\(([^)]+)\):\s*(.*)/i);
    if (returnMatch) {
      return {
        type: 'RETURN',
        employee: returnMatch[1].trim(),
        department: returnMatch[2].trim(),
        reason: returnMatch[3].trim()
      };
    }
    return {
      type: 'TAKEOUT',
      employee: logEmployee || 'Authorized staff',
      department: 'Corporate Staff',
      reason: noteStr.replace(/^(Taken|Returned) by [^:]+:\s*/i, '') || 'General takeout allocation'
    };
  };

  const getOutstandingAllocations = (): OutstandingItem[] => {
    const map: Record<string, OutstandingItem> = {};
    const chronologicalLogs = [...auditLogs]
      .filter(log => log.notes.startsWith('Taken by') || log.notes.startsWith('Returned by'))
      .reverse();

    chronologicalLogs.forEach(log => {
      const isReturn = log.notes.startsWith('Returned by');
      const isTake = log.notes.startsWith('Taken by');
      const parsed = parseTakeoutNote(log.notes, log.employeeName);
      const key = `${parsed.employee.toLowerCase()}_${log.productId}`;
      
      const originalProduct = products.find(p => p.id === log.productId);
      const barcode = originalProduct ? originalProduct.barcode : 'N/A';

      if (!map[key]) {
        map[key] = {
          id: key,
          employee: parsed.employee,
          department: parsed.department,
          productId: log.productId,
          productName: log.productName,
          barcode,
          quantity: 0
        };
      }

      if (isTake) {
        map[key].quantity += Math.abs(log.delta);
      } else if (isReturn) {
        map[key].quantity -= Math.abs(log.delta);
      }
    });

    return Object.values(map).filter(item => item.quantity > 0);
  };

  const outstandingAllocations = getOutstandingAllocations();
  const totalOutstandingUnits = outstandingAllocations.reduce((acc, item) => acc + item.quantity, 0);
  const outOfStockItems = products.filter(p => (p.quantity || 0) <= 0);

  // Total Sales and Profit
  const totalSalesRevenue = sales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
  const totalProfit = sales.reduce((acc, s) => acc + (s.profit || 0), 0);

  // Extract unique employee names across ALL audit logs for dropdown filter
  const uniqueEmployees = Array.from(
    new Set(
      auditLogs.map(log => log.employeeName || 'System')
    )
  ).filter(Boolean).sort();

  // Filtered audit logs based on selected employee name filter
  const filteredAuditLogs = auditLogs.filter(log => {
    if (selectedEmployeeFilter === 'All') return true;
    return (log.employeeName || 'System').toLowerCase() === selectedEmployeeFilter.toLowerCase();
  });

  // 2. Format Sales Trends (Group sales dynamically based on selected date range)
  const getSalesTrendsData = () => {
    let numDays = 7;
    if (dashboardDateRange === '30D') {
      numDays = 30;
    } else if (dashboardDateRange === '1Y') {
      numDays = 365;
    }

    const trendMap: { [key: string]: { dateStr: string; label: string; revenue: number; profit: number } } = {};
    const sortedKeys: string[] = [];

    // Initialize date placeholders
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const isoKey = d.toISOString().split('T')[0];

      let displayLabel = '';
      if (numDays === 7) {
        const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        displayLabel = daysShort[d.getDay()];
      } else if (numDays === 30) {
        displayLabel = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      } else {
        displayLabel = d.toLocaleDateString([], { month: 'short', year: '2-digit' });
      }

      trendMap[isoKey] = {
        dateStr: isoKey,
        label: displayLabel,
        revenue: 0,
        profit: 0
      };
      sortedKeys.push(isoKey);
    }

    // Accumulate actual checkout sales
    sales.forEach(sale => {
      try {
        const saleDate = new Date(sale.timestamp);
        const isoKey = saleDate.toISOString().split('T')[0];
        if (trendMap[isoKey] !== undefined) {
          trendMap[isoKey].revenue += sale.totalAmount || 0;
          trendMap[isoKey].profit += sale.profit || 0;
        }
      } catch (err) {
        // Safe placeholder fallback
      }
    });

    return sortedKeys.map(key => ({
      day: trendMap[key].label,
      date: key,
      revenue: parseFloat(trendMap[key].revenue.toFixed(2)),
      profit: parseFloat(trendMap[key].profit.toFixed(2))
    }));
  };

  const handleExportDashboardSalesCSV = () => {
    let numDays = 7;
    if (dashboardDateRange === '30D') {
      numDays = 30;
    } else if (dashboardDateRange === '1Y') {
      numDays = 365;
    }

    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - numDays + 1);
    cutoffDate.setHours(0, 0, 0, 0);

    // Filter sales records within range
    const filteredSales = sales.filter(sale => {
      try {
        const saleDate = new Date(sale.timestamp);
        return saleDate >= cutoffDate;
      } catch (e) {
        return false;
      }
    });

    if (filteredSales.length === 0) return;

    // Build standard CSV
    const csvRows = [
      ['Date & Time Log', 'Invoice Reference', 'Authorizing Employee', 'SKU / Barcode', 'Product Title', 'Quantity', 'Unit Sale Price (RM)', 'Unit Cost Price (RM)', 'Line Total (RM)', 'Line Profit (RM)'].join(',')
    ];

    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        csvRows.push([
          `"${new Date(sale.timestamp).toLocaleString()}"`,
          `"${sale.id}"`,
          `"${(sale.employeeName || 'System').replace(/"/g, '""')}"`,
          `"${item.barcode}"`,
          `"${item.name.replace(/"/g, '""')}"`,
          item.quantity,
          item.salePrice,
          item.costPrice,
          (item.salePrice * item.quantity).toFixed(2),
          ((item.salePrice - item.costPrice) * item.quantity).toFixed(2)
        ].join(','));
      });
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csvRows.join('\n'));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `rh_dashboard_sales_report_${dashboardDateRange}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const trendData = getSalesTrendsData();
  const maxRevenue = Math.max(...trendData.map(d => d.revenue), 100);

  // Identify top 5 most sold products based on auditLogs data (where type === 'SALE')
  const getTop5MostSoldProducts = () => {
    const soldQuantities: Record<string, number> = {};
    auditLogs.forEach(log => {
      if (log.type === 'SALE') {
        const pId = log.productId;
        // logs.delta is negative for sales, so we sum the absolute value
        soldQuantities[pId] = (soldQuantities[pId] || 0) + Math.abs(log.delta || 0);
      }
    });

    const sortedBySales = Object.entries(soldQuantities)
      .map(([id, totalSold]) => ({ id, totalSold }))
      .sort((a, b) => b.totalSold - a.totalSold);

    const top5Ids = sortedBySales.slice(0, 5).map(item => item.id);

    // If less than 5 products are found, fill with other active products in catalog
    if (top5Ids.length < 5) {
      const remainingCount = 5 - top5Ids.length;
      const otherProductIds = products
        .filter(p => !top5Ids.includes(p.id))
        .map(p => {
          const logsCount = auditLogs.filter(log => log.productId === p.id).length;
          return { id: p.id, logsCount };
        })
        .sort((a, b) => b.logsCount - a.logsCount)
        .map(p => p.id);

      top5Ids.push(...otherProductIds.slice(0, remainingCount));
    }

    return top5Ids.map(id => {
      const product = products.find(p => p.id === id);
      return {
        id,
        name: product ? product.name : `Product ${id}`,
        displayName: product ? (product.name.length > 25 ? product.name.slice(0, 22) + '...' : product.name) : `Item ${id}`
      };
    });
  };

  const top5MostSold = getTop5MostSoldProducts();

  // Color mapping palette for top 5 lines
  const LINE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

  const getHistoricalStockData = () => {
    const datesList: Date[] = [];
    // Generate dates for the past 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      datesList.push(d);
    }

    return datesList.map(date => {
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      const endOfDayTime = endOfDay.getTime();

      const dayLabel = date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });

      const row: Record<string, any> = { date: dayLabel };

      top5MostSold.forEach(p => {
        // Find latest audit log for this product on or before this day
        const matchedLog = [...auditLogs]
          .filter(log => log.productId === p.id && new Date(log.timestamp).getTime() <= endOfDayTime)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        if (matchedLog) {
          row[p.displayName] = matchedLog.quantityAfter;
        } else {
          // No log before this day, look at earliest log in history to deduce prior quantity
          const earliestLog = [...auditLogs]
            .filter(log => log.productId === p.id)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];

          if (earliestLog) {
            row[p.displayName] = Math.max(0, earliestLog.quantityAfter - earliestLog.delta);
          } else {
            // No logs at all, use current quantity
            const curProd = products.find(prod => prod.id === p.id);
            row[p.displayName] = curProd ? curProd.quantity : 0;
          }
        }
      });

      return row;
    });
  };

  const historicalStockData = getHistoricalStockData();

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeName.trim()) {
      setRestockError('Employee name is required to log updates.');
      return;
    }
    if (restockQty <= 0) {
      setRestockError('Quantity must be greater than zero.');
      return;
    }
    if (restockItem) {
      onQuickRestock(restockItem, restockQty, employeeName);
      setRestockItem(null);
      setEmployeeName('');
      setRestockQty(10);
      setRestockError('');
    }
  };

  return (
    <div className="space-y-5" id="dashboard-container">
      {/* Welcome Banner / Header Section */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
            RH
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-800 uppercase">RH COMPUTER TECHNOLOGY</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Inventory & Sales Control Core</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex flex-col md:text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">System Currency</span>
            <span className="text-sm font-extrabold text-slate-700">RM (Malaysian Ringgit)</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-xl">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-extrabold text-slate-600 tracking-wider">CLOUD SYNC ENCRYPTED</span>
          </div>
        </div>
      </header>

      {/* Dashboard Sub Navigation Tabs */}
      <div className="flex border-b border-slate-200" id="dashboard-sub-nav">
        <button
          type="button"
          onClick={() => setCurrentViewMode('overview')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            currentViewMode === 'overview'
              ? 'border-emerald-600 text-emerald-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          id="btn-subview-overview"
        >
          Core Overview
        </button>
        <button
          type="button"
          onClick={() => setCurrentViewMode('analytics')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            currentViewMode === 'analytics'
              ? 'border-emerald-600 text-emerald-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          id="btn-subview-analytics"
        >
          Category Analytics
        </button>
      </div>

      {currentViewMode === 'overview' ? (
        <>
          {/* 🔔 Live System Notification & Low-Stock Alerts Center */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-md shadow-emerald-50/40 space-y-4" id="inventory-notification-center">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${
              lowStockItems.length > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-600 animate-pulse font-bold' : 'bg-emerald-50/50 border-emerald-100/40 text-emerald-600'
            }`}>
              {lowStockItems.length > 0 ? <BellRing size={20} /> : <Bell size={20} />}
            </div>
            <div>
              <h2 className="font-extrabold text-slate-800 text-sm tracking-tight flex items-center gap-1.5 uppercase">
                Notification & Alerts Center
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">Real-time telemetry and minimum inventory threshold warnings</p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (!('Notification' in window)) {
                  alert('Desktop Notifications are not supported in this browser.');
                  return;
                }
                window.Notification.requestPermission().then(perm => {
                  if (perm === 'granted') {
                    new window.Notification("🔔 Custom Alerts Enabled", {
                      body: "You'll now receive browser notifications when items drop below threshold!",
                    });
                  }
                });
              }}
              className="text-[10px] bg-slate-50 hover:bg-slate-100 border border-slate-200 font-extrabold px-3 py-1.5 rounded-lg text-slate-650 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-amber-500"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
              </span>
              Desktop Notifications Enable
            </button>

            {lowStockItems.length > 0 && (
              <span className="text-[10px] bg-emerald-600/10 text-emerald-700 font-black px-2.5 py-1 rounded-lg border border-emerald-200 uppercase tracking-wider shadow-xs">
                {lowStockItems.length} DEFICITS DETECTED
              </span>
            )}
          </div>
        </div>

        {/* List of alert items */}
        {lowStockItems.length === 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
              <div>
                <p className="text-xs font-bold text-slate-800">Operational Integrity Intact</p>
                <p className="text-[10px] text-slate-500">Every catalog item is operating above designated safety stock thresholds.</p>
              </div>
            </div>
            <button
              onClick={() => onSetTab('inventory')}
              className="text-[10px] text-emerald-650 hover:text-emerald-800 hover:underline font-extrabold uppercase tracking-wider shrink-0 cursor-pointer"
            >
              Manage Catalog thresholds →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {lowStockItems.map((item) => {
              const isOutOfStock = item.quantity <= 0;
              return (
                <div 
                  key={item.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all text-left shadow-xs hover:shadow-md ${
                    isOutOfStock
                      ? 'bg-emerald-50/35 border-emerald-200/60 hover:bg-emerald-50/50 hover:border-emerald-350'
                      : 'bg-teal-50/20 border-teal-200/60 hover:bg-teal-50/40 hover:border-teal-350'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span className={`text-[8.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                        isOutOfStock
                          ? 'bg-emerald-600/10 text-emerald-700 border border-emerald-200/40 animate-pulse'
                          : 'bg-teal-600/10 text-teal-800 border border-teal-200/40'
                      }`}>
                        {isOutOfStock ? '⚠️ OUT OF STOCK' : '⚠️ LOW STOCK LIMIT'}
                      </span>
                      <span className="text-[10px] font-mono font-extrabold text-slate-400">
                        {item.barcode}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-slate-800 text-xs line-clamp-1 mb-1" title={item.name}>
                       {item.name}
                    </h3>

                    <div className="space-y-1 text-[11px] font-medium border-t border-slate-100/75 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold uppercase tracking-wide text-[9px]">Silo Inventory:</span>
                        <span className={`font-mono font-black ${isOutOfStock ? 'text-emerald-600 font-extrabold' : 'text-teal-600 font-bold'}`}>
                          {item.quantity} {item.quantity === 1 ? 'unit' : 'units'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold uppercase tracking-wide text-[9px]">Safety Threshold:</span>
                        <span className="font-mono text-slate-600 font-extrabold">{item.minStockThreshold} units</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-4 pt-2.5 border-t border-slate-100/75">
                    <span className="text-[9.5px] font-bold text-slate-450 uppercase tracking-wider">
                      CAT: {item.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRestockItem(item.id)}
                      className="text-[10.5px] bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-lg tracking-wide transition-all cursor-pointer shadow-xs flex items-center gap-1 shrink-0"
                    >
                      <Plus size={10} strokeWidth={3} />
                      Restock Now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 🧠 AI-Powered Inventory & Sales Performance Insights */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in" id="ai-insights-center">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-650 rounded-xl">
              <Sparkles size={20} className="text-emerald-600 shrink-0 animate-pulse" />
            </div>
            <div className="text-left">
              <h2 className="font-extrabold text-slate-800 text-xs tracking-tight flex items-center gap-1.5 uppercase">
                AI Inventory & Sales Advisor
              </h2>
              <p className="text-[10px] text-slate-500 font-medium">
                Real-time sales performance, stock turnover efficiency, and slow-moving asset insights
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {aiTimestamp && (
              <span className="text-[8.5px] font-bold font-mono text-slate-400 uppercase tracking-wider bg-slate-50 border border-slate-200/50 px-2 py-1.5 rounded-lg whitespace-nowrap">
                Last updated: {new Date(aiTimestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            )}
            <button
              type="button"
              onClick={generateAIAnalysis}
              disabled={isGeneratingAI}
              className={`text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer ${
                isGeneratingAI ? 'opacity-70 cursor-not-allowed animate-pulse' : ''
              }`}
              id="btn-generate-ai-analysis"
            >
              <Sparkles size={11} />
              {isGeneratingAI ? 'Generating...' : aiAnalysis ? 'Re-analyze' : 'Synthesize Analytics'}
            </button>
          </div>
        </div>

        {isGeneratingAI ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 bg-slate-50/50 rounded-xl border border-slate-100 text-center">
            <div className="relative">
              <div className="w-9 h-9 border-3 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
              <Sparkles size={14} className="text-emerald-600 absolute top-2.5 left-2.5 animate-ping" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-800 animate-pulse">Synthesizing Store Diagnostics...</p>
              <p className="text-[10px] text-slate-400 font-mono">Aggregating {products.length} products and {sales.length} sales receipts for Gemini expert modeling...</p>
            </div>
          </div>
        ) : aiError ? (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-left space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-rose-800">
                <AlertTriangle size={15} className="shrink-0 animate-bounce" />
                <p className="text-xs font-bold">Analysis Synthesis Interrupted</p>
              </div>
              <button
                type="button"
                onClick={generateAIAnalysis}
                className="text-[9.5px] font-extrabold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all shadow-xs cursor-pointer select-none"
              >
                <Sparkles size={10} className="animate-pulse" />
                Retry Analysis
              </button>
            </div>
            <p className="text-[10.5px] text-rose-600 font-semibold leading-relaxed">
              {aiError}
            </p>
            <p className="text-[9px] text-rose-450 font-bold font-mono uppercase leading-normal">
              Note: If this is a temporary platform rate-limit or high-demand state, waiting 5-10 seconds and clicking "Retry Analysis" usually succeeds. Otherwise, confirm your GEMINI_API_KEY under Settings & Secrets.
            </p>
          </div>
        ) : aiAnalysis ? (
          <div className="p-5 bg-indigo-50/15 border border-indigo-100/50 rounded-xl max-h-[350px] overflow-y-auto">
            {renderAIResponse(aiAnalysis)}
          </div>
        ) : (
          <div className="p-5 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
            <Sparkles size={20} className="text-indigo-400 mx-auto" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-700">Predictive Stock Efficiency Diagnostics Ready</p>
              <p className="text-[10px] text-slate-450 max-w-md mx-auto">
                Synthesize current shelf levels, critical deficits, and checkout receipts using Gemini AI to discover slow-moving hardware assets and optimize tied-up investment capital.
              </p>
            </div>
            <button
              type="button"
              onClick={generateAIAnalysis}
              className="text-[10px] bg-slate-200 text-slate-700 hover:bg-slate-300 hover:text-slate-800 border border-slate-300 font-extrabold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5 transition-all mt-1 cursor-pointer"
            >
              <Sparkles size={11} className="text-indigo-600" />
              Activate Intelligence Advisor
            </button>
          </div>
        )}
      </div>

      {/* Main Bento Grid containing Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat Box 1: Total Inventory (Blue theme copy of bento grid layout) */}
        <motion.div 
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer"
          whileHover={{ y: -2 }}
          onClick={() => onSetTab('inventory')}
          id="stat-total-stock-val"
        >
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Package size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Valuation (Cost)</p>
            <p className="text-xl font-black text-slate-800">
              RM {totalCostValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">In Stock: <span className="font-bold text-slate-600">{totalStockItems.toLocaleString()} units</span></p>
          </div>
        </motion.div>

        {/* Stat Box 2: Stock Alerts (Amber/Red theme copy of bento grid layout) */}
        <motion.div 
          className={`p-4 rounded-2xl border shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer ${
            lowStockItems.length > 0 ? 'bg-amber-50/45 border-amber-200' : 'bg-white border-slate-200'
          }`}
          whileHover={{ y: -2 }}
          onClick={() => onSetTab('inventory')}
          id="stat-stock-warnings"
        >
          <div className={`p-3 rounded-xl ${lowStockItems.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Stock Alerts</p>
            <p className={`text-xl font-black ${lowStockItems.length > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              {lowStockItems.length} <span className="text-xs font-normal text-slate-500">critical lines</span>
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              {outOfStockItems.length > 0 ? <span className="text-rose-500 font-bold">{outOfStockItems.length} completely out</span> : 'All levels safe'}
            </p>
          </div>
        </motion.div>

        {/* Stat Box 3: Daily Sales / Expected Revenue (Emerald theme copy of bento grid layout) */}
        <motion.div 
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer"
          whileHover={{ y: -2 }}
          onClick={() => onSetTab('pos')}
          id="stat-expected-rev"
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Estimated Retail</p>
            <p className="text-xl font-black text-slate-800">
              RM {totalSaleValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wide">
              Margin: +RM {(totalSaleValuation - totalCostValuation).toFixed(0)}
            </p>
          </div>
        </motion.div>

        {/* Stat Box 4: Interactive Quick Action Scan Card (Emerald theme from bento grid setup) */}
        <motion.div 
          className="bg-emerald-600 p-4 rounded-2xl shadow-lg flex items-center gap-4 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
          whileHover={{ y: -2 }}
          onClick={() => onSetTab('scanner')}
          id="stat-scan-tool"
        >
          <div className="p-3 bg-white/20 rounded-xl text-white">
            <ArrowUpRight size={22} />
          </div>
          <div>
            <p className="text-xs text-white/80 font-bold uppercase tracking-wider">Scan Tool Active</p>
            <p className="text-lg font-black tracking-tight uppercase">OPEN BARCODE SCANNER</p>
            <p className="text-[10px] text-emerald-200 font-medium">Analyze details in real-time</p>
          </div>
        </motion.div>
      </div>

      {/* Main Responsive Grid Layout (Charts & Columns from Bento Grid setup) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Side (8 cols): Sales Chart and Detailed Audit Log Timeline */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* Chart Bento Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between" id="sales-trends-chart">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5">
                  <TrendingUp size={18} className="text-emerald-600" />
                  Historical Sales Trends
                </h3>
                <p className="text-xs text-slate-500 font-medium">Real checkout transaction levels vs profit margins</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200/50">
                  {(['7D', '30D', '1Y'] as const).map((range) => (
                    <button 
                      key={range}
                      type="button"
                      onClick={() => setDashboardDateRange(range)}
                      className={`px-2 py-1 font-bold text-[9.5px] rounded-md transition-all cursor-pointer ${
                        dashboardDateRange === range
                          ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/65'
                          : 'text-slate-500 hover:text-slate-850'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleExportDashboardSalesCSV}
                  disabled={sales.length === 0}
                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[10px] font-extrabold text-emerald-650 rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-emerald-150 uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Export current period sales to CSV file"
                  id="btn-dashboard-export-csv"
                >
                  <Download size={11} />
                  <span>Export to CSV</span>
                </button>
              </div>
            </div>

            {/* Recharts High-Polished Line Chart representing daily revenue/profit */}
            <div className="w-full h-64 bg-slate-50 rounded-xl p-3 border border-slate-200/50 mt-1 flex items-center justify-center">
              {trendData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs font-bold text-slate-400">No trading volume logged for this timeframe</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData}
                    margin={{ top: 15, right: 15, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="day" 
                      tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `RM ${val}`}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        `RM ${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                        name === 'revenue' ? 'Sales Revenue' : 'Net Profit'
                      ]}
                      contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', padding: '10px 14px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 'extrabold', color: '#10b981', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase' }}
                      itemStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#f8fafc' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={32} 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '10px', fontWeight: 730, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      name="sales revenue" 
                      stroke="#059669" 
                      strokeWidth={2.5} 
                      dot={{ r: 2.5, strokeWidth: 1, fill: '#059669' }} 
                      activeDot={{ r: 5 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="profit" 
                      name="net profit margin" 
                      stroke="#10b981" 
                      strokeWidth={2} 
                      strokeDasharray="4 4"
                      dot={{ r: 2, strokeWidth: 1, fill: '#10b981' }} 
                      activeDot={{ r: 4 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="flex gap-4 mt-4 text-[10px] justify-between border-t border-slate-100 pt-3">
              <div className="flex items-center gap-1.5 font-mono">
                <span className="h-2 w-2 bg-emerald-500 rounded-full"></span>
                <span className="text-slate-500 font-bold">Total Sales Run: <span className="text-slate-800">RM {totalSalesRevenue.toFixed(2)}</span></span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="h-2 w-2 bg-teal-500 rounded-full"></span>
                <span className="text-slate-500 font-bold">Total Profit Margins: <span className="text-slate-800">RM {totalProfit.toFixed(2)}</span></span>
              </div>
            </div>
          </div>

          {/* Two Column Grid for Stock Levels Trend Chart & Inventory Items Category Distribution Pie Chart */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* New Bento Box: Historical Stock Levels Line Chart for Top 5 Sold Products */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between" id="stock-levels-trend-chart">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
                <div>
                  <h3 className="font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5 text-xs uppercase">
                    <TrendingUp size={16} className="text-indigo-600" />
                    Top 5 Sold Products Historical Dynamics
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">Daily inventory fluctuation over 7 days</p>
                </div>
                <div className="bg-slate-50 border border-slate-200/65 px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold text-slate-500 uppercase">
                  RECHARTS INTEGRATED
                </div>
              </div>

              <div className="w-full h-64">
                {historicalStockData.length === 0 || top5MostSold.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-100 p-6 text-center">
                    <Package className="text-slate-300 mb-2 animate-bounce" size={24} />
                    <p className="text-xs font-bold text-slate-750">No historical levels to display yet.</p>
                    <p className="text-[10px] text-slate-400">Perform adjustments or register sales transactions to activate inventory trends mapping.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={historicalStockData}
                      margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        tickLine={false} 
                        axisLine={false}
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600, fontFamily: 'monospace' }}
                      />
                      <YAxis 
                        tickLine={false} 
                        axisLine={false}
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#0f172a', 
                          borderColor: '#1e293b', 
                          borderRadius: '0.75rem', 
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                        }}
                        labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 'bold' }}
                        itemStyle={{ color: '#ffffff', fontSize: '11px', padding: '1px 0' }}
                      />
                      <Legend 
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }}
                      />
                      {top5MostSold.map((p, index) => (
                        <Line
                          key={p.id}
                          type="monotone"
                          dataKey={p.displayName}
                          stroke={LINE_COLORS[index % LINE_COLORS.length]}
                          strokeWidth={2.5}
                          dot={{ r: 3, strokeWidth: 1 }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* 📊 NEW Bento Box: Recharts Pie Chart showing distribution of inventory items across different product categories */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between" id="inventory-items-category-pie-chart">
              <div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                  <div>
                    <h3 className="font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5 text-xs uppercase">
                      <Package size={16} className="text-emerald-600" />
                      Inventory Items Category Distribution
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {invDistMetric === 'units' 
                        ? 'Distribution of inventory items (units) across categories' 
                        : 'Distribution of registered product SKUs across categories'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 self-start sm:self-center">
                    <div className="bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold text-emerald-700 uppercase">
                      {totalInvChartSum} {invDistMetric === 'units' ? 'UNITS' : 'SKUS'}
                    </div>
                  </div>
                </div>

                {/* Toggle Buttons for Units vs SKU Count */}
                <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl text-center border border-slate-200/40 gap-1 shadow-3xs mb-2">
                  <button
                    type="button"
                    onClick={() => setInvDistMetric('units')}
                    className={`py-1 rounded-lg text-[9px] font-black transition-all uppercase tracking-wider cursor-pointer ${
                      invDistMetric === 'units'
                        ? 'bg-white text-emerald-700 shadow-xs border border-emerald-100/30'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Stock Units (Qty)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvDistMetric('skus')}
                    className={`py-1 rounded-lg text-[9px] font-black transition-all uppercase tracking-wider cursor-pointer ${
                      invDistMetric === 'skus'
                        ? 'bg-white text-emerald-700 shadow-xs border border-emerald-100/30'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Product SKUs (Items)
                  </button>
                </div>
              </div>

              <div className="w-full h-44 relative flex items-center justify-center my-1">
                {inventoryCategoryChartData.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-100 p-4 text-center">
                    <Package className="text-slate-300 mb-2 animate-bounce" size={22} />
                    <p className="text-xs font-bold text-slate-750">No inventory categories cataloged.</p>
                    <p className="text-[10px] text-slate-400">Register products to visualize category breakdown.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={inventoryCategoryChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={68}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {inventoryCategoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          `${value} ${invDistMetric === 'units' ? 'Units' : 'SKUs'} (${totalInvChartSum > 0 ? ((Number(value) / totalInvChartSum) * 100).toFixed(1) : 0}%)`,
                          `${name}`
                        ]}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#1e293b',
                          borderRadius: '0.75rem',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          textAlign: 'left'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Legend / Category breakdown list */}
              {inventoryCategoryChartData.length > 0 && (
                <div className="grid grid-cols-2 gap-1 mt-2 pt-2 border-t border-slate-100 max-h-[82px] overflow-y-auto pr-1">
                  {inventoryCategoryChartData.map((item, idx) => {
                    const percentage = totalInvChartSum > 0 ? ((item.value / totalInvChartSum) * 100).toFixed(1) : '0';
                    const color = PIE_COLORS[idx % PIE_COLORS.length];
                    return (
                      <div key={item.name} className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-50/60 hover:bg-slate-50 border border-slate-100 transition-all text-left">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-slate-700 block truncate" title={item.name}>
                            {item.name}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono block">
                            {item.value} {invDistMetric === 'units' ? 'units' : 'items'} • {percentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Table / Event Log Bento Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm" id="dashboard-audit-logs">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 select-none">
              <div className="text-left">
                <h3 className="font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5 uppercase text-xs">
                  <Clock size={16} className="text-emerald-600" />
                  Recent Storage & Event Logs
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">Real-time certified adjustments timeline</p>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="audits-staff-filter" className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider shrink-0">
                  Cashier / Staff:
                </label>
                <select
                  id="audits-staff-filter"
                  value={selectedEmployeeFilter}
                  onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                  className="text-xs font-extrabold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-hidden cursor-pointer"
                >
                  <option value="All">All Staff (Default)</option>
                  {uniqueEmployees.map((emp) => (
                    <option key={emp} value={emp}>
                      {emp}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="text-slate-500 bg-slate-50 uppercase text-[9px] tracking-wider font-extrabold border-b border-slate-200/50">
                  <tr>
                    <th className="p-2.5 rounded-l-lg">Date & Time Log</th>
                    <th className="p-2.5">Item</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5 text-right">Adj</th>
                    <th className="p-2.5 text-right">In Store</th>
                    <th className="p-2.5">Staff Signature</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-mono text-[11px] space-y-2">
                        <p className="font-bold text-slate-500">No matching activities found.</p>
                        {selectedEmployeeFilter !== 'All' && (
                          <button
                            type="button"
                            onClick={() => setSelectedEmployeeFilter('All')}
                            className="text-[10px] bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold px-3 py-1.5 rounded-lg border border-emerald-200/50 mt-1 cursor-pointer transition-all"
                          >
                            Reset Filter to All Staff
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.slice(0, 10).map((log) => {
                      let badgeClass = "bg-slate-100 text-slate-700";
                      if (log.type === 'STOCK_IN') badgeClass = "bg-teal-50 text-teal-850 border border-teal-200/70";
                      if (log.type === 'STOCK_OUT') badgeClass = "bg-amber-50 text-amber-850 border border-amber-200/70";
                      if (log.type === 'SALE') badgeClass = "bg-emerald-50 text-emerald-850 border border-emerald-200/70";
                      if (log.type === 'CREATE') badgeClass = "bg-emerald-50 text-emerald-850 border border-emerald-200/70";
                      if (log.type === 'DELETE') badgeClass = "bg-rose-50 text-rose-850 border border-rose-200/70";

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/50 text-[11px]">
                          <td className="p-2.5 font-mono text-slate-400 whitespace-nowrap">
                            <span className="font-semibold block sm:inline mr-1">{new Date(log.timestamp).toLocaleDateString([], { month: '2-digit', day: '2-digit' })}</span>
                            <span className="text-slate-400">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="p-2.5 font-semibold text-slate-800 max-w-[150px] truncate" title={log.productName}>
                            {log.productName}
                          </td>
                          <td className="p-2.5">
                            <span className={`px-1.5 py-0.2 rounded-md font-bold text-[9px] uppercase tracking-wide ${badgeClass}`}>
                              {log.type}
                            </span>
                          </td>
                          <td className={`p-2.5 text-right font-mono font-bold ${
                            log.delta > 0 ? 'text-teal-600' : log.delta < 0 ? 'text-rose-600' : 'text-slate-400'
                          }`}>
                            {log.delta > 0 ? `+${log.delta}` : log.delta}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-500">
                            {log.quantityAfter}
                          </td>
                          <td className="p-2.5 font-medium text-slate-700 truncate">
                            {log.employeeName || 'System'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                Showing {Math.min(filteredAuditLogs.length, 10)} of {filteredAuditLogs.length} events
              </span>
              <button 
                onClick={() => onSetTab('backup')}
                className="py-1.5 px-4 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
              >
                Detailed Backups →
              </button>
            </div>
          </div>
        </div>

        {/* Right Side Column (4 cols): Critical Stock Alerts, Database Management & Health Widget */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* 📊 Category Inventory Distribution Pie Chart Bento Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between" id="category-distribution-chart">
            <div>
              <div className="flex flex-col gap-3.5 mb-3">
                <div className="flex justify-between items-start">
                  <div className="text-left">
                    <h3 className="font-extrabold text-slate-800 text-xs tracking-tight flex items-center gap-1.5 uppercase">
                      <Package size={15} className="text-emerald-650 animate-pulse" />
                      {valMetric === 'retail' && 'Retail Stock Value'}
                      {valMetric === 'cost' && 'Cost Stock Value'}
                      {valMetric === 'quantity' && 'Category Stock Weight'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium font-sans">
                      {valMetric === 'quantity' 
                        ? 'Distribution of registered items currently in store'
                        : `Category-based breakdown of total stock value (${valMetric === 'retail' ? 'Retail' : 'Cost'} Prices)`}
                    </p>
                  </div>
                  <span className="text-[10px] bg-emerald-50 border border-emerald-100 font-bold px-2.5 py-0.5 rounded-full text-emerald-700 shrink-0 font-mono">
                    {valMetric === 'quantity' 
                      ? `${totalQuantitySum} Units` 
                      : `RM ${totalQuantitySum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                </div>

                {/* Metric Selector Buttons */}
                <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl text-center border border-slate-200/40 gap-1 shadow-3xs">
                  <button
                    type="button"
                    onClick={() => setValMetric('retail')}
                    className={`py-1.5 rounded-lg text-[9px] font-black transition-all uppercase tracking-wider cursor-pointer ${
                      valMetric === 'retail'
                        ? 'bg-white text-emerald-700 shadow-xs border border-emerald-100/30'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Retail (RM)
                  </button>
                  <button
                    type="button"
                    onClick={() => setValMetric('cost')}
                    className={`py-1.5 rounded-lg text-[9px] font-black transition-all uppercase tracking-wider cursor-pointer ${
                      valMetric === 'cost'
                        ? 'bg-white text-emerald-700 shadow-xs border border-emerald-100/30'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Cost (RM)
                  </button>
                  <button
                    type="button"
                    onClick={() => setValMetric('quantity')}
                    className={`py-1.5 rounded-lg text-[9px] font-black transition-all uppercase tracking-wider cursor-pointer ${
                      valMetric === 'quantity'
                        ? 'bg-white text-emerald-700 shadow-xs border border-emerald-100/30'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Units
                  </button>
                </div>
              </div>

              <div className="w-full h-44 relative flex items-center justify-center">
                {categoryData.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 font-medium text-xs">
                    No active stock quantities left in catalog.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => [
                          valMetric === 'quantity'
                            ? `${value} Units (${totalQuantitySum > 0 ? ((value / totalQuantitySum) * 100).toFixed(1) : 0}%)`
                            : `RM ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${totalQuantitySum > 0 ? ((value / totalQuantitySum) * 100).toFixed(1) : 0}%)`,
                          'Value Breakdown'
                        ]}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#1e293b',
                          borderRadius: '0.75rem',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          textAlign: 'left'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Legend percentage listing */}
              {categoryData.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-slate-100 max-h-[110px] overflow-y-auto pr-1">
                  {categoryData.map((item, idx) => {
                    const percentage = totalQuantitySum > 0 ? ((item.value / totalQuantitySum) * 100).toFixed(1) : '0';
                    const color = PIE_COLORS[idx % PIE_COLORS.length];
                    return (
                      <div key={item.name} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50/50 hover:bg-slate-50 border border-slate-100 transition-all text-left">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-slate-700 block truncate" title={item.name}>
                            {item.name}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono block">
                            {valMetric === 'quantity'
                              ? `${item.value} units`
                              : `RM ${item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            } • {percentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 📊 Top 5 Lowest-Stock Items Bar Chart Bento Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between" id="lowest-stock-bar-chart">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div className="text-left">
                  <h3 className="font-extrabold text-slate-800 text-xs tracking-tight flex items-center gap-1.5 uppercase">
                    <Package size={15} className="text-emerald-600 shrink-0" />
                    Lowest Stock Levels (Top 5)
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium font-sans">
                    Quick identification of inventory deficits
                  </p>
                </div>
                <span className="text-[10px] bg-emerald-50 border border-emerald-100 font-bold px-2 py-0.5 rounded-full text-emerald-700 shrink-0 font-mono">
                  Min Stock
                </span>
              </div>

              <div className="w-full h-44 mt-2">
                {lowestStockData.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 font-medium text-xs">
                    No products cataloged yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={lowestStockData}
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        formatter={(value: any, name: any, props: any) => [
                          `${value} units (Threshold: ${props.payload.threshold})`,
                          'Stock Level'
                        ]}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: 'none',
                          borderRadius: '12px',
                          padding: '10px 14px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          color: '#fff'
                        }}
                        labelStyle={{ fontWeight: 'extrabold', color: '#10b981', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase' }}
                        itemStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#f8fafc' }}
                      />
                      <Bar
                        dataKey="quantity"
                        name="Quantity"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      >
                        {lowestStockData.map((entry, index) => {
                          const isCritical = entry.quantity <= entry.threshold;
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={isCritical ? '#ef4444' : '#10b981'}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
          
          {/* Critical Alerts Bento Box */}
          <div className="bg-emerald-50/60 p-5 rounded-2xl border border-emerald-150 shadow-md hover:shadow-lg transition-all flex flex-col justify-between" id="critical-stock-alerts">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-extrabold text-emerald-800 text-sm tracking-tight flex items-center gap-1.5">
                  <AlertTriangle size={16} className="text-emerald-600 animate-bounce" />
                  Critical Stock Alerts
                </h3>
                <span className="text-[10px] bg-white text-emerald-700 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-100 shadow-3xs">
                  {lowStockItems.length} Warnings
                </span>
              </div>
              
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {lowStockItems.length === 0 ? (
                  <div className="text-center py-6 bg-white rounded-xl border border-emerald-100/30 text-slate-500 flex flex-col items-center justify-center">
                    <CheckCircle2 size={26} className="text-emerald-500 mb-1.5 animate-pulse" />
                    <p className="text-xs font-bold font-sans">100% Stock Adequacy</p>
                    <p className="text-[10px] text-slate-400">All products cover dynamic thresholds</p>
                  </div>
                ) : (
                  lowStockItems.slice(0, 4).map((item) => (
                    <div 
                      key={item.id}
                      className="p-2 px-3 bg-white border border-emerald-100/35 rounded-xl flex items-center justify-between gap-1 shadow-3xs hover:shadow-xs hover:border-emerald-200/50 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-slate-700 truncate block">{item.name}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                          Stock: <span className={item.quantity <= 0 ? 'text-emerald-600 font-extrabold' : 'text-teal-600 font-bold'}>{item.quantity} units</span> / Req: {item.minStockThreshold}
                        </span>
                      </div>
                      
                      <button 
                        onClick={() => setRestockItem(item.id)}
                        className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-2.5 py-1 rounded-lg shrink-0 transition-colors shadow-2xs"
                      >
                        Adjust
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => onSetTab('inventory')}
              className="mt-4 w-full py-2 bg-transparent border border-emerald-300 text-xs font-bold text-emerald-800 hover:bg-emerald-100/50 rounded-xl transition-all uppercase tracking-wide"
            >
              RESOLVE DEFICITS IN CATALOG
            </button>
          </div>

          {/* Recent Activity Feed Bento Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between" id="recent-activity-feed">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                <h3 className="font-extrabold text-slate-800 text-xs tracking-tight flex items-center gap-1.5 uppercase">
                  <Clock size={15} className="text-indigo-650" />
                  Recent System Activity
                </h3>
                <span className="text-[10px] bg-slate-100 border border-slate-200/65 font-bold px-2 py-0.5 rounded-full text-slate-600 font-mono">
                  Last 5 Changes
                </span>
              </div>

              <div className="space-y-2.5 mt-3 max-h-[340px] overflow-y-auto pr-0.5">
                {auditLogs && auditLogs.length > 0 ? (
                  [...auditLogs]
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .slice(0, 5)
                    .map((log) => {
                      // Determine badge and accent colors for log type
                      let typeLabel = log.type;
                      let typeColorClass = "bg-slate-100 border-slate-200/60 text-slate-700";
                      let iconAccent = "🔄";

                      if (log.type === "STOCK_IN") {
                        typeColorClass = "bg-emerald-50 text-emerald-700 border-emerald-200/50";
                        iconAccent = "📥";
                      } else if (log.type === "STOCK_OUT") {
                        typeColorClass = "bg-amber-50 text-amber-700 border-amber-200/50";
                        iconAccent = "📤";
                      } else if (log.type === "SALE") {
                        typeColorClass = "bg-indigo-50 text-indigo-700 border-indigo-200/50";
                        iconAccent = "💳";
                      } else if (log.type === "ADJUSTMENT") {
                        typeColorClass = "bg-sky-50 text-sky-700 border-sky-200/50";
                        iconAccent = "⚙️";
                      } else if (log.type === "CREATE") {
                        typeColorClass = "bg-purple-50 text-purple-700 border-purple-200/50";
                        iconAccent = "✨";
                      } else if (log.type === "DELETE") {
                        typeColorClass = "bg-rose-50 text-rose-700 border-rose-200/50";
                        iconAccent = "❌";
                      }

                      // Format time nicely
                      const formattedTime = new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      return (
                        <div 
                          key={log.id} 
                          className="p-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl transition-all text-left space-y-1.5 shadow-3xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-black text-slate-850 leading-tight block break-words max-w-[150px]" title={log.productName}>
                              {log.productName}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black tracking-wider uppercase border shrink-0 ${typeColorClass} inline-flex items-center gap-1`}>
                              <span>{iconAccent}</span>
                              {typeLabel}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                            <span className="flex items-center gap-1 text-slate-700 font-bold">
                              👤 {log.employeeName || 'System'}
                            </span>
                            <span className="text-slate-400 font-mono text-[9px]">
                              {formattedTime}
                            </span>
                          </div>

                          {log.notes && (
                            <div className="text-[9.5px] text-slate-400/90 font-medium bg-white/50 p-1.5 rounded-lg border border-slate-150/40 line-clamp-1 font-mono" title={log.notes}>
                              {log.notes}
                            </div>
                          )}
                        </div>
                      );
                    })
                ) : (
                  <div className="text-center py-8 bg-slate-50/50 rounded-xl border border-slate-100 text-slate-400 font-mono italic text-xs">
                    No system activity recorded yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Database Setup & Health Bento Box */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex flex-col justify-between border border-slate-800">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight">System Memory Storage</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Bento core dynamic cache records</p>
                </div>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-mono font-bold uppercase px-2 py-0.5 rounded-full border border-emerald-500/35">
                  ONLINE
                </span>
              </div>

              <div className="space-y-3 font-mono text-[11px] text-slate-300">
                <div className="flex justify-between items-center py-1 border-b border-slate-800">
                  <span className="text-[9px] text-slate-450 uppercase tracking-wider font-bold">Catalog Items</span>
                  <span className="font-bold">{products.length} registered lines</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800">
                  <span className="text-[9px] text-slate-450 uppercase tracking-wider font-bold">Total Sales Registered</span>
                  <span className="font-bold">{sales.length} records</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[9px] text-slate-450 uppercase tracking-wider font-bold">Integrity Sync</span>
                  <span className="font-extrabold text-emerald-400">ACTIVE AES-256</span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button 
                onClick={() => onSetTab('backup')}
                className="py-2.5 bg-slate-800 text-[10px] text-slate-200 font-extrabold rounded-xl hover:bg-slate-750 transition-colors uppercase"
              >
                Launch Cloud
              </button>
              <button 
                onClick={() => onSetTab('pos')}
                className="py-2.5 bg-emerald-600 text-[10px] text-white font-extrabold rounded-xl hover:bg-emerald-550 transition-colors uppercase"
              >
                Checkout Terminal
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Employee Returnable Display Tracker (loan & display inventory tracking) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm" id="outstanding-display-tracker">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <div>
            <h3 className="font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5 uppercase text-sm">
              <User className="text-amber-500" size={18} />
              Outstanding Display & Staff Loans
            </h3>
            <p className="text-xs text-slate-500">Track which employees have active tech items on display, test rigs, or temporary QA allocations</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] bg-amber-50 text-amber-700 font-extrabold px-2.5 py-1 rounded-lg border border-amber-200/60">
              {outstandingAllocations.length} ACTIVE LOANS
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-605 font-extrabold px-2.5 py-1 rounded-lg">
              {totalOutstandingUnits} TOTAL UNITS
            </span>
          </div>
        </div>

        {outstandingAllocations.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
            <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">All display stock successfully accounted for</p>
            <p className="text-[10px] text-slate-405 mt-0.5">No outstanding employee takeout quantities require return</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {outstandingAllocations.map((item) => (
              <div 
                key={item.id}
                className="bg-slate-50 hover:bg-slate-100 rounded-xl p-3.5 border border-slate-200/70 shadow-3xs flex flex-col justify-between transition-all text-left"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center font-bold text-xs text-amber-700 shrink-0 select-none">
                        {item.employee ? item.employee.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0, 2) : 'EM'}
                      </div>
                      <div className="min-w-0">
                        <span className="font-extrabold text-slate-800 text-xs block truncate" title={item.employee}>
                          {item.employee}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold block truncate uppercase tracking-wide">
                          {item.department}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-amber-600/10 text-amber-750 font-black px-2 py-0.5 rounded-md self-start shrink-0">
                      {item.quantity} {item.quantity === 1 ? 'Unit' : 'Units'}
                    </span>
                  </div>

                  <div className="bg-white border border-slate-150 p-2.5 rounded-lg text-[11px] space-y-1">
                    <div className="font-bold text-slate-800 line-clamp-1">{item.productName}</div>
                    <div className="text-[9px] text-slate-450 font-mono tracking-tight font-bold">BARCODE: <span className="text-emerald-600 font-mono">{item.barcode}</span></div>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-slate-200/50">
                  <span className="text-[9px] text-rose-500 font-extrabold uppercase tracking-widest animate-pulse flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                    ON DISPLAY
                  </span>
                  <button 
                    onClick={() => onSetTab('take')}
                    className="text-[10px] text-emerald-650 hover:text-emerald-800 font-extrabold uppercase tracking-wider flex items-center gap-0.5 cursor-pointer"
                  >
                    Return Items →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
          id="category-analytics-panel"
        >
          {/* Analytics Overview Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-left">
            <div>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-600 rounded-sm inline-block"></span>
                Interactive Category Analytics
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                High-fidelity visualization and financial allocation breakdown of storage categories
              </p>
            </div>
            
            {/* View Mode Actions */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                type="button"
                onClick={() => {
                  const data = getCategoryMetrics();
                  const csvRows = [
                    ['Category Name', 'Total SKUs', 'Total Stock (Units)', 'Total Cost Value (RM)', 'Total Retail Value (RM)'].join(',')
                  ];
                  data.forEach(c => {
                    csvRows.push([
                      `"${c.name.replace(/"/g, '""')}"`,
                      c.skusCount,
                      c.totalQuantity,
                      c.totalCostValue.toFixed(2),
                      c.totalSaleValue.toFixed(2)
                    ].join(','));
                  });
                  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csvRows.join('\n'));
                  const link = document.createElement("a");
                  link.setAttribute("href", csvContent);
                  link.setAttribute("download", `rh_category_analytics_report_${new Date().toISOString().split('T')[0]}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100/90 text-emerald-700 text-xs font-black rounded-xl border border-emerald-250 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap uppercase tracking-wider"
              >
                <Download size={13} className="text-emerald-600" />
                <span>Export Categories</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics KPI row specifically for category overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm text-left">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">Total Product Groups</span>
              <span className="text-2xl font-black text-slate-800 block mt-1">
                {getCategoryMetrics().length} Distinct
              </span>
              <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">Categories registered on system</span>
            </div>
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm text-left">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">Highest Volume Category</span>
              <span className="text-xl font-black text-emerald-700 block mt-1.5 truncate uppercase" title={getCategoryMetrics()[0]?.name || 'None'}>
                {getCategoryMetrics()[0]?.name || 'None'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                {getCategoryMetrics()[0]?.totalQuantity || 0} Total Units in Stock
              </span>
            </div>
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm text-left">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">Highest Asset Capital</span>
              <span className="text-xl font-black text-slate-800 block mt-1.5 truncate uppercase" title={getCategoryMetrics().sort((a,b)=>b.totalCostValue - a.totalCostValue)[0]?.name || 'None'}>
                {getCategoryMetrics().sort((a,b)=>b.totalCostValue - a.totalCostValue)[0]?.name || 'None'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                RM {(getCategoryMetrics().sort((a,b)=>b.totalCostValue - a.totalCostValue)[0]?.totalCostValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} Value (Cost)
              </span>
            </div>
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm text-left">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">Average Category Yield</span>
              <span className="text-2xl font-black text-slate-800 block mt-1">
                {getCategoryMetrics().length > 0 
                  ? ((getCategoryMetrics().reduce((sum, c) => sum + c.totalQuantity, 0)) / getCategoryMetrics().length).toFixed(1)
                  : '0'} Units
              </span>
              <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">Avg count per category</span>
            </div>
          </div>

          {/* Core Analytics Grid: Pie Chart on Left, Detailed Grid on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Pie Chart Bento Card */}
            <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between text-left">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-xs tracking-tight flex items-center gap-1.5 uppercase">
                      Category Distribution Density
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium font-sans">
                      Select variable mode to recalculate chart percentages and radial portions
                    </p>
                  </div>
                </div>

                {/* Variable Selector */}
                <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl text-center border border-slate-200/40 gap-1 shadow-3xs mb-5">
                  <button
                    type="button"
                    onClick={() => setValMetric('retail')}
                    className={`py-2 rounded-lg text-[9.5px] font-black transition-all uppercase tracking-wider cursor-pointer ${
                      valMetric === 'retail'
                        ? 'bg-white text-emerald-700 shadow-xs border border-emerald-100/30'
                        : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    Retail Value (RM)
                  </button>
                  <button
                    type="button"
                    onClick={() => setValMetric('cost')}
                    className={`py-2 rounded-lg text-[9.5px] font-black transition-all uppercase tracking-wider cursor-pointer ${
                      valMetric === 'cost'
                        ? 'bg-white text-emerald-700 shadow-xs border border-emerald-100/30'
                        : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    Cost Value (RM)
                  </button>
                  <button
                    type="button"
                    onClick={() => setValMetric('quantity')}
                    className={`py-2 rounded-lg text-[9.5px] font-black transition-all uppercase tracking-wider cursor-pointer ${
                      valMetric === 'quantity'
                        ? 'bg-white text-emerald-700 shadow-xs border border-emerald-100/30'
                        : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    Stock Units
                  </button>
                </div>

                {/* Recharts Pie Chart representing distribution */}
                <div className="w-full h-80 relative flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-200/50 p-4 animate-fade-in" id="recharts-pie-chart-root">
                  {categoryData.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-medium text-xs">
                      No active stock quantities left to analyze.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={105}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any, name: any) => [
                            valMetric === 'quantity'
                              ? `${value} Units (${totalQuantitySum > 0 ? ((value / totalQuantitySum) * 100).toFixed(1) : 0}%)`
                              : `RM ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${totalQuantitySum > 0 ? ((value / totalQuantitySum) * 100).toFixed(1) : 0}%)`,
                            `${name}`
                          ]}
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#1e293b',
                            borderRadius: '0.75rem',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            textAlign: 'left'
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          iconType="circle"
                          iconSize={8}
                          layout="horizontal"
                          align="center"
                          wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  {categoryData.length > 0 && (
                    <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Total {valMetric === 'quantity' ? 'Units' : 'Value'}
                      </span>
                      <span className="text-sm font-black text-slate-800">
                        {valMetric === 'quantity'
                          ? `${totalQuantitySum}`
                          : `RM ${totalQuantitySum.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        }
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Detailed Table Grid Bento Card */}
            <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between text-left">
              <div>
                <h3 className="font-extrabold text-slate-800 text-xs tracking-tight flex items-center gap-1.5 uppercase mb-3 text-left">
                  Category Financials & Stock Distribution Matrix
                </h3>
                <p className="text-[11px] text-slate-400 font-medium mb-4 text-left">
                  Full categorical breakdown displaying physical volume, financial asset allocations, and SKU weight
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="text-slate-500 bg-slate-100/50 uppercase text-[9px] tracking-wider font-extrabold border-b border-slate-200/50">
                      <tr>
                        <th className="p-3 rounded-l-lg text-left">Category</th>
                        <th className="p-3 text-center">SKUs</th>
                        <th className="p-3 text-right">Qty (Stock)</th>
                        <th className="p-3 text-right font-mono">Cost Value</th>
                        <th className="p-3 text-right rounded-r-lg font-mono">Retail Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {getCategoryMetrics().map((cat, idx) => {
                        const totalQty = cat.totalQuantity;
                        const percentage = totalQuantitySumMetric > 0 ? ((totalQty / totalQuantitySumMetric) * 100).toFixed(1) : '0';
                        const color = PIE_COLORS[idx % PIE_COLORS.length];
                        
                        return (
                          <tr key={cat.name} className="hover:bg-slate-50/70 transition-all font-medium">
                            <td className="p-3 text-left">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                                <div className="min-w-0">
                                  <span className="font-bold text-slate-800 block truncate uppercase tracking-tight">{cat.name}</span>
                                  <span className="text-[9px] text-slate-400 font-mono block">Weight: {percentage}%</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-700">
                              {cat.skusCount}
                            </td>
                            <td className="p-3 text-right">
                              <div className="font-mono font-bold text-slate-750">{totalQty} units</div>
                              {/* Small simple progress bar to make it stunning */}
                              <div className="w-full bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                                <div 
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ 
                                    backgroundColor: color,
                                    width: `${percentage}%`
                                  }}
                                ></div>
                              </div>
                            </td>
                            <td className="p-3 text-right font-mono text-slate-500 whitespace-nowrap">
                              RM {cat.totalCostValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-mono font-black text-slate-800 whitespace-nowrap">
                              RM {cat.totalSaleValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Quick Restock Modals & Employee Signature Prompt */}
      {restockItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Package className="text-emerald-600" />
              Quick Stock Adjustment
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Restocking: <strong>{products.find(p => p.id === restockItem)?.name}</strong>
            </p>

            <form onSubmit={handleRestockSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Adjust Stock Quantity
                </label>
                <input 
                  type="number" 
                  value={restockQty}
                  onChange={(e) => setRestockQty(parseInt(e.target.value) || 0)}
                  min="1"
                  className="w-full border border-slate-200 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Employee Authorized Signature *
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input 
                    type="text" 
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    placeholder="Signature Initials / Name"
                    className="w-full border border-slate-200 pl-10 pr-4 p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              {restockError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg font-medium border border-rose-105">
                  {restockError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setRestockItem(null);
                    setRestockError('');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all border border-slate-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all"
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
