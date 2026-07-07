import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve .env from the backend root (3 levels up from src/workers/)
dotenv.config({ path: resolve(__dirname, '../../.env') });

const { Pool } = pg;

// Local DB connection
const localPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Remote Neon DB connection
const remotePool = new Pool({
  connectionString: process.env.NEON_DB_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  connectionTimeoutMillis: 10000,
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const executeWithRetry = async (pool, query, params, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await pool.query(query, params);
    } catch (error) {
      console.warn(`[Remote DB] Attempt ${attempt} failed: ${error.message}`);
      if (attempt === maxRetries) {
        throw error;
      }
      await sleep(3000);
    }
  }
};

// Define sync operations in dependency order to avoid FK errors on remote DB
const syncOperations = [
  {
    table: 'User',
    upsertQuery: `
      INSERT INTO "User" (id, username, password, role, "syncStatus", "isDeleted", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 'synced', $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        password = EXCLUDED.password,
        role = EXCLUDED.role,
        "syncStatus" = 'synced',
        "isDeleted" = EXCLUDED."isDeleted",
        "updatedAt" = EXCLUDED."updatedAt"
    `,
    getParams: (row) => [row.id, row.username, row.password, row.role, row.isDeleted, row.createdAt, row.updatedAt]
  },
  {
    table: 'Client',
    upsertQuery: `
      INSERT INTO "Client" (id, name, phone, debt, "syncStatus", "isDeleted", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 'synced', $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        debt = EXCLUDED.debt,
        "syncStatus" = 'synced',
        "isDeleted" = EXCLUDED."isDeleted",
        "updatedAt" = EXCLUDED."updatedAt"
    `,
    getParams: (row) => [row.id, row.name, row.phone, row.debt, row.isDeleted, row.createdAt, row.updatedAt]
  },
  {
    table: 'Product',
    upsertQuery: `
      INSERT INTO "Product" (id, barcode, name, "basePrice", addition, "finalPrice", stock, "minStock", category, weight, color, "measureUnit", "syncStatus", "isDeleted", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'synced', $13, $14, $15)
      ON CONFLICT (id) DO UPDATE SET
        barcode = EXCLUDED.barcode,
        name = EXCLUDED.name,
        "basePrice" = EXCLUDED."basePrice",
        addition = EXCLUDED.addition,
        "finalPrice" = EXCLUDED."finalPrice",
        stock = EXCLUDED.stock,
        "minStock" = EXCLUDED."minStock",
        category = EXCLUDED.category,
        weight = EXCLUDED.weight,
        color = EXCLUDED.color,
        "measureUnit" = EXCLUDED."measureUnit",
        "syncStatus" = 'synced',
        "isDeleted" = EXCLUDED."isDeleted",
        "updatedAt" = EXCLUDED."updatedAt"
    `,
    getParams: (row) => [row.id, row.barcode, row.name, row.basePrice, row.addition, row.finalPrice, row.stock, row.minStock, row.category, row.weight, row.color, row.measureUnit, row.isDeleted, row.createdAt, row.updatedAt]
  },
  {
    table: 'Sale',
    upsertQuery: `
      INSERT INTO "Sale" (id, "cashierId", "clientId", "totalAmount", "amountPaid", "syncStatus", "isDeleted", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, 'synced', $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        "cashierId" = EXCLUDED."cashierId",
        "clientId" = EXCLUDED."clientId",
        "totalAmount" = EXCLUDED."totalAmount",
        "amountPaid" = EXCLUDED."amountPaid",
        "syncStatus" = 'synced',
        "isDeleted" = EXCLUDED."isDeleted",
        "updatedAt" = EXCLUDED."updatedAt"
    `,
    getParams: (row) => [row.id, row.cashierId, row.clientId, row.totalAmount, row.amountPaid, row.isDeleted, row.createdAt, row.updatedAt]
  },
  {
    table: 'SaleItem',
    upsertQuery: `
      INSERT INTO "SaleItem" (id, "saleId", "productId", quantity, "priceSold", "syncStatus", "isDeleted", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, 'synced', $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        "saleId" = EXCLUDED."saleId",
        "productId" = EXCLUDED."productId",
        quantity = EXCLUDED.quantity,
        "priceSold" = EXCLUDED."priceSold",
        "syncStatus" = 'synced',
        "isDeleted" = EXCLUDED."isDeleted",
        "updatedAt" = EXCLUDED."updatedAt"
    `,
    getParams: (row) => [row.id, row.saleId, row.productId, row.quantity, row.priceSold, row.isDeleted, row.createdAt, row.updatedAt]
  },
  {
    table: 'DebtPayment',
    upsertQuery: `
      INSERT INTO "DebtPayment" (id, "clientId", amount, "syncStatus", "isDeleted", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, 'synced', $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        "clientId" = EXCLUDED."clientId",
        amount = EXCLUDED.amount,
        "syncStatus" = 'synced',
        "isDeleted" = EXCLUDED."isDeleted",
        "updatedAt" = EXCLUDED."updatedAt"
    `,
    getParams: (row) => [row.id, row.clientId, row.amount, row.isDeleted, row.createdAt, row.updatedAt]
  }
];

const syncPendingRecords = async () => {
  console.log(`\n[${new Date().toISOString()}] Starting full schema sync cycle...`);
  
  let client;
  try {
    client = await localPool.connect();
  } catch (error) {
    console.error('Failed to connect to local database:', error.message);
    return; // Exit early if local db is unreachable
  }
  
  try {
    for (const operation of syncOperations) {
      const { table, upsertQuery, getParams } = operation;
      
      // 1. Fetch pending records from local DB for this table
      const { rows: pendingRecords } = await client.query(
        `SELECT * FROM "${table}" WHERE "syncStatus" = 'pending'`
      );

      if (pendingRecords.length === 0) {
        continue;
      }

      console.log(`Found ${pendingRecords.length} pending records in "${table}". Syncing...`);

      // 2. Process each record
      let syncedIds = [];
      
      for (const record of pendingRecords) {
        try {
          await executeWithRetry(remotePool, upsertQuery, getParams(record));
          syncedIds.push(record.id);
        } catch (err) {
          console.error(`Failed to sync ${table} ${record.id}:`, err.message);
        }
      }

      // 3. Update local database to 'synced'
      if (syncedIds.length > 0) {
        await client.query(
          `UPDATE "${table}" SET "syncStatus" = 'synced' WHERE id = ANY($1::uuid[])`,
          [syncedIds]
        );
        console.log(`Successfully synced ${syncedIds.length} records in "${table}".`);
      }
    }

  } catch (error) {
    console.error('Error during synchronization:', error);
  } finally {
    if (client) client.release();
  }
};

// Run the worker on an interval
const SYNC_INTERVAL_MS = 60 * 1000; // 1 minute

console.log(`Starting Offline-First Sync Worker. Checking every ${SYNC_INTERVAL_MS / 1000} seconds.`);

// Run immediately on startup
syncPendingRecords();

// Schedule subsequent runs
setInterval(() => {
  syncPendingRecords();
}, SYNC_INTERVAL_MS);

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Shutting down sync worker gracefully...');
  await localPool.end();
  await remotePool.end();
  process.exit(0);
});
