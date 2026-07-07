import express from "express";
import multer from "multer";
import { uploadReceipt } from "../controllers/receiptController.js";

const router = express.Router();

// Setup multer for temporary file storage
const upload = multer({ dest: "uploads/" });

// POST /api/receipts/upload
router.post("/upload", upload.single("receipt"), uploadReceipt);

export default router;
