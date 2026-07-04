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
    
    let whereClause = {};
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
    
    const client = await prisma.client.findUnique({
      where: { id: parseInt(id) },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Fetch the 10 most recent sales
          include: {
            items: {
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

    const existingClient = await prisma.client.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    const updatedClient = await prisma.client.update({
      where: { id: parseInt(id) },
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

    const client = await prisma.client.findUnique({
      where: { id: parseInt(id) },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (amountPaid > client.debt) {
      return res.status(400).json({ error: "amountPaid cannot be greater than the client's current debt" });
    }

    const updatedClient = await prisma.client.update({
      where: { id: parseInt(id) },
      data: {
        debt: client.debt - parseFloat(amountPaid)
      }
    });

    res.status(200).json({
      message: "Payment processed successfully",
      client: updatedClient
    });
  } catch (error) {
    console.error("Error in payClient:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
