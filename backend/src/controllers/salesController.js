import prisma from "../config/prisma.js";

// @desc    Create a new sale (POS Checkout)
// @route   POST /api/sales
// @access  Private (Cashier & Admin)
// @example
// fetch('/api/sales', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({
//     clientId: 5,
//     amountPaid: 2000,
//     items: [
//       { productId: 1, quantity: 2, priceSold: 120 },
//       { productId: 4, quantity: 0.5, priceSold: 300 }
//     ]
//   })
// })
export const createSale = async (req, res) => {
  try {
    const { clientId, amountPaid, items } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: "Sale must have at least one item" });
    }

    if (amountPaid === undefined || amountPaid < 0) {
      return res.status(400).json({ error: "Please provide a valid amountPaid" });
    }

    const cashierId = req.user.id; // From auth middleware protectRoute

    // 1. Calculate totalAmount based on items
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.quantity * item.priceSold;
    }

    // Must run in a transaction
    const result = await prisma.$transaction(async (prisma) => {
      // 2 & 3. Create the Sale record and the tied SaleItem records
      const sale = await prisma.sale.create({
        data: {
          cashierId,
          clientId: clientId || null,
          totalAmount,
          amountPaid,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              priceSold: item.priceSold
            }))
          }
        },
        include: { items: true } // Include items to return
      });

      // 4. Loop through items and decrement Product.stock
      for (const item of items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        });
      }

      // 5. If clientId is provided and amountPaid < totalAmount, add difference to Client.debt
      if (clientId && amountPaid < totalAmount) {
        const debtToAdd = totalAmount - amountPaid;
        await prisma.client.update({
          where: { id: clientId },
          data: {
            debt: {
              increment: debtToAdd
            }
          }
        });
      }

      return sale;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Error in createSale:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Get past sales (Admin gets all or filtered, Cashier gets only their own)
// @route   GET /api/sales
// @access  Private
// @example
// fetch('/api/sales?date=2023-10-25')
export const getAllSales = async (req, res) => {
  try {
    const { date, cashierId } = req.query;
    const userRole = req.user.role;
    const userId = req.user.id;
    
    let whereClause = {};

    if (userRole === "ADMIN") {
      if (cashierId) {
        whereClause.cashierId = parseInt(cashierId);
      }
    } else {
      // Cashier can only fetch their own sales
      whereClause.cashierId = userId;
    }

    if (date) {
      // Expected date format YYYY-MM-DD
      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      whereClause.createdAt = {
        gte: startOfDay,
        lte: endOfDay
      };
    }

    const sales = await prisma.sale.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        cashier: { select: { username: true } },
        client: { select: { name: true } }
      }
    });

    res.status(200).json(sales);
  } catch (error) {
    console.error("Error in getAllSales:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Get a specific sale
// @route   GET /api/sales/:id
// @access  Private
// @example
// fetch('/api/sales/1')
export const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            product: { select: { name: true } }
          }
        },
        cashier: { select: { username: true } },
        client: { select: { name: true } }
      }
    });

    if (!sale) {
      return res.status(404).json({ error: "Sale not found" });
    }

    res.status(200).json(sale);
  } catch (error) {
    console.error("Error in getSaleById:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Update a sale (Full rewrite of items, stock, and debt)
// @route   PUT /api/sales/:id
// @access  Private/Admin
// @example
// fetch('/api/sales/1', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({...}) })
export const putSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId, amountPaid, items } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: "Sale must have at least one item" });
    }

    if (amountPaid === undefined || amountPaid < 0) {
      return res.status(400).json({ error: "Please provide a valid amountPaid" });
    }

    const saleId = parseInt(id);

    const result = await prisma.$transaction(async (prisma) => {
      // 1. Fetch old sale with items
      const oldSale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { items: true }
      });

      if (!oldSale) {
        throw new Error("SALE_NOT_FOUND");
      }

      // 2. Revert old sale side effects (stock & debt)
      for (const oldItem of oldSale.items) {
        await prisma.product.update({
          where: { id: oldItem.productId },
          data: { stock: { increment: oldItem.quantity } }
        });
      }

      if (oldSale.clientId && oldSale.amountPaid < oldSale.totalAmount) {
        const oldDebt = oldSale.totalAmount - oldSale.amountPaid;
        await prisma.client.update({
          where: { id: oldSale.clientId },
          data: { debt: { decrement: oldDebt } }
        });
      }

      // 3. Delete old items
      await prisma.saleItem.deleteMany({
        where: { saleId }
      });

      // 4. Calculate new total
      let newTotalAmount = 0;
      for (const item of items) {
        newTotalAmount += item.quantity * item.priceSold;
      }

      // 5. Apply new side effects (stock & debt)
      for (const item of items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } }
        });
      }

      if (clientId && amountPaid < newTotalAmount) {
        const newDebt = newTotalAmount - amountPaid;
        await prisma.client.update({
          where: { id: clientId },
          data: { debt: { increment: newDebt } }
        });
      }

      // 6. Update Sale record and create new items
      const updatedSale = await prisma.sale.update({
        where: { id: saleId },
        data: {
          clientId: clientId || null,
          totalAmount: newTotalAmount,
          amountPaid,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              priceSold: item.priceSold
            }))
          }
        },
        include: { items: true }
      });

      return updatedSale;
    });

    res.status(200).json(result);
  } catch (error) {
    if (error.message === "SALE_NOT_FOUND") {
      return res.status(404).json({ error: "Sale not found" });
    }
    console.error("Error in putSale:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Delete a sale and revert stock/debt
// @route   DELETE /api/sales/:id
// @access  Private/Admin
// @example
// fetch('/api/sales/1', { method: 'DELETE' })
export const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;
    const saleId = parseInt(id);

    await prisma.$transaction(async (prisma) => {
      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { items: true }
      });

      if (!sale) {
        throw new Error("SALE_NOT_FOUND");
      }

      // Revert stock
      for (const item of sale.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        });
      }

      // Revert debt
      if (sale.clientId && sale.amountPaid < sale.totalAmount) {
        const debtToRevert = sale.totalAmount - sale.amountPaid;
        await prisma.client.update({
          where: { id: sale.clientId },
          data: { debt: { decrement: debtToRevert } }
        });
      }

      // Delete items and sale
      await prisma.saleItem.deleteMany({
        where: { saleId }
      });

      await prisma.sale.delete({
        where: { id: saleId }
      });
    });

    res.status(200).json({ message: "Sale deleted and side-effects reversed successfully" });
  } catch (error) {
    if (error.message === "SALE_NOT_FOUND") {
      return res.status(404).json({ error: "Sale not found" });
    }
    console.error("Error in deleteSale:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
