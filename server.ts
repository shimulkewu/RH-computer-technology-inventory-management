import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Helper to generate a dynamic local offline report if Gemini is unavailable, has hit rate limits, or is unconfigured
function generateLocalFallbackAnalysis(productsSummary: any[], salesSummary: any[], reason: 'quota' | 'key' | 'generic') {
  const products = productsSummary || [];
  const sales = salesSummary || [];

  // 1. Calculate general stats
  const totalStockUnits = products.reduce((sum, p) => sum + (p.quantity || 0), 0);
  const totalCapitalTiedUp = products.reduce((sum, p) => sum + (p.capitalTiedUp || 0), 0);
  
  const totalSoldUnits = sales.reduce((sum, s) => sum + (s.totalSold || 0), 0);
  const totalRevenue = sales.reduce((sum, s) => sum + (s.revenueGenerated || 0), 0);
  const totalProfit = sales.reduce((sum, s) => sum + (s.profitMargin || 0), 0);
  
  // 2. Category Performance Analysis
  const categoryMap: Record<string, { skus: number, qty: number, capital: number }> = {};
  products.forEach(p => {
    const cat = p.category || "Uncategorized";
    if (!categoryMap[cat]) {
      categoryMap[cat] = { skus: 0, qty: 0, capital: 0 };
    }
    categoryMap[cat].skus += 1;
    categoryMap[cat].qty += (p.quantity || 0);
    categoryMap[cat].capital += (p.capitalTiedUp || 0);
  });
  
  const categoriesList = Object.entries(categoryMap).map(([name, data]) => ({
    name,
    ...data
  })).sort((a, b) => b.capital - a.capital);

  // 3. Top-selling items
  const sortedSales = [...sales].sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0));
  const topSellers = sortedSales.slice(0, 3);

  // 4. Critical restock items (quantity <= threshold)
  const criticalItems = products
    .filter(p => (p.quantity || 0) <= (p.minStockThreshold || 0))
    .sort((a, b) => (a.quantity || 0) - (b.quantity || 0))
    .slice(0, 4);

  // 5. Slower stock (capital tie-up, sold 0 or low)
  const slowMovers = products
    .filter(p => {
      const soldInfo = sales.find(s => s.name === p.name);
      return !soldInfo || (soldInfo.totalSold || 0) === 0;
    })
    .sort((a, b) => (b.capitalTiedUp || 0) - (a.capitalTiedUp || 0))
    .slice(0, 3);

  // Compile recommendations
  const recs: string[] = [];
  if (criticalItems.length > 0) {
    recs.push(`**Immediate Restock Action Required**: Place dynamic purchase orders for critical lines with immediate storage deficit risk, particularly **${criticalItems[0].name}** (current stock is ${criticalItems[0].quantity} units against safety threshold ${criticalItems[0].minStockThreshold}).`);
  } else {
    recs.push(`**Safety Threshold Auditing**: Regularize SKU threshold settings periodically. Stock adequacy is currently 100% stable across active catalog listings.`);
  }

  if (slowMovers.length > 0 && (slowMovers[0].capitalTiedUp || 0) > 200) {
    recs.push(`**Tied-Up Capital Release**: Design clearance bundle promotions or corporate staff purchase programs for slow-moving lines, such as **${slowMovers[0].name}**, which is tieing up **RM ${(slowMovers[0].capitalTiedUp || 0).toFixed(2)}** in dormant asset value.`);
  } else {
    recs.push(`**Storage Density Optimization**: Allocate shelf spacing priority to high-turnover IT accessory units and monitor category distribution metrics monthly.`);
  }

  if (topSellers.length > 0) {
    recs.push(`**Secure Top Seller Margins**: The store's top item **${topSellers[0].name}** generated **RM ${(topSellers[0].revenueGenerated || 0).toFixed(2)}** in sales. Establish standard supplier agreements to negotiate better unit cost prices on this high-turnover line.`);
  }

  recs.push(`**Employee display checkout tracking**: Ensure outstanding loan devices on physical display are returned by cashiers within standard 14-day checkout windows to retain asset integrity.`);

  let warningDisclaimer = '';
  if (reason === 'quota') {
    warningDisclaimer = `⚠️ **Note: High-Fidelity Local Analytics Activated**
*The server-side Gemini AI free quota limit has been temporarily reached (429 Rate Limit). To ensure uninterrupted service, our premium offline rule-based analytic engine has compiled your live data report below.*`;
  } else if (reason === 'key') {
    warningDisclaimer = `⚠️ **Note: High-Fidelity Local Analytics Activated**
*The server-side Gemini API key is not fully configured under Settings. To ensure uninterrupted service, our premium offline rule-based analytic engine has compiled your live data report below.*`;
  } else {
    warningDisclaimer = `⚠️ **Note: High-Fidelity Local Analytics Activated**
*The server-side Gemini AI service experienced a connection exception. To ensure uninterrupted service, our premium offline rule-based analytic engine has compiled your live data report below.*`;
  }

  // Assemble report
  return `${warningDisclaimer}

---

# Store Performance & Efficiency Analysis

## Sales Performance Summary
- **Total Revenue Recorded**: RM ${totalRevenue.toFixed(2)}
- **Total Net Profit Margin**: RM ${totalProfit.toFixed(2)}
- **Total Transaction Items Sold**: ${totalSoldUnits} units
- **Average gross margin yield**: ${totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : "0.0"}%
${categoriesList.length > 0 ? `\n### Category Capital Allocation\n` + categoriesList.map(c => `- **${c.name}**: ${c.skus} active SKUs, containing ${c.qty} total physical units, tieing up **RM ${c.capital.toFixed(2)}** in storage asset value.`).join('\n') : ""}

