/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ArrowUpDown, 
  ArrowUp,
  ArrowDown, 
  Package, 
  Layers, 
  AlertTriangle,
  User,
  X,
  FileCheck,
  Download,
  Printer,
  Barcode,
  ExternalLink,
  CheckSquare,
  Sliders,
  Check,
  AlertCircle,
  Image as ImageIcon,
  QrCode as QrCodeIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles
} from 'lucide-react';
import { Product, AuditLog } from '../types';
import ProductPhotoCapture from './ProductPhotoCapture';
import QRCode from 'qrcode';

// Deterministic 1D barcode stripes SVG generator based on product SKU string
function renderBarcodeSVG(barcodeStr: string) {
  const input = (barcodeStr || "00000000").trim().toUpperCase();
  // Build a reproducible sequence of bar widths
  let hashNum = 0;
  for (let i = 0; i < input.length; i++) {
    hashNum = (hashNum * 31 + input.charCodeAt(i)) & 0xffffff;
  }

  // Draw 24 alternating black & white bars with specific deterministic widths
  const bars: { width: number; isBlack: boolean }[] = [];
  let isBlack = true;
  let seed = hashNum || 1234567;
  
  for (let i = 0; i < 24; i++) {
    // pseudo-random but fully deterministic LCG width selector
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const isWide = (seed % 3) === 0;
    const width = isWide ? 3 : 1.5;
    
    // Always start/end with black bars for real scanner boundary looks
    const finalBlack = i === 0 || i === 23 ? true : isBlack;
    bars.push({ width, isBlack: finalBlack });
    
    isBlack = !isBlack;
  }

  const totalWidth = bars.reduce((sum, b) => sum + b.width, 0);

  return (
    <svg viewBox={`0 0 ${totalWidth} 40`} className="w-full h-10 bg-white" preserveAspectRatio="none">
      {bars.map((bar, i) => (
        bar.isBlack ? (
          <rect 
            key={i} 
            x={bars.slice(0, i).reduce((sum, b) => sum + b.width, 0)} 
            y={0} 
            width={bar.width} 
            height={40} 
            fill="#000000" 
          />
        ) : null
      ))}
    </svg>
  );
}

interface InventoryListProps {
  products: Product[];
  auditLogs: AuditLog[];
  onAddProduct: (product: Omit<Product, 'id' | 'updatedAt'>, employeeName: string) => void;
  onUpdateProduct: (productId: string, updatedFields: Partial<Product>, employeeName: string) => void;
  onDeleteProduct: (productId: string, employeeName: string) => void;
  onBulkUpdateProducts?: (updates: { id: string; fields: Partial<Product> }[], employeeName: string) => Promise<void> | void;
}

