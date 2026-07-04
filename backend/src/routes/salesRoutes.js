import express from "express";
import { createSale, getAllSales, getSaleById, putSale, deleteSale } from "../controllers/salesController.js";
import { protectRoute, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protectRoute);

router.post("/", createSale);

router.get("/", getAllSales);

router.get("/:id", getSaleById);

router.put("/:id", putSale);

router.delete("/:id", deleteSale);

export default router;
