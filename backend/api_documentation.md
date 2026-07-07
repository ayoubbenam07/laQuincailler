# La Quincaillerie API & Database Documentation

This document provides a comprehensive overview of the database schema and all available REST API endpoints for the hardware store backend.

---

## 1. Database Schema

The database uses PostgreSQL via Prisma. Here are the core models and their relationships:

### Enums
- **`Role`**: `ADMIN`, `CASHIER`
- **`Category`**: `TOOLS`, `PLUMBING`, `ELECTRICAL`, `HARDWARE`, `PAINT`, `MATERIALS`, `OTHER`
- **`MeasureUnit`**: `PIECE`, `KG`, `METER`, `LITER`, `BOX`, `PACK`

### Models

#### `User` (Cashiers & Admins)
- `id` (Int, PK)
- `username` (String, Unique)
- `password` (String, Hashed)
- `role` (Role, default: `CASHIER`)
- *Relations*: `sales` (One-to-Many with `Sale`)

#### `Client`
- `id` (Int, PK)
- `name` (String)
- `phone` (String, Optional)
- `debt` (Float, default: 0.0) - *Tracks total unpaid amount.*
- `createdAt` (DateTime)
- *Relations*: `sales` (One-to-Many with `Sale`)

#### `Product`
- `id` (Int, PK)
- `barcode` (String, Unique) - *Auto-generated 12-digit if not provided.*
- `name` (String)
- `basePrice` (Float) - *Cost to acquire the item.*
- `addition` (Float) - *Profit margin added to basePrice.*
- `finalPrice` (Float) - *Selling price (basePrice + addition). Auto-calculated.*
- `stock` (Float)
- `minStock` (Float, default: 10)
- `category` (Category, Optional)
- `weight` (Float, Optional)
- `color` (String, Optional)
- `measureUnit` (MeasureUnit, Optional)
- *Relations*: `saleItems` (One-to-Many with `SaleItem`)

#### `Sale`
- `id` (Int, PK)
- `cashierId` (Int, FK to `User`)
- `clientId` (Int, Optional, FK to `Client`)
- `totalAmount` (Float) - *Auto-calculated from items.*
- `amountPaid` (Float) - *Cash handed to cashier.*
- `createdAt` (DateTime)
- *Relations*: `items` (One-to-Many with `SaleItem`)

#### `SaleItem`
- `id` (Int, PK)
- `saleId` (Int, FK to `Sale`)
- `productId` (Int, FK to `Product`)
- `quantity` (Float)
- `priceSold` (Float) - *The price it was actually sold for at the time.*

---

## 2. API Endpoints

> **Note on Authentication**: Almost all routes require an active JWT session (provided by an HTTP-only cookie). Routes marked as `Admin` require the user role to be `ADMIN`.

### 🔐 Authentication (`/api/auth`)

#### `POST /register`
- **Access**: Public
- **Description**: Registers a new user. Default role is CASHIER.
- **Request Body Example**:
  ```json
  {
    "username": "johndoe",
    "password": "secretpassword",
    "role": "CASHIER"
  }
  ```
- **Response Example**:
  ```json
  {
    "message": "User created successfully",
    "user": {
      "id": 1,
      "username": "johndoe",
      "role": "CASHIER"
    }
  }
  ```

#### `POST /login`
- **Access**: Public
- **Description**: Authenticates and sets HTTP-only JWT cookie.
- **Request Body Example**:
  ```json
  {
    "username": "johndoe",
    "password": "secretpassword"
  }
  ```
- **Response Example**:
  ```json
  {
    "message": "Login successful"
  }
  ```
*(Sets `token` HTTP-only cookie)*

#### `POST /logout`
- **Access**: Public
- **Description**: Clears the JWT cookie.
- **Request Body**: None
- **Response Example**:
  ```json
  {
    "message": "Logged out successfully"
  }
  ```

### 👥 Users / Cashiers (`/api/users/cashiers`)

#### `GET /`
- **Access**: Admin
- **Description**: Returns all cashiers (excluding passwords).
- **Request**: None
- **Response Example**:
  ```json
  [
    {
      "id": 2,
      "username": "alice",
      "role": "CASHIER"
    }
  ]
  ```

