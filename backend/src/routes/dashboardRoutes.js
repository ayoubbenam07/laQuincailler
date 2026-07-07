import express from "express";
import { 
  getRevenueTrend, 
  getCashFlow, 
  getInventoryValuation, 
  getStockValueEstimate,
  getDeadStock, 
  getLowStock, 
  getCashierStats,
  getSummary
} from "../controllers/dashboardController.js";
import { protectRoute, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protectRoute, isAdmin);

router.get("/revenue-trend", getRevenueTrend);
router.get("/cash-flow", getCashFlow);
router.get("/inventory-valuation", getInventoryValuation);
router.get("/stock-value-estimate", getStockValueEstimate);
router.get("/dead-stock", getDeadStock);
router.get("/low-stock", getLowStock);
router.get("/cashier-stats", getCashierStats);
router.get("/summary", getSummary);

export default router;