## Top-Selling Items
${topSellers.length > 0 ? topSellers.map((item, idx) => `${idx + 1}. **${item.name}**: ${item.totalSold} units sold, generating **RM ${item.revenueGenerated.toFixed(2)}** in total store revenue with profit yield of **RM ${item.profitMargin.toFixed(2)}**.`).join('\n') : "No sales transactions registered in the active system snapshot yet."}

## Inventory Efficiency & Potential Waste
### Critical Restock Risks (Stock Below Minimum Threshold)
${criticalItems.length > 0 ? criticalItems.map(item => `- **${item.name}**: Current physical stock is **${item.quantity}** units (Designated safety minimum threshold: ${item.minStockThreshold} units).`).join('\n') : "- *No critical stock deficits detected. All registered lines are currently operating within safe inventory threshold bounds.*"}

### Capital Immobilization Risks (Slow-Moving High Tied-Up Cost)
${slowMovers.length > 0 ? slowMovers.map(item => `- **${item.name}**: **${item.quantity}** units sitting dormant with zero sales recorded. This immobilizes **RM ${item.capitalTiedUp.toFixed(2)}** of capital cost price investment.`).join('\n') : "- *No severe capital immobilization risks detected in the active catalog snapshot.*"}

## Actionable Recommendations
${recs.map(r => `- ${r}`).join('\n')}
`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API Route for Gemini analysis
  app.post("/api/analyze-inventory", async (req, res) => {
    // We declare summaries out of try scope to access them in catch fallback block if needed
    let productsSummary: any[] = [];
    let salesSummary: any[] = [];

    try {
      const { products, sales } = req.body;
      if (!products || !Array.isArray(products)) {
        return res.status(400).json({ error: "Products array is required for analysis." });
      }

      // Prepare a highly concise summary of inventory to avoid excess token usage while retaining high context
      productsSummary = products.map((p) => ({
        name: p.name,
        category: p.category,
        quantity: p.quantity,
        costPrice: p.costPrice,
        salePrice: p.salePrice,
        minStockThreshold: p.minStockThreshold,
        capitalTiedUp: (p.quantity || 0) * (p.costPrice || 0)
      }));

      // Aggregate sales details per product name
      const salesMap: Record<string, { qty: number; revenue: number; profit: number }> = {};
      sales?.forEach((s: any) => {
        s.items?.forEach((item: any) => {
          if (!salesMap[item.name]) {
            salesMap[item.name] = { qty: 0, revenue: 0, profit: 0 };
          }
          const itemQty = item.quantity || 0;
          salesMap[item.name].qty += itemQty;
          salesMap[item.name].revenue += itemQty * (item.salePrice || 0);
          salesMap[item.name].profit += itemQty * ((item.salePrice || 0) - (item.costPrice || 0));
        });
      });

      salesSummary = Object.entries(salesMap).map(([name, stat]) => ({
        name,
        totalSold: stat.qty,
        revenueGenerated: stat.revenue,
        profitMargin: stat.profit
      }));

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Safe UX Fallback: If API key is missing, return fallback local analysis
        const fallbackText = generateLocalFallbackAnalysis(productsSummary, salesSummary, 'key');
        return res.json({ analysis: fallbackText });
      }

      // Initialize Google GenAI client of @google/genai
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const prompt = `You are a professional IT, hardware, and accessories retail analyst. You are analyzing RH Computer Technology store snapshot state.
      