#### `GET /:id`
- **Access**: Admin
- **Description**: Returns a specific cashier.
- **Request**: None
- **Response Example**:
  ```json
  {
    "id": 2,
    "username": "alice",
    "role": "CASHIER",
    "sales": []
  }
  ```

#### `POST /`
- **Access**: Admin
- **Description**: Creates a cashier profile.
- **Request Body Example**:
  ```json
  {
    "username": "bob",
    "password": "bobpassword"
  }
  ```
- **Response Example**:
  ```json
  {
    "id": 3,
    "username": "bob",
    "role": "CASHIER"
  }
  ```

#### `PUT /:id`
- **Access**: Admin
- **Description**: Updates a cashier. Hashes new password if provided.
- **Request Body Example**:
  ```json
  {
    "username": "bob_updated",
    "password": "newpassword"
  }
  ```
- **Response Example**:
  ```json
  {
    "id": 3,
    "username": "bob_updated",
    "role": "CASHIER"
  }
  ```

#### `DELETE /:id`
- **Access**: Admin
- **Description**: Deletes a cashier.
- **Request**: None
- **Response Example**:
  ```json
  {
    "message": "User deleted successfully"
  }
  ```

### 📦 Products (`/api/products`)

#### `GET /`
- **Access**: Any Auth
- **Description**: Returns all products.
- **Request**: None
- **Response Example**:
  ```json
  [
    {
      "id": 1,
      "barcode": "123456789012",
      "name": "Hammer",
      "basePrice": 10.0,
      "addition": 5.0,
      "finalPrice": 15.0,
      "stock": 50,
      "minStock": 10,
      "category": "TOOLS",
      "weight": 1.5,
      "color": "Red",
      "measureUnit": "PIECE"
    }
  ]
  ```

#### `GET /:id`
- **Access**: Any Auth
- **Description**: Returns a specific product.
- **Request**: None
- **Response Example**:
  ```json
  {
    "id": 1,
    "barcode": "123456789012",
    "name": "Hammer",
    "basePrice": 10.0,
    "addition": 5.0,
    "finalPrice": 15.0,
    "stock": 50,
    "minStock": 10,
    "category": "TOOLS",
    "weight": 1.5,
    "color": "Red",
    "measureUnit": "PIECE"
  }
  ```

#### `POST /`
- **Access**: Admin
- **Description**: Creates a product. Auto-generates `barcode` and calculates `finalPrice`.
- **Request Body Example**:
  ```json
  {
    "name": "Wrench",
    "basePrice": 8.0,
    "addition": 4.0,
    "stock": 30,
    "minStock": 5,
    "category": "TOOLS",
    "measureUnit": "PIECE"
  }
  ```
- **Response Example**:
  ```json
  {
    "id": 2,
    "barcode": "987654321098",
    "name": "Wrench",
    "basePrice": 8.0,
    "addition": 4.0,
    "finalPrice": 12.0,
    "stock": 30,
    "minStock": 5,
    "category": "TOOLS",
    "measureUnit": "PIECE"
  }
  ```

#### `PUT /:id`
- **Access**: Admin
- **Description**: Updates product. Recalculates `finalPrice` if pricing changes.
- **Request Body Example**:
  ```json
  {
    "stock": 35,
    "addition": 5.0
  }
  ```
- **Response Example**:
  ```json
  {
    "id": 2,
    "barcode": "987654321098",
    "name": "Wrench",
    "basePrice": 8.0,
    "addition": 5.0,
    "finalPrice": 13.0,
    "stock": 35,
    "minStock": 5,
    "category": "TOOLS",
    "measureUnit": "PIECE"
  }
  ```

#### `DELETE /:id`
- **Access**: Admin
- **Description**: Deletes a product.
- **Request**: None
- **Response Example**:
  ```json
  {
    "message": "Product deleted successfully"
  }
  ```

### 🤝 Clients & Debt (`/api/clients`)

#### `GET /`
- **Access**: Any Auth
- **Description**: Returns clients. Optionally filters to those with `debt > 0`.
- **Query Parameters**: `?hasDebt=true` (Optional)
- **Request**: None
- **Response Example**:
  ```json
  [
    {
      "id": 1,
      "name": "John Builder",
      "phone": "555-1234",
      "debt": 50.0,
      "createdAt": "2023-10-27T10:00:00Z"
    }
  ]
  ```

