/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserCheck, 
  Trash2, 
  Search, 
  Plus, 
  Minus, 
  CheckCircle2, 
  FileText,
  AlertTriangle,
  Briefcase,
  X,
  Clock,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  Undo2,
  Copy,
  Check,
  TrendingDown,
  FileSpreadsheet,
  ShoppingCart,
  Sparkles
} from 'lucide-react';
import { Product, AuditLog } from '../types';

interface EmployeeTakeProps {
  products: Product[];
  auditLogs: AuditLog[];
  onEmployeeTake: (
    items: Array<{ productId: string; name: string; quantity: number }>,
    employeeName: string,
    department: string,
    reason: string
  ) => void;
  onEmployeeReturn?: (
    items: Array<{ productId: string; name: string; quantity: number }>,
    employeeName: string,
    department: string,
    reason: string
  ) => void;
  onSellRedirect?: (
    items: Array<{ productId: string; name: string; barcode: string; quantity: number; salePrice: number; costPrice: number }>,
    employeeName: string
  ) => void;
  onDeleteOutstanding?: (
    employeeName: string,
    productId: string,
    quantity: number
  ) => void;
}

interface CartItem {
  productId: string;
  name: string;
  barcode: string;
  quantity: number;
}

interface OutstandingItem {
  id: string; // employee_productId lowercase
  employee: string;
  department: string;
  productId: string;
  productName: string;
  barcode: string;
  quantity: number;
  timestamp?: string;
}

const DEPARTMENTS = [
  "IT & Infrastructure",
  "Software Engineering",
  "Research & Development",
  "Customer Support",
  "Office Operations",
  "Marketing & PR"
];

const REASONS = [
  "Internal Lab Setup",
  "Workstation Upgrade",
  "QA & Hardware Testing",
  "Customer Live Demo",
  "Defective Replacement",
  "General Office Supply"
];

const RETURN_REASONS = [
  "Display Finished",
  "QA Test Completed",
  "Evaluation Terminated",
  "Temporary Allocation Returned",
  "Stock Correction Checkout Reset"
];

