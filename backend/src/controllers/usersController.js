import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";

// @desc    Create a cashier
// @route   POST /api/users/cashiers
// @access  Private/Admin
// @example
// fetch('/api/users/cashiers', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ username: 'cashier1', password: 'securepassword' })
// })
export const createCashier = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(400).json({ error: "Username is already taken" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const cashier = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: "CASHIER",
      },
      select: { id: true, username: true, role: true },
    });

    res.status(201).json(cashier);
  } catch (error) {
    console.error("Error in createCashier:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Get all cashiers
// @route   GET /api/users/cashiers
// @access  Private/Admin
// @example
// fetch('/api/users/cashiers')
//   .then(res => res.json())
//   .then(data => console.log(data))
export const getAllCashiers = async (req, res) => {
  try {
    const cashiers = await prisma.user.findMany({
      where: { role: "CASHIER", isDeleted: false },
      select: { id: true, username: true, role: true },
    });
    res.status(200).json(cashiers);
  } catch (error) {
    console.error("Error in getAllCashiers:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Get a single cashier
// @route   GET /api/users/cashiers/:id
// @access  Private/Admin
// @example
// fetch('/api/users/cashiers/1')
//   .then(res => res.json())
//   .then(data => console.log(data))
export const getCashierById = async (req, res) => {
  try {
    const { id } = req.params;
    const cashier = await prisma.user.findFirst({
      where: {
        id: id,
        role: "CASHIER",
        isDeleted: false,
      },
      select: { id: true, username: true, role: true },
    });

    if (!cashier) {
      return res.status(404).json({ error: "Cashier not found" });
    }

    res.status(200).json(cashier);
  } catch (error) {
    console.error("Error in getCashierById:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Update a cashier
// @route   PUT /api/users/cashiers/:id
// @access  Private/Admin
// @example
// fetch('/api/users/cashiers/1', {
//   method: 'PUT',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ username: 'updatedcashier', password: 'newpassword123' })
// })
export const putCashier = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password } = req.body;

    const existingCashier = await prisma.user.findFirst({
      where: {
        id: id,
        role: "CASHIER",
        isDeleted: false,
      },
    });

    if (!existingCashier) {
      return res.status(404).json({ error: "Cashier not found" });
    }

    const updateData = {};
    if (username) {
      if (username !== existingCashier.username) {
         const taken = await prisma.user.findUnique({ where: { username } });
         if (taken) {
            return res.status(400).json({ error: "Username is already taken" });
         }
      }
      updateData.username = username;
    }
    
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const updatedCashier = await prisma.user.update({
      where: { id: id },
      data: updateData,
      select: { id: true, username: true, role: true },
    });

    res.status(200).json(updatedCashier);
  } catch (error) {
    console.error("Error in putCashier:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Delete a cashier
// @route   DELETE /api/users/cashiers/:id
// @access  Private/Admin
// @example
// fetch('/api/users/cashiers/1', { method: 'DELETE' })
export const deleteCashier = async (req, res) => {
  try {
    const { id } = req.params;
    
    const existingCashier = await prisma.user.findFirst({
      where: {
        id: id,
        role: "CASHIER",
        isDeleted: false,
      },
    });

    if (!existingCashier) {
      return res.status(404).json({ error: "Cashier not found" });
    }

    await prisma.user.update({
      where: { id: id },
      data: { isDeleted: true, syncStatus: "pending" },
    });

    res.status(200).json({ message: "Cashier deleted successfully" });
  } catch (error) {
    console.error("Error in deleteCashier:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
