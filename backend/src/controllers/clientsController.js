import prisma from "../config/prisma.js";

// @desc    Get all clients (optionally filter by debt)
// @route   GET /api/clients?hasDebt=true
// @access  Private
// @example
// fetch('/api/clients?hasDebt=true')
//   .then(res => res.json())
//   .then(data => console.log(data))
export const getAllClients = async (req, res) => {
  try {
    const { hasDebt } = req.query;
    
    let whereClause = { isDeleted: false };
    if (hasDebt === 'true') {
      whereClause.debt = { gt: 0 };
    }

    const clients = await prisma.client.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    });

    res.status(200).json(clients);
  } catch (error) {
    console.error("Error in getAllClients:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Get a single client with recent sales
// @route   GET /api/clients/:id
// @access  Private
// @example
// fetch('/api/clients/1')
//   .then(res => res.json())
//   .then(data => console.log(data))
export const getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const client = await prisma.client.findFirst({
      where: { id: id, isDeleted: false },
      include: {
        sales: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 10, // Fetch the 10 most recent sales
          include: {
            items: {
              where: { isDeleted: false },
              include: {
                product: { select: { name: true } }
              }
            }
          }
        }
      }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.status(200).json(client);
  } catch (error) {
    console.error("Error in getClientById:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Create a new client profile
// @route   POST /api/clients
// @access  Private
// @example
// fetch('/api/clients', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ name: "John Doe", phone: "123456789" })
// })
export const createClient = async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Client name is required" });
    }

    const newClient = await prisma.client.create({
      data: {
        name,
        phone,
        debt: req.body.debt ? parseFloat(req.body.debt) : 0,
      },
    });

    res.status(201).json(newClient);
  } catch (error) {
    console.error("Error in createClient:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Update a client profile
// @route   PUT /api/clients/:id
// @access  Private
// @example
// fetch('/api/clients/1', {
//   method: 'PUT',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ phone: "987654321" })
// })
export const putClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone } = req.body;

    const existingClient = await prisma.client.findFirst({
      where: { id: id, isDeleted: false },
    });

    if (!existingClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    const updatedClient = await prisma.client.update({
      where: { id: id },
      data: { name, phone },
    });

    res.status(200).json(updatedClient);
  } catch (error) {
    console.error("Error in putClient:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Pay off a client's debt
// @route   POST /api/clients/:id/pay
// @access  Private
// @example
// fetch('/api/clients/1/pay', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ amountPaid: 5000 })
// })
export const payClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { amountPaid } = req.body;

    if (amountPaid === undefined || amountPaid <= 0) {
      return res.status(400).json({ error: "Please provide a valid amountPaid" });
    }

    const client = await prisma.client.findFirst({
      where: { id: id, isDeleted: false },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (amountPaid > client.debt) {
      return res.status(400).json({ error: "amountPaid cannot be greater than the client's current debt" });
    }

    // Use a transaction to ensure both operations succeed or fail together
    const [updatedClient, debtPayment] = await prisma.$transaction([
      prisma.client.update({
        where: { id: id },
        data: {
          debt: client.debt - parseFloat(amountPaid)
        }
      }),
      prisma.debtPayment.create({
        data: {
          clientId: id,
          amount: parseFloat(amountPaid)
        }
      })
    ]);

    res.status(200).json({
      message: "Payment processed successfully",
      client: updatedClient,
      payment: debtPayment
    });
  } catch (error) {
    console.error("Error in payClient:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Add manual debt to a client
// @route   POST /api/clients/:id/debt
// @access  Private
// @example
// fetch('/api/clients/1/debt', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ amount: 5000 })
// })
export const addDebt = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (amount === undefined || amount <= 0) {
      return res.status(400).json({ error: "Please provide a valid amount > 0" });
    }

    const client = await prisma.client.findFirst({
      where: { id: id, isDeleted: false },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const updatedClient = await prisma.client.update({
      where: { id: id },
      data: {
        debt: client.debt + parseFloat(amount)
      }
    });

    res.status(200).json({
      message: "Debt added successfully",
      client: updatedClient,
    });
  } catch (error) {
    console.error("Error in addDebt:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Delete a client
// @route   DELETE /api/clients/:id
// @access  Private/Admin
// @example
// fetch('/api/clients/1', {
//   method: 'DELETE'
// })
export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const existingClient = await prisma.client.findFirst({
      where: { id: id, isDeleted: false },
    });

    if (!existingClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Delete all related sales and their items first
    const sales = await prisma.sale.findMany({
      where: { clientId: id },
      select: { id: true }
    });
    const saleIds = sales.map(s => s.id);

    if (saleIds.length > 0) {
      await prisma.saleItem.updateMany({
        where: { saleId: { in: saleIds } },
        data: { isDeleted: true, syncStatus: "pending" }
      });
    }

    await prisma.sale.updateMany({
      where: { clientId: id },
      data: { isDeleted: true, syncStatus: "pending" }
    });

    // Delete all debt payments
    await prisma.debtPayment.updateMany({
      where: { clientId: id },
      data: { isDeleted: true, syncStatus: "pending" }
    });

    // Finally delete the client
    const deletedClient = await prisma.client.update({
      where: { id: id },
      data: { isDeleted: true, syncStatus: "pending" }
    });

    res.status(200).json({
      message: "Client deleted successfully",
      client: deletedClient,
    });
  } catch (error) {
    console.error("Error in deleteClient:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