Here is the real data:
1. Store Product Inventory Status:
${JSON.stringify(productsSummary, null, 2)}

2. Aggregated Store Sales Snapshot:
${JSON.stringify(salesSummary, null, 2)}

Task:
Generate a summarized textual performance and efficiency analysis based only on this actual statistics dataset.
Please render format with clean, high-contrast Markdown headers.
Structure the report as follows:
- **Sales Performance Summary**: Assess total revenue trends and category performance based directly on the numbers.
- **Top-Selling Items**: Highlight item lines with the highest units sold, noting their estimated impact.
- **Inventory Efficiency & Potential Waste**: Identify slower stock lines tieing up high capital value with zero sales (capital waste risk) as well as catalog items dropping near or below threshold with solid sales (critical restock risk).
- **Actionable recommendations**: Give 3-4 professional, direct, bullet-pointed inventory and stocking adjustment decisions.

Make the output direct, executive, concise, and professional. Avoid conversational talk, generic placeholders, or boilerplate intros. Just start with the headers.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      return res.json({ analysis: response.text });
    } catch (error: any) {
      console.error("Gemini Analysis Endpoint Error:", error);
      
      const errMsg = error?.message || "";
      const errStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
      
      const isQuota = errStr.includes("429") || 
                      errStr.includes("RESOURCE_EXHAUSTED") || 
                      errStr.includes("quota") || 
                      errStr.includes("limit") ||
                      errMsg.includes("429") ||
                      errMsg.includes("RESOURCE_EXHAUSTED") ||
                      errMsg.includes("quota") ||
                      errMsg.includes("limit");

      const is503 = errStr.includes("503") || 
                    errStr.includes("UNAVAILABLE") || 
                    errStr.includes("high demand") || 
                    errStr.includes("temporary") ||
                    errMsg.includes("503") ||
                    errMsg.includes("UNAVAILABLE") ||
                    errMsg.includes("high demand") ||
                    errMsg.includes("temporary");

      if (isQuota) {
        // Safe UX Fallback: If rate-limited/quota exhausted, return offline analytics instead of a 429 error!
        const fallbackText = generateLocalFallbackAnalysis(productsSummary, salesSummary, 'quota');
        return res.json({ analysis: fallbackText });
      }

      if (is503) {
        return res.status(503).json({
          error: "The Gemini AI service is currently experiencing high demand. This is a temporary platform state. Please wait a moment and click the 'Retry Analysis' button to try again.",
          isTransient: true
        });
      }

      // Safe UX Fallback: Return offline analytics for other exceptions as well to prevent app crash
      const fallbackText = generateLocalFallbackAnalysis(productsSummary, salesSummary, 'generic');
      return res.json({ analysis: fallbackText });
    }
  });

  // Handle Vite middleware inside the main dev server
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Express] Core full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
