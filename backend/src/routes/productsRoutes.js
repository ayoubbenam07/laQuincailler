import express from "express";
import { getAllProducts, getProductById, createProduct, putProduct, deleteProduct } from "../controllers/productsController.js";
import { protectRoute, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protectRoute);

router.get("/", getAllProducts);

router.get("/:id", getProductById);

router.post("/", isAdmin, createProduct);

router.put("/:id", isAdmin, putProduct);

router.delete("/:id", isAdmin, deleteProduct);

export default router;