#### `GET /:id`
- **Access**: Any Auth
- **Description**: Returns client details and their 10 most recent sales.
- **Request**: None
- **Response Example**:
  ```json
  {
    "id": 1,
    "name": "John Builder",
    "phone": "555-1234",
    "debt": 50.0,
    "createdAt": "2023-10-27T10:00:00Z",
    "sales": [
      {
        "id": 101,
        "totalAmount": 100.0,
        "amountPaid": 50.0,
        "createdAt": "2023-10-28T14:30:00Z"
      }
    ]
  }
  ```

#### `POST /`
- **Access**: Any Auth
- **Description**: Creates a new client (debt defaults to 0).
- **Request Body Example**:
  ```json
  {
    "name": "Bob Plumber",
    "phone": "555-9876"
  }
  ```
- **Response Example**:
  ```json
  {
    "id": 2,
    "name": "Bob Plumber",
    "phone": "555-9876",
    "debt": 0.0,
    "createdAt": "2023-10-29T09:15:00Z"
  }
  ```

#### `PUT /:id`
- **Access**: Any Auth
- **Description**: Updates client profile.
- **Request Body Example**:
  ```json
  {
    "phone": "555-1111"
  }
  ```
- **Response Example**:
  ```json
  {
    "id": 2,
    "name": "Bob Plumber",
    "phone": "555-1111",
    "debt": 0.0,
    "createdAt": "2023-10-29T09:15:00Z"
  }
  ```

#### `POST /:id/pay`
- **Access**: Any Auth
- **Description**: Safely deducts `amountPaid` from the client's `debt`.
- **Request Body Example**:
  ```json
  {
    "amountPaid": 20.0
  }
  ```
- **Response Example**:
  ```json
  {
    "message": "Debt payment recorded",
    "client": {
      "id": 1,
      "name": "John Builder",
      "debt": 30.0
    }
  }
  ```

### 🛒 Sales & POS (`/api/sales`)

#### `POST /`
- **Access**: Any Auth
- **Description**: **Atomic Checkout:** Calculates total, deducts stock, creates sale, and adds to client debt if underpaid.
- **Request Body Example**:
  ```json
  {
    "clientId": 1,
    "amountPaid": 50.0,
    "items": [
      {
        "productId": 1,
        "quantity": 2,
        "priceSold": 15.0
      },
      {
        "productId": 2,
        "quantity": 1,
        "priceSold": 12.0
      }
    ]
  }
  ```
- **Response Example**:
  ```json
  {
    "id": 102,
    "cashierId": 2,
    "clientId": 1,
    "totalAmount": 42.0,
    "amountPaid": 50.0,
    "createdAt": "2023-10-29T11:00:00Z",
    "items": [
      {
        "id": 301,
        "productId": 1,
        "quantity": 2,
        "priceSold": 15.0
      }
    ]
  }
  ```

#### `GET /`
- **Access**: Any Auth
- **Description**: Returns past sales. Admins see all; Cashiers only see their own sales.
- **Query Parameters**: `?date=YYYY-MM-DD`, `?cashierId=2` (Optional)
- **Request**: None
- **Response Example**:
  ```json
  [
    {
      "id": 102,
      "cashierId": 2,
      "clientId": 1,
      "totalAmount": 42.0,
      "amountPaid": 50.0,
      "createdAt": "2023-10-29T11:00:00Z"
    }
  ]
  ```

#### `GET /:id`
- **Access**: Any Auth
- **Description**: Fetches a specific sale and its items (useful for reprint).
- **Request**: None
- **Response Example**:
  ```json
  {
    "id": 102,
    "cashierId": 2,
    "clientId": 1,
    "totalAmount": 42.0,
    "amountPaid": 50.0,
    "createdAt": "2023-10-29T11:00:00Z",
    "items": [
      {
        "id": 301,
        "productId": 1,
        "quantity": 2,
        "priceSold": 15.0,
        "product": {
          "name": "Hammer"
        }
      }
    ],
    "client": {
      "name": "John Builder"
    },
    "cashier": {
      "username": "alice"
    }
  }
  ```

