import express from "express";
import { getAllClients, getClientById, createClient, putClient, payClient, addDebt, deleteClient } from "../controllers/clientsController.js";
import { protectRoute, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protectRoute);

router.get("/", getAllClients);

router.get("/:id", getClientById);

router.post("/", createClient);

router.put("/:id", putClient);

router.post("/:id/pay", payClient);

router.post("/:id/debt", addDebt);

router.delete("/:id", deleteClient);

export default router;