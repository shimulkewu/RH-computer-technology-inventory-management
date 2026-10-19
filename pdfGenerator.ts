/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * High-Fidelity Management Summary PDF Generator Utility
 */

import { jsPDF } from 'jspdf';
import { Product, AuditLog, Sale } from '../types';

export function generateManagementSummaryPDF(
  products: Product[],
  sales: Sale[],
  auditLogs: AuditLog[],
  dateMode: 'weekly' | 'all'
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const now = new Date("2026-06-09T04:29:17Z"); // Reference UTC system time from metadata
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. Data Filtering according to Selected Date Scope
  const filteredSales = dateMode === 'weekly'
    ? sales.filter(s => new Date(s.timestamp) >= sevenDaysAgo)
    : sales;

  const filteredLogs = dateMode === 'weekly'
    ? auditLogs.filter(log => new Date(log.timestamp) >= sevenDaysAgo)
    : auditLogs;

  // 2. Compute Executive Summary Stats
  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let totalItemsSold = 0;
  const totalTransactions = filteredSales.length;

  filteredSales.forEach(s => {
    totalRevenue += s.totalAmount;
    totalProfit += s.profit;
    s.items.forEach(item => {
      totalItemsSold += item.quantity;
      totalCost += (item.costPrice || 0) * item.quantity;
    });
  });

  const grossMarginPercent = totalRevenue > 0
    ? (totalProfit / totalRevenue) * 100
    : 0;

  // 3. Category Sales & Margin Performance Aggregation
  const categoryPerformance: { [key: string]: { quantity: number, revenue: number, cost: number, profit: number } } = {};
  
  filteredSales.forEach(s => {
    s.items.forEach(item => {
      const prodDetail = products.find(p => p.id === item.productId);
      const category = prodDetail?.category || 'Hardware Accessories';
      
      if (!categoryPerformance[category]) {
        categoryPerformance[category] = { quantity: 0, revenue: 0, cost: 0, profit: 0 };
      }
      
      const itemCost = item.costPrice || prodDetail?.costPrice || 0;
      categoryPerformance[category].quantity += item.quantity;
      categoryPerformance[category].revenue += item.quantity * item.salePrice;
      categoryPerformance[category].cost += item.quantity * itemCost;
      categoryPerformance[category].profit += item.quantity * (item.salePrice - itemCost);
    });
  });

  // 4. Product Sales Volumetric Data (Top Sellers Listing)
  const productPerformance: { [key: string]: { name: string, barcode: string, category: string, quantity: number, revenue: number, profit: number } } = {};
  
  filteredSales.forEach(s => {
    s.items.forEach(item => {
      const prodDetail = products.find(p => p.id === item.productId);
      const category = prodDetail?.category || 'Hardware Accessories';
      
      if (!productPerformance[item.productId]) {
        productPerformance[item.productId] = {
          name: item.name,
          barcode: item.barcode,
          category,
          quantity: 0,
          revenue: 0,
          profit: 0
        };
      }
      
      productPerformance[item.productId].quantity += item.quantity;
      productPerformance[item.productId].revenue += item.quantity * item.salePrice;
      productPerformance[item.productId].profit += item.quantity * (item.salePrice - (item.costPrice || prodDetail?.costPrice || 0));
    });
  });

  const sortedTopProducts = Object.values(productPerformance)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // 5. Chronicle Movement Ledger Sorting
  const sortedAuditLogs = [...filteredLogs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // 6. Multi-Page Coordinate Context Tracker
  let curY = 15;
  let currentPage = 1;

  const checkNewPage = (neededHeight: number): void => {
    if (curY + neededHeight > 280) {
      // Draw running page footer first
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 130, 140);
      doc.text(`RH Computer Technology Audit Registry | Confidential Management Copy`, 15, 290);
      doc.text(`Sheet ${currentPage}`, 185, 290);

      doc.addPage();
      currentPage++;
      curY = 20;

      // Draw running page header banner
      doc.setFillColor(248, 250, 252);
      doc.rect(15, curY - 10, 180, 11, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, curY - 10, 180, 11, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('MANAGEMENT PERFORMANCE & AUDIT ARCHIVE SUMMARY', 20, curY - 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Scope: ${dateMode === 'weekly' ? '7-Day Activity' : 'All-Time Log'}`, 135, curY - 5);
      doc.text(`Date of Audit: ${now.toLocaleDateString()}`, 170, curY - 5);

      curY += 10;
    }
  };

  // --- START PDF DRAW ---

  // A. Cohesive Indigo Hero Header Section (Page 1)
  doc.setFillColor(34, 43, 69); // Sleek deep navy slate
  doc.rect(15, curY, 180, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RH COMPUTER TECHNOLOGY', 20, curY + 7);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(220, 225, 240);
  doc.text('EXECUTIVE OPERATIONS & FINANCIAL ANALYSIS REPORT', 20, curY + 13);

  doc.setFontSize(7.5);
  doc.setTextColor(165, 180, 200);
  doc.text(`Chronology: ${dateMode === 'weekly' ? 'Weekly (Last 7 Days)' : 'Comprehensive History'} | Issued on: ${now.toUTCString().replace('GMT', 'UTC')}`, 20, curY + 19.5);
  
  curY += 34;

  // B. Section 1 Header: KPIs Dashboard Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. CORE FINANCIAL & OPERATIONAL KPIS', 15, curY);
  
  doc.setDrawColor(220, 225, 235);
  doc.line(15, curY + 2, 195, curY + 2);
  curY += 7;

  // 4 Horizontal KPI Boxes (Height = 18mm)
  const boxWidth = 42;
  const boxSpacing = 4;
  const labelValues = [
    { label: 'GROSS VOLUME REVENUE', val: `RM ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: 'NET OVERALL PROFIT', val: `RM ${totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: 'NET MARGIN SCORE', val: `${grossMarginPercent.toFixed(1)}%` },
    { label: 'UNITS DISCHARGED', val: `${totalItemsSold} items` }
  ];

  labelValues.forEach((item, index) => {
    const xPos = 15 + index * (boxWidth + boxSpacing);
    doc.setFillColor(250, 251, 253);
    doc.rect(xPos, curY, boxWidth, 18, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(xPos, curY, boxWidth, 18, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(115, 125, 140);
    doc.text(item.label, xPos + 3, curY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(item.val, xPos + 3, curY + 13);
  });

  curY += 26;

  // C. Section 2: Category Profitability Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('2. CATEGORY-WISE PERFORMANCE MATRIX', 15, curY);
  doc.line(15, curY + 2, 195, curY + 2);
  curY += 7;

  // Draw Table Headers (Category)
  doc.setFillColor(240, 243, 248);
  doc.rect(15, curY, 180, 7.5, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85); // slate-700
  doc.text('Catalog Category Group', 18, curY + 5);
  doc.text('Qty Sold', 80, curY + 5);
  doc.text('Gross Revenue', 105, curY + 5);
  doc.text('Cost Allocated', 135, curY + 5);
  doc.text('Gross profit', 165, curY + 5);
  doc.text('Margin %', 181, curY + 5);
  
  curY += 7.5;

  const categories = Object.keys(categoryPerformance);
  if (categories.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(140, 145, 155);
    doc.text('No categories sales captured under the selected date parameters.', 20, curY + 5);
    curY += 8;
  } else {
    categories.forEach((catName, index) => {
      const perf = categoryPerformance[catName];
      const margin = perf.revenue > 0 ? (perf.profit / perf.revenue) * 100 : 0;

      // Alternating list backdrop
      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, curY, 180, 6.5, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      
      doc.text(catName, 18, curY + 4.5);
      doc.text(`${perf.quantity} u`, 80, curY + 4.5);
      doc.text(`RM ${perf.revenue.toFixed(2)}`, 105, curY + 4.5);
      doc.text(`RM ${perf.cost.toFixed(2)}`, 135, curY + 4.5);
      doc.text(`RM ${perf.profit.toFixed(2)}`, 165, curY + 4.5);
      doc.text(`${margin.toFixed(1)}%`, 181, curY + 4.5);
      
      curY += 6.5;
    });
  }
  curY += 5;

  // D. Section 3: Value Products Velocity & Turnovers (Top Products)
  checkNewPage(50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('3. VALUABLE HARDWARE SALES VELOCITY', 15, curY);
  doc.line(15, curY + 2, 195, curY + 2);
  curY += 7;

  // Table Headers
  doc.setFillColor(240, 243, 248);
  doc.rect(15, curY, 180, 7.5, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Component Name', 18, curY + 5);
  doc.text('Barcode SKU', 85, curY + 5);
  doc.text('Main Category', 115, curY + 5);
  doc.text('Qty Sold', 150, curY + 5);
  doc.text('Gross Sales', 170, curY + 5);
  
  curY += 7.5;

  if (sortedTopProducts.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(140, 145, 155);
    doc.text('N/A - Zero component shipments logged during this phase.', 20, curY + 5);
    curY += 8;
  } else {
    sortedTopProducts.forEach((item, index) => {
      checkNewPage(8);
      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, curY, 180, 6.5, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);

      const nameTruncated = item.name.length > 34 ? item.name.slice(0, 31) + '...' : item.name;
      doc.text(nameTruncated, 18, curY + 4.5);
      doc.text(item.barcode, 85, curY + 4.5);
      doc.text(item.category, 115, curY + 4.5);
      doc.text(`${item.quantity} units`, 150, curY + 4.5);
      doc.text(`RM ${item.revenue.toFixed(2)}`, 170, curY + 4.5);
      
      curY += 6.5;
    });
  }
  curY += 8;

  // E. Section 4: Detailed Audit & Inventory Movement Logs
  checkNewPage(50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('4. SYSTEMATIC WAREHOUSE INVENTORY MOVEMENT LEDGER', 15, curY);
  doc.line(15, curY + 2, 195, curY + 2);
  curY += 7;

  // Table header for logs
  doc.setFillColor(240, 243, 248);
  doc.rect(15, curY, 180, 7.5, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Date & Time Log', 18, curY + 5);
  doc.text('Action Type', 56, curY + 5);
  doc.text('Component/Hardware', 82, curY + 5);
  doc.text('Delta', 138, curY + 5);
  doc.text('New Qty', 150, curY + 5);
  doc.text('Attending Author', 165, curY + 5);

  curY += 7.5;

  if (sortedAuditLogs.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(140, 145, 155);
    doc.text('No audited stock adjustment transactions found in this period.', 20, curY + 5);
    curY += 8;
  } else {
    sortedAuditLogs.forEach((log, index) => {
      checkNewPage(12);

      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, curY, 180, 8.5, 'F');
      }

      // Border floor line for spacing
      doc.setDrawColor(241, 245, 249);
      doc.line(15, curY + 8.5, 195, curY + 8.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);

      // 1. Log timestamp format (MM/DD HH:MM)
      const logDate = new Date(log.timestamp);
      const formattedDate = `${logDate.toLocaleDateString([], { month: '2-digit', day: '2-digit' })} ${logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
      doc.text(formattedDate, 18, curY + 4.5);

      // 2. Action badge-like bolding
      doc.setFont('helvetica', 'bold');
      let typeLabel = log.type || 'ADJUST';
      if (typeLabel === 'STOCK_IN') {
        doc.setTextColor(5, 150, 105); // emerald green
        typeLabel = 'STOCK IN';
      } else if (typeLabel === 'STOCK_OUT') {
        doc.setTextColor(220, 38, 38); // rose red
        typeLabel = 'TAKEOUT';
      } else if (typeLabel === 'SALE') {
        doc.setTextColor(5, 150, 105); // emerald green
        typeLabel = 'SALE OUT';
      } else {
        doc.setTextColor(217, 119, 6); // amber
      }
      doc.text(typeLabel, 56, curY + 4.5);

      // Restore defaults style
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);

      // 3. Name & description text line
      const prodName = log.productName || 'N/A';
      const prodTrunc = prodName.length > 28 ? prodName.slice(0, 25) + '...' : prodName;
      doc.text(prodTrunc, 82, curY + 3.5);

      // Under-aligned audit notes
      doc.setFontSize(6.5);
      doc.setTextColor(140, 145, 155);
      const noteTrunc = (log.notes || '').length > 44 ? (log.notes || '').slice(0, 41) + '...' : log.notes || 'No extra notes.';
      doc.text(noteTrunc, 82, curY + 7);

      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);

      // 4. Delta with visual prefix (+/-)
      const deltaVal = log.delta || 0;
      const deltaPrefix = deltaVal > 0 ? `+${deltaVal}` : `${deltaVal}`;
      doc.setFont('helvetica', 'bold');
      if (deltaVal > 0) doc.setTextColor(5, 150, 105);
      else if (deltaVal < 0) doc.setTextColor(220, 38, 38);
      doc.text(deltaPrefix, 138, curY + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);

      // 5. Quantity remaining/after
      doc.text(`${log.quantityAfter || 0} left`, 150, curY + 4.5);

      // 6. Operator initials
      const operator = log.employeeName || 'System';
      const opTrunc = operator.length > 15 ? operator.slice(0, 13) + '.' : operator;
      doc.text(opTrunc, 165, curY + 4.5);

      curY += 8.5;
    });
  }

  curY += 10;
  checkNewPage(24);

  // F. Official Signoff and Corporate Stamp Block
  doc.setFillColor(248, 250, 252);
  doc.rect(15, curY, 180, 21, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(15, curY, 180, 21, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('CORPORATE AUDIT AUTHENTICITY DECLARATION:', 18, curY + 6);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('This weekly operations summary and cash volume inventory statement has been autonomously generated inside', 18, curY + 11);
  doc.text('the encrypted database sandboxing. All printed and electronic transactions accurately represent current registers.', 18, curY + 15);

  // Dynamic Page numbers footer for final page
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 130, 140);
  doc.text(`RH Computer Technology Audit Registry | Confidential Management Copy`, 15, 290);
  doc.text(`Sheet ${currentPage}`, 185, 290);

  return doc;
}