export default function EmployeeTake({ products, auditLogs, onEmployeeTake, onEmployeeReturn, onSellRedirect, onDeleteOutstanding }: EmployeeTakeProps) {
  // Navigation Tabs: 
  // 'checkout' - Withdraw stocks
  // 'return' - Return from display/labels outstanding
  // 'lowstock' - Low stock alert tracking
  // 'ledger' - Allocation Ledger histories
  const [activeSubTab, setActiveSubTab] = useState<'checkout' | 'return' | 'lowstock' | 'ledger'>('checkout');

  // Action type selector state (Takeout/Internals, Sell/Sales Portal, return/Stock Entry)
  const [actionType, setActionType] = useState<'takeout' | 'sell' | 'return'>(() => {
    const saved = localStorage.getItem('employee_takeout_actionType');
    return (saved === 'takeout' || saved === 'sell' || saved === 'return') ? saved : 'takeout';
  });

  // Checkout states
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('employee_takeout_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [employeeName, setEmployeeName] = useState(() => {
    return localStorage.getItem('employee_takeout_employeeName') || '';
  });
  const [department, setDepartment] = useState(() => {
    return localStorage.getItem('employee_takeout_department') || DEPARTMENTS[0];
  });
  const [reason, setReason] = useState(() => {
    return localStorage.getItem('employee_takeout_reason') || REASONS[0];
  });
  const [customReason, setCustomReason] = useState(() => {
    return localStorage.getItem('employee_takeout_customReason') || '';
  });
  const [errorStatus, setErrorStatus] = useState('');

  // Auto-save form states to localStorage
  React.useEffect(() => {
    localStorage.setItem('employee_takeout_actionType', actionType);
  }, [actionType]);

  React.useEffect(() => {
    localStorage.setItem('employee_takeout_cart', JSON.stringify(cart));
  }, [cart]);

  React.useEffect(() => {
    localStorage.setItem('employee_takeout_employeeName', employeeName);
  }, [employeeName]);

  React.useEffect(() => {
    localStorage.setItem('employee_takeout_department', department);
  }, [department]);

  React.useEffect(() => {
    localStorage.setItem('employee_takeout_reason', reason);
  }, [reason]);

  React.useEffect(() => {
    localStorage.setItem('employee_takeout_customReason', customReason);
  }, [customReason]);
  
  // Withdrawal Confirmed Modal receipt state
  const [confirmedTake, setConfirmedTake] = useState<{
    id: string;
    items: CartItem[];
    employee: string;
    department: string;
    reason: string;
    timestamp: string;
  } | null>(null);

  // Return Processing states
  const [selectedOutstanding, setSelectedOutstanding] = useState<OutstandingItem | null>(() => {
    try {
      const saved = localStorage.getItem('employee_return_selectedOutstanding');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [returnEmployee, setReturnEmployee] = useState(() => {
    return localStorage.getItem('employee_return_employee') || '';
  });
  const [returnDept, setReturnDept] = useState(() => {
    return localStorage.getItem('employee_return_dept') || DEPARTMENTS[0];
  });
  const [returnProductId, setReturnProductId] = useState(() => {
    return localStorage.getItem('employee_return_productId') || '';
  });
  const [returnQty, setReturnQty] = useState(() => {
    const saved = localStorage.getItem('employee_return_qty');
    return saved ? Math.max(1, parseInt(saved) || 1) : 1;
  });
  const [returnReason, setReturnReason] = useState(() => {
    return localStorage.getItem('employee_return_reason') || RETURN_REASONS[0];
  });
  const [customReturnReason, setCustomReturnReason] = useState(() => {
    return localStorage.getItem('employee_return_customReason') || '';
  });
  const [returnErrorStatus, setReturnErrorStatus] = useState('');
  const [returnSearchQuery, setReturnSearchQuery] = useState('');
  const [returnMode, setReturnMode] = useState<'restock' | 'sold'>(() => {
    const saved = localStorage.getItem('employee_return_mode');
    return (saved === 'restock' || saved === 'sold') ? saved : 'restock';
  });

  // Auto-save return form states to localStorage
  React.useEffect(() => {
    localStorage.setItem('employee_return_selectedOutstanding', selectedOutstanding ? JSON.stringify(selectedOutstanding) : '');
  }, [selectedOutstanding]);

  React.useEffect(() => {
    localStorage.setItem('employee_return_employee', returnEmployee);
  }, [returnEmployee]);

  React.useEffect(() => {
    localStorage.setItem('employee_return_dept', returnDept);
  }, [returnDept]);

  React.useEffect(() => {
    localStorage.setItem('employee_return_productId', returnProductId);
  }, [returnProductId]);

  React.useEffect(() => {
    localStorage.setItem('employee_return_qty', String(returnQty));
  }, [returnQty]);

  React.useEffect(() => {
    localStorage.setItem('employee_return_reason', returnReason);
  }, [returnReason]);

  React.useEffect(() => {
    localStorage.setItem('employee_return_customReason', customReturnReason);
  }, [customReturnReason]);

  React.useEffect(() => {
    localStorage.setItem('employee_return_mode', returnMode);
  }, [returnMode]);

  const [confirmedReturn, setConfirmedReturn] = useState<{
    id: string;
    items: CartItem[];
    employee: string;
    department: string;
    reason: string;
    timestamp: string;
  } | null>(null);

  // Deleting outstanding display/lab record state
  const [deletingOutstanding, setDeletingOutstanding] = useState<OutstandingItem | null>(null);

  // Low stock copy states
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Ledger Filter states
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [filterEmployee, setFilterEmployee] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Parse notes generated during takeout or return
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
    // Fallback if not matching canonical takeout record pattern
    return {
      type: 'TAKEOUT',
      employee: logEmployee || 'Authorized staff',
      department: 'Corporate Staff',
      reason: noteStr.replace(/^(Taken|Returned) by [^:]+:\s*/i, '') || 'General takeout allocation'
    };
  };

  // Filter audit logs specifically corresponding to STOCK_OUT & STOCK_IN of takeout category
  const takeoutRecords = auditLogs.filter(log => {
    return (log.notes.startsWith('Taken by') || log.notes.startsWith('Returned by') || log.employeeName !== 'System');
  });

  // Calculate unique staff in ledger logs for filter dropdown index
  const uniqueEmployees = Array.from(new Set(takeoutRecords.map(log => {
    const parsed = parseTakeoutNote(log.notes, log.employeeName);
    return parsed.employee;
  }))).filter(Boolean).sort();

  // Filtered takeout & returns list for allocation ledger
  const filteredRecords = takeoutRecords.filter(log => {
    const parsed = parseTakeoutNote(log.notes, log.employeeName);
    
    // Dropdown filters
    if (filterDepartment !== 'All' && parsed.department !== filterDepartment) return false;
    if (filterEmployee !== 'All' && parsed.employee !== filterEmployee) return false;
    
    // Text search query index
    if (ledgerSearchQuery.trim()) {
      const q = ledgerSearchQuery.toLowerCase();
      const matchText = `${log.productName} ${log.id} ${parsed.employee} ${parsed.department} ${parsed.reason}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    
    return true;
  });

  // Pagination bounds math
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Search filtered products for cart checkout lookup
  const matchingProducts = products.filter(p => {
    if (!searchQuery.trim()) return true;
    return p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           p.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
           p.category.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // GATHER OUTSTANDING DISPLAY ITEMS BASED ON TAKEN vs. RETURNED LOGS
  const getOutstandingAllocations = (): OutstandingItem[] => {
    const map: Record<string, OutstandingItem> = {};
    
    // Sort oldest to newest so calculations increase then decrease correctly
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
          quantity: 0,
          timestamp: log.timestamp
        };
      }

      if (isTake) {
        map[key].quantity += Math.abs(log.delta);
        map[key].timestamp = log.timestamp;
      } else if (isReturn) {
        map[key].quantity -= Math.abs(log.delta);
        map[key].timestamp = log.timestamp;
      }
    });

    // Return only records with net outstanding quantity > 0
    return Object.values(map).filter(item => item.quantity > 0);
  };

  const outstandingAllocations = getOutstandingAllocations();

  // Filter Outstanding Items for Search Bar in returns
  const filteredOutstanding = outstandingAllocations.filter(item => {
    if (!returnSearchQuery.trim()) return true;
    const q = returnSearchQuery.toLowerCase();
    return item.employee.toLowerCase().includes(q) ||
           item.productName.toLowerCase().includes(q) ||
           item.barcode.toLowerCase().includes(q) ||
           item.department.toLowerCase().includes(q);
  });

  // Calculate Low Stock parameters
  const lowStockProducts = products.filter(p => p.quantity <= p.minStockThreshold);
  const outOfStockProducts = lowStockProducts.filter(p => p.quantity <= 0);
  const warningStockProducts = lowStockProducts.filter(p => p.quantity > 0);

  // Add items into cart operations
  const addToCart = (product: Product) => {
    if (product.quantity <= 0) {
      setErrorStatus(`Product "${product.name}" is completely out of stock!`);
      setTimeout(() => setErrorStatus(''), 4000);
      return;
    }

    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      if (existing.quantity >= product.quantity) {
        setErrorStatus(`Cannot take more than ${product.quantity} units of "${product.name}" (stock limit reached).`);
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
        quantity: 1
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
        setErrorStatus(`Insufficient inventory. Only ${originalProduct.quantity} units can be withdrawn.`);
        setTimeout(() => setErrorStatus(''), 4005);
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

  const handleWithdrawalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setErrorStatus('Please add at least one product to the list.');
      return;
    }
    if (!employeeName.trim()) {
      setErrorStatus('Employee name is required to authorize actions.');
      return;
    }

    const finalReason = reason === "Other" && customReason.trim() 
      ? customReason.trim() 
      : reason;

    if (actionType === 'sell') {
      // IF THE EMPLOYEE SALE ANY PRODUCT IT WILL BE A SELL OPTION AND WILL DIRECTLY GO TO THE SALES PORTAL
      if (onSellRedirect) {
        const saleItems = cart.map(item => {
          const original = products.find(p => p.id === item.productId);
          return {
            productId: item.productId,
            name: item.name,
            barcode: item.barcode,
            quantity: item.quantity,
            salePrice: original ? original.salePrice : 0,
            costPrice: original ? original.costPrice : 0
          };
        });
        onSellRedirect(saleItems, employeeName.trim());
      }
      // Reset parameters
      setCart([]);
      setEmployeeName('');
      setCustomReason('');
      setSearchQuery('');
      return;
    }

    if (actionType === 'return') {
      // IF THE EMPLOYEE RETURN THE PRODUCT IT WILL BE A RETURN OPTION AND THAT WILL COUNT IN THE STOCK AFTER RETURN ENTRY BY THIS EMPLOYEE NAME
      if (onEmployeeReturn) {
        const returnItems = cart.map(item => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity
        }));
        onEmployeeReturn(returnItems, employeeName.trim(), department, finalReason);
      }

      setConfirmedReturn({
        id: 'ret_' + Math.floor(Math.random() * 1000000).toString(),
        items: [...cart],
        employee: employeeName.trim(),
        department,
        reason: finalReason,
        timestamp: new Date().toISOString()
      });

      // Reset parameters
      setCart([]);
      setEmployeeName('');
      setCustomReason('');
      setSearchQuery('');
      return;
    }

    // Default: takeout
    // Call upstream mutation state
    onEmployeeTake(cart, employeeName.trim(), department, finalReason);

    // Show success overlay receipt
    setConfirmedTake({
      id: 'take_' + Math.floor(Math.random() * 1000000).toString(),
      items: [...cart],
      employee: employeeName.trim(),
      department,
      reason: finalReason,
      timestamp: new Date().toISOString()
    });

    // Reset parameters
    setCart([]);
    setEmployeeName('');
    setCustomReason('');
    setSearchQuery('');
  };

  // Select outstanding item to initiate quick return form
  const handleSelectOutstandingForReturn = (item: OutstandingItem) => {
    setSelectedOutstanding(item);
    setReturnEmployee(item.employee);
    setReturnDept(item.department);
    setReturnProductId(item.productId);
    setReturnQty(item.quantity);
    setReturnMode('restock');
    setReturnErrorStatus('');
  };

  // Select outstanding item to initiate instant sold process
  const handleSelectOutstandingForSale = (item: OutstandingItem) => {
    setSelectedOutstanding(item);
    setReturnEmployee(item.employee);
    setReturnDept(item.department);
    setReturnProductId(item.productId);
    setReturnQty(item.quantity);
    setReturnMode('sold');
    setReturnErrorStatus('');
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnEmployee.trim()) {
      setReturnErrorStatus('Please specify the employee name returning the item.');
      return;
    }
    if (!returnProductId) {
      setReturnErrorStatus('Please select a product to return.');
      return;
    }
    if (returnQty <= 0) {
      setReturnErrorStatus('Return quantity must be greater than zero.');
      return;
    }

    const selectedProd = products.find(p => p.id === returnProductId);
    if (!selectedProd) {
      setReturnErrorStatus('Selected product not found in database.');
      return;
    }

    // If selected from outstanding item list, we prevent returning more than she took
    if (selectedOutstanding && 
        selectedOutstanding.productId === returnProductId && 
        selectedOutstanding.employee.toLowerCase() === returnEmployee.toLowerCase()) {
      if (returnQty > selectedOutstanding.quantity) {
        setReturnErrorStatus(`Cannot return more than outstanding display balance (${selectedOutstanding.quantity} units).`);
        return;
      }
    }

    const finalReturnReason = returnReason === "Other" && customReturnReason.trim()
      ? customReturnReason.trim()
      : returnReason;

    const returnItems = [{
      productId: returnProductId,
      name: selectedProd.name,
      quantity: returnQty
    }];

    if (returnMode === 'sold') {
      // 1. Auto-restore stock to avoid double deduction when sold via POS register
      if (onEmployeeReturn) {
        onEmployeeReturn(returnItems, returnEmployee.trim(), returnDept, `POS Sale auto-restoration (${finalReturnReason})`);
      }
      // 2. Redirect to POS register with items pre-filled
      if (onSellRedirect) {
        onSellRedirect([{
          productId: returnProductId,
          name: selectedProd.name,
          barcode: selectedProd.barcode,
          quantity: returnQty,
          salePrice: selectedProd.salePrice,
          costPrice: selectedProd.costPrice
        }], returnEmployee.trim());
      }

      // Reset parameters
      setSelectedOutstanding(null);
      setReturnEmployee('');
      setReturnProductId('');
      setReturnQty(1);
      setCustomReturnReason('');
      setReturnErrorStatus('');
      return;
    }

    // Call upstream return handler
    if (onEmployeeReturn) {
      onEmployeeReturn(returnItems, returnEmployee.trim(), returnDept, finalReturnReason);
    }

    // Show success return modal
    setConfirmedReturn({
      id: 'ret_' + Math.floor(Math.random() * 1000000).toString(),
      items: [{
        productId: returnProductId,
        name: selectedProd.name,
        barcode: selectedProd.barcode,
        quantity: returnQty
      }],
      employee: returnEmployee.trim(),
      department: returnDept,
      reason: finalReturnReason,
      timestamp: new Date().toISOString()
    });

    // Reset parameters
    setSelectedOutstanding(null);
    setReturnEmployee('');
    setReturnProductId('');
    setReturnQty(1);
    setCustomReturnReason('');
    setReturnErrorStatus('');
  };

  // Copy procurement memo template to clipboard
  const handleCopyMemo = (product: Product) => {
    const memo = `=== PROCUREMENT REQUISITION MEMO ===\nGenerated: ${new Date().toLocaleString()}\nProduct Category: ${product.category}\nProduct Description: ${product.name}\nSKU Barcode Code: ${product.barcode}\nCurrent Physical Count: ${product.quantity} units\nReorder Trigger Point: ${product.minStockThreshold} units\nStatus: ${product.quantity <= 0 ? 'CRITICAL OUT OF STOCK' : 'LOW STOCK RUNNING OUT'}\nAction requested: Place replenishment order for inventory safety minimum levels.`;
    navigator.clipboard.writeText(memo);
    setCopiedId(product.id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  // Export filtered records stream to downloadable CSV spreadsheet
  const exportToCSV = () => {
    const csvHeader = ["Log Entry ID", "Timestamp", "Barcode / SKU Code", "Product Name", "Inventory Action Type", "Quantity Delta", "Authorized Staff/Recipient", "Department Section", "Allocation Project Reason"];
    const csvRows = [csvHeader];

    filteredRecords.forEach((log) => {
      const parsed = parseTakeoutNote(log.notes, log.employeeName);
      const originalProduct = products.find(p => p.id === log.productId);
      const barcode = originalProduct ? originalProduct.barcode : 'N/A';
      
      csvRows.push([
        log.id,
        new Date(log.timestamp).toLocaleString(),
        barcode,
        log.productName,
        log.type,
        log.delta.toString(),
        parsed.employee,
        parsed.department,
        parsed.reason
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + csvRows.map(row => row.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `RH_Employee_Takeout_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick stats math summaries
  const totalTakenEventsCount = filteredRecords.filter(r => r.type === 'STOCK_OUT').length;
  const totalReturnEventsCount = filteredRecords.filter(r => r.type === 'STOCK_IN').length;
  const totalOutstandingUnitsSum = outstandingAllocations.reduce((sum, item) => sum + item.quantity, 0);
  
  // Determine most active department for allocation
  const deptFreq: Record<string, number> = {};
  filteredRecords.forEach(log => {
    const p = parseTakeoutNote(log.notes, log.employeeName);
    deptFreq[p.department] = (deptFreq[p.department] || 0) + 1;
  });
  let topDepartment = 'N/A';
  let topDeptCount = 0;
  Object.entries(deptFreq).forEach(([dept, count]) => {
    if (count > topDeptCount) {
      topDeptCount = count;
      topDepartment = dept;
    }
  });

  return (
    <div className="space-y-5" id="employee-take-container">
      
      {/* Upper header segment matching bento style */}
      <header className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
            <UserCheck size={20} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-800 uppercase">Employee checkout & display control panel</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Internal laboratory setups, workstation allocation, low-stock warnings & returns</p>
          </div>
        </div>

        {/* Quad navigation tabs toggle */}
        <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-xl gap-1 max-w-full border border-slate-200 shadow-3xs">
          <button
            onClick={() => { setActiveSubTab('checkout'); setErrorStatus(''); }}
            className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 uppercase tracking-wide ${
              activeSubTab === 'checkout' 
                ? 'bg-white text-slate-800 shadow-xs border border-slate-200/50' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers size={13} />
            Withdraw Stocks
          </button>
          
          <button
            onClick={() => { setActiveSubTab('return'); setReturnErrorStatus(''); }}
            className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 uppercase tracking-wide ${
              activeSubTab === 'return' 
                ? 'bg-white text-emerald-700 shadow-xs border border-emerald-250' 
                : 'text-slate-500 hover:text-emerald-600'
            }`}
            id="btn-allocation-returns"
          >
            <Undo2 size={13} />
            Returns Portal
            {outstandingAllocations.length > 0 && (
              <span className="bg-emerald-100 text-emerald-800 rounded-full px-1.5 py-0.2 text-[9px] font-black">
                {outstandingAllocations.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('lowstock')}
            className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 uppercase tracking-wide ${
              activeSubTab === 'lowstock' 
                ? 'bg-amber-100/75 text-amber-900 shadow-xs border border-amber-200/40' 
                : 'text-slate-500 hover:text-amber-700'
            }`}
          >
            <TrendingDown size={13} />
            Low Stock Alerts
            {lowStockProducts.length > 0 && (
              <span className="bg-amber-500 text-white rounded-full px-1.5 py-0.2 text-[9px] font-black">
                {lowStockProducts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('ledger')}
            className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 uppercase tracking-wide ${
              activeSubTab === 'ledger' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
            id="btn-allocation-ledger"
          >
            <Clock size={13} />
            Allocation Log
          </button>
        </div>
      </header>

      {/* RENDER NEW CHECKOUT CART SUB-TAB */}
      {activeSubTab === 'checkout' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Left Side: Product Picker Index Table (7 columns) */}
          <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm tracking-tight">Select Items to Take</h3>
                <p className="text-[11px] text-slate-400">Click a product card or row to add to checkout cart</p>
              </div>

              {/* Quick Search Bar */}
              <div className="relative max-w-sm w-full">
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Product, SKU, category..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[500px] border border-slate-150/60 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] tracking-wider font-extrabold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">SKU Code</th>
                    <th className="p-3 text-center">Available Stock</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {matchingProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 font-mono italic">
                        No matching registered products available for checkout.
                      </td>
                    </tr>
                  ) : (
                    matchingProducts.map((p) => {
                      const isLow = p.quantity <= p.minStockThreshold;
                      const isOut = p.quantity <= 0;
                      
                      return (
                        <tr 
                          key={p.id} 
                          className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${isOut ? 'opacity-60 bg-slate-50/20' : ''}`}
                          onClick={() => !isOut && addToCart(p)}
                        >
                          <td className="p-3 font-semibold text-slate-800">
                            <div>
                              <span className="block text-slate-800 font-bold">{p.name}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{p.category}</span>
                            </div>
                          </td>
                          <td className="p-3 font-mono text-slate-500 text-[10px]">{p.barcode}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-block leading-none ${
                              isOut 
                                ? 'bg-rose-100 text-rose-700' 
                                : isLow 
                                  ? 'bg-amber-100 text-amber-700 font-bold' 
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {isOut ? 'OUT OF STOCK' : isLow ? `LOW: ${p.quantity} units` : `IN STOCK: ${p.quantity} units`}
                            </span>
                          </td>
                          <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              disabled={isOut}
                              onClick={() => addToCart(p)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold px-3 py-1.5 rounded-xl text-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                            >
                              + ADD TO LIST
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Side: Certification Credentials Form & List (5 columns) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Cart item selection panel */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                <h3 className="font-extrabold text-slate-800 text-sm tracking-tight flex items-center gap-1.5">
                  <Briefcase size={16} className="text-emerald-600" />
                  Items Selected ({cart.reduce((a, c) => a + c.quantity, 0)})
                </h3>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-rose-600 hover:text-rose-800 text-[11px] font-bold uppercase tracking-wider"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Selected items array */}
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 mb-4">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center">
                    <Briefcase size={24} className="text-slate-350 mb-1.5" />
                    <p className="text-xs font-bold">Withdrawal list is empty</p>
                    <p className="text-[10px] text-slate-400">Click items on the left to add them here</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div 
                      key={item.productId}
                      className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-2 shadow-3xs"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-slate-700 block truncate">{item.name}</span>
                        <span className="text-[10px] font-medium text-slate-400 font-mono">{item.barcode}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-3xs">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.productId, -1)}
                            className="p-1 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-lg"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-8 text-center text-xs font-mono font-extrabold">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.productId, 1)}
                            className="p-1 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-lg"
                          >
                            <Plus size={11} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-xl hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Verification Form */}
              <form onSubmit={handleWithdrawalSubmit} className="space-y-3.5 border-t border-slate-100 pt-4">
                {/* Browser Auto-saved Draft Restoration Notification Alert Banner */}
                {(employeeName !== '' || cart.length > 0 || customReason !== '') && (
                  <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-2.5 text-[10px] text-emerald-800 flex items-center justify-between font-sans text-left">
                    <span className="font-semibold flex items-center gap-1.5 leading-normal">
                      <Sparkles size={12} className="text-emerald-600 shrink-0" />
                      Restored pending withdrawal checkout draft.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEmployeeName('');
                        setCustomReason('');
                        setCart([]);
                        localStorage.removeItem('employee_takeout_cart');
                        localStorage.removeItem('employee_takeout_employeeName');
                        localStorage.removeItem('employee_takeout_customReason');
                      }}
                      className="text-emerald-700 hover:text-emerald-950 font-extrabold underline cursor-pointer shrink-0 ml-2 uppercase text-[9px]"
                    >
                      Clear Draft
                    </button>
                  </div>
                )}

                {/* Action Mode Choice */}
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 text-left">
                    Select Cart Option *
                  </label>
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setActionType('sell')}
                      className={`py-2 rounded-lg text-[10px] font-black transition-all uppercase tracking-wide flex flex-col items-center justify-center gap-1 ${
                        actionType === 'sell'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                      }`}
                      id="opt-take-sell"
                    >
                      <ShoppingCart size={14} />
                      Sell Option
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionType('return')}
                      className={`py-2 rounded-lg text-[10px] font-black transition-all uppercase tracking-wide flex flex-col items-center justify-center gap-1 ${
                        actionType === 'return'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                      }`}
                      id="opt-take-return"
                    >
                      <Undo2 size={14} />
                      Return Option
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionType('takeout')}
                      className={`py-2 rounded-lg text-[10px] font-black transition-all uppercase tracking-wide flex flex-col items-center justify-center gap-1 ${
                        actionType === 'takeout'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                      }`}
                      id="opt-take-checkout"
                    >
                      <Layers size={14} />
                      Take Option
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 text-left">
                    Employee Full Name *
                  </label>
                  <div className="relative text-left">
                    <UserCheck size={14} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={employeeName}
                      onChange={(e) => setEmployeeName(e.target.value)}
                      placeholder="E.g., Sarah Jenkins"
                      className="w-full text-xs border border-slate-200 pl-9 pr-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-left">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                      Department *
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full text-xs border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-slate-700"
                    >
                      {DEPARTMENTS.map((dept, i) => (
                        <option value={dept} key={i}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                      {actionType === 'sell' ? 'Sales Reason *' : actionType === 'return' ? 'Return Reason *' : 'Withdrawal Reason *'}
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full text-xs border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-slate-700"
                    >
                      {actionType === 'return' ? (
                        RETURN_REASONS.map((r, i) => (
                          <option value={r} key={i}>{r}</option>
                        ))
                      ) : (
                        REASONS.map((r, i) => (
                          <option value={r} key={i}>{r}</option>
                        ))
                      )}
                      <option value="Other">Other (Write Custom Reason)</option>
                    </select>
                  </div>
                </div>

                {reason === "Other" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1 text-left"
                  >
                    <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">
                      Describe your custom reason *
                    </label>
                    <input
                      type="text"
                      required
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder={
                        actionType === 'sell' 
                          ? "E.g., Customer POS special order sale" 
                          : actionType === 'return' 
                            ? "E.g., Temporary display unit re-stock" 
                            : "Why are you taking these items?"
                      }
                      className="w-full text-xs border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                    />
                  </motion.div>
                )}

                {errorStatus && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold rounded-xl flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                    <span>{errorStatus}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={cart.length === 0 || !employeeName.trim()}
                  className={`w-full mt-2 py-3 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl transition-all shadow-md tracking-widest uppercase cursor-pointer ${
                    actionType === 'sell'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10'
                      : actionType === 'return'
                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/10'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10'
                  }`}
                  id="btn-process-checkout-action"
                >
                  {actionType === 'sell' 
                    ? 'SEND TO SALES PORTAL (POS)' 
                    : actionType === 'return' 
                      ? 'RESTOCK ITEMS & INCREASE INVENTORY' 
                      : 'AUTHORIZE WITHDRAWAL & DETACH STOCK'}
                </button>
              </form>
            </div>
          </div>

        </div>
      )}

      {/* RENDER RETURN FROM DISPLAY TAB */}
      {activeSubTab === 'return' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Outstanding Inventory list currently on loan/display */}
          <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm tracking-tight">Currently Outstanding on Display/Lab</h3>
                <p className="text-[11px] text-slate-400">Select an item below to automatically fill the return form</p>
              </div>

              {/* Quick Search across loans */}
              <div className="relative max-w-sm w-full">
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={returnSearchQuery}
                  onChange={(e) => setReturnSearchQuery(e.target.value)}
                  placeholder="Search outstanding staff/product..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700"
                />
                {returnSearchQuery && (
                  <button 
                    onClick={() => setReturnSearchQuery('')}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[500px] border border-slate-150/60 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] tracking-wider font-extrabold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Staff Employee</th>
                    <th className="p-3">Allocated Product</th>
                    <th className="p-3 text-center">Outstanding Qty</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredOutstanding.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 font-mono italic">
                        No outstanding allocations/display stock items found. All items currently returned!
                      </td>
                    </tr>
                  ) : (
                    filteredOutstanding.map((item) => (
                      <tr 
                        key={item.id} 
                        onClick={() => handleSelectOutstandingForReturn(item)}
                        className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${
                          selectedOutstanding?.id === item.id ? 'bg-emerald-50/50 hover:bg-emerald-50' : ''
                        }`}
                      >
                        <td className="p-3">
                          <span className="font-extrabold text-slate-800 block">{item.employee}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{item.department}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-slate-800 block">{item.productName}</span>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 font-mono">
                            <span>{item.barcode}</span>
                            {item.timestamp ? (
                              <>
                                <span>•</span>
                                <span className="text-slate-500 font-sans font-bold flex items-center gap-1 text-[9px] uppercase tracking-wide bg-amber-50 border border-amber-200/50 px-1.5 py-0.2 rounded">
                                  <Clock size={10} className="text-slate-500" />
                                  Out: {new Date(item.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="bg-amber-100 text-amber-900 border border-amber-200 font-mono font-black px-2.5 py-1 rounded-md text-[10px]">
                            {item.quantity} units
                          </span>
                        </td>
                        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => handleSelectOutstandingForReturn(item)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold px-2.5 py-1.5 rounded-xl text-[10px] transition-all uppercase"
                              title="Select to return items back to storage"
                            >
                              Return
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectOutstandingForSale(item)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold px-2.5 py-1.5 rounded-xl text-[10px] transition-all uppercase flex items-center gap-1"
                              title="Mark this taken product as Sold via POS"
                            >
                              <ShoppingCart size={11} />
                              Mark Sold
                            </button>
                            {onDeleteOutstanding && (
                              <button
                                type="button"
                                onClick={() => setDeletingOutstanding(item)}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold px-2 py-1.5 rounded-xl text-[10px] transition-all uppercase flex items-center gap-1"
                                title="Delete outstanding display allocation and restore storage stock"
                              >
                                <Trash2 size={11} />
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
          </div>

          {/* Form to process Return Check-in or Conversion to Sold */}
          <div className="lg:col-span-12 xl:col-span-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm tracking-tight flex items-center gap-1.5">
                    {returnMode === 'sold' ? (
                      <>
                        <ShoppingCart size={16} className="text-emerald-600 animate-pulse" />
                        <span className="text-emerald-700 font-extrabold">Convert Takeaway to Sale</span>
                      </>
                    ) : (
                      <>
                        <Undo2 size={16} className="text-emerald-600" />
                        <span>Process Return Check-In</span>
                      </>
                    )}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {returnMode === 'sold' 
                      ? 'Process payment conversion and log checkout as Sold item' 
                      : 'Re-enter display units back into available storage'}
                  </p>
                </div>
                {selectedOutstanding && (
                  <button 
                    onClick={() => {
                      setSelectedOutstanding(null);
                      setReturnEmployee('');
                      setReturnProductId('');
                      setReturnQty(1);
                      setReturnMode('restock');
                    }}
                    className="text-xs font-extrabold text-rose-600 hover:text-rose-800 uppercase"
                  >
                    Reset Form
                  </button>
                )}
              </div>

              {/* Action Goal Mode Selector */}
              <div className="grid grid-cols-2 bg-slate-100 p-1.5 rounded-xl text-center border border-slate-200/50 gap-1 shadow-3xs">
                <button
                  type="button"
                  onClick={() => setReturnMode('restock')}
                  className={`py-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1.5 uppercase tracking-wide ${
                    returnMode === 'restock'
                      ? 'bg-white text-emerald-700 shadow-xs border border-emerald-250'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Undo2 size={12} className={returnMode === 'restock' ? 'text-emerald-600' : ''} />
                  Return To Stock
                </button>
                <button
                  type="button"
                  onClick={() => setReturnMode('sold')}
                  className={`py-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1.5 uppercase tracking-wide ${
                    returnMode === 'sold'
                      ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                      : 'text-slate-500 hover:text-emerald-700'
                  }`}
                >
                  <ShoppingCart size={12} className={returnMode === 'sold' ? 'text-white' : ''} />
                  Convert to Sold
                </button>
              </div>

              {selectedOutstanding && (
                <div className={`p-3 border text-xs rounded-xl space-y-1 shadow-3xs ${
                  returnMode === 'sold' 
                    ? 'bg-emerald-50/70 border-emerald-100 text-emerald-950' 
                    : 'bg-emerald-50/75 border-emerald-150 text-emerald-950'
                }`}>
                  <span className={`font-extrabold text-[10px] uppercase block tracking-wider ${
                    returnMode === 'sold' ? 'text-emerald-600' : 'text-emerald-650'
                  }`}>
                    {returnMode === 'sold' ? 'Converting Taken Reference to Sale:' : 'Processing Outstanding Reference:'}
                  </span>
                  <p className="font-bold">Staff: <span className="text-slate-800 font-black">{selectedOutstanding.employee}</span></p>
                  <p className="font-medium">Item: <span className="text-slate-800 font-bold">{selectedOutstanding.productName}</span></p>
                  <p className="text-[11px] text-slate-500 font-mono">Maximum conversion size: {selectedOutstanding.quantity} units</p>
                </div>
              )}

              <form onSubmit={handleReturnSubmit} className="space-y-4">
                {/* Browser Auto-saved Draft Restoration Notification Alert Banner */}
                {(returnEmployee !== '' || returnProductId !== '' || customReturnReason !== '') && (
                  <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-2.5 text-[10px] text-emerald-800 flex items-center justify-between font-sans text-left">
                    <span className="font-semibold flex items-center gap-1.5 leading-normal">
                      <Sparkles size={12} className="text-emerald-600 shrink-0" />
                      Restored pending return check-in draft.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setReturnEmployee('');
                        setReturnDept(DEPARTMENTS[0]);
                        setReturnProductId('');
                        setReturnQty(1);
                        setReturnReason(RETURN_REASONS[0]);
                        setCustomReturnReason('');
                        setSelectedOutstanding(null);
                        localStorage.removeItem('employee_return_selectedOutstanding');
                        localStorage.removeItem('employee_return_employee');
                        localStorage.removeItem('employee_return_dept');
                        localStorage.removeItem('employee_return_productId');
                        localStorage.removeItem('employee_return_qty');
                        localStorage.removeItem('employee_return_reason');
                        localStorage.removeItem('employee_return_customReason');
                        localStorage.removeItem('employee_return_mode');
                      }}
                      className="text-emerald-750 hover:text-emerald-950 font-extrabold underline cursor-pointer shrink-0 ml-2 uppercase text-[9px]"
                    >
                      Clear Draft
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                    Employee Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={returnEmployee}
                    onChange={(e) => setReturnEmployee(e.target.value)}
                    placeholder="Enter staff full name..."
                    className="w-full text-xs border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                      Department Segment
                    </label>
                    <select
                      value={returnDept}
                      onChange={(e) => setReturnDept(e.target.value)}
                      className="w-full text-xs border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-slate-700"
                    >
                      {DEPARTMENTS.map((dept, i) => (
                        <option value={dept} key={i}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                      Check-In Product *
                    </label>
                    <select
                      value={returnProductId}
                      onChange={(e) => {
                        setReturnProductId(e.target.value);
                        const outstandingFound = outstandingAllocations.find(
                          o => o.productId === e.target.value && o.employee.toLowerCase() === returnEmployee.toLowerCase()
                        );
                        if (outstandingFound) {
                          setReturnQty(outstandingFound.quantity);
                        } else {
                          setReturnQty(1);
                        }
                      }}
                      required
                      className="w-full text-xs border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-slate-700"
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.name} ({p.barcode})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                      Return Quantity *
                    </label>
                    <div className="flex items-center border border-slate-200 rounded-xl bg-white p-1">
                      <button
                        type="button"
                        onClick={() => setReturnQty(q => Math.max(1, q - 1))}
                        className="p-1.5 hover:bg-slate-50 text-slate-500 rounded-lg"
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        required
                        value={returnQty}
                        onChange={(e) => setReturnQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full text-center text-xs font-mono font-black focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedOutstanding && returnQty >= selectedOutstanding.quantity) {
                            return;
                          }
                          setReturnQty(q => q + 1);
                        }}
                        className="p-1.5 hover:bg-slate-50 text-slate-500 rounded-lg"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                      {returnMode === 'sold' ? 'Conversion Status Category' : 'Return Status Group'}
                    </label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full text-xs border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-slate-700"
                    >
                      {returnMode === 'sold' ? (
                        <>
                          <option value="Customer Direct Buy">Customer Direct Buy</option>
                          <option value="Corporate Project Sale">Corporate Project Sale</option>
                          <option value="Employee Purchase">Employee Personal Purchase</option>
                          <option value="Other">Other (Custom explanation)</option>
                        </>
                      ) : (
                        <>
                          {RETURN_REASONS.map((r, i) => (
                            <option value={r} key={i}>{r}</option>
                          ))}
                          <option value="Other">Other (Custom context)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {returnReason === "Other" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">
                      {returnMode === 'sold' ? 'Describe Custom Conversion Details *' : 'Describe Custom Return Details *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={customReturnReason}
                      onChange={(e) => setCustomReturnReason(e.target.value)}
                      placeholder="Comment..."
                      className="w-full text-xs border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                    />
                  </motion.div>
                )}

                {returnErrorStatus && (
                  <div className="p-3 bg-rose-50 border border-rose-150 text-rose-800 text-[11px] font-bold rounded-xl flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0 text-rose-600" />
                    <span>{returnErrorStatus}</span>
                  </div>
                )}

                {!onEmployeeReturn && (
                  <div className="p-3 bg-amber-50 border border-amber-150/60 text-amber-800 text-[10px] font-medium rounded-xl">
                    Note: Complete return integration is still saving to active cache.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!returnEmployee.trim() || !returnProductId}
                  className={`w-full py-3 text-white text-xs font-black rounded-xl transition-all shadow-md tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed ${
                    returnMode === 'sold'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'
                  }`}
                >
                  {returnMode === 'sold' 
                    ? 'CONVERT TO SOLD & REDIRECT TO POS' 
                    : 'PROCESS CHECK-IN & RE-STOCK UNIT'}
                </button>
              </form>
            </div>
          </div>

        </div>
      )}

      {/* RENDER DEDICATED LOW STOCK ALERTS TRACKING TAB */}
      {activeSubTab === 'lowstock' && (
        <div className="space-y-4" id="low-stock-tracking-tab">
          
          {/* Quick Metrics of Low stock */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200/50 shadow-3xs flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-500/10 text-rose-600 rounded-lg flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div>
                <span className="text-[10px] text-rose-600/80 font-black uppercase tracking-wider block">Critical Empty (0 Count)</span>
                <span className="text-xl font-black text-rose-950">{outOfStockProducts.length} product lines</span>
              </div>
            </div>

            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/50 shadow-3xs flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 text-amber-600 rounded-lg flex items-center justify-center">
                <TrendingDown size={20} />
              </div>
              <div>
                <span className="text-[10px] text-amber-700/80 font-black uppercase tracking-wider block">Below Safety Threshold</span>
                <span className="text-xl font-black text-amber-950">{warningStockProducts.length} product lines</span>
              </div>
            </div>

            <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-200/30 shadow-3xs flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 rounded-lg flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <span className="text-[10px] text-emerald-700/80 font-black uppercase tracking-wider block">Fully Stocked & Optimal</span>
                <span className="text-xl font-black text-slate-800">{products.length - lowStockProducts.length} product lines</span>
              </div>
            </div>

          </div>

          {/* Low stock Alert List */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm tracking-tight flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                Durable Procurement & Stock Safety Levels
              </h3>
              <p className="text-[11px] text-slate-400">These specific items currently fall short of designated min safe stock. Draft requisition memos for ordering instantly.</p>
            </div>

            <div className="border border-slate-200/70 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] tracking-wider font-extrabold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Category</th>
                    <th className="p-3">Product Description</th>
                    <th className="p-3">SKU Barcode</th>
                    <th className="p-3 text-center">Current Stock</th>
                    <th className="p-3 text-center">Safety Threshold</th>
                    <th className="p-3 text-center">Replenish Progress</th>
                    <th className="p-3 text-right">Reorder Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {lowStockProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400 font-mono italic">
                        ✅ Excellent! All registered physical inventory holds exceed safety thresholds.
                      </td>
                    </tr>
                  ) : (
                    lowStockProducts.map((p) => {
                      const isOOS = p.quantity <= 0;
                      // ratio calculation safely
                      const percent = p.minStockThreshold > 0 
                        ? Math.min(100, Math.round((p.quantity / p.minStockThreshold) * 100))
                        : 0;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/40 text-[11px]">
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-100 text-slate-500 uppercase tracking-tight">
                              {p.category}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-800">
                            {p.name}
                          </td>
                          <td className="p-3 font-mono text-slate-500 font-medium">
                            {p.barcode}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              isOOS ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {p.quantity} units
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-500">
                            {p.minStockThreshold} units
                          </td>
                          <td className="p-3">
                            <div className="w-full max-w-[120px] mx-auto space-y-1">
                              <div className="flex justify-between items-center text-[9px] font-mono font-bold text-slate-400">
                                <span>{p.quantity} / {p.minStockThreshold}</span>
                                <span>{percent}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${isOOS ? 'bg-rose-500' : 'bg-amber-500'}`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleCopyMemo(p)}
                              className="px-2.5 py-1.5 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 text-emerald-700 rounded-lg text-[9px] font-black transition-all flex items-center justify-end gap-1.5 ml-auto uppercase tracking-wider"
                            >
                              {copiedId === p.id ? (
                                <>
                                  <Check size={11} className="text-emerald-500" />
                                  Copied Memo!
                                </>
                              ) : (
                                <>
                                  <Copy size={11} />
                                  Copy Reorder Memo
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RENDER HISTORICAL ALLOCATION RECORDS LEDGER SUB-TAB */}
      {activeSubTab === 'ledger' && (
        <div className="space-y-5" id="allocation-ledger-tab">
          
          {/* Quick Recap Metric Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <FileText size={18} />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">Withdrawn Events</span>
                <span className="text-lg font-black text-slate-800">{totalTakenEventsCount} runs</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <Undo2 size={18} />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">Returns Checked back</span>
                <span className="text-lg font-black text-slate-800">{totalReturnEventsCount} items</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                <Briefcase size={18} />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">Outstanding Display Units</span>
                <span className="text-lg font-black text-slate-800">{totalOutstandingUnitsSum} units out</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
                <UserCheck size={18} />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">High Allocation Dept</span>
                <span className="text-xs font-black text-slate-800 truncate block max-w-[150px]" title={topDepartment}>
                  {topDepartment}
                </span>
              </div>
            </div>

          </div>

          {/* Ledger Advanced Filtering Panel */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              
              {/* Filter 1: Text Search Bar */}
              <div className="md:col-span-5 relative">
                <Search size={14} className="absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={ledgerSearchQuery}
                  onChange={(e) => {
                    setLedgerSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Query employee name, reason, product line code..."
                  className="w-full bg-slate-50 border border-slate-200 text-xs pl-9 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700"
                />
              </div>

              {/* Filter 2: Department Selector */}
              <div className="md:col-span-3">
                <select
                  value={filterDepartment}
                  onChange={(e) => {
                    setFilterDepartment(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-slate-700"
                >
                  <option value="All">All Departments</option>
                  {DEPARTMENTS.map((dept, i) => (
                    <option value={dept} key={i}>Dept: {dept}</option>
                  ))}
                </select>
              </div>

              {/* Filter 3: Employee Selector */}
              <div className="md:col-span-2">
                <select
                  value={filterEmployee}
                  onChange={(e) => {
                    setFilterEmployee(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs border border-slate-200 p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-slate-700"
                >
                  <option value="All">All Staff Members</option>
                  {uniqueEmployees.map((emp, i) => (
                    <option value={emp} key={i}>Staff: {emp}</option>
                  ))}
                </select>
              </div>

              {/* Action 4: Export Ledger to spreadsheet CSV */}
              <div className="md:col-span-2">
                <button
                  onClick={exportToCSV}
                  disabled={filteredRecords.length === 0}
                  className="w-full py-2.5 border border-slate-200 hover:border-emerald-250 hover:bg-emerald-50/20 text-slate-600 hover:text-emerald-700 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                >
                  <FileSpreadsheet size={13} />
                  Export Sheet
                </button>
              </div>

            </div>
          </div>

          {/* Allocation Logs Primary Table Layout */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] tracking-wider font-extrabold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Date & Time Log</th>
                    <th className="p-3">Reference SKU</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3 text-center">Type Action</th>
                    <th className="p-3 text-center">Quantity Delta</th>
                    <th className="p-3">Authorized Employee</th>
                    <th className="p-3">Department Segment</th>
                    <th className="p-3">Context / Purpose Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400 font-mono italic">
                        No historical employee takeout / return records found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((log) => {
                      const parsed = parseTakeoutNote(log.notes, log.employeeName);
                      const originalProduct = products.find(p => p.id === log.productId);
                      const barcode = originalProduct ? originalProduct.barcode : 'N/A';
                      const isReturn = log.notes.startsWith('Returned by');
                      
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/40 text-[11px] transition-colors leading-relaxed">
                          <td className="p-3 whitespace-nowrap text-slate-400 font-mono flex items-center gap-1">
                            <Clock size={11} className="text-slate-350" />
                            {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="p-3 font-mono text-slate-500 font-medium text-[10px]">
                            {barcode}
                          </td>
                          <td className="p-3 font-bold text-slate-850">
                            {log.productName}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${
                              isReturn 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {isReturn ? 'CHECK-IN' : 'STOCK-OUT'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`font-mono font-extrabold px-2 py-0.5 rounded-md ${
                              isReturn 
                                ? 'text-emerald-700 bg-emerald-50/30' 
                                : 'text-rose-700 bg-rose-50/30'
                            }`}>
                              {isReturn ? `+${log.delta}` : `-${Math.abs(log.delta)}`} units
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 font-extrabold flex items-center gap-1">
                            <UserCheck size={11} className={isReturn ? "text-emerald-500" : "text-emerald-600"} />
                            {parsed.employee}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700 uppercase">
                              {parsed.department}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 font-medium max-w-[200px] truncate" title={parsed.reason}>
                            {parsed.reason}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Footer block */}
            {totalPages > 1 && (
              <div className="bg-slate-50 px-4 py-3 border-t border-slate-150 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">
                  Showing Page <strong className="text-slate-700">{currentPage}</strong> of <strong className="text-slate-700">{totalPages}</strong> ({filteredRecords.length} records)
                </span>
                
                <div className="flex gap-1.5 font-mono">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1 px-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 disabled:opacity-40 select-none hover:bg-white bg-slate-50 transition-colors"
                  >
                    PREV
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1 px-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 disabled:opacity-40 select-none hover:bg-white bg-slate-50 transition-colors"
                  >
                    NEXT
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmed Takeout Modal Receipt Overlay */}
      <AnimatePresence>
        {confirmedTake && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 relative"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <button 
                onClick={() => setConfirmedTake(null)}
                className="absolute right-4 top-4 p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <X size={16} />
              </button>

              <div className="text-center space-y-2 pb-4 border-b border-slate-100 flex flex-col items-center justify-center">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Withdrawal Approved</h3>
                <span className="text-[10px] font-mono text-slate-400">TKT-ID: {confirmedTake.id}</span>
              </div>

              <div className="my-4 space-y-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl space-y-2 border border-slate-150">
                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase text-[9px] font-extrabold tracking-wider">Authorized Staff</span>
                    <span className="font-extrabold text-slate-800">{confirmedTake.employee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase text-[9px] font-extrabold tracking-wider">Department</span>
                    <span className="font-bold text-slate-700">{confirmedTake.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase text-[9px] font-extrabold tracking-wider">Project / Reason</span>
                    <span className="font-medium text-slate-700 max-w-[200px] truncate">{confirmedTake.reason}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase text-[9px] font-extrabold tracking-wider">Timestamp Log</span>
                    <span className="font-mono text-slate-600">{new Date(confirmedTake.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Withdrawn Products:</h4>
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                    {confirmedTake.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] p-2 bg-slate-50/50 rounded-lg">
                        <span className="font-bold text-slate-700 max-w-[280px] truncate">{item.name}</span>
                        <span className="font-mono bg-emerald-50 text-emerald-700 rounded-md font-extrabold px-2 py-0.5">
                          -{item.quantity} units
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmedTake(null)}
                className="w-full py-2.5 bg-slate-950 border border-slate-800 text-white hover:bg-slate-900 rounded-xl text-xs font-bold transition-all uppercase tracking-wider"
              >
                Ack and Close Receipt
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmed Return Modal Receipt Overlay */}
      <AnimatePresence>
        {confirmedReturn && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 relative"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <button 
                onClick={() => setConfirmedReturn(null)}
                className="absolute right-4 top-4 p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <X size={16} />
              </button>

              <div className="text-center space-y-2 pb-4 border-b border-slate-100 flex flex-col items-center justify-center">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Return Checked In</h3>
                <span className="text-[10px] font-mono text-slate-400">RET-ID: {confirmedReturn.id}</span>
              </div>

              <div className="my-4 space-y-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl space-y-2 border border-slate-150">
                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase text-[9px] font-extrabold tracking-wider">Returning Staff</span>
                    <span className="font-extrabold text-slate-800">{confirmedReturn.employee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase text-[9px] font-extrabold tracking-wider">Department</span>
                    <span className="font-bold text-slate-700">{confirmedReturn.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase text-[9px] font-extrabold tracking-wider">Audit / Reason</span>
                    <span className="font-medium text-slate-700 max-w-[200px] truncate">{confirmedReturn.reason}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase text-[9px] font-extrabold tracking-wider">Check-in Log</span>
                    <span className="font-mono text-slate-600">{new Date(confirmedReturn.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Restocked Products:</h4>
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                    {confirmedReturn.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] p-2 bg-slate-50/50 rounded-lg">
                        <span className="font-bold text-slate-700 max-w-[280px] truncate">{item.name}</span>
                        <span className="font-mono bg-emerald-100 text-emerald-700 rounded-md font-extrabold px-2 py-0.5">
                          +{item.quantity} units
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmedReturn(null)}
                className="w-full py-2.5 bg-slate-900 border border-slate-800 text-white hover:bg-slate-850 rounded-xl text-xs font-bold transition-all uppercase tracking-wider"
              >
                Ack and Close Receipt
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🗑️ Delete Outstanding Display/Lab Item Confirmation Modal */}
      {deletingOutstanding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in" id="delete-outstanding-confirmation-modal">
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
                  <h3 className="text-xs font-black tracking-wider uppercase">Delete Outstanding Takeout</h3>
                  <p className="text-[10px] text-rose-100 font-mono">Staff: {deletingOutstanding.employee}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setDeletingOutstanding(null)}
                className="p-1 px-2.5 rounded-lg bg-rose-700/50 hover:bg-slate-800 text-white text-[10px] font-bold border border-white/10 uppercase cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="p-6 space-y-4 text-left font-sans">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                You are about to permanently delete the outstanding display/lab allocation of <span className="font-bold text-slate-900 font-mono">"{deletingOutstanding.productName}"</span> assigned to <span className="font-bold text-slate-900">"{deletingOutstanding.employee}"</span> ({deletingOutstanding.department}).
              </p>

              <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-3.5 space-y-2">
                <span className="text-[9px] font-black text-rose-900 uppercase tracking-wider block">Automatic Stock Restoration:</span>
                <div className="py-1.5 flex items-center justify-between text-xs text-slate-700">
                  <span className="font-semibold text-slate-900 truncate max-w-[220px]">{deletingOutstanding.productName}</span>
                  <span className="font-mono text-[10px] text-slate-600">
                    Restoring <span className="font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-sans">+{deletingOutstanding.quantity}</span> units to available inventory
                  </span>
                </div>
                <div className="pt-2 border-t border-rose-100/80 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-500 uppercase text-[9px]">SKU Barcode:</span>
                  <span className="font-mono font-bold text-slate-700">{deletingOutstanding.barcode}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletingOutstanding(null)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteOutstanding) {
                      onDeleteOutstanding(deletingOutstanding.employee, deletingOutstanding.productId, deletingOutstanding.quantity);
                    }
                    if (selectedOutstanding?.id === deletingOutstanding.id) {
                      setSelectedOutstanding(null);
                      setReturnEmployee('');
                      setReturnProductId('');
                      setReturnQty(1);
                    }
                    setDeletingOutstanding(null);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                  id="btn-confirm-delete-outstanding"
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