export default function InventoryList({ 
  products, 
  auditLogs,
  onAddProduct, 
  onUpdateProduct, 
  onDeleteProduct,
  onBulkUpdateProducts
}: InventoryListProps) {
  // Navigation & Form State
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [deletingItem, setDeletingItem] = useState<Product | null>(null);
  const [barcodeStickerItem, setBarcodeStickerItem] = useState<Product | null>(null);
  const [stickerMode, setStickerMode] = useState<'dual' | 'barcode' | 'qrcode'>('dual');
  const [generatedQRCode, setGeneratedQRCode] = useState<string>('');

  // Quick action context menu adjustment states
  const [quickAdjustProductId, setQuickAdjustProductId] = useState<string | null>(null);
  const [quickAdjustType, setQuickAdjustType] = useState<'in' | 'out' | null>(null);
  const [quickAdjustQty, setQuickAdjustQty] = useState<number>(1);
  const [quickAdjustEmployee, setQuickAdjustEmployee] = useState<string>(() => {
    return localStorage.getItem('rh_quick_adjust_employee') || '';
  });
  const [quickAdjustError, setQuickAdjustError] = useState<string>('');

  // Helper to compute a product's current stock quantity trend relative to previous audit log entry
  const getProductTrend = (product: Product) => {
    if (!auditLogs || auditLogs.length === 0) return null;
    
    // Filter and sort audit logs for this specific product, newest first
    const pLogs = auditLogs
      .filter(log => log.productId === product.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (pLogs.length === 0) return null;

    const latestLog = pLogs[0];
    let previousQuantity = 0;
    let label = '';

    if (pLogs.length >= 2) {
      // Compare current quantity with the previous log's quantityAfter
      previousQuantity = pLogs[1].quantityAfter;
      label = `Previous log (${new Date(pLogs[1].timestamp).toLocaleDateString()}): ${previousQuantity} units. Newest action was ${latestLog.type} by ${latestLog.employeeName || 'System'} (${latestLog.delta >= 0 ? '+' : ''}${latestLog.delta}).`;
    } else {
      // Compare current quantity with the state before the only log
      previousQuantity = latestLog.quantityAfter - latestLog.delta;
      label = `Initial quantity before first log (${new Date(latestLog.timestamp).toLocaleDateString()}): ${previousQuantity} units. Newest action was ${latestLog.type} by ${latestLog.employeeName || 'System'} (${latestLog.delta >= 0 ? '+' : ''}${latestLog.delta}).`;
    }

    const difference = product.quantity - previousQuantity;
    return {
      difference,
      previousQuantity,
      label,
    };
  };

  const renderTrendSelector = (product: Product) => {
    const trend = getProductTrend(product);
    if (!trend) return null;

    const { difference, label } = trend;

    if (difference > 0) {
      return (
        <span 
          className="inline-flex items-center gap-0.5 text-[9px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1 py-0.5 rounded-md cursor-help shrink-0"
          title={label}
        >
          <TrendingUp size={9} className="stroke-[3px]" />
          <span>+{difference}</span>
        </span>
      );
    } else if (difference < 0) {
      return (
        <span 
          className="inline-flex items-center gap-0.5 text-[9px] font-extrabold text-rose-600 bg-rose-50 border border-rose-100 px-1 py-0.5 rounded-md cursor-help shrink-0"
          title={label}
        >
          <TrendingDown size={9} className="stroke-[3px]" />
          <span>{difference}</span>
        </span>
      );
    } else {
      return (
        <span 
          className="inline-flex items-center gap-0.5 text-[9px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded-md cursor-help shrink-0"
          title={label}
        >
          <Minus size={9} className="stroke-[3px]" />
          <span>0</span>
        </span>
      );
    }
  };

  React.useEffect(() => {
    if (barcodeStickerItem) {
      QRCode.toDataURL(barcodeStickerItem.barcode, {
        width: 180,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
      .then(url => {
        setGeneratedQRCode(url);
      })
      .catch(err => {
        console.error("Error generating QR code:", err);
      });
    } else {
      setGeneratedQRCode('');
    }
  }, [barcodeStickerItem]);

  const [deleteSignature, setDeleteSignature] = useState('');
  const [deleteError, setDeleteError] = useState('');
  
  const handleSaveQuickAdjust = (product: Product) => {
    if (!quickAdjustEmployee.trim()) {
      setQuickAdjustError('Name signature is required!');
      return;
    }
    if (quickAdjustQty <= 0) {
      setQuickAdjustError('Must be at least 1 unit.');
      return;
    }
    
    let nextQty = product.quantity;
    if (quickAdjustType === 'in') {
      nextQty += quickAdjustQty;
    } else {
      nextQty = product.quantity - quickAdjustQty;
      if (nextQty < 0) {
        setQuickAdjustError(`Cannot stock out more than ${product.quantity} units!`);
        return;
      }
    }

    onUpdateProduct(product.id, {
      quantity: nextQty,
      updatedBy: quickAdjustEmployee.trim()
    }, quickAdjustEmployee.trim());

    handleCancelQuickAdjust();
  };

  const handleCancelQuickAdjust = () => {
    setQuickAdjustProductId(null);
    setQuickAdjustType(null);
    setQuickAdjustQty(1);
    setQuickAdjustError('');
  };
  
  // Bulk Selection and adjustment states
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isBulkAdjusting, setIsBulkAdjusting] = useState(false);
  const [bulkAdjType, setBulkAdjType] = useState<'quantity' | 'price'>('quantity');
  
  // Bulk Quantity states
  const [bulkQtyOperator, setBulkQtyOperator] = useState<'add' | 'subtract' | 'set'>('add');
  const [bulkQtyValue, setBulkQtyValue] = useState<number>(0);
  
  // Bulk Price states
  const [bulkPriceTarget, setBulkPriceTarget] = useState<'cost' | 'sale'>('sale');
  const [bulkPriceOperator, setBulkPriceOperator] = useState<'add_flat' | 'subtract_flat' | 'add_percent' | 'subtract_percent' | 'set'>('add_flat');
  const [bulkPriceValue, setBulkPriceValue] = useState<number>(0);

  const [bulkEmployeeSignature, setBulkEmployeeSignature] = useState('');
  const [bulkError, setBulkError] = useState('');
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [alertFilter, setAlertFilter] = useState<'All' | 'LowStock' | 'OutOfStock'>('All');
  const [sortField, setSortField] = useState<'name' | 'quantity' | 'costPrice' | 'salePrice' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isPrintingInventory, setIsPrintingInventory] = useState(false);
  const [printFilterMode, setPrintFilterMode] = useState<'all' | 'filtered'>('all');
  const [isDateWiseActive, setIsDateWiseActive] = useState(false);
  const [snapshotDate, setSnapshotDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const handlePrintInventoryWindow = () => {
    const currentList = filteredProducts;
    const totalUnits = currentList.reduce((sum, p) => sum + p.quantity, 0);
    const totalCostVal = currentList.reduce((sum, p) => sum + (p.quantity * p.costPrice), 0);
    const totalSaleVal = currentList.reduce((sum, p) => sum + (p.quantity * p.salePrice), 0);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to print the inventory list in a new window/tab.");
      return;
    }

    const rowsHtml = currentList.map((p, index) => {
      const isLowStock = p.quantity <= p.minStockThreshold;
      const isOutOfStock = p.quantity <= 0;
      const rowStyle = isOutOfStock 
        ? 'background-color: #fef2f2; color: #991b1b; font-weight: 600;' 
        : isLowStock 
          ? 'background-color: #fffbeb; color: #92400e; font-weight: 600;' 
          : index % 2 === 1 ? 'background-color: #f8fafc;' : '';

      return `
        <tr style="${rowStyle}">
          <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-weight: bold; color: #64748b;">${index + 1}</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; text-transform: uppercase;">${p.barcode}</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1;">
            <div style="font-weight: 800; color: #0fa172a;">${p.name}</div>
            ${p.description ? `<div style="font-size: 11px; color: #64748b; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; max-width: 400px; white-space: nowrap;">${p.description}</div>` : ''}
          </td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; font-size: 11px; text-transform: uppercase; font-weight: bold; color: #64748b;">${p.category}</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-size: 11px; color: #475569; font-weight: bold;">${p.storageLocation || 'Unassigned'}</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">RM ${p.costPrice.toFixed(2)}</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">RM ${p.salePrice.toFixed(2)}</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">
            <div style="font-family: monospace; font-weight: 900; font-size: 12px;">
              <span style="${isOutOfStock ? 'color: #dc2626;' : isLowStock ? 'color: #d97706;' : 'color: #0f172a;'}">${p.quantity} Units</span>
            </div>
            ${isOutOfStock ? '<span style="font-size: 9px; background-color: #fee2e2; border: 1px solid #fecaca; color: #991b1b; padding: 2px 4px; border-radius: 3px; font-weight: bold; text-transform: uppercase; margin-top: 4px; display: inline-block;">OUT</span>' : ''}
            ${!isOutOfStock && isLowStock ? '<span style="font-size: 9px; background-color: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 2px 4px; border-radius: 3px; font-weight: bold; text-transform: uppercase; margin-top: 4px; display: inline-block;">LOW</span>' : ''}
          </td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>RH Computer Technology - Active Inventory Report</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
          
          body {
            font-family: 'Inter', system-ui, sans-serif;
            background-color: #f8fafc;
            color: #1e293b;
            margin: 0;
            padding: 24px;
          }

          h1, h2, h3 {
            font-family: 'Outfit', sans-serif;
            margin: 0;
          }

          .print-container {
            background-color: #ffffff;
            border-radius: 16px;
            max-width: 1100px;
            margin: 0 auto;
            padding: 32px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
            border: 1px solid #f1f5f9;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px dashed #cbd5e1;
            padding-bottom: 20px;
            margin-bottom: 24px;
          }

          .header-title h1 {
            font-size: 24px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.025em;
          }

          .header-title p {
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: #059669;
            font-weight: 700;
            margin: 4px 0 0 0;
            letter-spacing: 0.05em;
          }

          .header-meta {
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            color: #64748b;
            text-align: right;
            line-height: 1.6;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 24px;
          }

          .summary-card {
            padding: 16px;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            background-color: #f8fafc;
          }

          .summary-label {
            display: block;
            font-size: 10px;
            font-weight: 800;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.1em;
          }

          .summary-val {
            display: block;
            font-size: 16px;
            font-weight: 950;
            color: #0f172a;
            font-family: 'JetBrains Mono', monospace;
            margin-top: 6px;
          }

          .summary-val.emerald {
            color: #047857;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #cbd5e1;
            font-size: 12px;
            margin-bottom: 32px;
          }

          th {
            background-color: #f1f5f9;
            color: #475569;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.05em;
            padding: 12px 10px;
            border: 1px solid #cbd5e1;
            text-align: left;
          }

          footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 48px;
            font-size: 11px;
            font-family: 'JetBrains Mono', monospace;
            color: #94a3b8;
          }

          .signature-box {
            border-top: 1px dashed #cbd5e1;
            padding-top: 8px;
            width: 220px;
            text-align: center;
          }

          .signature-box .title {
            color: #475569;
            font-weight: 700;
          }

          .signature-box .sub {
            font-size: 9px;
            color: #94a3b8;
            margin-top: 4px;
          }

          .toolbar {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-bottom: 20px;
            max-width: 1100px;
            margin-left: auto;
            margin-right: auto;
          }

          .btn {
            background-color: #10b981;
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 13px;
            font-weight: 700;
            border-radius: 8px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            transition: all 0.2s;
          }

          .btn:hover {
            background-color: #059669;
          }

          .btn-secondary {
            background-color: white;
            color: #475569;
            border: 1px solid #cbd5e1;
          }

          .btn-secondary:hover {
            background-color: #f8fafc;
            color: #1e293b;
          }

          /* Existing @media print styles configuration block */
          @media print {
            body {
              background: white !important;
              color: black !important;
              padding: 0 !important;
            }
            
            body * {
              visibility: hidden !important;
            }
            
            .printable-receipt,
            .printable-receipt * {
              visibility: visible !important;
            }
            
            .printable-receipt {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 1.5rem !important;
              border: none !important;
              box-shadow: none !important;
            }
            
            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="toolbar no-print">
          <button class="btn btn-secondary" onclick="window.close()">Close Window</button>
          <button class="btn" onclick="window.print()">Print Report</button>
        </div>

        <div class="print-container printable-receipt">
          <div class="header">
            <div class="header-title">
              <h1>RH COMPUTER TECHNOLOGY</h1>
              <p>Active Filtered Inventory Report</p>
            </div>
            <div class="header-meta">
              <div>Report Printed: ${new Date().toLocaleString()}</div>
              <div>Database Source: Secure Cloud Core</div>
              <div>Product Lines: ${currentList.length} items</div>
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-card">
              <span class="summary-label">Calculated Models</span>
              <span class="summary-val">${currentList.length} SKU codes</span>
            </div>
            <div class="summary-card">
              <span class="summary-label">Total Counts (Qty)</span>
              <span class="summary-val">${totalUnits} units</span>
            </div>
            <div class="summary-card">
              <span class="summary-label">Asset Value (Cost RM)</span>
              <span class="summary-val">RM ${totalCostVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div class="summary-card">
              <span class="summary-label">Asset Value (Sale RM)</span>
              <span class="summary-val emerald">RM ${totalSaleVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th style="width: 150px;">Barcode / SKU</th>
                <th>Product Model Description & Specs</th>
                <th style="width: 180px;">Category Group</th>
                <th style="width: 100px; text-align: center;">Storage Loc</th>
                <th style="width: 120px; text-align: right;">Cost (RM)</th>
                <th style="width: 120px; text-align: right;">Retail (RM)</th>
                <th style="width: 120px; text-align: center;">In Stock</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `
                <tr>
                  <td colspan="8" style="padding: 24px; text-align: center; color: #94a3b8; font-style: italic;">
                    No items matched the current active configuration report.
                  </td>
                </tr>
              `}
            </tbody>
          </table>

          <footer>
            <div>
              <p>RH Inventory Report System Validation</p>
              <p style="font-size: 9px; color: #cbd5e1; margin-top: 4px;">ID Reference Log: RH-PRN-${currentList.length}-${Math.floor(Math.random() * 100000)}</p>
            </div>
            <div class="signature-box">
              <div class="title">Authorizing Specialist</div>
              <div class="sub">Signature Initials / Stamp</div>
            </div>
          </footer>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };
  
  // Captured Form Inputs
  const [formName, setFormName] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('Laptops & PCs');
  const [formCostPrice, setFormCostPrice] = useState<number>(0);
  const [formSalePrice, setFormSalePrice] = useState<number>(0);
  const [formQuantity, setFormQuantity] = useState<number>(0);
  const [formMinStock, setFormMinStock] = useState<number>(5);
  const [formMaxStock, setFormMaxStock] = useState<number>(100);
  const [formReorderQty, setFormReorderQty] = useState<number>(10);
  const [formStorageLocation, setFormStorageLocation] = useState<string>('');
  const [formSupplierName, setFormSupplierName] = useState<string>('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [employeeSignature, setEmployeeSignature] = useState('');
  const [errorBox, setErrorBox] = useState('');
  const [isSkuManuallyEdited, setIsSkuManuallyEdited] = useState(false);
  const [formQRCodeDataUrl, setFormQRCodeDataUrl] = useState<string>('');

  // Dynamically generate QR code for the Add/Edit form SKU input
  React.useEffect(() => {
    if (formBarcode.trim()) {
      QRCode.toDataURL(formBarcode.trim(), {
        width: 120,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
      .then(url => {
        setFormQRCodeDataUrl(url);
      })
      .catch(err => {
        console.error("Error generating form SKU QR code:", err);
        setFormQRCodeDataUrl('');
      });
    } else {
      setFormQRCodeDataUrl('');
    }
  }, [formBarcode]);

  // Dynamic automatic draft saving to LocalStorage for Register (Add) Form
  React.useEffect(() => {
    if (isAdding) {
      const draft = {
        name: formName,
        barcode: formBarcode,
        description: formDescription,
        category: formCategory,
        costPrice: formCostPrice,
        salePrice: formSalePrice,
        quantity: formQuantity,
        minStock: formMinStock,
        maxStock: formMaxStock,
        reorderQty: formReorderQty,
        storageLocation: formStorageLocation,
        supplierName: formSupplierName,
        imageUrl: formImageUrl,
        employeeSignature: employeeSignature
      };
      const hasContent = formName || formBarcode || formDescription || formImageUrl || employeeSignature || formCostPrice > 0 || formSalePrice > 0 || formQuantity > 0 || formStorageLocation || formSupplierName;
      if (hasContent) {
        localStorage.setItem('rh_add_product_draft', JSON.stringify(draft));
      } else {
        localStorage.removeItem('rh_add_product_draft');
      }
    }
  }, [isAdding, formName, formBarcode, formDescription, formCategory, formCostPrice, formSalePrice, formQuantity, formMinStock, formMaxStock, formReorderQty, formStorageLocation, formSupplierName, formImageUrl, employeeSignature]);

  // Dynamic automatic draft saving to LocalStorage for Modify (Edit) Form
  React.useEffect(() => {
    if (editingItem) {
      const draft = {
        editingItemId: editingItem.id,
        name: formName,
        barcode: formBarcode,
        description: formDescription,
        category: formCategory,
        costPrice: formCostPrice,
        salePrice: formSalePrice,
        quantity: formQuantity,
        minStock: formMinStock,
        maxStock: formMaxStock,
        reorderQty: formReorderQty,
        storageLocation: formStorageLocation,
        supplierName: formSupplierName,
        imageUrl: formImageUrl,
        employeeSignature: employeeSignature
      };
      localStorage.setItem('rh_edit_product_draft', JSON.stringify(draft));
    }
  }, [editingItem, formName, formBarcode, formDescription, formCategory, formCostPrice, formSalePrice, formQuantity, formMinStock, formMaxStock, formReorderQty, formStorageLocation, formSupplierName, formImageUrl, employeeSignature]);

  // Default Preset Categories for Computer Tech Retail
  const categories = ['All', 'Laptops & PCs', 'Networking Devices', 'Computer Components', 'Monitors & Visuals', 'Power Backups', 'Printers & Cartridges', 'Accessories'];

  // SKU / Barcode Auto-generation Engine
  const getCategoryCode = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes('laptop') || lower.includes('pc')) return 'LAP';
    if (lower.includes('network')) return 'NET';
    if (lower.includes('component')) return 'CMP';
    if (lower.includes('monitor') || lower.includes('visual')) return 'MON';
    if (lower.includes('power') || lower.includes('backup')) return 'PWR';
    if (lower.includes('printer') || lower.includes('cartridge')) return 'PRN';
    if (lower.includes('access')) return 'ACC';
    return cat.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'GEN';
  };

  const generateUniqueSku = (name: string, category: string) => {
    if (!name || !name.trim()) return '';
    const catCode = getCategoryCode(category);
    // Extract first 6 letters/digits of the name
    const cleanName = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const namePart = cleanName.slice(0, 6) || 'PROD';
    
    let counter = 1001;
    let sku = `${catCode}-${namePart}-${counter}`;
    
    // Check uniqueness across existing products
    while (products.some(p => p.barcode?.toUpperCase() === sku.toUpperCase())) {
      counter++;
      sku = `${catCode}-${namePart}-${counter}`;
    }
    return sku;
  };

  // Automatically generate unique SKU when product name or category is updated (when adding)
  React.useEffect(() => {
    if (isAdding && !isSkuManuallyEdited && formName.trim()) {
      const suggested = generateUniqueSku(formName, formCategory);
      setFormBarcode(suggested);
    }
  }, [formName, formCategory, isAdding, isSkuManuallyEdited, products]);

  // Export Inventory Catalog to CSV Handler
  const handleExportCSV = () => {
    const headers = ['SKU/Barcode', 'Product Name', 'Category', 'Description', 'Cost Price (RM)', 'Retail Price (RM)', 'Stock Level', 'Min Threshold Limit', 'Max Capacity Threshold', 'Reorder Quantity', 'Storage Location', 'Supplier Name', 'Updated By', 'Updated At'];
    
    const csvContentRows = [headers.join(',')];
    
    products.forEach(p => {
      const row = [
        p.barcode,
        p.name,
        p.category,
        p.description || '',
        p.costPrice.toFixed(2),
        p.salePrice.toFixed(2),
        p.quantity.toString(),
        p.minStockThreshold.toString(),
        (p.maxStockThreshold || 100).toString(),
        (p.reorderQuantity || 10).toString(),
        p.storageLocation || '',
        p.supplierName || '',
        p.updatedBy || 'System Init',
        p.updatedAt || ''
      ].map(val => {
        // Double quotes are escaped with double quotes
        const escaped = val.replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvContentRows.push(row.join(','));
    });
    
    const blob = new Blob([csvContentRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory_catalog_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCancelAdd = () => {
    localStorage.removeItem('rh_add_product_draft');
    setFormName('');
    setFormBarcode('');
    setFormDescription('');
    setFormCategory('Laptops & PCs');
    setFormCostPrice(0);
    setFormSalePrice(0);
    setFormQuantity(0);
    setFormMinStock(5);
    setFormMaxStock(100);
    setFormReorderQty(10);
    setFormStorageLocation('');
    setFormSupplierName('');
    setFormImageUrl('');
    setEmployeeSignature('');
    setIsAdding(false);
    setErrorBox('');
    setIsSkuManuallyEdited(false);
  };

  const handleCancelEdit = () => {
    localStorage.removeItem('rh_edit_product_draft');
    setFormName('');
    setFormBarcode('');
    setFormDescription('');
    setFormCategory('Laptops & PCs');
    setFormCostPrice(0);
    setFormSalePrice(0);
    setFormQuantity(0);
    setFormMinStock(5);
    setFormMaxStock(100);
    setFormReorderQty(10);
    setFormStorageLocation('');
    setFormSupplierName('');
    setFormImageUrl('');
    setEmployeeSignature('');
    setEditingItem(null);
    setErrorBox('');
    setIsSkuManuallyEdited(false);
  };

  // 1. Handlers
  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeSignature.trim()) {
      setErrorBox('Authorized Employee Name is required to save inventory modifications.');
      return;
    }
    if (formCostPrice < 0 || formSalePrice < 0 || formQuantity < 0 || formMinStock < 0 || formMaxStock < 0 || formReorderQty < 0) {
      setErrorBox('Prices, starting stock levels, reorder quantities, and limits cannot be negative values.');
      return;
    }
    if (!formName.trim() || !formBarcode.trim()) {
      setErrorBox('Item Name and SKU/Barcode are mandatory fields.');
      return;
    }

    onAddProduct({
      name: formName,
      barcode: formBarcode,
      description: formDescription,
      category: formCategory,
      costPrice: formCostPrice,
      salePrice: formSalePrice,
      quantity: formQuantity,
      minStockThreshold: formMinStock,
      maxStockThreshold: formMaxStock,
      reorderQuantity: formReorderQty,
      storageLocation: formStorageLocation || undefined,
      supplierName: formSupplierName || undefined,
      updatedBy: employeeSignature,
      imageUrl: formImageUrl
    }, employeeSignature);

    // Clear Draft and Reset Forms
    localStorage.removeItem('rh_add_product_draft');
    setFormName('');
    setFormBarcode('');
    setFormDescription('');
    setFormCategory('Laptops & PCs');
    setFormCostPrice(0);
    setFormSalePrice(0);
    setFormQuantity(0);
    setFormMinStock(5);
    setFormMaxStock(100);
    setFormReorderQty(10);
    setFormStorageLocation('');
    setFormSupplierName('');
    setFormImageUrl('');
    setEmployeeSignature('');
    setIsAdding(false);
    setErrorBox('');
    setIsSkuManuallyEdited(false);
  };

  const handleEditItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!employeeSignature.trim()) {
      setErrorBox('Employee signature is required to update database data.');
      return;
    }
    if (formCostPrice < 0 || formSalePrice < 0 || formQuantity < 0 || formMinStock < 0 || formMaxStock < 0 || formReorderQty < 0) {
      setErrorBox('Prices, stock levels, reorder quantities, and limits cannot be negative values.');
      return;
    }

    onUpdateProduct(editingItem.id, {
      name: formName,
      barcode: formBarcode,
      description: formDescription,
      category: formCategory,
      costPrice: formCostPrice,
      salePrice: formSalePrice,
      quantity: formQuantity,
      minStockThreshold: formMinStock,
      maxStockThreshold: formMaxStock,
      reorderQuantity: formReorderQty,
      storageLocation: formStorageLocation || undefined,
      supplierName: formSupplierName || undefined,
      updatedBy: employeeSignature,
      imageUrl: formImageUrl
    }, employeeSignature);

    // Clear Draft and Clean states
    localStorage.removeItem('rh_edit_product_draft');
    setEditingItem(null);
    setFormImageUrl('');
    setFormName('');
    setFormBarcode('');
    setFormDescription('');
    setFormCategory('Laptops & PCs');
    setFormCostPrice(0);
    setFormSalePrice(0);
    setFormQuantity(0);
    setFormMinStock(5);
    setFormMaxStock(100);
    setFormReorderQty(10);
    setFormStorageLocation('');
    setFormSupplierName('');
    setEmployeeSignature('');
    setErrorBox('');
  };

  const openEditModal = (item: Product) => {
    const saved = localStorage.getItem('rh_edit_product_draft');
    let loadedFromDraft = false;
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (draft.editingItemId === item.id) {
          setEditingItem(item);
          setFormName(draft.name || '');
          setFormBarcode(draft.barcode || '');
          setFormDescription(draft.description || '');
          setFormCategory(draft.category || 'Laptops & PCs');
          setFormCostPrice(draft.costPrice || 0);
          setFormSalePrice(draft.salePrice || 0);
          setFormQuantity(draft.quantity || 0);
          setFormMinStock(draft.minStock || 5);
          setFormMaxStock(draft.maxStock || 100);
          setFormReorderQty(draft.reorderQty || 10);
          setFormStorageLocation(draft.storageLocation || '');
          setFormSupplierName(draft.supplierName || '');
          setFormImageUrl(draft.imageUrl || '');
          setEmployeeSignature(draft.employeeSignature || '');
          setErrorBox('');
          loadedFromDraft = true;
        }
      } catch (e) {
        console.error("Error reading edit product draft", e);
      }
    }

    if (!loadedFromDraft) {
      setEditingItem(item);
      setFormName(item.name);
      setFormBarcode(item.barcode);
      setFormDescription(item.description);
      setFormCategory(item.category);
      setFormCostPrice(item.costPrice);
      setFormSalePrice(item.salePrice);
      setFormQuantity(item.quantity);
      setFormMinStock(item.minStockThreshold);
      setFormMaxStock(item.maxStockThreshold || 100);
      setFormReorderQty(item.reorderQuantity || 10);
      setFormStorageLocation(item.storageLocation || '');
      setFormSupplierName(item.supplierName || '');
      setFormImageUrl(item.imageUrl || '');
      setEmployeeSignature('');
      setErrorBox('');
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (filteredList: Product[]) => {
    const filteredIds = filteredList.map(p => p.id);
    const allFilteredAreSelected = filteredIds.length > 0 && filteredIds.every(id => selectedProductIds.includes(id));

    if (allFilteredAreSelected) {
      // Remove all filtered from selection
      setSelectedProductIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Add all filtered that aren't already selected
      setSelectedProductIds(prev => {
        const newlySelected = filteredIds.filter(id => !prev.includes(id));
        return [...prev, ...newlySelected];
      });
    }
  };

  const handleBulkAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkEmployeeSignature.trim()) {
      setBulkError('Authorized Employee Name is required to save inventory modifications.');
      return;
    }

    if (bulkAdjType === 'quantity') {
      if (bulkQtyValue < 0) {
        setBulkError('Adjustment value cannot be negative.');
        return;
      }
    } else {
      if (bulkPriceValue < 0) {
        setBulkError('Adjustment value cannot be negative.');
        return;
      }
    }

    // Build updates array
    const updates: { id: string; fields: Partial<Product> }[] = [];

    for (const id of selectedProductIds) {
      const prod = products.find(p => p.id === id);
      if (!prod) continue;

      const fields: Partial<Product> = {};

      if (bulkAdjType === 'quantity') {
        let nextQty = prod.quantity;
        if (bulkQtyOperator === 'add') {
          nextQty = prod.quantity + bulkQtyValue;
        } else if (bulkQtyOperator === 'subtract') {
          nextQty = Math.max(0, prod.quantity - bulkQtyValue);
        } else if (bulkQtyOperator === 'set') {
          nextQty = bulkQtyValue;
        }
        fields.quantity = nextQty;
      } else {
        const currentPrice = bulkPriceTarget === 'cost' ? prod.costPrice : prod.salePrice;
        let nextPrice = currentPrice;

        if (bulkPriceOperator === 'add_flat') {
          nextPrice = currentPrice + bulkPriceValue;
        } else if (bulkPriceOperator === 'subtract_flat') {
          nextPrice = Math.max(0, currentPrice - bulkPriceValue);
        } else if (bulkPriceOperator === 'add_percent') {
          nextPrice = currentPrice * (1 + bulkPriceValue / 100);
        } else if (bulkPriceOperator === 'subtract_percent') {
          nextPrice = Math.max(0, currentPrice * (1 - bulkPriceValue / 100));
        } else if (bulkPriceOperator === 'set') {
          nextPrice = bulkPriceValue;
        }

        if (bulkPriceTarget === 'cost') {
          fields.costPrice = nextPrice;
        } else {
          fields.salePrice = nextPrice;
        }
      }

      updates.push({ id, fields });
    }

    if (onBulkUpdateProducts) {
      onBulkUpdateProducts(updates, bulkEmployeeSignature.trim());
    } else {
      updates.forEach(upd => {
        onUpdateProduct(upd.id, upd.fields, bulkEmployeeSignature.trim());
      });
    }

    // Reset states
    setSelectedProductIds([]);
    setIsBulkAdjusting(false);
    setBulkEmployeeSignature('');
    setBulkQtyValue(0);
    setBulkPriceValue(0);
    setBulkError('');
  };

  // Filter products sequentially
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    
    let matchesAlert = true;
    if (alertFilter === 'LowStock') {
      matchesAlert = p.quantity <= p.minStockThreshold;
    } else if (alertFilter === 'OutOfStock') {
      matchesAlert = p.quantity <= 0;
    }

    return matchesSearch && matchesCategory && matchesAlert;
  }).sort((a, b) => {
    if (!sortField) return 0;
    
    let comp = 0;
    if (sortField === 'name') {
      comp = a.name.localeCompare(b.name);
    } else if (sortField === 'quantity') {
      comp = (a.quantity || 0) - (b.quantity || 0);
    } else if (sortField === 'costPrice') {
      comp = (a.costPrice || 0) - (b.costPrice || 0);
    } else if (sortField === 'salePrice') {
      comp = (a.salePrice || 0) - (b.salePrice || 0);
    }
    
    return sortDirection === 'asc' ? comp : -comp;
  });

  const toggleSort = (field: 'name' | 'quantity' | 'costPrice' | 'salePrice') => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-6" id="inventory-view-flow">
      {/* Catalog Title + Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-left">
          <h2 className="text-xl font-bold text-slate-800">Master Product Catalog</h2>
          <p className="text-sm text-slate-400">Total counted lines: {products.length} computer components & notebooks</p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Download CSV Action button */}
          <button 
            type="button"
            onClick={handleExportCSV}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-3xs cursor-pointer"
            id="btn-export-catalog-csv"
            title="Export full catalog list as CSV backup"
          >
            <Download size={14} className="text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Print Catalog Report Button */}
          <button 
            type="button"
            onClick={() => setIsPrintingInventory(true)}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-3xs cursor-pointer"
            id="btn-print-catalog-pdf"
            title="Update the Inventory Catalog to add a Print Inventory List button that generates a date-stamped, printer-friendly summary table of the current inventory quantities"
          >
            <Printer size={14} className="text-slate-500" />
            <span>Print Inventory List</span>
          </button>

          {/* Print Inventory (New Window/Tab) Button */}
          <button 
            type="button"
            onClick={handlePrintInventoryWindow}
            className="border border-emerald-250 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-3xs cursor-pointer"
            id="btn-print-inventory-new-window"
            title="Open a clean, printer-friendly list view of current products in a new window/tab"
          >
            <ExternalLink size={14} className="text-emerald-600" />
            <span>Print Inventory</span>
          </button>

          <button 
            onClick={() => {
              const saved = localStorage.getItem('rh_add_product_draft');
              if (saved) {
                try {
                  const draft = JSON.parse(saved);
                  setFormName(draft.name || '');
                  setFormBarcode(draft.barcode || '');
                  setFormDescription(draft.description || '');
                  setFormCategory(draft.category || 'Laptops & PCs');
                  setFormCostPrice(draft.costPrice || 0);
                  setFormSalePrice(draft.salePrice || 0);
                  setFormQuantity(draft.quantity || 0);
                  setFormMinStock(draft.minStock || 5);
                  setFormMaxStock(draft.maxStock || 100);
                  setFormReorderQty(draft.reorderQty || 10);
                  setFormStorageLocation(draft.storageLocation || '');
                  setFormSupplierName(draft.supplierName || '');
                  setFormImageUrl(draft.imageUrl || '');
                  setEmployeeSignature(draft.employeeSignature || '');
                  setIsSkuManuallyEdited(!!draft.barcode);
                } catch (e) {
                  console.error("Error reading add product draft", e);
                  setIsSkuManuallyEdited(false);
                }
              } else {
                setFormName('');
                setFormBarcode('');
                setFormDescription('');
                setFormCategory('Laptops & PCs');
                setFormCostPrice(0);
                setFormSalePrice(0);
                setFormQuantity(0);
                setFormMinStock(5);
                setFormMaxStock(100);
                setFormReorderQty(10);
                setFormStorageLocation('');
                setFormSupplierName('');
                setFormImageUrl('');
                setEmployeeSignature('');
                setIsSkuManuallyEdited(false);
              }
              setIsAdding(true);
              setErrorBox('');
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-xs shadow-emerald-600/10"
          >
            <Plus size={16} />
            Register New Product
          </button>
        </div>
      </div>

      {/* Query Filter panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4" id="inventory-search-filter-panel">
        {/* Persistent Real-time Search Input Bar */}
        <div>
          <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1.5 select-none">
            <Search size={12} className="text-emerald-600" />
            Quickly Search Catalog (Name, Specifications, or Barcode/SKU)
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-3.5 text-slate-400 animate-pulse" size={18} />
            <input 
              type="text" 
              placeholder="Search by laptop name, part specs, or scan/enter barcode SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-slate-200 pl-12 pr-12 py-3 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all placeholder-slate-400 bg-slate-50/20"
              autoFocus
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-3.5 text-rose-500 hover:text-rose-700 transition-colors p-0.5 rounded-full hover:bg-rose-50 cursor-pointer"
                title="Clear search query"
              >
                <X size={16} />
              </button>
            ) : (
              <span className="absolute right-4 top-4 text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-wider hidden sm:inline-block select-none bg-emerald-50/50 px-2 py-0.5 rounded-md border border-emerald-100/50">
                Type or Scan
              </span>
            )}
          </div>
        </div>

        {/* Secondary Category and Quick Alert Filter controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white cursor-pointer"
            >
              {categories.map((cat, i) => (
                <option value={cat} key={i}>Category Group: {cat}</option>
              ))}
            </select>
          </div>

          {/* Quick Alert Filter switches */}
          <div className="sm:w-64 flex gap-1 bg-slate-50 p-1 rounded-xl border border-slate-250">
            {(['All', 'LowStock', 'OutOfStock'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAlertFilter(mode)}
                className={`flex-1 text-[10px] uppercase tracking-wider font-extrabold py-1.5 rounded-lg transition-all ${
                  alertFilter === mode 
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200' 
                    : 'text-slate-450 hover:text-slate-700'
                }`}
              >
                {mode === 'All' ? 'All' : mode === 'LowStock' ? 'Low Stock' : 'Out'}
              </button>
            ))}
          </div>

          <div className="shrink-0 text-right px-1">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest bg-slate-100 p-2 px-3 rounded-lg border border-slate-200">
              {filteredProducts.length} of {products.length} Items Shown
            </span>
          </div>
        </div>
      </div>

      {/* Bulk Actions Banner */}
      {selectedProductIds.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-250 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm shadow-emerald-600/5" id="bulk-actions-banner">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-150 rounded-xl flex items-center justify-center border border-emerald-200 text-emerald-800">
              <CheckSquare size={18} />
            </div>
            <div className="text-left">
              <h4 className="font-bold text-xs text-emerald-950 uppercase tracking-wider">Bulk Operations Console</h4>
              <p className="text-[11px] text-emerald-800 font-medium font-sans">You have selected <span className="font-bold font-mono text-xs">{selectedProductIds.length}</span> {selectedProductIds.length === 1 ? 'product' : 'products'} for batch modification.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setIsBulkAdjusting(true);
                setBulkEmployeeSignature('');
                setBulkQtyValue(0);
                setBulkPriceValue(0);
                setBulkError('');
              }}
              className="flex-1 sm:flex-none justify-center bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 uppercase tracking-wider shadow-emerald-600/10"
              id="btn-open-bulk-adjust"
            >
              <Sliders size={13} />
              Apply Bulk Adjust
            </button>
            <button
              onClick={() => setSelectedProductIds([])}
              className="flex-1 sm:flex-none justify-center text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 text-[11px] font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer uppercase tracking-wider"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Product Grid Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider font-bold border-b border-slate-200 divide-y divide-slate-150">
              <tr>
                <th className="p-4 w-12 text-center rounded-tl-xl select-none">
                  <input 
                    type="checkbox" 
                    onChange={() => toggleSelectAll(filteredProducts)}
                    checked={filteredProducts.length > 0 && filteredProducts.every(p => selectedProductIds.includes(p.id))}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    title="Toggle select all filtered products"
                  />
                </th>
                <th className="p-4">Barcode / SKU</th>
                <th 
                  className="p-4 hover:bg-slate-100/80 cursor-pointer select-none transition-colors group"
                  onClick={() => toggleSort('name')}
                  title="Click to sort by product name"
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>Item Details</span>
                    {sortField === 'name' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} className="text-emerald-600 font-bold shrink-0 animate-bounce" /> : <ArrowDown size={12} className="text-emerald-600 font-bold shrink-0 animate-bounce" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-350 shrink-0 group-hover:text-slate-500 transition-colors" />
                    )}
                  </div>
                </th>
                <th className="p-4">Category</th>
                <th 
                  className="p-4 hover:bg-slate-100/80 cursor-pointer select-none transition-colors group text-right"
                  onClick={() => toggleSort('costPrice')}
                  title="Click to sort by cost price"
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>Cost Price</span>
                    {sortField === 'costPrice' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} className="text-emerald-600 font-bold shrink-0" /> : <ArrowDown size={12} className="text-emerald-600 font-bold shrink-0" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-350 shrink-0 group-hover:text-slate-500 transition-colors" />
                    )}
                  </div>
                </th>
                <th 
                  className="p-4 hover:bg-slate-100/80 cursor-pointer select-none transition-colors group text-right"
                  onClick={() => toggleSort('salePrice')}
                  title="Click to sort by retail sale price"
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>Sale Price</span>
                    {sortField === 'salePrice' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} className="text-emerald-600 font-bold shrink-0" /> : <ArrowDown size={12} className="text-emerald-600 font-bold shrink-0" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-350 shrink-0 group-hover:text-slate-500 transition-colors" />
                    )}
                  </div>
                </th>
                <th 
                  className="p-4 hover:bg-slate-100/80 cursor-pointer select-none transition-colors group text-center"
                  onClick={() => toggleSort('quantity')}
                  title="Click to sort by stock quantity"
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    <span>Stock Level</span>
                    {sortField === 'quantity' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} className="text-emerald-600 font-bold shrink-0" /> : <ArrowDown size={12} className="text-emerald-600 font-bold shrink-0" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-350 shrink-0 group-hover:text-slate-500 transition-colors" />
                    )}
                  </div>
                </th>
                <th className="p-4 font-bold select-none">Latest Log By</th>
                <th className="p-4 rounded-tr-xl text-center">Options</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 font-sans">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-mono">
                    No components found matching your custom filter queries.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOutOfStock = p.quantity <= 0;
                  const isLowStock = p.quantity <= p.minStockThreshold;
                  
                  return (
                    <tr key={p.id} className="hover:bg-slate-55/40 transition-colors" id={`row-${p.id}`}>
                      {/* Checkbox column */}
                      <td className="p-3 w-12 text-center select-none">
                        <input 
                          type="checkbox" 
                          onChange={() => toggleSelectItem(p.id)}
                          checked={selectedProductIds.includes(p.id)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                      {/* Barcode Accent */}
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                          {p.barcode}
                        </span>
                      </td>

                      {/* Main Spec Description */}
                      <td className="p-4 max-w-[240px]">
                        <div className="flex items-center gap-2.5">
                          <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shadow-3xs">
                            {p.imageUrl ? (
                              <img 
                                src={p.imageUrl} 
                                alt="" 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <ImageIcon className="text-slate-300" size={16} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-800 text-sm truncate" title={p.name}>{p.name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 mb-1.5" title={p.description}>{p.description || 'No extended specs listed.'}</div>
                            
                            {/* Physical stock tracking tags */}
                            {(p.storageLocation || p.supplierName || p.reorderQuantity) && (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {p.storageLocation && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 border border-slate-200/65 text-slate-500 mr-0.5">
                                    <span className="text-[8px] text-emerald-500">📍</span> {p.storageLocation}
                                  </span>
                                )}
                                {p.supplierName && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 border border-slate-200/65 text-slate-500 mr-0.5" title={`Registered supplier link: ${p.supplierName}`}>
                                    <span className="text-[8px] text-emerald-500 font-semibold font-sans">🏢</span> {p.supplierName}
                                  </span>
                                )}
                                {p.reorderQuantity && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50/60 border border-emerald-100/60 text-emerald-600" title={`Standard replenish unit size: ${p.reorderQuantity}`}>
                                    📦 Restock Size: {p.reorderQuantity}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Categories Badge */}
                      <td className="p-4 whitespace-nowrap">
                        <span className="bg-slate-100/60 text-slate-500 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                          {p.category}
                        </span>
                      </td>

                      {/* RM Prices */}
                      <td className="p-4 text-right font-mono text-slate-500 whitespace-nowrap">
                        RM {p.costPrice.toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-mono text-slate-850 font-semibold whitespace-nowrap">
                        RM {p.salePrice.toFixed(2)}
                      </td>

                      {/* Stock Level Slider Badges */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1.5 justify-center">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              isOutOfStock 
                                ? 'bg-rose-101 text-rose-700 font-extrabold animate-pulse' 
                                : isLowStock 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {isOutOfStock ? 'OUT OF STOCK' : `${p.quantity} Units`}
                            </span>
                            {renderTrendSelector(p)}
                          </div>
                          <span className="text-[9px] text-slate-400 font-mono">Min threshold: {p.minStockThreshold}</span>

                          {/* Space Utilization Gauge */}
                          {p.maxStockThreshold && p.maxStockThreshold > 0 ? (
                            <div className="flex flex-col items-center mt-1">
                              <div 
                                className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden transition-all border border-slate-200/40" 
                                title={`Capacity utilisation: ${p.quantity} / ${p.maxStockThreshold} max units`}
                              >
                                <div 
                                  className={`h-full rounded-full transition-all ${
                                    p.quantity > p.maxStockThreshold 
                                      ? 'bg-amber-500 animate-[pulse_2s_infinite]' 
                                      : (p.quantity / p.maxStockThreshold) > 0.8 
                                        ? 'bg-teal-500' 
                                        : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, (p.quantity / p.maxStockThreshold) * 100)}%` }}
                                />
                              </div>
                              <span className="text-[8.5px] font-mono text-slate-400 mt-0.5">
                                {p.quantity > p.maxStockThreshold ? (
                                  <span className="text-amber-600 font-black">OVERSTOCKED</span>
                                ) : (
                                  <span>Cap: {Math.round((p.quantity / p.maxStockThreshold) * 100)}% used</span>
                                )}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </td>

                      {/* Latest Edit Log By details */}
                      <td className="p-4 whitespace-nowrap text-slate-500">
                        <div className="flex items-center gap-1.5 font-medium">
                          <User size={12} className="text-slate-400" />
                          <span className="text-slate-700">{p.updatedBy || 'System Init'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-mono font-semibold">
                          {new Date(p.updatedAt).toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' })}
                          <span className="text-slate-400 font-normal ml-1">
                            {new Date(p.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* Settings Buttons */}
                      <td className="relative p-4 whitespace-nowrap text-center">
                        {quickAdjustProductId === p.id && quickAdjustType ? (
                          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 shadow-xs p-1 rounded-lg text-left inline-flex">
                            <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded-md ${
                              quickAdjustType === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {quickAdjustType === 'in' ? 'In' : 'Out'}
                            </span>
                            
                            <div className="flex items-center gap-0.5">
                              <button 
                                type="button"
                                onClick={() => setQuickAdjustQty(prev => Math.max(1, prev - 1))}
                                className="w-5 h-5 bg-white border border-slate-200 text-slate-500 rounded-md flex items-center justify-center hover:bg-slate-100 font-extrabold cursor-pointer text-[10px]"
                              >
                                -
                              </button>
                              <input 
                                type="number"
                                min="1"
                                value={quickAdjustQty}
                                onChange={(e) => setQuickAdjustQty(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-10 h-5 text-center font-mono font-bold text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button 
                                type="button"
                                onClick={() => setQuickAdjustQty(prev => prev + 1)}
                                className="w-5 h-5 bg-white border border-slate-200 text-slate-500 rounded-md flex items-center justify-center hover:bg-slate-100 font-extrabold cursor-pointer text-[10px]"
                              >
                                +
                              </button>
                            </div>

                            <input 
                              type="text"
                              placeholder="Signature *"
                              value={quickAdjustEmployee}
                              onChange={(e) => {
                                setQuickAdjustEmployee(e.target.value);
                                localStorage.setItem('rh_quick_adjust_employee', e.target.value);
                              }}
                              className="w-24 h-5 text-[9.5px] font-sans font-bold bg-white text-slate-800 border border-slate-200 rounded-md px-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-350"
                              required
                            />

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleSaveQuickAdjust(p)}
                                className="h-5 px-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-md text-white font-extrabold text-[9.5px] cursor-pointer flex items-center gap-0.5 transition-colors"
                              >
                                <Check size={11} className="stroke-[3px]" />
                                <span className="uppercase text-[9px]">Ok</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelQuickAdjust}
                                className="h-5 w-5 bg-white border border-slate-200 rounded-md text-slate-500 hover:text-slate-800 cursor-pointer flex items-center justify-center transition-colors"
                              >
                                <X size={11} className="stroke-[3px]" />
                              </button>
                            </div>

                            {/* Tooltip Error */}
                            {quickAdjustError && (
                              <div className="absolute right-4 top-full mt-1 bg-rose-50 border border-rose-250 text-[10px] text-rose-700 font-bold p-2 px-3 rounded-lg z-50 shadow-md max-w-[200px] whitespace-normal">
                                ⚠️ {quickAdjustError}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setQuickAdjustProductId(p.id);
                                setQuickAdjustType('in');
                                setQuickAdjustQty(1);
                                setQuickAdjustError('');
                              }}
                              className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 p-1.5 rounded-lg transition-colors border border-emerald-150/40"
                              title="Quick Stock In (+)"
                            >
                              <Plus size={13} className="stroke-[2.5px]" />
                            </button>
                            <button
                              onClick={() => {
                                setQuickAdjustProductId(p.id);
                                setQuickAdjustType('out');
                                setQuickAdjustQty(1);
                                setQuickAdjustError('');
                              }}
                              className="bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-800 p-1.5 rounded-lg transition-colors border border-rose-150/40"
                              title="Quick Stock Out (-)"
                            >
                              <Minus size={13} className="stroke-[2.5px]" />
                            </button>
                            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0" />
                            <button
                              onClick={() => setBarcodeStickerItem(p)}
                              className="bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-850 p-1.5 rounded-lg transition-colors border border-slate-200/60"
                              title="Generate printed SKU sticker"
                              id={`btn-barcode-${p.id}`}
                            >
                              <Barcode size={13} />
                            </button>
                            <button
                              onClick={() => openEditModal(p)}
                              className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 p-1.5 rounded-lg transition-colors border border-emerald-150/50"
                              title="Edit details"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => {
                                setDeletingItem(p);
                                setDeleteSignature('');
                                setDeleteError('');
                              }}
                              className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-1.5 rounded-lg transition-colors border border-rose-150/50"
                              title="De-register Product"
                              id={`btn-delete-${p.id}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Register Modal Dialog */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <Package className="text-emerald-600" />
                Register New Inventory Item
              </h3>
              <button onClick={handleCancelAdd} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Browser Auto-saved Draft Restoration Notification Alert Banner */}
            {localStorage.getItem('rh_add_product_draft') && (
              <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-2.5 mb-4 text-[11px] text-emerald-800 flex items-center justify-between font-sans">
                <span className="font-semibold flex items-center gap-1.5 leading-normal">
                  <Sparkles size={12} className="text-emerald-600 shrink-0 animate-pulse" />
                  Restored mid-entry draft automatically from your browser cache.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('rh_add_product_draft');
                    setFormName('');
                    setFormBarcode('');
                    setFormDescription('');
                    setFormCategory('Laptops & PCs');
                    setFormCostPrice(0);
                    setFormSalePrice(0);
                    setFormQuantity(0);
                    setFormMinStock(5);
                    setFormImageUrl('');
                    setEmployeeSignature('');
                    setIsSkuManuallyEdited(false);
                  }}
                  className="text-emerald-600 hover:text-emerald-900 font-extrabold underline cursor-pointer shrink-0 ml-2"
                >
                  Clear Draft
                </button>
              </div>
            )}

            <form onSubmit={handleAddNewItem} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">
                    Product Brand & Name / Specs *
                  </label>
                  <input 
                    type="text" 
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="E.g., HP ProBook 450 G10 i7 16GB"
                    className="w-full border border-slate-200 p-2.5 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider">
                      SKU / Barcode Scan Code *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const suggested = generateUniqueSku(formName, formCategory);
                        if (suggested) {
                          setFormBarcode(suggested);
                          setIsSkuManuallyEdited(true);
                        }
                      }}
                      disabled={!formName.trim()}
                      className={`text-[9px] font-black px-2 py-0.5 rounded-md border transition-all uppercase tracking-wider ${
                        formName.trim()
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50 hover:bg-emerald-100 cursor-pointer'
                          : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'
                      }`}
                      title={formName.trim() ? "Suggest unique standardized SKU barcode" : "Please fill in Product Name first"}
                    >
                      ✨ Suggest SKU
                    </button>
                  </div>
                  <div className="flex gap-3 items-center">
                    <div className="flex-1">
                      <input 
                        type="text" 
                        value={formBarcode}
                        onChange={(e) => {
                          setFormBarcode(e.target.value);
                          setIsSkuManuallyEdited(true);
                        }}
                        placeholder="E.g., 690250002131"
                        className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                        required
                      />
                    </div>
                    {formQRCodeDataUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const tempProduct: Product = {
                            id: 'temp-print',
                            name: formName || 'Asset Label Preview',
                            barcode: formBarcode,
                            description: formDescription || '',
                            category: formCategory,
                            costPrice: formCostPrice || 0,
                            salePrice: formSalePrice || 0,
                            quantity: formQuantity || 0,
                            minStockThreshold: formMinStock || 5,
                            maxStockThreshold: formMaxStock || 100,
                            reorderQuantity: formReorderQty || 10,
                            storageLocation: formStorageLocation || '',
                            supplierName: formSupplierName || '',
                            updatedAt: new Date().toISOString(),
                            updatedBy: employeeSignature || 'System staff',
                            imageUrl: formImageUrl || ''
                          };
                          setBarcodeStickerItem(tempProduct);
                        }}
                        className="border border-slate-200 hover:border-emerald-300 rounded-xl p-1.5 bg-white flex flex-col items-center justify-center shadow-3xs shrink-0 cursor-pointer transition-all hover:shadow-2xs group relative"
                        title="Click to preview & print instant high-quality custom SKU label sticker"
                      >
                        <img 
                          src={formQRCodeDataUrl} 
                          alt="SKU QR Code" 
                          className="w-8 h-8 object-contain" 
                          referrerPolicy="no-referrer" 
                        />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 hidden group-hover:flex items-center gap-1 bg-slate-900 text-white text-[9px] font-bold px-2 py-1 rounded-md shadow-lg whitespace-nowrap z-50">
                          <Printer size={10} className="text-emerald-400" />
                          Print Label Sticker
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">
                    Category Group *
                  </label>
                  <select 
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full border border-slate-200 p-2.5 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
                  >
                    {categories.filter(c => c !== 'All').map((cat, idx) => (
                      <option value={cat} key={idx}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">
                    Spec Specifications Description
                  </label>
                  <textarea 
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Provide ports details, motherboard speeds, hardware configurations..."
                    rows={2}
                    className="w-full border border-slate-200 p-2.5 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <ProductPhotoCapture imageUrl={formImageUrl} onChange={setFormImageUrl} label="Capture Product Photo / SKU Image" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">
                    Cost Price (RM) *
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">
                    Customer Retail Price (RM) *
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formSalePrice}
                    onChange={(e) => setFormSalePrice(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">
                    Initial Stock Level *
                  </label>
                  <input 
                    type="number" 
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(parseInt(e.target.value) || 0)}
                    className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">
                    Low Stock Alert Threshold *
                  </label>
                  <input 
                    type="number" 
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(parseInt(e.target.value) || 0)}
                    className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                {/* Supplemental Advanced Stock Tracking Options */}
                <div className="sm:col-span-2 border-t border-slate-100 pt-3">
                  <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">
                    Supplemental Stock Tracking Options
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Max Capacity Threshold (Overstock Limit)
                      </label>
                      <input 
                        type="number" 
                        value={formMaxStock}
                        onChange={(e) => setFormMaxStock(parseInt(e.target.value) || 0)}
                        placeholder="E.g., 100"
                        className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Suggested Replenish Reorder Size
                      </label>
                      <input 
                        type="number" 
                        value={formReorderQty}
                        onChange={(e) => setFormReorderQty(parseInt(e.target.value) || 0)}
                        placeholder="E.g., 10"
                        className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Warehouse Storage Slot (Location)
                      </label>
                      <input 
                        type="text" 
                        value={formStorageLocation}
                        onChange={(e) => setFormStorageLocation(e.target.value)}
                        placeholder="E.g., Aisle 4, Shelf B"
                        className="w-full border border-slate-200 p-2.5 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Primary Supplier / Vendor Partner
                      </label>
                      <input 
                        type="text" 
                        value={formSupplierName}
                        onChange={(e) => setFormSupplierName(e.target.value)}
                        placeholder="E.g., HP Distribution Asia"
                        className="w-full border border-slate-200 p-2.5 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2 border-t border-slate-100 pt-3">
                  <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
                    Authorized Employee Name / Signature *
                  </label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-3.5 text-emerald-500" />
                    <input 
                      type="text" 
                      value={employeeSignature}
                      onChange={(e) => setEmployeeSignature(e.target.value)}
                      placeholder="Input name of employee logging this addition"
                      className="w-full border border-emerald-250 pl-9 pr-4 p-2.5 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 bg-emerald-50/10 placeholder-emerald-400/80"
                      required
                    />
                  </div>
                </div>
              </div>

              {errorBox && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
                  {errorBox}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={handleCancelAdd}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1 cursor-pointer shadow-xs shadow-emerald-600/10"
                >
                  <FileCheck size={14} />
                  Authorize & Save Product
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Component Modal Dialog */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <Edit2 className="text-emerald-600" size={18} />
                Modify Product Specs #{editingItem.barcode}
              </h3>
              <button onClick={handleCancelEdit} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Browser Auto-saved Copy of Specs Edit Draft Warning Shield */}
            {localStorage.getItem('rh_edit_product_draft') && (
              <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-2.5 mb-4 text-[11px] text-emerald-800 flex items-center justify-between font-sans">
                <span className="font-semibold flex items-center gap-1.5 leading-normal">
                  <Sparkles size={12} className="text-emerald-600 shrink-0 animate-pulse" />
                  Restored previous specs edit draft automatically from your browser cache.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('rh_edit_product_draft');
                    if (editingItem) {
                      setFormName(editingItem.name);
                      setFormBarcode(editingItem.barcode);
                      setFormDescription(editingItem.description);
                      setFormCategory(editingItem.category);
                      setFormCostPrice(editingItem.costPrice);
                      setFormSalePrice(editingItem.salePrice);
                      setFormQuantity(editingItem.quantity);
                      setFormMinStock(editingItem.minStockThreshold);
                      setFormImageUrl(editingItem.imageUrl || '');
                    }
                  }}
                  className="text-emerald-600 hover:text-emerald-950 font-extrabold underline cursor-pointer shrink-0 ml-2"
                >
                  Reset Specs
                </button>
              </div>
            )}

            <form onSubmit={handleEditItemSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">
                    Product Brand &                   </label>
                  <input 
                    type="text" 
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full border border-slate-200 p-2.5 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider">
                      SKU / Barcode *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const suggested = generateUniqueSku(formName, formCategory);
                        if (suggested) {
                          setFormBarcode(suggested);
                        }
                      }}
                      disabled={!formName.trim()}
                      className={`text-[9px] font-black px-2 py-0.5 rounded-md border transition-all uppercase tracking-wider ${
                        formName.trim()
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50 hover:bg-emerald-100 cursor-pointer'
                          : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'
                      }`}
                      title={formName.trim() ? "Suggest unique standardized SKU barcode" : "Please fill in Product Name first"}
                    >
                      ✨ Suggest SKU
                    </button>
                  </div>
                  <div className="flex gap-3 items-center">
                    <div className="flex-1">
                      <input 
                        type="text" 
                        value={formBarcode}
                        onChange={(e) => setFormBarcode(e.target.value)}
                        className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                        required
                      />
                    </div>
                    {formQRCodeDataUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const tempProduct: Product = {
                            id: editingItem?.id || 'temp-print',
                            name: formName || 'Asset Label Preview',
                            barcode: formBarcode,
                            description: formDescription || '',
                            category: formCategory,
                            costPrice: formCostPrice || 0,
                            salePrice: formSalePrice || 0,
                            quantity: formQuantity || 0,
                            minStockThreshold: formMinStock || 5,
                            maxStockThreshold: formMaxStock || 100,
                            reorderQuantity: formReorderQty || 10,
                            storageLocation: formStorageLocation || '',
                            supplierName: formSupplierName || '',
                            updatedAt: new Date().toISOString(),
                            updatedBy: employeeSignature || 'System staff',
                            imageUrl: formImageUrl || ''
                          };
                          setBarcodeStickerItem(tempProduct);
                        }}
                        className="border border-slate-200 hover:border-emerald-300 rounded-xl p-1.5 bg-white flex flex-col items-center justify-center shadow-3xs shrink-0 cursor-pointer transition-all hover:shadow-2xs group relative"
                        title="Click to preview & print instant high-quality custom SKU label sticker"
                      >
                        <img 
                          src={formQRCodeDataUrl} 
                          alt="SKU QR Code" 
                          className="w-8 h-8 object-contain" 
                          referrerPolicy="no-referrer" 
                        />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 hidden group-hover:flex items-center gap-1 bg-slate-900 text-white text-[9px] font-bold px-2 py-1 rounded-md shadow-lg whitespace-nowrap z-50">
                          <Printer size={10} className="text-emerald-400" />
                          Print Label Sticker
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">
                    Category Group *
                  </label>
                  <select 
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full border border-slate-200 p-2.5 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
                  >
                    {categories.filter(c => c !== 'All').map((cat, idx) => (
                      <option value={cat} key={idx}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">
                    Specifications Description
                  </label>
                  <textarea 
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={2}
                    className="w-full border border-slate-200 p-2.5 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <ProductPhotoCapture imageUrl={formImageUrl} onChange={setFormImageUrl} label="Capture Product Photo / SKU Image" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">
                    Cost Price (RM) *
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">
                    Customer Retail Price (RM) *
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formSalePrice}
                    onChange={(e) => setFormSalePrice(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">
                    Current Quantity in Inventory *
                  </label>
                  <input 
                    type="number" 
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(parseInt(e.target.value) || 0)}
                    className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">
                    Stock Alert Level *
                  </label>
                  <input 
                    type="number" 
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(parseInt(e.target.value) || 0)}
                    className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                {/* Supplemental Advanced Stock Tracking Options */}
                <div className="sm:col-span-2 border-t border-slate-100 pt-3">
                  <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">
                    Supplemental Stock Tracking Options
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">
                        Max Capacity Threshold (Overstock Limit)
                      </label>
                      <input 
                        type="number" 
                        value={formMaxStock}
                        onChange={(e) => setFormMaxStock(parseInt(e.target.value) || 0)}
                        placeholder="E.g., 100"
                        className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">
                        Suggested Replenish Reorder Size
                      </label>
                      <input 
                        type="number" 
                        value={formReorderQty}
                        onChange={(e) => setFormReorderQty(parseInt(e.target.value) || 0)}
                        placeholder="E.g., 10"
                        className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">
                        Warehouse Storage Slot (Location)
                      </label>
                      <input 
                        type="text" 
                        value={formStorageLocation}
                        onChange={(e) => setFormStorageLocation(e.target.value)}
                        placeholder="E.g., Aisle 4, Shelf B"
                        className="w-full border border-slate-200 p-2.5 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">
                        Primary Supplier / Vendor Partner
                      </label>
                      <input 
                        type="text" 
                        value={formSupplierName}
                        onChange={(e) => setFormSupplierName(e.target.value)}
                        placeholder="E.g., HP Distribution Asia"
                        className="w-full border border-slate-200 p-2.5 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2 border-t border-slate-100 pt-3">
                  <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
                    Authorizing Employee Name / Signature *
                  </label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-3.5 text-emerald-500" />
                    <input 
                      type="text" 
                      value={employeeSignature}
                      onChange={(e) => setEmployeeSignature(e.target.value)}
                      placeholder="Input employee name validating edits"
                      className="w-full border border-emerald-250 pl-9 pr-4 p-2.5 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 bg-emerald-50/10 placeholder-emerald-400/80"
                      required
                    />
                  </div>
                </div>
              </div>

              {errorBox && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
                  {errorBox}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1 cursor-pointer shadow-xs shadow-emerald-600/10"
                >
                  <FileCheck size={14} />
                  Authorize & Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete / De-registration Confirmation Drawer Modal */}
      {deletingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" id="dialog-delete-confirmation">
          <motion.div 
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-100"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="flex items-center gap-3 pb-3 border-b border-rose-100 mb-4 text-rose-600">
              <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center border border-rose-150">
                <AlertTriangle size={20} className="text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-tight text-slate-900 uppercase">
                  Product De-registration
                </h3>
                <p className="text-[11px] text-rose-500 font-bold uppercase tracking-wider">
                  Irreversible stock purge authorization
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl text-left space-y-1.5 shadow-3xs">
                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest block">Selected Catalog Target:</span>
                <div className="font-extrabold text-slate-800 text-xs">{deletingItem.name}</div>
                <div className="flex items-center gap-3">
                  <div className="text-[10px] text-slate-500 font-medium">SKU: <span className="font-mono font-bold text-slate-700">{deletingItem.barcode}</span></div>
                  <div className="text-[10px] text-slate-500 font-medium">Stock levels: <span className="font-bold text-rose-600">{deletingItem.quantity} units</span></div>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                De-registering this item will purge it completely from the catalog and log a system withdrawal write. Active customers will no longer find this computer tech SKU.
              </p>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!deleteSignature.trim()) {
                    setDeleteError('Authorizing Administrator name is required to execute deletion.');
                    return;
                  }
                  onDeleteProduct(deletingItem.id, deleteSignature.trim());
                  setDeletingItem(null);
                  setDeleteSignature('');
                  setDeleteError('');
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="block text-[10px] font-extrabold text-rose-700 uppercase tracking-widest mb-1">
                    Authorizing Admin Name / Signature *
                  </label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-3.5 text-rose-500" />
                    <input 
                      type="text"
                      required
                      value={deleteSignature}
                      onChange={(e) => setDeleteSignature(e.target.value)}
                      placeholder="Type your name to sign"
                      className="w-full border border-rose-200 pl-9 pr-4 py-2.5 rounded-xl text-xs focus:ring-1 focus:ring-rose-500 bg-rose-50/10 placeholder-rose-300 font-semibold"
                    />
                  </div>
                </div>

                {deleteError && (
                  <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-150 font-bold">
                    {deleteError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => {
                      setDeletingItem(null);
                      setDeleteSignature('');
                      setDeleteError('');
                    }}
                    className="flex-1 px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 uppercase tracking-widest"
                  >
                    Keep Product
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-colors shadow-md shadow-rose-600/10 uppercase tracking-widest"
                    id="btn-confirm-delete"
                  >
                    Confirm Delete
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Printable Barcode Sticker Modal */}
      {barcodeStickerItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 font-mono text-xs text-slate-800 printable-receipt"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            {/* Header: only shown on screen */}
            <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-200 mb-3 no-print">
              <h3 className="font-sans text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                <Printer size={16} className="text-emerald-600" />
                Asset Sticker Generator
              </h3>
              <button 
                type="button"
                onClick={() => setBarcodeStickerItem(null)} 
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                title="Dismiss sticker view"
              >
                <X size={16} />
              </button>
            </div>

            {/* Toggle tabs for sticker display modes */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-4 no-print text-[10px] font-sans font-bold">
              <button
                type="button"
                onClick={() => setStickerMode('dual')}
                className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
                  stickerMode === 'dual' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Dual Format
              </button>
              <button
                type="button"
                onClick={() => setStickerMode('barcode')}
                className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
                  stickerMode === 'barcode' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                1D Barcode
              </button>
              <button
                type="button"
                onClick={() => setStickerMode('qrcode')}
                className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
                  stickerMode === 'qrcode' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                2D QR Code
              </button>
            </div>

            {/* Sticker Area (Physical design printed) */}
            <div className="border border-slate-300 rounded-lg p-5 bg-white text-center space-y-4 max-w-[280px] mx-auto select-none">
              <div className="font-extrabold text-[9px] tracking-widest text-slate-400 uppercase">
                * COMPUTER TECH STICKER *
              </div>
              
              <div className="space-y-1">
                <p className="font-sans font-black text-slate-900 text-xs line-clamp-2 leading-tight">
                  {barcodeStickerItem.name}
                </p>
                <p className="text-[9px] text-slate-500 font-bold uppercase font-sans">
                  {barcodeStickerItem.category}
                </p>
              </div>

              {stickerMode === 'barcode' && (
                <div className="py-2.5 px-2 bg-white border border-slate-100 rounded-md flex flex-col items-center justify-center gap-1.5">
                  {renderBarcodeSVG(barcodeStickerItem.barcode)}
                  <span className="text-[11px] font-mono tracking-[4px] font-bold text-slate-900 uppercase block pl-[4px]">
                    {barcodeStickerItem.barcode}
                  </span>
                </div>
              )}

              {stickerMode === 'qrcode' && (
                <div className="py-2 px-2 bg-white border border-slate-100 rounded-md flex flex-col items-center justify-center gap-1">
                  {generatedQRCode ? (
                    <img src={generatedQRCode} alt="Asset QR Code" className="w-28 h-28 object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="text-[10px] text-slate-450 py-10 font-sans">Generating...</div>
                  )}
                  <span className="text-[11px] font-mono font-bold text-slate-900 tracking-wide mt-1 uppercase">
                    {barcodeStickerItem.barcode}
                  </span>
                </div>
              )}

              {stickerMode === 'dual' && (
                <div className="space-y-2">
                  <div className="py-1 px-2 bg-white border border-slate-100 rounded-md flex flex-col items-center justify-center">
                    {renderBarcodeSVG(barcodeStickerItem.barcode)}
                    <span className="text-[9px] font-mono font-bold text-slate-600 uppercase mt-0.5">
                      {barcodeStickerItem.barcode}
                    </span>
                  </div>
                  <div className="py-2 px-2 bg-white border border-slate-100 rounded-md flex flex-col items-center justify-center">
                    {generatedQRCode ? (
                      <img src={generatedQRCode} alt="Asset QR Code" className="w-24 h-24 object-contain mx-auto" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="text-[9px] text-slate-400 py-6">Generating...</div>
                    )}
                    <span className="text-[8px] font-mono text-slate-400 font-bold uppercase mt-1">
                      Scannable Asset QR Code
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-205 font-bold">
                <span className="text-[10px] text-slate-400 uppercase">RETAIL PRICE</span>
                <span className="text-sm font-black text-slate-950 font-sans">
                  RM {barcodeStickerItem.salePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Print trigger CTA */}
            <div className="flex gap-2.5 mt-5 pt-4 border-t border-slate-100 no-print">
              <button
                type="button"
                onClick={() => setBarcodeStickerItem(null)}
                className="flex-1 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all uppercase tracking-wider"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/15 uppercase tracking-wider cursor-pointer"
                id="btn-trigger-print-sticker"
              >
                <Printer size={13} />
                Print Sticker
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Bulk Custom Adjustments Modal Dialog */}
      {isBulkAdjusting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" id="bulk-adjust-modal">
          <motion.div 
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <Sliders className="text-emerald-600" size={20} />
                Bulk Adjust ({selectedProductIds.length} Products)
              </h3>
              <button onClick={() => setIsBulkAdjusting(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBulkAdjustSubmit} className="space-y-5">
              {/* Selected Items Summary Grid */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 max-h-24 overflow-y-auto text-left space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Target Products:</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedProductIds.map(id => {
                    const found = products.find(p => p.id === id);
                    return found ? (
                      <span key={id} className="inline-flex items-center gap-1 bg-white border border-slate-200/80 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-700">
                        {found.name.length > 25 ? found.name.slice(0, 22) + '...' : found.name}
                        <span className="font-mono text-[9px] text-slate-400 bg-slate-50 px-1 py-0.5 rounded">Qty: {found.quantity}</span>
                      </span>
                    ) : null;
                  })}
                </div>
              </div>

              {/* Adjustment Type Switch tabs */}
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-2">Adjustment Area</label>
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkAdjType('quantity');
                      setBulkError('');
                    }}
                    className={`flex-1 text-xs font-bold py-2.5 rounded-lg transition-all uppercase tracking-wider ${
                      bulkAdjType === 'quantity' 
                        ? 'bg-white text-emerald-700 shadow-3xs font-extrabold border border-emerald-100' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Inventory Count (Units)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkAdjType('price');
                      setBulkError('');
                    }}
                    className={`flex-1 text-xs font-bold py-2.5 rounded-lg transition-all uppercase tracking-wider ${
                      bulkAdjType === 'price' 
                        ? 'bg-white text-emerald-700 shadow-3xs font-extrabold border border-emerald-100' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Product Pricing (RM)
                  </button>
                </div>
              </div>

              {/* Dynamic Subforms layout based on Adjustment Type */}
              {bulkAdjType === 'quantity' ? (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase mb-1">Batch Operation</label>
                      <select
                        value={bulkQtyOperator}
                        onChange={(e: any) => setBulkQtyOperator(e.target.value)}
                        className="w-full border border-slate-200 p-2.5 rounded-xl text-xs bg-white focus:ring-1 focus:ring-emerald-500 font-semibold cursor-pointer font-sans"
                        id="bulk-qty-operator-select"
                      >
                        <option value="add">Increase Quantity (+)</option>
                        <option value="subtract">Decrease Quantity (-)</option>
                        <option value="set">Set Fixed Stock Level (=)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase mb-1">Adjustment Value</label>
                      <input 
                        type="number" 
                        min="0"
                        step="1"
                        value={bulkQtyValue}
                        onChange={(e) => setBulkQtyValue(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500 px-3"
                        required
                        id="bulk-qty-value-input"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium font-sans">Note: Quantity reductions will never result in negative stock. Items will bottom out at 0 units automatically.</p>
                </div>
              ) : (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase mb-1">Target Price</label>
                      <select
                        value={bulkPriceTarget}
                        onChange={(e: any) => setBulkPriceTarget(e.target.value)}
                        className="w-full border border-slate-200 p-2.5 rounded-xl text-xs bg-white focus:ring-1 focus:ring-emerald-500 font-semibold cursor-pointer font-sans"
                        id="bulk-price-target-select"
                      >
                        <option value="sale">Customer Retail Price</option>
                        <option value="cost">Product Cost Price</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase mb-1">Pricing Operator</label>
                      <select
                        value={bulkPriceOperator}
                        onChange={(e: any) => setBulkPriceOperator(e.target.value)}
                        className="w-full border border-slate-200 p-2.5 rounded-xl text-xs bg-white focus:ring-1 focus:ring-emerald-500 font-semibold cursor-pointer font-sans"
                        id="bulk-price-operator-select"
                      >
                        <option value="add_flat">Increase flat RM (+)</option>
                        <option value="subtract_flat">Decrease flat RM (-)</option>
                        <option value="add_percent">Increase by Percent (%)</option>
                        <option value="subtract_percent">Decrease by Percent (%)</option>
                        <option value="set">Set Fixed RM (=)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase mb-1">Adjustment Amount</label>
                      <input 
                        type="number" 
                        min="0"
                        step="0.01"
                        value={bulkPriceValue}
                        onChange={(e) => setBulkPriceValue(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500 px-3"
                        required
                        id="bulk-price-value-input"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium font-sans">Note: Percentage modifications are calculated based on each product's current valuation, enabling dynamic category shifts in one transaction.</p>
                </div>
              )}

              {/* Employee Signature required to execute bulk transaction */}
              <div className="border-t border-slate-100 pt-4">
                <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
                  Authorizing Administrator / Employee Signature *
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-3.5 text-emerald-500" />
                  <input 
                    type="text" 
                    value={bulkEmployeeSignature}
                    onChange={(e) => setBulkEmployeeSignature(e.target.value)}
                    placeholder="Enter full name of authorizing manager"
                    className="w-full border border-emerald-250 pl-9 pr-4 p-2.5 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 bg-emerald-50/10 placeholder-emerald-400/80 font-bold"
                    required
                    id="bulk-employee-signature-input"
                  />
                </div>
              </div>

              {bulkError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100 font-bold">
                  {bulkError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsBulkAdjusting(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 font-sans cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-600/10 font-sans cursor-pointer"
                  id="btn-confirm-bulk-adjust"
                >
                  <Check size={14} />
                  Authorize & Apply
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Printable Inventory Catalog Reports Modal */}
      {isPrintingInventory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div 
            className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 text-xs text-slate-800 printable-receipt my-8"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            {/* Header: only shown on screen */}
            <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-200 mb-4 no-print font-sans">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
                <Printer size={18} className="text-emerald-600 animate-pulse" />
                Inventory List Print Preview
              </h3>
              <button 
                type="button"
                onClick={() => setIsPrintingInventory(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                title="Dismiss print preview"
              >
                <X size={18} />
              </button>
            </div>

            {/* Customizer settings toolbar on-screen only */}
            <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl mb-5 space-y-4 no-print font-sans text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-3 border-b border-slate-200/60">
                
                {/* Print Filter Selector */}
                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] font-black text-emerald-600 block uppercase tracking-wider font-sans">Print Filter Scope</span>
                    <span className="text-slate-500 text-[10.5px]">Select which catalog items should print</span>
                  </div>
                  <div className="flex bg-white border border-slate-200 p-1 rounded-xl text-[11px] font-bold shadow-3xs w-full max-w-xs">
                    <button
                      type="button"
                      onClick={() => setPrintFilterMode('all')}
                      className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                        printFilterMode === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      All ({products.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintFilterMode('filtered')}
                      className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                        printFilterMode === 'filtered' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Active Filtered ({filteredProducts.length})
                    </button>
                  </div>
                </div>

                {/* Date-Wise Snapshot Mode Control */}
                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] font-black text-emerald-600 block uppercase tracking-wider font-sans">Date-Wise Tracking & Balance</span>
                    <span className="text-slate-500 text-[10.5px]">Track back stock balances as of a target date</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="flex bg-white border border-slate-200 p-1 rounded-xl text-[11px] font-bold shadow-3xs shrink-0 self-start">
                      <button
                        type="button"
                        onClick={() => setIsDateWiseActive(false)}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                          !isDateWiseActive ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Live Counts
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDateWiseActive(true)}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                          isDateWiseActive ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                        id="btn-enable-datewise"
                      >
                        Date Snapshot
                      </button>
                    </div>

                    {isDateWiseActive && (
                      <input 
                        type="date"
                        value={snapshotDate}
                        onChange={(e) => setSnapshotDate(e.target.value)}
                        className="border border-emerald-250 bg-white px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-bold text-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-3xs cursor-pointer"
                        id="input-print-snapshot-date"
                      />
                    )}
                  </div>
                </div>

              </div>

              {/* Status information banners */}
              <div className="flex flex-col gap-2">
                {printFilterMode === 'filtered' && (
                  <div className="p-2.5 bg-emerald-50/50 border border-emerald-100/30 rounded-lg text-[10px] text-emerald-850 font-medium leading-relaxed">
                    🔍 Filtered view active: includes items matching keyword <span className="font-semibold">"{searchQuery || 'None'}"</span>, category grouping <span className="font-semibold">"{selectedCategory}"</span>, and alert level <span className="font-semibold">"{alertFilter}"</span>.
                  </div>
                )}
                {isDateWiseActive && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-100/50 rounded-lg text-[10px] text-emerald-800 font-medium leading-relaxed">
                    💡 <strong>Date-Wise Snapshot Active:</strong> All quantities and asset valuations below have been dynamically backward-reconstructed to represent the close of business on <strong>{snapshotDate}</strong>. This is compiled by processing historical audit trail differentials backwards from today.
                  </div>
                )}
              </div>
            </div>

            {/* Printable Document Sheet (Physical layout printed) */}
            {(() => {
              const listToPrint = printFilterMode === 'all' ? products : filteredProducts;
              
              // Map items to calculate their historical stock level
              const computedItems = listToPrint.map(p => {
                const historicalQty = (() => {
                  try {
                    if (!isDateWiseActive || !snapshotDate) return p.quantity;
                    const targetDate = new Date(`${snapshotDate}T23:59:59`);
                    const now = new Date();
                    if (targetDate >= now) return p.quantity;

                    const futureLogs = (auditLogs || []).filter(log => {
                      if (log.productId !== p.id) return false;
                      const logTime = new Date(log.timestamp);
                      return logTime > targetDate;
                    });

                    const deltaSum = futureLogs.reduce((sum, log) => sum + log.delta, 0);
                    return Math.max(0, p.quantity - deltaSum);
                  } catch {
                    return p.quantity;
                  }
                })();

                return {
                  ...p,
                  quantity: historicalQty,
                };
              });

              const totalUnits = computedItems.reduce((sum, p) => sum + p.quantity, 0);
              const totalCostVal = computedItems.reduce((sum, p) => sum + (p.quantity * p.costPrice), 0);
              const totalSaleVal = computedItems.reduce((sum, p) => sum + (p.quantity * p.salePrice), 0);

              // Get all stock operation logs occurred exactly on selected date
              const dailyActivities = (() => {
                if (!isDateWiseActive || !snapshotDate) return [];
                return (auditLogs || []).filter(log => {
                  try {
                    const logDate = new Date(log.timestamp);
                    const yyyy = logDate.getFullYear();
                    const mm = String(logDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(logDate.getDate()).padStart(2, '0');
                    return `${yyyy}-${mm}-${dd}` === snapshotDate;
                  } catch {
                    return false;
                  }
                }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
              })();

              return (
                <div className="bg-white text-slate-900 space-y-4 text-left">
                  {/* Document Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
                    <div className="space-y-1 text-left">
                      <h1 className="text-lg font-black text-slate-900 tracking-tight font-sans">RH COMPUTER TECHNOLOGY</h1>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">
                        {isDateWiseActive ? `Historical Inventory Report (As of ${snapshotDate})` : 'Master Product Inventory Report'}
                      </p>
                    </div>
                    <div className="text-left sm:text-right text-[10px] text-slate-500 font-mono space-y-0.5 shrink-0">
                      <p>Report Printed: {new Date().toLocaleString()}</p>
                      {isDateWiseActive && <p className="font-black text-emerald-800">Snapshot Target: {snapshotDate} (EOD)</p>}
                      <p>Database Source: Secure Cloud Core</p>
                      <p>Product Lines: {computedItems.length} items</p>
                    </div>
                  </div>

                  {/* Summary row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-1 font-sans">
                    <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/40">
                      <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Calculated Models</span>
                      <span className="text-sm font-black text-slate-900 font-mono mt-0.5 block">{computedItems.length} SKU codes</span>
                    </div>
                    <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/40">
                      <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        {isDateWiseActive ? `Snapshot Units (${snapshotDate})` : 'Total Counts (Qty)'}
                      </span>
                      <span className="text-sm font-black text-slate-900 font-mono mt-0.5 block">{totalUnits} units</span>
                    </div>
                    <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/40">
                      <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Asset Value (Cost RM)</span>
                      <span className="text-sm font-black text-slate-900 font-mono mt-0.5 block">
                        RM {totalCostVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/40">
                      <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Asset Value (Sale RM)</span>
                      <span className="text-sm font-black text-emerald-800 font-mono mt-0.5 block">
                        RM {totalSaleVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Table area for the printing list */}
                  <div className="pt-2 overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-250 text-left text-[10px] font-sans">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-250 text-[9px] uppercase tracking-wide">
                          <th className="p-2 border border-slate-200 w-8 text-center">#</th>
                          <th className="p-2 border border-slate-200 w-28">Barcode / SKU</th>
                          <th className="p-2 border border-slate-200">Product Model Description & Specs</th>
                          <th className="p-2 border border-slate-200 w-32">Category Group</th>
                          <th className="p-2 border border-slate-200 w-24 text-center">Storage Loc</th>
                          <th className="p-2 border border-slate-200 w-20 text-right">Cost (RM)</th>
                          <th className="p-2 border border-slate-200 w-20 text-right">Retail (RM)</th>
                          <th className="p-2 border border-slate-200 w-20 text-center">{isDateWiseActive ? `Snapshot Qty` : 'In Stock'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                        {computedItems.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-400 font-mono italic">
                              No items matched the current active configuration report.
                            </td>
                          </tr>
                        ) : (
                          computedItems.map((p, index) => {
                            const isLowStock = p.quantity <= p.minStockThreshold;
                            const isOutOfStock = p.quantity <= 0;
                            return (
                              <tr 
                                key={p.id} 
                                className={`${
                                  isOutOfStock 
                                    ? 'bg-rose-50/50 text-rose-950 font-semibold' 
                                    : isLowStock 
                                      ? 'bg-amber-50/40 text-amber-950 font-semibold' 
                                      : 'even:bg-slate-50/20'
                                }`}
                              >
                                <td className="p-2 border border-slate-150 text-center font-mono font-bold text-slate-400">{index + 1}</td>
                                <td className="p-2 border border-slate-150 font-mono font-bold text-slate-900 tracking-wider uppercase">{p.barcode}</td>
                                <td className="p-2 border border-slate-150">
                                  <span className="font-extrabold text-slate-950 block leading-tight">{p.name}</span>
                                  {p.description && <span className="text-[9px] text-slate-450 block mt-0.5 truncate max-w-sm" title={p.description}>{p.description}</span>}
                                </td>
                                <td className="p-2 border border-slate-150 text-[9px] text-slate-500 font-bold uppercase">{p.category}</td>
                                <td className="p-2 border border-slate-150 text-center font-mono text-[9px] text-slate-600 bg-slate-50/10 font-bold">{p.storageLocation || 'Unassigned'}</td>
                                <td className="p-2 border border-slate-150 text-right font-mono">RM {p.costPrice.toFixed(2)}</td>
                                <td className="p-2 border border-slate-150 text-right font-mono font-bold text-slate-950">RM {p.salePrice.toFixed(2)}</td>
                                <td className="p-2 border border-slate-150 text-center">
                                  <div className="flex flex-col items-center justify-center font-mono font-black text-[11px]">
                                    <span className={isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-900'}>
                                      {p.quantity} Units
                                    </span>
                                    {isDateWiseActive && (
                                      <span className="text-[7.5px] text-emerald-700 font-black tracking-tighter block mt-0.5 uppercase">(Snapshot)</span>
                                    )}
                                    {!isDateWiseActive && isOutOfStock ? (
                                      <span className="text-[7.5px] bg-rose-100 border border-rose-250 text-rose-800 font-black px-1 rounded-sm uppercase tracking-widest mt-0.5 scale-90">OUT</span>
                                    ) : !isDateWiseActive && isLowStock ? (
                                      <span className="text-[7.5px] bg-amber-100 border border-amber-250 text-amber-800 font-black px-1 rounded-sm uppercase tracking-widest mt-0.5 scale-90">LOW</span>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Daily Tracking ledger - only shown when Date-wise filter is active and printing */}
                  {isDateWiseActive && (
                    <div className="pt-4 space-y-2 border-t border-dashed border-slate-200">
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider font-sans">
                        📅 Stock Operations Ledger & Tracking Logs (On {snapshotDate})
                      </h4>
                      <p className="text-[9px] text-slate-500 font-semibold leading-normal">
                        Detailed operational index recording stock adjustments, check-ins, withdrawals, and sales processed during this single day.
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-slate-200 text-left text-[9px] font-sans">
                          <thead>
                            <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[8px] uppercase tracking-wide">
                              <th className="p-1.5 border border-slate-200 w-16">Time</th>
                              <th className="p-1.5 border border-slate-200 w-28 font-mono">Barcode SKU</th>
                              <th className="p-1.5 border border-slate-200">Product Model</th>
                              <th className="p-1.5 border border-slate-200 w-24 text-center">Operation</th>
                              <th className="p-1.5 border border-slate-200 w-16 text-right">Delta</th>
                              <th className="p-1.5 border border-slate-200 w-16 text-right">Stock EOD</th>
                              <th className="p-1.5 border border-slate-200 w-28">Processed By</th>
                              <th className="p-1.5 border border-slate-200">Notes / Receipts References</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 font-medium text-slate-700">
                            {dailyActivities.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="p-4 text-center text-slate-400 font-mono italic text-[9px]">
                                  No transaction, checkout, or stock adjustments registered in terminal logs on this date.
                                </td>
                              </tr>
                            ) : (
                              dailyActivities.map((log) => {
                                const isPositive = log.delta > 0;
                                return (
                                  <tr key={log.id} className="even:bg-slate-50/10">
                                    <td className="p-1.5 border border-slate-150 font-mono">
                                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="p-1.5 border border-slate-150 font-mono text-slate-900 font-bold">
                                      {(() => {
                                        const prod = products.find(p => p.id === log.productId);
                                        return prod ? prod.barcode : 'N/A';
                                      })()}
                                    </td>
                                    <td className="p-1.5 border border-slate-150 font-extrabold text-slate-900">{log.productName}</td>
                                    <td className="p-1.5 border border-slate-150 text-center uppercase text-[7.5px] font-black">
                                      <span className={`px-1 rounded-xs inline-block ${
                                        log.type === 'STOCK_IN' ? 'bg-teal-50 text-teal-800 border border-teal-150' :
                                        log.type === 'SALE' ? 'bg-emerald-50 text-emerald-800 border border-emerald-150' :
                                        log.type === 'STOCK_OUT' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                        'bg-slate-50 text-slate-700 border border-slate-150'
                                      }`}>
                                        {log.type}
                                      </span>
                                    </td>
                                    <td className={`p-1.5 border border-slate-150 text-right font-mono font-bold ${isPositive ? 'text-emerald-700' : 'text-rose-600'}`}>
                                      {isPositive ? '+' : ''}{log.delta}
                                    </td>
                                    <td className="p-1.5 border border-slate-150 text-right font-mono font-black text-slate-900">
                                      {log.quantityAfter}
                                    </td>
                                    <td className="p-1.5 border border-slate-150 font-bold text-slate-900">{log.employeeName || 'System'}</td>
                                    <td className="p-1.5 border border-slate-150 text-slate-450 font-medium italic break-words max-w-xs">{log.notes || 'Routine update'}</td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Document Footer Signatures */}
                  <div className="flex justify-between items-end pt-12 text-[9px] text-slate-400 font-mono">
                    <div>
                      <p>RH Inventory Report System Validation</p>
                      <p className="text-[8px] text-slate-350">ID Reference Log: RH-INV-{computedItems.length}-{Math.floor(Math.random() * 100000)}</p>
                    </div>
                    <div className="border-t border-dashed border-slate-300 pt-2 w-48 text-center shrink-0">
                      <p className="text-slate-500 font-bold">Authorizing Specialist</p>
                      <p className="text-[8px] text-slate-350 mt-1">Signature Initials / Stamp</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Print & Close trigger CTAs (No-print) */}
            <div className="flex justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100 no-print font-sans">
              <button
                type="button"
                onClick={() => setIsPrintingInventory(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all uppercase tracking-wider"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/15 uppercase tracking-wider cursor-pointer font-sans"
                id="btn-complete-inventory-print"
              >
                <Printer size={13} />
                Print Now
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
