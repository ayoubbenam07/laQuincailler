import express from "express";
import { createCashier, getAllCashiers, getCashierById, putCashier, deleteCashier } from "../controllers/usersController.js";
import { protectRoute, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protectRoute);

router.post("/cashiers", isAdmin, createCashier);

router.get("/cashiers", isAdmin, getAllCashiers);

router.get("/cashiers/:id", isAdmin, getCashierById);

router.put("/cashiers/:id", putCashier);

router.delete("/cashiers/:id", isAdmin, deleteCashier);

export default router;