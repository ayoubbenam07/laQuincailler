import prisma from "../config/prisma.js";

// @desc    Get all products
// @route   GET /api/products
// @access  Private
// @example
// fetch('/api/products')
//   .then(res => res.json())
//   .then(data => console.log(data))
export const getAllProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isDeleted: false }
    });
    res.status(200).json(products);
  } catch (error) {
    console.error("Error in getAllProducts:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Get a single product by ID
// @route   GET /api/products/:id
// @access  Private
// @example
// fetch('/api/products/1')
//   .then(res => res.json())
//   .then(data => console.log(data))
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findFirst({
      where: { id: id, isDeleted: false },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error("Error in getProductById:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Create a new product
// @route   POST /api/products
// @access  Private/Admin
// @example
// fetch('/api/products', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({
//     name: 'Hammer',
//     basePrice: 10.0,
//     addition: 5.0,
//     stock: 50,
//     minStock: 5,
//     category: 'TOOLS',
//     weight: 1.5,
//     color: 'Red',
//     measureUnit: 'PIECE'
//   })
// })
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      basePrice,
      addition,
      stock,
      minStock,
      category,
      weight,
      color,
      measureUnit,
    } = req.body;
    let { barcode } = req.body;

    if (!name || basePrice === undefined || addition === undefined || stock === undefined) {
      return res.status(400).json({ error: "Please provide name, basePrice, addition, and stock" });
    }

    // Generate barcode if not provided
    if (!barcode) {
      let unique = false;
      while (!unique) {
        barcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
        const existing = await prisma.product.findUnique({ where: { barcode } });
        if (!existing) unique = true;
      }
    } else {
      const existingProduct = await prisma.product.findFirst({
        where: { barcode, isDeleted: false },
      });

      if (existingProduct) {
        return res.status(400).json({ error: "Product with this barcode already exists" });
      }
    }

    const calculatedFinalPrice = parseFloat(basePrice) + parseFloat(addition);

    const newProduct = await prisma.product.create({
      data: {
        barcode,
        name,
        basePrice: parseFloat(basePrice),
        addition: parseFloat(addition),
        finalPrice: calculatedFinalPrice,
        stock: parseFloat(stock),
        minStock: minStock !== undefined ? parseFloat(minStock) : 10,
        category,
        weight: weight !== undefined ? parseFloat(weight) : null,
        color,
        measureUnit,
      },
    });

    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Error in createProduct:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
// @example
// fetch('/api/products/1', {
//   method: 'PUT',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ stock: 40, basePrice: 11.0 })
// })
export const putProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existingProduct = await prisma.product.findFirst({
      where: { id: id, isDeleted: false },
    });

    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (updateData.basePrice !== undefined) updateData.basePrice = parseFloat(updateData.basePrice);
    if (updateData.addition !== undefined) updateData.addition = parseFloat(updateData.addition);
    
    // Ignore any finalPrice sent by client
    if (updateData.finalPrice !== undefined) delete updateData.finalPrice;

    // Recalculate finalPrice if basePrice or addition changes
    if (updateData.basePrice !== undefined || updateData.addition !== undefined) {
      const base = updateData.basePrice !== undefined ? updateData.basePrice : existingProduct.basePrice;
      const add = updateData.addition !== undefined ? updateData.addition : existingProduct.addition;
      updateData.finalPrice = base + add;
    }

    if (updateData.stock !== undefined) updateData.stock = parseFloat(updateData.stock);
    if (updateData.minStock !== undefined) updateData.minStock = parseFloat(updateData.minStock);
    if (updateData.weight !== undefined) updateData.weight = parseFloat(updateData.weight);

    const updatedProduct = await prisma.product.update({
      where: { id: id },
      data: updateData,
    });

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error("Error in putProduct:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
// @example
// fetch('/api/products/1', { method: 'DELETE' })
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const existingProduct = await prisma.product.findFirst({
      where: { id: id, isDeleted: false },
    });

    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    await prisma.product.update({
      where: { id: id },
      data: { isDeleted: true, syncStatus: "pending" },
    });

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error in deleteProduct:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Bulk import/update products from receipt
// @route   POST /api/products/bulk
// @access  Private/Admin
export const bulkImportProducts = async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: "Invalid product array" });
    }

    const results = { created: 0, updated: 0, errors: [] };

    // Process sequentially to handle barcode uniqueness properly
    for (const item of products) {
      try {
        const basePrice = parseFloat(item.basePrice);
        const addition = parseFloat(item.addition) || 0;
        const finalPrice = basePrice + addition;

        if (item.action === 'UPDATE' && item.id) {
          // Update existing product
          const existing = await prisma.product.findFirst({ where: { id: item.id, isDeleted: false } });
          if (existing) {
            await prisma.product.update({
              where: { id: item.id },
              data: {
                stock: existing.stock + parseFloat(item.stockToAdd || item.stock || 0),
                basePrice,
                addition,
                finalPrice,
                ...(item.category ? { category: item.category } : {})
              }
            });
            results.updated++;
          } else {
            results.errors.push(`Product ID ${item.id} not found for update`);
          }
        } else if (item.action === 'CREATE') {
          // Create new product
          let barcode = item.barcode;
          if (!barcode) {
             let unique = false;
             while (!unique) {
               barcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
               const existing = await prisma.product.findFirst({ where: { barcode, isDeleted: false } });
               if (!existing) unique = true;
             }
          }
          await prisma.product.create({
            data: {
              barcode,
              name: item.name,
              basePrice,
              addition,
              finalPrice,
              stock: parseFloat(item.stock || item.stockToAdd || 0),
              minStock: 10,
              category: item.category || "OTHER"
            }
          });
          results.created++;
        }
      } catch (err) {
        console.error("Error processing item:", item.name, err);
        results.errors.push(`Error on ${item.name || 'unknown'}: ${err.message}`);
      }
    }

    res.status(200).json(results);
  } catch (error) {
    console.error("Error in bulkImportProducts:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
