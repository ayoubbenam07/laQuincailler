import prisma from "../config/prisma.js";

const getStartDate = (period) => {
  const date = new Date();
  if (period === 'week') {
    date.setDate(date.getDate() - 7);
  } else if (period === 'month') {
    date.setMonth(date.getMonth() - 1);
  } else if (period === 'year') {
    date.setFullYear(date.getFullYear() - 1);
  }
  return date;
};

// @desc    Get Revenue Trend
// @route   GET /api/dashboard/revenue-trend?period=week|month
// @access  Private/Admin
export const getRevenueTrend = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const startDate = getStartDate(period);

    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: startDate } },
      include: {
        items: {
          include: { product: { select: { basePrice: true } } }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const trend = {};

    sales.forEach(sale => {
      const dateKey = period === 'year' 
        ? sale.createdAt.toISOString().slice(0, 7)
        : sale.createdAt.toISOString().split('T')[0];

      if (!trend[dateKey]) {
        trend[dateKey] = { date: dateKey, totalRevenue: 0, totalProfit: 0 };
      }

      let cost = 0;
      sale.items.forEach(item => {
        cost += item.quantity * (item.product?.basePrice || 0);
      });

      trend[dateKey].totalRevenue += sale.totalAmount;
      trend[dateKey].totalProfit += (sale.totalAmount - cost);
    });

    res.status(200).json(Object.values(trend));
  } catch (error) {
    console.error("Error in getRevenueTrend:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Get Cash Flow (Cash vs Credit)
// @route   GET /api/dashboard/cash-flow?period=month
// @access  Private/Admin
export const getCashFlow = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const startDate = getStartDate(period);

    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: startDate } },
      select: { totalAmount: true, amountPaid: true }
    });

    const debtPayments = await prisma.debtPayment.findMany({
      where: { createdAt: { gte: startDate } },
      select: { amount: true }
    });

    let totalCash = 0;
    let totalCredit = 0;

    sales.forEach(sale => {
      totalCash += sale.amountPaid;
      totalCredit += (sale.totalAmount - sale.amountPaid);
    });

    debtPayments.forEach(payment => {
      totalCash += payment.amount;
      totalCredit -= payment.amount;
    });

    res.status(200).json({
      period,
      cashInDrawer: totalCash,
      creditGiven: totalCredit,
      totalSales: totalCash + totalCredit
    });
  } catch (error) {
    console.error("Error in getCashFlow:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Get Inventory Valuation
// @route   GET /api/dashboard/inventory-valuation
// @access  Private/Admin
export const getInventoryValuation = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      select: { category: true, stock: true, basePrice: true }
    });

    let totalValuation = 0;
    const categoryValuation = {};

    products.forEach(p => {
      const val = p.stock * p.basePrice;
      totalValuation += val;

      const cat = p.category || "UNCATEGORIZED";
      if (!categoryValuation[cat]) {
        categoryValuation[cat] = 0;
      }
      categoryValuation[cat] += val;
      
    });

    res.status(200).json({
      totalValuation,
      estimatedStockValue: totalValuation,
      byCategory: categoryValuation
    });
  } catch (error) {
    console.error("Error in getInventoryValuation:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Get Estimated Stock Value
// @route   GET /api/dashboard/stock-value-estimate
// @access  Private/Admin
export const getStockValueEstimate = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      select: { category: true, stock: true, basePrice: true }
    });

    let totalValuation = 0;
    const categoryValuation = {};

    products.forEach((product) => {
      const valuation = (product.stock || 0) * (product.basePrice || 0);
      totalValuation += valuation;

      const category = product.category || "UNCATEGORIZED";
      if (!categoryValuation[category]) {
        categoryValuation[category] = 0;
      }
      categoryValuation[category] += valuation;
    });

    res.status(200).json({
      estimatedStockValue: totalValuation,
      byCategory: categoryValuation
    });
  } catch (error) {
    console.error("Error in getStockValueEstimate:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Get Dead Stock
// @route   GET /api/dashboard/dead-stock?months=6
// @access  Private/Admin
export const getDeadStock = async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const thresholdDate = new Date();
    thresholdDate.setMonth(thresholdDate.getMonth() - parseInt(months));

    const deadStock = await prisma.product.findMany({
      where: {
        stock: { gt: 0 },
        saleItems: {
          none: {
            sale: {
              createdAt: { gte: thresholdDate }
            }
          }
        }
      }
    });

    res.status(200).json(deadStock);
  } catch (error) {
    console.error("Error in getDeadStock:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Get Low Stock
// @route   GET /api/dashboard/low-stock
// @access  Private/Admin
export const getLowStock = async (req, res) => {
  try {
    const lowStockProducts = await prisma.$queryRaw`SELECT * FROM "Product" WHERE stock <= "minStock"`;
    res.status(200).json(lowStockProducts);
  } catch (error) {
    console.error("Error in getLowStock:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Get Cashier Stats
// @route   GET /api/dashboard/cashier-stats?date=YYYY-MM-DD
// @access  Private/Admin
export const getCashierStats = async (req, res) => {
  try {
    const { date } = req.query;
    let startOfDay, endOfDay;

    if (date) {
      startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);
    } else {
      startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      endOfDay = new Date();
      endOfDay.setUTCHours(23, 59, 59, 999);
    }

    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        cashier: { select: { username: true } }
      }
    });

    const stats = {};

    sales.forEach(sale => {
      const cid = sale.cashierId;
      if (!stats[cid]) {
        stats[cid] = {
          cashierId: cid,
          username: sale.cashier?.username || 'Unknown',
          transactionCount: 0,
          totalCashCollected: 0
        };
      }
      stats[cid].transactionCount += 1;
      stats[cid].totalCashCollected += sale.amountPaid;
    });

    res.status(200).json(Object.values(stats));
  } catch (error) {
    console.error("Error in getCashierStats:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Get Summary Analytics
// @route   GET /api/dashboard/summary
// @access  Private/Admin
export const getSummary = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0,0,0,0);

    // Today's metrics
    const todaySales = await prisma.sale.aggregate({
      where: { createdAt: { gte: startOfDay } },
      _sum: { totalAmount: true, amountPaid: true },
      _count: { id: true }
    });

    const todayDebtPayments = await prisma.debtPayment.aggregate({
      where: { createdAt: { gte: startOfDay } },
      _sum: { amount: true }
    });

    const outOfStockCount = await prisma.product.count({
      where: { stock: { lte: 0 } }
    });

    // All-time metrics
    const allTimeSales = await prisma.sale.aggregate({
      _sum: { totalAmount: true },
      _count: { id: true }
    });

    const allSales = await prisma.sale.findMany({
      include: {
        items: {
          include: { product: { select: { basePrice: true } } }
        }
      }
    });

    let totalProfit = 0;
    allSales.forEach((sale) => {
      let cost = 0;
      sale.items.forEach((item) => {
        cost += item.quantity * (item.product?.basePrice || 0);
      });
      totalProfit += sale.totalAmount - cost;
    });

    const totalClientsDebt = await prisma.client.aggregate({
      _sum: { debt: true }
    });

    const todayCashFromSales = todaySales._sum.amountPaid || 0;
    const todayCashFromDebt = todayDebtPayments._sum.amount || 0;

    res.status(200).json({
      // Today
      todayRevenue: todaySales._sum.totalAmount || 0,
      todayCash: todayCashFromSales + todayCashFromDebt,
      transactionsToday: todaySales._count.id || 0,
      outOfStockItems: outOfStockCount,
      // All-time
      totalChiffreAffaires: allTimeSales._sum.totalAmount || 0,
      totalProfit,
      totalDette: totalClientsDebt._sum.debt || 0,
      totalVentes: allTimeSales._count.id || 0
    });
  } catch (error) {
    console.error("Error in getSummary:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
