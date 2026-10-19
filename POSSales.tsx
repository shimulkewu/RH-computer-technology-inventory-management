/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, 
  Trash2, 
  User, 
  DollarSign, 
  Search, 
  Plus, 
  Minus, 
  Barcode, 
  CheckCircle2, 
  CreditCard,
  FileText,
  X,
  Printer,
  Calendar,
  Filter,
  Download,
  Clock,
  FolderOpen,
  Edit,
  Save,
  AlertTriangle,
  TrendingUp,
  Mail,
  Send,
  Copy,
  Check,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { Product, SaleItem, Sale } from '../types';

interface POSSalesProps {
  products: Product[];
  sales?: Sale[];
  onRecordSale: (saleItems: SaleItem[], employeeName: string, customTimestamp?: string) => void;
  initialCart?: SaleItem[];
  initialEmployee?: string;
  onClearInitialPOS?: () => void;
  onUpdateSale?: (sale: Sale) => void;
  onUndoSale?: () => void;
  onDeleteSale?: (saleId: string) => void;
  onUpdateProductPrice?: (productId: string, newPrice: number) => void;
}

export default function POSSales({ 
  products, 
  sales = [],
  onRecordSale,
  initialCart,
  initialEmployee,
  onClearInitialPOS,
  onUpdateSale,
  onUndoSale,
  onDeleteSale,
  onUpdateProductPrice
}: POSSalesProps) {
  const [cart, setCart] = useState<SaleItem[]>(() => {
    try {
      const saved = localStorage.getItem('pos_checkout_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [employeeSignature, setEmployeeSignature] = useState(() => {
    return localStorage.getItem('pos_checkout_employeeSignature') || '';
  });
  const [errorStatus, setErrorStatus] = useState('');
  const [showUndoConfirmation, setShowUndoConfirmation] = useState(false);
  const [undoSuccessMessage, setUndoSuccessMessage] = useState('');

  // Auto-save form states to localStorage
  useEffect(() => {
    localStorage.setItem('pos_checkout_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('pos_checkout_employeeSignature', employeeSignature);
  }, [employeeSignature]);

  // Dynamically sync cart item specifications/prices with the latest product updates from the inventory list
  useEffect(() => {
    let rawChanged = false;
    const syncedCart = cart.map((item) => {
      const liveProduct = products.find(p => p.id === item.productId || p.barcode === item.barcode);
      if (liveProduct) {
        const matchingPrice = liveProduct.salePrice;
        if (item.salePrice !== matchingPrice || item.name !== liveProduct.name || item.barcode !== liveProduct.barcode || item.costPrice !== liveProduct.costPrice) {
          rawChanged = true;
          return {
            ...item,
            name: liveProduct.name,
            barcode: liveProduct.barcode,
            salePrice: matchingPrice,
            costPrice: liveProduct.costPrice
          };
        }
      }
      return item;
    });

    if (rawChanged) {
      setCart(syncedCart);
    }
  }, [products, cart]);

  // Sub-navigation state: 'checkout' vs 'reports'
  const [activeSubTab, setActiveSubTab] = useState<'checkout' | 'reports'>('checkout');

  // Sales tracking report states
  const [reportSearch, setReportSearch] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('All');
  const [selectedDateRange, setSelectedDateRange] = useState<'All' | 'Today' | 'Yesterday' | 'Week' | 'Month' | 'Custom'>('Today');
  const [reportSortDirection, setReportSortDirection] = useState<'desc' | 'asc'>('desc');
  
  const [customSaleDate, setCustomSaleDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  });

  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}-01`;
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // Pre-load from employee takeout tab transfer
  useEffect(() => {
    if (initialCart && initialCart.length > 0) {
      setCart(initialCart);
      if (initialEmployee) {
        setEmployeeSignature(initialEmployee);
      }
      if (onClearInitialPOS) {
        onClearInitialPOS();
      }
    }
  }, [initialCart, initialEmployee, onClearInitialPOS]);
  
  // Checkout Complete Modals
  const [checkedOutSale, setCheckedOutSale] = useState<{
    id: string;
    items: SaleItem[];
    total: number;
    employee: string;
    timestamp: string;
  } | null>(null);

  // States for Editing Sale (Date, Name, items)
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editEmployeeName, setEditEmployeeName] = useState('');
  const [editTimestamp, setEditTimestamp] = useState('');
  const [editItems, setEditItems] = useState<SaleItem[]>([]);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);

  const saleToDelete = sales?.find(s => s.id === deletingSaleId) || null;

  const formatISOForDateTimeInput = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  const handleEditSaleClick = (saleId: string) => {
    const targetSale = sales.find(s => s.id === saleId);
    if (targetSale) {
      setEditingSale(targetSale);
      setEditEmployeeName(targetSale.employeeName);
      setEditTimestamp(formatISOForDateTimeInput(targetSale.timestamp));
      setEditItems(JSON.parse(JSON.stringify(targetSale.items || []))); // Deep clone
    }
  };

  // 1. Math computations
  const cartTotal = cart.reduce((acc, i) => acc + (i.quantity * i.salePrice), 0);

  // Flatten sales data into individual item events for detailed reports
  const flatSalesRecords = (sales || []).flatMap((sale) => {
    return (sale.items || []).map((item) => {
      const prod = products.find(p => p.id === item.productId);
      return {
        id: sale.id,
        timestamp: sale.timestamp,
        employeeName: sale.employeeName || 'Unknown Staff',
        productId: item.productId,
        name: item.name || 'Unknown Item',
        barcode: item.barcode || 'N/A',
        category: prod?.category || 'Hardware Accessories',
        quantity: item.quantity || 0,
        salePrice: item.salePrice || 0,
        costPrice: item.costPrice || 0,
        totalAmount: (item.quantity || 0) * (item.salePrice || 0),
        profit: (item.quantity || 0) * ((item.salePrice || 0) - (item.costPrice || 0)),
      };
    });
  });

  const filteredSalesRecords = flatSalesRecords.filter((record) => {
    // 1. Text Search Filter (Product Name, Barcode SKU, Sale ID, or Employee name)
    const matchesSearch = 
      record.name.toLowerCase().includes(reportSearch.toLowerCase()) ||
      record.barcode.toLowerCase().includes(reportSearch.toLowerCase()) ||
      record.id.toLowerCase().includes(reportSearch.toLowerCase()) ||
      record.employeeName.toLowerCase().includes(reportSearch.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Employee Name Filter
    if (selectedStaff !== 'All' && record.employeeName !== selectedStaff) {
      return false;
    }

    // 3. Date Range Filter
    const recordDate = new Date(record.timestamp);
    const now = new Date();
    
    if (selectedDateRange === 'Today') {
      return recordDate.toDateString() === now.toDateString();
    } else if (selectedDateRange === 'Yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return recordDate.toDateString() === yesterday.toDateString();
    } else if (selectedDateRange === 'Week') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return recordDate >= sevenDaysAgo;
    } else if (selectedDateRange === 'Month') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return recordDate >= thirtyDaysAgo;
    } else if (selectedDateRange === 'Custom') {
      if (customStartDate) {
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        if (recordDate < start) return false;
      }
      if (customEndDate) {
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        if (recordDate > end) return false;
      }
    }

    return true;
  });

  // Sort sales records datewise based on the selected direction
  const sortedAndFilteredSalesRecords = [...filteredSalesRecords].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return reportSortDirection === 'desc' ? timeB - timeA : timeA - timeB;
  });

  // Calculate statistics from the filtered records
  const totalFilteredRevenue = filteredSalesRecords.reduce((sum, r) => sum + r.totalAmount, 0);
  const totalFilteredProfit = filteredSalesRecords.reduce((sum, r) => sum + r.profit, 0);
  const totalFilteredQuantity = filteredSalesRecords.reduce((sum, r) => sum + r.quantity, 0);
  const totalFilteredInvoices = new Set(filteredSalesRecords.map(r => r.id)).size;

  // Format daily revenue data for Recharts LineChart over the selected/filtered date range
  const getFilteredDailyRevenueData = () => {
    const dailyMap: { [key: string]: { revenue: number; profit: number } } = {};
    
    filteredSalesRecords.forEach(record => {
      try {
        const dateObj = new Date(record.timestamp);
        if (isNaN(dateObj.getTime())) return;
        const key = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
        if (!dailyMap[key]) {
          dailyMap[key] = { revenue: 0, profit: 0 };
        }
        dailyMap[key].revenue += record.totalAmount || 0;
        dailyMap[key].profit += record.profit || 0;
      } catch (e) {
        // Safe bypass
      }
    });

    const sortedKeys = Object.keys(dailyMap).sort();

    return sortedKeys.map(key => {
      const formattedDate = new Date(key).toLocaleDateString([], { month: 'short', day: '2-digit' });
      return {
        date: formattedDate,
        rawDate: key,
        revenue: parseFloat(dailyMap[key].revenue.toFixed(2)),
        profit: parseFloat(dailyMap[key].profit.toFixed(2))
      };
    });
  };

  const chartData = getFilteredDailyRevenueData();

  // Share & Dispatcher states
  const [shareChannel, setShareChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [whatsappPhone, setWhatsappPhone] = useState(() => localStorage.getItem('pos_share_whatsapp_phone') || '');
  const [emailAddress, setEmailAddress] = useState(() => localStorage.getItem('pos_share_email_address') || '');
  const [isCopied, setIsCopied] = useState(false);

  // Sync share destinations to localStorage for seamless UX
  useEffect(() => {
    localStorage.setItem('pos_share_whatsapp_phone', whatsappPhone);
  }, [whatsappPhone]);

  useEffect(() => {
    localStorage.setItem('pos_share_email_address', emailAddress);
  }, [emailAddress]);

  const getFormattedReportText = () => {
    const marginPercent = totalFilteredRevenue > 0
      ? ((totalFilteredProfit / totalFilteredRevenue) * 100).toFixed(1)
      : '0.0';

    let text = `===================================\n`;
    text    += `📊 RH DAILY SALES DATA 📊\n`;
    text    += `===================================\n`;
    text    += `Generated: ${new Date().toLocaleString()}\n`;
    text    += `Report Period: ${selectedDateRange}\n`;
    if (selectedDateRange === 'Custom') {
      text  += `Dates: ${customStartDate} to ${customEndDate}\n`;
    }
    if (selectedStaff !== 'All') {
      text  += `Filter Staff/Authorizer: ${selectedStaff}\n`;
    }
    text    += `-----------------------------------\n`;
    text    += `📈 PERFORMANCE SUMMARY\n`;
    text    += `-----------------------------------\n`;
    text    += `• Total Gross Sales : RM ${totalFilteredRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
    text    += `• Captured Net Profit: RM ${totalFilteredProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
    text    += `• Profit Margin      : ${marginPercent}%\n`;
    text    += `• Units of Stock Sold: ${totalFilteredQuantity} units\n`;
    text    += `• Receipts Generated : ${totalFilteredInvoices} checks\n`;
    text    += `-----------------------------------\n`;

    text    += `Report synchronized from POS Terminal logs.`;
    return text;
  };

  const handleSendWhatsApp = () => {
    const reportText = getFormattedReportText();
    const cleanPhone = whatsappPhone.replace(/\D/g, '');
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(reportText)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleSendEmail = () => {
    const reportText = getFormattedReportText();
    const periodStr = selectedDateRange === 'Custom' ? `${customStartDate} to ${customEndDate}` : selectedDateRange;
    const subject = `RH POS Daily Sales Report (${periodStr})`;
    const mailtoUrl = `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(reportText)}`;
    window.location.href = mailtoUrl;
  };

  const handleCopyReport = () => {
    const reportText = getFormattedReportText();
    navigator.clipboard.writeText(reportText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleSendTodaysWhatsAppReport = () => {
    // 1. Filter sales specifically for Today
    const now = new Date();
    const todaysRecords = flatSalesRecords.filter(record => {
      try {
        const recordDate = new Date(record.timestamp);
        return recordDate.toDateString() === now.toDateString();
      } catch (e) {
        return false;
      }
    });

    const todaysRevenue = todaysRecords.reduce((sum, r) => sum + r.totalAmount, 0);
    const todaysProfit = todaysRecords.reduce((sum, r) => sum + r.profit, 0);
    const todaysQuantity = todaysRecords.reduce((sum, r) => sum + r.quantity, 0);
    const todaysInvoices = new Set(todaysRecords.map(r => r.id)).size;

    const marginPercent = todaysRevenue > 0
      ? ((todaysProfit / todaysRevenue) * 100).toFixed(1)
      : '0.0';

    let text = `===================================\n`;
    text    += `📅 RH TODAY'S SALES SUMMARY 📅\n`;
    text    += `===================================\n`;
    text    += `Report Date : ${now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
    text    += `Generated At: ${now.toLocaleTimeString()}\n`;
    text    += `-----------------------------------\n`;
    text    += `📈 TODAY'S PERFORMANCE HIGHLIGHTS\n`;
    text    += `-----------------------------------\n`;
    text    += `• Total Gross Sales : RM ${todaysRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
    text    += `• Captured Net Profit: RM ${todaysProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
    text    += `• Profit Margin      : ${marginPercent}%\n`;
    text    += `• Units of Stock Sold: ${todaysQuantity} units\n`;
    text    += `• Receipts Generated : ${todaysInvoices} checks\n`;
    text    += `-----------------------------------\n`;

    text    += `System: POS Terminal Live Daily Audit.`;

    const cleanPhone = whatsappPhone.replace(/\D/g, '');
    const whatsappUrl = `https://api.whatsapp.com/send?${cleanPhone ? `phone=${cleanPhone}&` : ''}text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  const uniqueStaffNames = Array.from(
    new Set((sales || []).map((s) => s.employeeName).filter(Boolean))
  );

  const handleDownloadCSV = () => {
    if (filteredSalesRecords.length === 0) return;
    
    // Header Row with clean caps
    const csvRows = [
      ['Date & Time Log', 'Invoice Reference', 'Authorizing Employee', 'SKU / Barcode', 'Product Title', 'Quantity', 'Unit Sale Price (RM)', 'Unit Cost Price (RM)', 'Line Total (RM)', 'Line Profit (RM)'].join(',')
    ];
    
    filteredSalesRecords.forEach(r => {
      csvRows.push([
        `"${new Date(r.timestamp).toLocaleString()}"`,
        `"${r.id}"`,
        `"${r.employeeName.replace(/"/g, '""')}"`,
        `"${r.barcode}"`,
        `"${r.name.replace(/"/g, '""')}"`,
        r.quantity,
        r.salePrice,
        r.costPrice,
        r.totalAmount,
        r.profit
      ].join(','));
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join('\n'));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `rh_stock_sell_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Search products
  const matchingProducts = products.filter(p => {
    if (!searchQuery.trim()) return false;
    return p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           p.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
           p.category.toLowerCase().includes(searchQuery.toLowerCase());
  }).slice(0, 5); // limit to 5 matching for fast selection

  // 2. Cart Operations
  const addToCart = (product: Product) => {
    if (product.quantity <= 0) {
      setErrorStatus(`Product "${product.name}" is out of stock! Cannot checkout.`);
      setTimeout(() => setErrorStatus(''), 4000);
      return;
    }

    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      if (existing.quantity >= product.quantity) {
        setErrorStatus(`Insufficient units of "${product.name}" in inventory to increase checkout.`);
        setTimeout(() => setErrorStatus(''), 4000);
        return;
      }
      setCart(cart.map(item => 
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        quantity: 1,
        salePrice: product.salePrice,
        costPrice: product.costPrice
      }]);
    }
    setErrorStatus('');
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    const item = cart.find(i => i.productId === productId);
    if (!item) return;

    const originalProduct = products.find(p => p.id === productId);
    if (!originalProduct) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.filter(i => i.productId !== productId));
    } else {
      if (delta > 0 && newQty > originalProduct.quantity) {
        setErrorStatus(`Insufficient stock. Only ${originalProduct.quantity} units available.`);
        setTimeout(() => setErrorStatus(''), 4000);
        return;
      }
      setCart(cart.map(i => 
        i.productId === productId 
          ? { ...i, quantity: newQty }
          : i
      ));
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(i => i.productId !== productId));
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setErrorStatus('Checkout cart is empty.');
      return;
    }
    if (!employeeSignature.trim()) {
      setErrorStatus('Employee signature required to validate customer transactions.');
      return;
    }

    // Double-check stock limits
    for (const item of cart) {
      const original = products.find(p => p.id === item.productId);
      if (!original || original.quantity < item.quantity) {
        setErrorStatus(`Out of stock during checkout verification for "${item.name}".`);
        return;
      }
    }

    const customTimestampISO = customSaleDate ? new Date(customSaleDate).toISOString() : new Date().toISOString();

    // Complete transaction
    onRecordSale(cart, employeeSignature, customTimestampISO);
    
    // Toggle completed printable modal receipt
    setCheckedOutSale({
      id: 'RH-' + Math.floor(Math.random() * 900000 + 100000),
      items: [...cart],
      total: cartTotal,
      employee: employeeSignature,
      timestamp: customTimestampISO
    });

    // Reset checkout forms
    setCart([]);
    setEmployeeSignature('');
    setErrorStatus('');
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    setCustomSaleDate(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
  };

  const handleTriggerUndo = () => {
    if (onUndoSale && sales.length > 0) {
      const latest = sales[0];
      onUndoSale();
      setUndoSuccessMessage(`Successfully reversed sale of ${latest.items.length} items (Total: RM ${latest.totalAmount.toFixed(2)})! Stock levels have been restored.`);
      setShowUndoConfirmation(false);
      setTimeout(() => {
        setUndoSuccessMessage('');
      }, 5000);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="pos-billing-flows">
      {/* Visual Indicator & Sub Tab Selector */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-black text-slate-850 flex items-center gap-2 uppercase tracking-tight">
            <ShoppingCart size={20} className="text-emerald-600 shrink-0" />
            POS Registry & Sales Tracking
          </h2>
          <p className="text-[11px] text-slate-400 font-semibold">Process client terminal sales, audit stock line releases, and inspect detailed performance analytics</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-start xl:self-center">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('checkout')}
              className={`px-3.5 py-2 text-[10px] font-extrabold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'checkout'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/20'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShoppingCart size={11} />
              Checkout Desk Terminal
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('reports')}
              className={`px-3.5 py-2 text-[10px] font-extrabold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'reports'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/20'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              id="btn-switch-sales-reports"
            >
              <Calendar size={11} />
              Stock Sell-Out Reports
            </button>
          </div>

          {onUndoSale && sales.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowUndoConfirmation(true);
                setUndoSuccessMessage('');
              }}
              className="px-3.5 py-2 text-[10px] font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-rose-50 border border-rose-200/80 hover:bg-rose-100 text-rose-700 hover:text-rose-900 shadow-3xs uppercase tracking-wider font-sans shrink-0"
              id="btn-trigger-undo-sale"
              title="Reverse the last transaction instantly"
            >
              <RotateCcw size={11} />
              <span>Undo Last Sale</span>
            </button>
          )}
        </div>
      </div>

      {/* Undo Success Message */}
      {undoSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-250 p-4 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between shadow-3xs leading-relaxed animate-fade-in text-left">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold block text-sm">✓</span>
            <span>{undoSuccessMessage}</span>
          </div>
          <button 
            type="button"
            onClick={() => setUndoSuccessMessage('')}
            className="text-emerald-500 hover:text-emerald-700 font-bold cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Undo Confirmation Dialog/Card */}
      {showUndoConfirmation && sales.length > 0 && (
        <div className="bg-rose-50 border border-rose-250 p-5 rounded-2xl shadow-3xs space-y-4 animate-fade-in text-left">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={18} />
            <div className="space-y-1">
              <h4 className="text-sm font-black text-rose-950 uppercase tracking-wider font-sans">
                Confirm Transaction Reversal & Stock Restoration
              </h4>
              <p className="text-[11px] text-rose-800 leading-relaxed font-sans font-medium">
                You are about to reverse the latest transaction recorded by <span className="font-bold">"{sales[0].employeeName}"</span> on <span className="font-bold font-mono">{new Date(sales[0].timestamp).toLocaleString()}</span>.
              </p>
            </div>
          </div>

          {/* Details of items being returned */}
          <div className="bg-white border border-rose-100/80 rounded-xl p-3.5 max-w-xl">
            <span className="text-[9px] font-black text-rose-900 block uppercase tracking-wider mb-2">Items to re-add to inventory:</span>
            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {sales[0].items.map((item, idx) => {
                const existingProd = products.find(p => p.id === item.productId);
                const currentQty = existingProd ? existingProd.quantity : 0;
                return (
                  <div key={idx} className="py-2 flex items-center justify-between text-xs text-slate-700">
                    <span className="font-semibold text-slate-900 truncate max-w-[280px]">{item.name}</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      Restoring <span className="font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md font-sans">+{item.quantity}</span> units <span className="text-[10px] ml-1">(Current stock: {currentQty})</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500 uppercase text-[9px]">Sale Grand Total Amount:</span>
              <span className="font-mono font-black text-slate-900">RM {sales[0].totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTriggerUndo}
              className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl shadow-sm hover:shadow-md transition-all uppercase tracking-wider cursor-pointer font-sans"
              id="btn-confirm-undo-sale"
            >
              Yes, Reverse Transaction
            </button>
            <button
              type="button"
              onClick={() => setShowUndoConfirmation(false)}
              className="px-4 py-2 text-xs bg-white hover:bg-slate-100 border border-slate-250 text-slate-700 font-extrabold rounded-xl transition-all uppercase tracking-wider cursor-pointer font-sans"
              id="btn-cancel-undo-sale"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {activeSubTab === 'checkout' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sales Left: Find parts + Cart details */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Search size={16} />
              Find Products & Parts
            </h3>

            {/* Live Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Type brand name, specs description, or SKU code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-slate-200 pl-10 pr-4 p-3 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Quick Match result list dropdown */}
            <AnimatePresence>
              {searchQuery && (
                <motion.div 
                  className="divide-y divide-slate-100 border border-slate-150 rounded-xl overflow-hidden bg-slate-50/50"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                >
                  {matchingProducts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-mono">
                      No matching products registered in RH Computer Technology catalog.
                    </div>
                  ) : (
                    matchingProducts.map((p) => (
                      <div 
                        key={p.id} 
                        className="p-3 hover:bg-emerald-50/20 flex items-center justify-between text-xs cursor-pointer group"
                        onClick={() => {
                          addToCart(p);
                          setSearchQuery('');
                        }}
                      >
                        <div>
                          <span className="font-semibold text-slate-800 group-hover:text-emerald-600 truncate block max-w-[280px]">
                            {p.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">Barcode: {p.barcode} • Stock: {p.quantity} units</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800">RM {p.salePrice.toFixed(2)}</span>
                          <div className="bg-white p-1 rounded-md border border-slate-200 text-emerald-600 shadow-xs">
                            <Plus size={12} />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Cart Visualizer listing contents */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" id="pos-billing-items-card">
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-650 uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart size={14} className="text-slate-500" />
                Shopping Checkout Cart ({cart.length} unique)
              </h3>
              {cart.length > 0 && (
                <button 
                  onClick={() => setCart([])}
                  className="text-xs text-rose-500 hover:text-rose-700 font-semibold flex items-center gap-1"
                >
                  <Trash2 size={13} />
                  Clear Cart
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
              {cart.length === 0 ? (
                <div className="text-center py-20 text-slate-400 font-sans">
                  <ShoppingCart size={40} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-xs">Your sales cart is empty.</p>
                  <p className="text-[10px] text-slate-450 mt-1">Search components above to populate shopping rows.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.productId} className="p-4 flex items-center justify-between gap-4 text-xs">
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-slate-800 block truncate">{item.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">UPC: {item.barcode}</span>
                    </div>

                    {/* Quantity Modifier controls */}
                    <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-150 p-1.5 rounded-lg shrink-0">
                      <button 
                        onClick={() => updateCartQuantity(item.productId, -1)}
                        className="hover:bg-white text-slate-600 p-1 rounded-md transition-colors"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="font-mono font-bold text-slate-800 px-1">{item.quantity}</span>
                      <button 
                        onClick={() => updateCartQuantity(item.productId, 1)}
                        className="hover:bg-white text-slate-600 p-1 rounded-md transition-colors"
                      >
                        <Plus size={11} />
                      </button>
                    </div>

                    <div className="text-right shrink-0 w-36 flex flex-col items-end gap-1">
                      <div className="font-mono font-bold text-slate-850">RM {(item.quantity * item.salePrice).toFixed(2)}</div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-400 font-mono">RM</span>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.salePrice}
                          onChange={(e) => {
                            const newPrice = parseFloat(e.target.value) || 0;
                            // 1. Update the cart item price locally
                            setCart(cart.map(i => i.productId === item.productId ? { ...i, salePrice: newPrice } : i));
                            // 2. Propagate price change back to master inventory list
                            onUpdateProductPrice?.(item.productId, newPrice);
                          }}
                          className="w-18 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-700 text-right focus:outline-none"
                        />
                        <span className="text-[9px] text-slate-400 font-mono">each</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => removeFromCart(item.productId)}
                      className="text-slate-350 hover:text-rose-600 p-1 rounded transition-colors shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sales Right: Complete POS Checkout with Clerk Signature */}
        <div className="lg:col-span-5">
          <form onSubmit={handleCheckoutSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5 flex flex-col justify-between h-full" id="pos-[authorization]-frame">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                <CreditCard size={15} />
                Checkout Ledger
              </h3>

              {/* Browser Auto-saved Draft Restoration Notification Alert Banner */}
              {(employeeSignature !== '' || cart.length > 0) && (
                <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-2.5 text-[10px] text-emerald-800 flex items-center justify-between font-sans">
                  <span className="font-semibold flex items-center gap-1.5 leading-normal text-left">
                    <Sparkles size={12} className="text-emerald-600 shrink-0" />
                    Restored pending POS checkout draft.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmployeeSignature('');
                      setCart([]);
                      localStorage.removeItem('pos_checkout_cart');
                      localStorage.removeItem('pos_checkout_employeeSignature');
                    }}
                    className="text-emerald-700 hover:text-emerald-900 font-extrabold underline cursor-pointer shrink-0 ml-2 uppercase text-[9px]"
                  >
                    Clear Draft
                  </button>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-mono">RM {cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 pb-2 border-b border-slate-150">
                  <span>Sales SST Tax (0%):</span>
                  <span className="font-mono">RM 0.00</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
                  <span>Grand Total to Pay:</span>
                  <span className="font-mono text-emerald-700 text-base">RM {cartTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Employee Signature validation hook */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  Attending Employee Signature Name *
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-3.5 text-emerald-500" />
                  <input 
                    type="text" 
                    value={employeeSignature}
                    onChange={(e) => setEmployeeSignature(e.target.value)}
                    placeholder="E.g., Adam Smith"
                    className="w-full border border-emerald-250 bg-emerald-50/10 pl-9 pr-4 p-3 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-emerald-400 font-sans"
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-400 block font-sans">
                  The checkout is authenticated and recorded in the audit database under this employee signature.
                </span>
              </div>

              {/* Set custom sale transaction date */}
              <div className="space-y-1.5 font-sans">
                <label className="block text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                  <Calendar size={12} className="text-emerald-600" />
                  <span>Choose Sale Transaction Date & Time *</span>
                </label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-3.5 text-emerald-500" />
                  <input 
                    type="datetime-local" 
                    value={customSaleDate}
                    onChange={(e) => setCustomSaleDate(e.target.value)}
                    className="w-full border border-emerald-250 bg-emerald-50/10 pl-9 pr-4 p-3 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans text-slate-800"
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-400 block font-sans">
                  Explicit transaction stamp (defaults to current system timing). Helpful for historical corrections.
                </span>
              </div>
            </div>

            {errorStatus && (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-xl font-medium">
                {errorStatus}
              </div>
            )}

            <button 
              type="submit"
              disabled={cart.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs p-3.5 rounded-xl transition-all shadow-md uppercase tracking-wider flex items-center justify-center gap-2 mt-4"
            >
              <CheckCircle2 size={16} />
              Finalize & Process Checkout
            </button>
          </form>
        </div>

      </div>
      )}

      {activeSubTab === 'reports' && (
        <div className="space-y-6 animate-fade-in" id="sales-reports-panel">
          {/* Filters & Actions bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter size={15} className="text-slate-500" />
                <h3 className="text-xs font-black text-slate-705 uppercase tracking-wider">
                  Report Filters & Parameters
                </h3>
              </div>
              
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setReportSearch('');
                    setSelectedStaff('All');
                    setSelectedDateRange('All');
                    const d = new Date();
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    setCustomStartDate(`${yyyy}-${mm}-01`);
                    setCustomEndDate(`${yyyy}-${mm}-${dd}`);
                  }}
                  className="px-3 py-1.5 text-[10px] text-slate-500 hover:text-slate-700 font-bold border border-slate-200 hover:bg-slate-50 transition-all rounded-lg uppercase tracking-wide cursor-pointer"
                >
                  Reset Filters
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  disabled={filteredSalesRecords.length === 0}
                  className="px-3.5 py-1.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all rounded-lg flex items-center gap-1.5 uppercase tracking-wide cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-700/10"
                  id="btn-download-sales-csv"
                >
                  <Download size={12} />
                  Export to CSV
                </button>
                <button
                  type="button"
                  onClick={handleSendTodaysWhatsAppReport}
                  className="px-3.5 py-1.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all rounded-lg flex items-center gap-1.5 uppercase tracking-wide cursor-pointer border border-emerald-700/10"
                  id="btn-send-todays-whatsapp"
                  title="Generate and send Today's Sales summary immediately to WhatsApp"
                >
                  <Send size={12} />
                  <span>Send Today via WhatsApp</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 pt-1">
              {/* Text Search Input */}
              <div className="space-y-1.5 lg:col-span-3">
                <label className="text-[10px] font-extrabold text-slate-550 uppercase tracking-wider">
                  Search item / SKU / Invoice
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={13} />
                  <input
                    type="text"
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    placeholder="E.g., Intel, Core, APC, RH-..."
                    className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-2 text-[11px] font-medium rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Employee Filter */}
              <div className="space-y-1.5 lg:col-span-3">
                <label className="text-[10px] font-extrabold text-slate-550 uppercase tracking-wider">
                  Attending Employee
                </label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold text-slate-700"
                >
                  <option value="All">All Registered Staff ({sales.length ? uniqueStaffNames.length + " staff" : "0"})</option>
                  {uniqueStaffNames.map(staff => (
                    <option key={staff} value={staff}>{staff}</option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div className="space-y-1.5 lg:col-span-4">
                <label className="text-[10px] font-extrabold text-slate-550 uppercase tracking-wider flex items-center justify-between">
                  <span>Transaction Date Range</span>
                  {selectedDateRange === 'Custom' && (
                    <span className="text-[9px] text-emerald-600 font-mono font-bold animate-pulse">📅 picker active</span>
                  )}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/50">
                  {(['All', 'Today', 'Yesterday', 'Week', 'Month', 'Custom'] as const).map(range => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setSelectedDateRange(range)}
                      className={`py-1 text-[9px] font-extrabold rounded-md transition-all uppercase tracking-tight text-center cursor-pointer ${
                        selectedDateRange === range
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Datewise Selector */}
              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-[10px] font-extrabold text-slate-550 uppercase tracking-wider block">
                  Sort Datewise
                </label>
                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/50">
                  <button
                    type="button"
                    onClick={() => setReportSortDirection('desc')}
                    className={`py-1 text-[9px] font-extrabold rounded-md transition-all uppercase tracking-tight text-center cursor-pointer ${
                      reportSortDirection === 'desc'
                        ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/20'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Newest
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportSortDirection('asc')}
                    className={`py-1 text-[9px] font-extrabold rounded-md transition-all uppercase tracking-tight text-center cursor-pointer ${
                      reportSortDirection === 'asc'
                        ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/20'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    id="btn-sort-sales-asc"
                  >
                    Oldest
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Date Inputs Row */}
            {selectedDateRange === 'Custom' && (
              <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200/60 p-4.5 rounded-xl pt-3.5 animate-slide-down">
                <div className="space-y-1">
                  <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest pl-0.5">
                    Start Date (From 12:00 AM)
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 px-3.5 py-2 text-[11px] font-semibold text-slate-755 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest pl-0.5">
                    End Date (To 11:59 PM)
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 px-3.5 py-2 text-[11px] font-semibold text-slate-755 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* KPI Dashboard Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Total Filtered Gross Value</span>
              <p className="text-lg font-black text-slate-850 font-mono">RM {totalFilteredRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <span className="text-[9.5px] text-emerald-700 font-bold uppercase tracking-wider font-sans bg-emerald-50 px-1 py-0.5 rounded text-[8.5px]">SST Core (0% Excluded)</span>
            </div>
            
            <div className="bg-white p-4.5 rounded-2xl border border-slate-205 shadow-xs space-y-1">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Captured Net Profit Margin</span>
              <p className={`text-lg font-black font-mono ${totalFilteredProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                RM {totalFilteredProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[9.5px] text-slate-400 font-medium font-sans">
                {totalFilteredRevenue > 0 ? `${((totalFilteredProfit / totalFilteredRevenue) * 100).toFixed(1)}% margins` : '0% margin'}
              </span>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Units of Stock Sold</span>
              <p className="text-lg font-black text-slate-850 font-mono">{totalFilteredQuantity} units</p>
              <span className="text-[9.5px] text-slate-400 font-medium font-sans">Across catalog hardware</span>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Invoices Generated</span>
              <p className="text-lg font-black text-slate-850 font-mono">{totalFilteredInvoices} receipts</p>
              <span className="text-[9.5px] text-slate-400 font-medium font-sans">Processed tickets</span>
            </div>
          </div>

          {/* Charts & Sharing Panel Combined Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Daily Sales Revenue Chart (lg:col-span-2) */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between" id="daily-sales-revenue-recharts">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
                <div>
                  <h3 className="font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5 text-xs uppercase">
                    <TrendingUp size={16} className="text-emerald-600" />
                    Daily Revenue Performance Trends
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">Daily transaction earnings over the selected range ({selectedDateRange})</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-[9px] font-mono font-extrabold text-emerald-600 uppercase tracking-wide">
                  Selected Range: {selectedDateRange}
                </div>
              </div>

              <div className="w-full h-64 bg-slate-50 rounded-xl p-3 border border-slate-200/60 flex items-center justify-center">
                {chartData.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 font-sans gap-1.5 py-12">
                    <TrendingUp size={28} className="text-slate-300 animate-pulse" />
                    <span className="text-xs font-bold text-slate-600">No transaction logs in filtered window</span>
                    <span className="text-[9.5px] text-slate-400">Select a wider date range or complete sales above.</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 15, right: 15, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="date" 
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
                        labelStyle={{ fontWeight: 'extrabold', color: '#34d399', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase' }}
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
            </div>

            {/* Daily Sales Dispatcher Panel (lg:col-span-1) */}
            <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between animate-fade-in" id="sales-report-dispatcher">
              <div className="space-y-4">
                <div>
                  <h3 className="font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5 text-xs uppercase">
                    <Mail size={15} className="text-emerald-600" />
                    Dispatch Report Desk
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">Broadcast daily transaction summaries instantly</p>
                </div>

                {/* Selective Channel Buttons */}
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/55">
                  <button
                    type="button"
                    onClick={() => setShareChannel('whatsapp')}
                    className={`py-2 text-[9.5px] font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider ${
                      shareChannel === 'whatsapp'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>💬 WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareChannel('email')}
                    className={`py-2 text-[9.5px] font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider ${
                      shareChannel === 'email'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Mail size={12} className={shareChannel === 'email' ? 'text-white' : 'text-slate-500'} />
                    <span>📧 E-Mail</span>
                  </button>
                </div>

                {/* Input Fields details */}
                {shareChannel === 'whatsapp' ? (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-550 uppercase tracking-wider block">
                      Recipient WhatsApp Number
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={whatsappPhone}
                        onChange={(e) => setWhatsappPhone(e.target.value)}
                        placeholder="E.g., +60123456789"
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] font-mono font-semibold text-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 block font-bold leading-normal">
                      💡 Enter country prefix code (e.g. <strong>+60</strong> for Malaysia) with no spaces.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-550 uppercase tracking-wider block">
                      Recipient Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        placeholder="E.g., manager@hardwaretransx.com"
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 block font-bold leading-normal">
                      💡 Open mail client with formatted email body structured automatically.
                    </span>
                  </div>
                )}

                {/* Compiled plain-text review panel */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[9.5px] font-extrabold text-slate-500 uppercase tracking-widest pl-0.5">
                      Message Preview
                    </label>
                    <button
                      type="button"
                      onClick={handleCopyReport}
                      className="px-1.5 py-0.5 text-[9px] text-emerald-700 hover:text-emerald-850 bg-emerald-50 border border-emerald-100/40 rounded flex items-center gap-1 font-bold cursor-pointer hover:bg-emerald-100"
                    >
                      {isCopied ? (
                        <>
                          <Check size={10} className="text-emerald-600 font-bold" />
                          <span className="text-emerald-700 font-extrabold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={10} />
                          <span>Copy Raw Text</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="w-full h-28 bg-slate-950 text-slate-300 font-mono text-[9px] p-2 rounded-lg overflow-y-auto select-all leading-normal border border-slate-800">
                    {getFormattedReportText()}
                  </pre>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-3">
                {shareChannel === 'whatsapp' ? (
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] p-2.5 rounded-xl transition-all shadow-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-700/10"
                  >
                    <Send size={11} />
                    Submit to WhatsApp
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendEmail}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] p-2.5 rounded-xl transition-all shadow-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-700/10"
                  >
                    <Mail size={11} />
                    Dispatch via Email
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Sell Records Inventory Data Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <FileText size={14} className="text-emerald-600" />
                Employee Sales Logging Ledger ({filteredSalesRecords.length} entries matching)
              </h3>
              <span className="text-[9.5px] font-mono text-slate-400 uppercase tracking-wider bg-slate-150 border px-1.5 py-0.5 rounded">
                Ref Timezone: UTC
              </span>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 bg-slate-100/50 border-b border-slate-150">
                  <tr>
                    <th className="p-3.5 pl-5">Date & Time Log</th>
                    <th className="p-3.5">Invoice Ref</th>
                    <th className="p-3.5">Attending Staff</th>
                    <th className="p-3.5">SKU / Barcode</th>
                    <th className="p-3.5">Product Description</th>
                    <th className="p-3.5 text-center">Qty Sold</th>
                    <th className="p-3.5 text-right">Unit Price (RM)</th>
                    <th className="p-3.5 text-right">Line Total (RM)</th>
                    <th className="p-3.5 text-right">Profit (RM)</th>
                    <th className="p-3.5 text-center">Modify</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-655">
                  {filteredSalesRecords.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-24 text-center text-slate-400">
                        <FolderOpen size={40} className="mx-auto text-slate-200 mb-2.5" />
                        <p className="font-bold text-slate-600">No matching stock sell records captured.</p>
                        <p className="text-[10px] text-slate-400 max-w-sm mx-auto mt-1">Adjust your dates, search strings, or employee staff signatures above to re-query the cloud transaction logs.</p>
                      </td>
                    </tr>
                  ) : (
                    sortedAndFilteredSalesRecords.map((record, index) => (
                      <tr 
                        key={`${record.id}-${record.productId}-${index}`} 
                        className="hover:bg-slate-50/50 transition-colors border-b border-slate-100/50"
                      >
                        <td className="p-3.5 pl-5 whitespace-nowrap font-mono text-slate-400">
                          <span className="font-semibold text-slate-700 block text-[10px] sm:inline mr-1">
                            {new Date(record.timestamp).toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' })}
                          </span>
                          <span className="text-slate-400">
                            {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                          {record.id}
                        </td>
                        <td className="p-3.5 font-bold text-emerald-800 uppercase whitespace-nowrap">
                          <span className="bg-emerald-50/80 border border-emerald-100 px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 font-extrabold text-emerald-800">
                            <User size={10} className="text-emerald-500" />
                            {record.employeeName}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-500 whitespace-nowrap">
                          {record.barcode}
                        </td>
                        <td className="p-3.5">
                          <span className="font-semibold text-slate-800 line-clamp-1" title={record.name}>
                            {record.name}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold block uppercase mt-0.5">{record.category}</span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="inline-block bg-slate-100 text-slate-805 font-black font-mono px-2 py-0.5 rounded border border-slate-200 text-[10.5px]">
                            {record.quantity}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-slate-800">
                          {record.salePrice.toFixed(2)}
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-emerald-800">
                          {record.totalAmount.toFixed(2)}
                        </td>
                        <td className={`p-3.5 text-right font-mono font-extrabold ${record.profit >= 0 ? 'text-emerald-600 bg-emerald-50/20' : 'text-rose-600 bg-rose-50/20'}`}>
                          {record.profit >= 0 ? '+' : ''}{record.profit.toFixed(2)}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditSaleClick(record.id)}
                              className="p-1 px-2 text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-200 text-emerald-705 hover:text-emerald-850 rounded font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
                              id={`btn-edit-sale-${record.id}-${index}`}
                              title="Edit sale transaction details"
                            >
                              <Edit size={10} />
                              Edit
                            </button>
                            {onDeleteSale && (
                              <button
                                type="button"
                                onClick={() => setDeletingSaleId(record.id)}
                                className="p-1 px-2 text-[10px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-800 rounded font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
                                id={`btn-delete-sale-${record.id}-${index}`}
                                title="Delete invoice and restore inventory stock"
                              >
                                <Trash2 size={10} />
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredSalesRecords.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3 font-semibold">
                <p>Showing flat sales extraction ledger. All amounts are displayed in Malaysian Ringgit (RM) based on original checkout snapshots.</p>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                  <span className="font-bold text-emerald-700">Audit tracking synchronized successfully</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Printed Receipt Simulator Dialog */}
      {checkedOutSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 font-mono text-xs text-slate-800 printable-receipt"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="text-center font-sans space-y-1 pb-4 border-b border-dashed border-slate-200">
              <h4 className="font-extrabold text-slate-900 text-sm">RH COMPUTER TECHNOLOGY</h4>
              <p className="text-[10px] text-slate-500">Kuala Lumpur, Malaysia</p>
              <p className="text-[10px] text-slate-500">Retail Inventory Invoice Receipt</p>
            </div>

            <div className="py-4 space-y-1.5 border-b border-dashed border-slate-200 text-[11px]">
              <div className="flex justify-between">
                <span>Receipt Ref:</span>
                <span className="font-bold text-slate-900">{checkedOutSale.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Date Recorded:</span>
                <span>{new Date(checkedOutSale.timestamp).toLocaleDateString()} {new Date(checkedOutSale.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
              <div className="flex justify-between">
                <span>Served Clerk:</span>
                <span className="font-bold underline">{checkedOutSale.employee}</span>
              </div>
            </div>

            <div className="py-4 space-y-3 border-b border-dashed border-slate-200 max-h-[180px] overflow-y-auto">
              {checkedOutSale.items.map((item, id) => (
                <div key={id} className="flex justify-between gap-2.5 text-[11px]">
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 block truncate">{item.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{item.quantity} x RM {item.salePrice.toFixed(2)}</span>
                  </div>
                  <span className="font-bold text-slate-950 shrink-0">RM {(item.quantity * item.salePrice).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="py-4 space-y-1 border-b border-dashed border-slate-200 text-xs">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>RM {checkedOutSale.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>SST INCLUDED:</span>
                <span>RM 0.00</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-slate-950 pt-2 font-sans">
                <span>TOTAL PAID RM:</span>
                <span>RM {checkedOutSale.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="text-center font-sans text-[10px] text-slate-400 mt-4 space-y-0.5">
              <p className="font-bold text-emerald-600">✓ Transaction synced to Secure Cloud Core</p>
              <p>Thank you for shopping at RH Computer Technology!</p>
            </div>

            {/* Print and Close controls */}
            <div className="mt-5 space-y-2 no-print">
              <button 
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-extrabold text-xs py-2.5 rounded-xl transition-all text-center flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                id="btn-print-receipt-action"
              >
                <Printer size={13} />
                Print Receipt
              </button>

              <button 
                type="button"
                onClick={() => setCheckedOutSale(null)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold text-xs py-2.5 rounded-xl transition-colors text-center block"
                id="btn-close-receipt-action"
              >
                Close Receipt Ticket
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ✏️ Edit Sale Confirmation & Modifiers Modal */}
      {editingSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in" id="edit-sale-ledger-modal">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden my-8"
          >
            {/* Header branding */}
            <div className="bg-emerald-600 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-700/80 rounded-xl border border-white/10">
                  <Edit size={16} className="text-white shrink-0" />
                </div>
                <div className="text-left">
                  <h3 className="text-xs font-black tracking-wider uppercase">Edit Sales Ledger Entry</h3>
                  <p className="text-[10px] text-emerald-100 font-mono">Invoice Reference: #{editingSale.id}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setEditingSale(null)}
                className="p-1 px-2.5 rounded-lg bg-emerald-700/50 hover:bg-rose-600 text-white text-[10px] font-bold border border-white/10 uppercase cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="p-6 space-y-4 text-left">
              
              {/* Alert Warning banner */}
              <div className="p-3 bg-amber-55/15 border border-amber-100 rounded-xl flex items-start gap-2.5">
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 font-bold leading-normal">
                  You are editing an authorized transaction. All totals, profits, and cloud databases will be automatically updated and synchronized.
                </p>
              </div>

              {/* DATE / TIMESTAMP FIELD */}
              <div className="space-y-1.5">
                <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block">
                  1. Transaction Date & Time Log (UTC)
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={editTimestamp}
                    onChange={(e) => setEditTimestamp(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500"
                    id="edit-sale-timestamp-input"
                  />
                </div>
              </div>

              {/* CLERK ATTENDING NAME FIELD */}
              <div className="space-y-1.5">
                <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block">
                  2. Attending Staff / Operator Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={editEmployeeName}
                    onChange={(e) => setEditEmployeeName(e.target.value)}
                    placeholder="Enter operator signature"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500"
                    id="edit-sale-employee-input"
                  />
                </div>
              </div>

              {/* ITEM EDITING / LISTING OPTION */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block">
                    3. Modify Cart Invoice List ({editItems.length} items)
                  </label>

                  {/* dropdown select to add item */}
                  <select
                    onChange={(e) => {
                      const prodId = e.target.value;
                      if (!prodId) return;
                      const selectedProd = products.find(p => p.id === prodId);
                      if (selectedProd) {
                        const existing = editItems.find(i => i.productId === prodId);
                        if (existing) {
                          setEditItems(editItems.map(i => i.productId === prodId ? { ...i, quantity: i.quantity + 1 } : i));
                        } else {
                          setEditItems([...editItems, {
                            productId: selectedProd.id,
                            name: selectedProd.name,
                            barcode: selectedProd.barcode,
                            quantity: 1,
                            salePrice: selectedProd.salePrice,
                            costPrice: selectedProd.costPrice
                          }]);
                        }
                      }
                      e.target.value = '';
                    }}
                    className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-[10px] font-extrabold px-3 py-1.5 rounded-xl border border-emerald-200 outline-none cursor-pointer"
                  >
                    <option value="">+ Add item to invoice...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (RM {p.salePrice})</option>
                    ))}
                  </select>
                </div>

                {editItems.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-slate-200/65 rounded-xl font-medium text-slate-400 text-xs">
                    No items left in this invoice. Add an item above to continue.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {editItems.map((item, index) => (
                      <div key={item.productId} className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="min-w-0 text-left flex-1">
                          <span className="font-bold text-slate-800 text-xs block truncate" title={item.name}>{item.name}</span>
                          <span className="text-[9px] font-mono text-slate-400 block mt-0.5">Barcode: {item.barcode} | Cost: RM {item.costPrice.toFixed(2)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Unit Sale Price Field */}
                          <div className="w-20 text-left">
                            <span className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Price</span>
                            <input
                              type="number"
                              min={0.01}
                              step="any"
                              value={item.salePrice}
                              onChange={(e) => {
                                const newPrice = parseFloat(e.target.value) || 0;
                                setEditItems(editItems.map((it, idx) => idx === index ? { ...it, salePrice: newPrice } : it));
                              }}
                              className="w-full bg-white border border-slate-200 px-2 py-1 rounded text-xs font-mono font-bold text-slate-700 text-right"
                            />
                          </div>

                          {/* Editable Quantity fields */}
                          <div className="w-18 text-left">
                            <span className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Qty</span>
                            <div className="flex items-center bg-white border border-slate-200 rounded overflow-hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextQty = Math.max(1, item.quantity - 1);
                                  setEditItems(editItems.map((it, idx) => idx === index ? { ...it, quantity: nextQty } : it));
                                }}
                                className="px-1 text-slate-500 hover:bg-slate-100 font-bold"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => {
                                  const nextQty = Math.max(1, parseInt(e.target.value, 10) || 1);
                                  setEditItems(editItems.map((it, idx) => idx === index ? { ...it, quantity: nextQty } : it));
                                }}
                                className="w-full text-center bg-transparent border-0 text-xs font-bold text-slate-700 outline-none font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setEditItems(editItems.map((it, idx) => idx === index ? { ...it, quantity: it.quantity + 1 } : it));
                                }}
                                className="px-1 text-slate-500 hover:bg-slate-100 font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Delete Item */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditItems(editItems.filter((_, idx) => idx !== index));
                            }}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                            title="Remove item"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* TOTAL AMOUNT RUNNING STATISTICS PREVIEW */}
              <div className="bg-slate-105 p-3 rounded-xl border border-slate-200 space-y-1 font-mono text-[10px]">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">New Subtotal Price:</span>
                  <span className="font-extrabold text-slate-800">
                    RM {editItems.reduce((acc, it) => acc + (it.quantity * it.salePrice), 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Estimated Cost Base:</span>
                  <span className="font-extrabold text-slate-500">
                    RM {editItems.reduce((acc, it) => acc + (it.quantity * it.costPrice), 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 text-[10.5px]">
                  <span className="font-extrabold text-emerald-800 uppercase">New Profit Earned:</span>
                  <span className={`font-black font-mono ${
                    editItems.reduce((acc, it) => acc + (it.quantity * (it.salePrice - it.costPrice)), 0) >= 0 
                      ? 'text-emerald-600' 
                      : 'text-rose-600'
                  }`}>
                    RM {editItems.reduce((acc, it) => acc + (it.quantity * (it.salePrice - it.costPrice)), 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action save/exit controller triggers */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                {onDeleteSale && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingSaleId(editingSale.id);
                      setEditingSale(null);
                    }}
                    className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    title="Delete entire invoice and restore inventory stock"
                  >
                    <Trash2 size={13} />
                    Delete Invoice
                  </button>
                )}
                <div className="flex items-center gap-2.5 ml-auto w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setEditingSale(null)}
                    className="flex-1 sm:flex-none py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    disabled={editItems.length === 0 || !editEmployeeName.trim()}
                    onClick={() => {
                      if (editItems.length === 0 || !editEmployeeName.trim()) return;
                      const totalAmount = editItems.reduce((acc, it) => acc + (it.quantity * it.salePrice), 0);
                      const profit = editItems.reduce((acc, it) => acc + (it.quantity * (it.salePrice - it.costPrice)), 0);
                      
                      const updatedSale: Sale = {
                        ...editingSale,
                        employeeName: editEmployeeName.trim(),
                        timestamp: editTimestamp ? new Date(editTimestamp).toISOString() : editingSale.timestamp,
                        items: editItems,
                        totalAmount,
                        profit
                      };

                      onUpdateSale?.(updatedSale);
                      setEditingSale(null);
                    }}
                    className={`flex-1 sm:flex-none py-2.5 px-4 rounded-xl text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md ${
                      editItems.length > 0 && editEmployeeName.trim()
                        ? 'bg-emerald-600 hover:bg-emerald-705 cursor-pointer'
                        : 'bg-slate-300 pointer-events-none opacity-50 shadow-none'
                    }`}
                    id="btn-save-sale-changes"
                  >
                    <Save size={13} />
                    Save Ledger Changes
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* 🗑️ Delete Sale Ledger Entry Confirmation Modal */}
      {saleToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in" id="delete-sale-confirmation-modal">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl border border-rose-200 shadow-2xl max-w-md w-full overflow-hidden my-8"
          >
            <div className="bg-rose-600 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-700/80 rounded-xl border border-white/10">
                  <AlertTriangle size={16} className="text-white shrink-0" />
                </div>
                <div className="text-left">
                  <h3 className="text-xs font-black tracking-wider uppercase">Delete Ledger Entry</h3>
                  <p className="text-[10px] text-rose-100 font-mono">Invoice Reference: #{saleToDelete.id}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setDeletingSaleId(null)}
                className="p-1 px-2.5 rounded-lg bg-rose-700/50 hover:bg-slate-800 text-white text-[10px] font-bold border border-white/10 uppercase cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="p-6 space-y-4 text-left font-sans">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                You are about to permanently delete invoice <span className="font-bold text-slate-900 font-mono">#{saleToDelete.id}</span> logged by <span className="font-bold text-slate-900">"{saleToDelete.employeeName}"</span> on <span className="font-bold font-mono">{new Date(saleToDelete.timestamp).toLocaleString()}</span>.
              </p>

              <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-3.5 space-y-2">
                <span className="text-[9px] font-black text-rose-900 uppercase tracking-wider block">Automatic Stock Restoration:</span>
                <div className="divide-y divide-rose-100/60 max-h-40 overflow-y-auto">
                  {saleToDelete.items.map((item, idx) => {
                    const existingProd = products.find(p => p.id === item.productId);
                    const currentQty = existingProd ? existingProd.quantity : 0;
                    return (
                      <div key={idx} className="py-1.5 flex items-center justify-between text-xs text-slate-700">
                        <span className="font-semibold text-slate-900 truncate max-w-[220px]">{item.name}</span>
                        <span className="font-mono text-[10px] text-slate-600">
                          Restoring <span className="font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-sans">+{item.quantity}</span> units <span className="text-[9px] text-slate-400">(Current: {currentQty})</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="pt-2 border-t border-rose-100/80 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-500 uppercase text-[9px]">Total Invoice Amount:</span>
                  <span className="font-mono font-black text-rose-800">RM {saleToDelete.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletingSaleId(null)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteSale) {
                      onDeleteSale(saleToDelete.id);
                    }
                    if (editingSale?.id === saleToDelete.id) {
                      setEditingSale(null);
                    }
                    setDeletingSaleId(null);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                  id="btn-confirm-delete-sale"
                >
                  <Trash2 size={13} />
                  Confirm Deletion & Restore Stock
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