#### `PUT /:id`
- **Access**: Admin
- **Description**: **Full Rewrite:** Reverts old stock/debt, simulates new sale, re-applies new stock/debt.
- **Request Body Example**:
  ```json
  {
    "clientId": 1,
    "amountPaid": 42.0,
    "items": [
      {
        "productId": 1,
        "quantity": 2,
        "priceSold": 15.0
      },
      {
        "productId": 2,
        "quantity": 1,
        "priceSold": 12.0
      }
    ]
  }
  ```
- **Response Example**:
  ```json
  {
    "id": 102,
    "cashierId": 2,
    "clientId": 1,
    "totalAmount": 42.0,
    "amountPaid": 42.0,
    "createdAt": "2023-10-29T11:00:00Z",
    "items": [
      {
        "productId": 1,
        "quantity": 2,
        "priceSold": 15.0
      }
    ]
  }
  ```

#### `DELETE /:id`
- **Access**: Admin
- **Description**: **Void Sale:** Safely restores stock and forgives the specific debt added by this sale.
- **Request**: None
- **Response Example**:
  ```json
  {
    "message": "Sale voided successfully"
  }
  ```

### 📊 Dashboard Analytics (`/api/dashboard`)
*All dashboard routes are strictly **Admin Only**.*

#### `GET /revenue-trend`
- **Access**: Admin
- **Description**: Groups sales by day/month. Returns `totalRevenue` and precisely calculated `totalProfit`.
- **Query Parameters**: `?period=week` or `?period=month`
- **Request**: None
- **Response Example**:
  ```json
  [
    {
      "date": "2023-10-29",
      "totalRevenue": 500.0,
      "totalProfit": 150.0
    }
  ]
  ```

#### `GET /cash-flow`
- **Access**: Admin
- **Description**: Compares total cash received (`amountPaid`) vs credit given (unpaid portion of sales).
- **Query Parameters**: `?period=month`
- **Request**: None
- **Response Example**:
  ```json
  {
    "totalCashReceived": 4000.0,
    "totalCreditGiven": 500.0
  }
  ```

#### `GET /inventory-valuation`
- **Access**: Admin
- **Description**: Sums `stock * basePrice` to show total capital tied up on shelves, grouped by `Category`.
- **Request**: None
- **Response Example**:
  ```json
  [
    {
      "category": "TOOLS",
      "totalValue": 1500.0
    },
    {
      "category": "PLUMBING",
      "totalValue": 800.0
    }
  ]
  ```

#### `GET /dead-stock`
- **Access**: Admin
- **Description**: Finds items with `stock > 0` that haven't been sold in X months.
- **Query Parameters**: `?months=6`
- **Request**: None
- **Response Example**:
  ```json
  [
    {
      "id": 5,
      "name": "Obscure Screwdriver",
      "stock": 10,
      "lastSold": "2023-01-15T00:00:00Z"
    }
  ]
  ```

#### `GET /low-stock`
- **Access**: Admin
- **Description**: Finds items where `stock <= minStock`.
- **Request**: None
- **Response Example**:
  ```json
  [
    {
      "id": 2,
      "name": "Wrench",
      "stock": 4,
      "minStock": 5
    }
  ]
  ```

#### `GET /cashier-stats`
- **Access**: Admin
- **Description**: Groups sales by cashier. Shows transaction counts and total cash collected per cashier.
- **Query Parameters**: `?date=YYYY-MM-DD`
- **Request**: None
- **Response Example**:
  ```json
  [
    {
      "cashierId": 2,
      "cashierName": "alice",
      "transactionCount": 15,
      "totalCashCollected": 600.0
    }
  ]
  ```

#### `GET /summary`
- **Access**: Admin
- **Description**: Provides a quick overview: today's revenue, today's cash, daily transaction count, out-of-stock items, and all-time totals (chiffre d'affaires, dette, ventes).
- **Request**: None
- **Response Example**:
  ```json
  {
    "todayRevenue": 850.0,
    "todayCash": 800.0,
    "transactionsToday": 25,
    "outOfStockItems": 3,
    "totalChiffreAffaires": 125000.0,
    "totalDette": 1250.0,
    "totalVentes": 430
  }
  ```
