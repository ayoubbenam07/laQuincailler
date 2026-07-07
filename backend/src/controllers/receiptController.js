import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// @desc    Upload and parse supplier receipt
// @route   POST /api/receipts/upload
// @access  Private/Admin
export const uploadReceipt = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    }

    const filePath = req.file.path;
    const mimeType = req.file.mimetype;
    const fileBytes = fs.readFileSync(filePath);
    const base64Data = fileBytes.toString("base64");

    // We define a schema for the structured JSON output
    const schema = {
      type: Type.ARRAY,
      description: "List of items parsed from the receipt",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Name or description of the product/item",
          },
          quantity: {
            type: Type.NUMBER,
            description: "Quantity of the item",
          },
          basePrice: {
            type: Type.NUMBER,
            description: "Unit price of the item. Do not include currency symbols.",
          },
          category: {
            type: Type.STRING,
            description: "Best matching category for the item",
            enum: ["TOOLS", "PLUMBING", "ELECTRICAL", "HARDWARE", "PAINT", "MATERIALS", "OTHER"]
          },
        },
        required: ["name", "quantity", "basePrice"],
      },
    };

    const prompt = `You are a receipt parser. 
Analyze this supplier receipt and extract the line items. 
Return the result strictly adhering to the JSON schema.
If a quantity is missing, assume 1.
If a unit price is missing but a total price is present, calculate the unit price.
Infer the best category from the item name.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const parsedData = JSON.parse(response.text);

    // Clean up the uploaded file
    fs.unlinkSync(filePath);

    res.status(200).json({ items: parsedData });
  } catch (error) {
    console.error("Error in uploadReceipt:", error);
    
    // Attempt to clean up the uploaded file on error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: "Failed to parse receipt" });
  }
};
