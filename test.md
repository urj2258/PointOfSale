# Testing Guide — POS Application

## Prerequisites

- Node.js installed
- The app compiles: `npm run build` exits with 0 errors

---

## 1. First Launch & Owner Registration

### Test: First-time setup
1. Delete the database file if it exists:  
   `C:\Users\<you>\AppData\Roaming\pos\pos.db` (Windows)  
   `~/Library/Application Support/pos/pos.db` (macOS)
2. Run the app: `npm run dev`
3. The login page appears
4. **Expected**: "Register as Owner" link is visible below the form (no owner exists yet)

### Test: Register owner
1. Click "Register as Owner"
2. Fill in:
   - Full Name: `Test Owner`
   - Email: `owner@test.com`
   - Username: `owner`
   - Password: `test123`
   - Confirm Password: `test123`
3. Click "Create Owner Account"
4. **Expected**: Redirected to login page

### Test: Login with owner
1. Enter email: `owner@test.com`, password: `test123`
2. Click Sign In
3. **Expected**: Redirected to Dashboard, "Good morning, Test Owner" in header

### Test: Wrong credentials
1. Enter email: `owner@test.com`, password: `wrongpass`
2. Click Sign In
3. **Expected**: Error message "Invalid email or password.", stays on login page

### Test: Second registration blocked
1. Logout (Settings page → Logout)
2. Navigate to `/register`
3. **Expected**: Page shows "Already Registered — An owner account already exists" with "Go to Login" button

### Test: Default owner credentials (fresh DB)
1. Delete the database and restart
2. Default owner is seeded: email `owner@pos.com`, password `owner123`
3. **Expected**: Login works with these credentials without needing to register

---

## 2. Dashboard

### Test: Dashboard loads with zeros
1. Login with a fresh database (no data entered yet)
2. **Expected**:
   - Total Vendors: 0
   - Total Customers: 0
   - Inventory Items: 0
   - Low Stock Items: 0
   - Today's Sales: Rs. 0
   - Today's Purchases: Rs. 0
   - Today's Expenses: Rs. 0
   - Recent Transactions: "No recent transactions"
   - Low Stock Alert: "All items are well stocked"

### Test: Dashboard updates after data entry
After creating vendors, customers, inventory, ledger entries, and expenses (steps below):
1. Return to Dashboard
2. **Expected**: Counts and amounts reflect the data you entered

---

## 3. Vendors Module

### Test: Create vendor
1. Go to Vendors page
2. Click "Add Vendor"
3. Fill Name: `ABC Suppliers`, Phone: `0300-1234567`, Address: `123 Main Street`, Mill Name: `ABC Mill`
4. Click Save
5. **Expected**: Vendor appears in the table

### Test: Create vendor with minimal fields
1. Click "Add Vendor"
2. Enter Name only: `Test Vendor`
3. Click Save
4. **Expected**: Vendor appears with empty/null fields for phone, address, mill_name

### Test: Validation — empty name
1. Click "Add Vendor", leave Name blank
2. Click Save
3. **Expected**: Error "Name is required"

### Test: Search vendors
1. Type a partial name in the search box
2. **Expected**: Table filters to matching vendors only

### Test: Edit vendor
1. Click the pencil icon on a vendor row
2. Change the name
3. Click Save
4. **Expected**: Table updates with the new name

### Test: Delete vendor (soft delete)
1. Click the trash icon on a vendor row
2. Confirm in the browser dialog
3. **Expected**: Vendor disappears from the table
4. Re-search: vendor is gone (but still exists in DB with `deleted_at` set)

---

## 4. Customers Module

### Test: Create customer
1. Go to Customers page
2. Click "Add Customer"
3. Fill Name: `BuildMart`, Phone: `0301-7654321`, Address: `456 Oak Road`, Shop Name: `BuildMart Store`
4. Click Save
5. **Expected**: Customer appears in table

### Test: Create customer with minimal fields
1. Click "Add Customer", enter only a name
2. **Expected**: Customer saved successfully

### Test: Search, Edit, Delete customers
Same flow as Vendors:
- Search filters by name or phone
- Edit updates the record
- Delete soft-deletes (disappears from UI)

---

## 5. Inventory Module

### Test: Create product
1. Go to Inventory page
2. Click "Add Product"
3. Name: `Cement`, Unit: `bags`, Description: `Ordinary Portland Cement`
4. Click Save
5. **Expected**: Product appears with quantity 0

### Test: Create more products
- `Steel Bars`, Unit: `kg`
- `Bricks`, Unit: `pieces`
- `Sand`, Unit: `cubic feet`

### Test: Validation — missing name or unit
1. Click "Add Product", leave Name blank
2. Click Save
3. **Expected**: Error "Name and unit are required"

### Test: Adjust stock — increase
1. Click "Adjust Stock" on Cement row
2. Enter Quantity Change: `500`
3. Click "Update Stock"
4. **Expected**: Cement quantity shows 500 bags

### Test: Adjust stock — decrease
1. Click "Adjust Stock" on Cement row
2. Enter Quantity Change: `-50`
3. Click "Update Stock"
4. **Expected**: Cement quantity shows 450 bags

### Test: Adjust stock — prevents negative
1. Enter Quantity Change: `-99999`
2. Click "Update Stock"
3. **Expected**: Error or operation fails (inventory CHECK constraint `quantity >= 0`)

### Test: Low stock indicator
1. Set a product's quantity to 10 or less
2. **Expected**: Quantity text turns orange in the table

### Test: Dashboard low stock alert
1. Dashboard should show the low-stock product in the "Low Stock Alert" section

### Test: Search products
Type partial name in search → table filters

### Test: Edit product
Change name or unit → saves correctly

### Test: Delete product
Soft-deletes (disappears from UI)

---

## 6. Vendor Ledger (Purchases)

### Test: Create a purchase entry
1. Go to Vendor Ledger page
2. Click "New Purchase"
3. Select Vendor: `ABC Suppliers`
4. Select Product: `Cement`
5. Date & Time: today's date
6. Quantity: `100`
7. Rate/Unit: `1200`
8. **Expected**: Computed total shows Rs. 120,000
9. Total Payment: `120000`
10. Paid Amount: `50000`
11. **Expected**: Remaining balance shows Rs. 70,000
12. Vehicle Number: `ABC-123`
13. Click Save

### Test: Verify inventory updated
1. Go to Inventory page
2. **Expected**: Cement quantity increased by 100

### Test: Validation — paid > total
1. Try creating a purchase with Paid Amount: 200000, Total Payment: 100000
2. **Expected**: Error "Paid amount cannot exceed total payment"

### Test: Filter by vendor
1. Select a specific vendor in the filter dropdown
2. **Expected**: Only that vendor's purchases shown

### Test: Filter by date range
1. Set From and To dates
2. **Expected**: Only purchases within that range shown

### Test: Clear filters
1. Click "Clear"
2. **Expected**: All purchases shown again

### Test: Edit purchase (update paid amount)
1. Click pencil icon on a purchase row
2. Change Paid Amount
3. Click Save
4. **Expected**: Remaining balance recalculated (paid_amount and remaining_balance update)

### Test: Delete purchase
1. Click trash icon, confirm
2. **Expected**: Entry disappears AND inventory quantity decreases by the purchase quantity
3. Verify in Inventory page

---

## 7. Customer Ledger (Sales)

### Test: Create a sale entry
1. Go to Customer Ledger page
2. Click "New Sale"
3. Select Customer: `BuildMart`
4. Select Product: `Cement`
5. Quantity: `20`
6. Rate/Unit: `1500`
7. Total Payment: `30000`
8. Paid Amount: `30000` (fully paid)
9. **Expected**: Remaining balance shows Rs. 0 (cleared, green text)
10. Click Save

### Test: Verify inventory decreased
1. Go to Inventory
2. **Expected**: Cement decreased by 20

### Test: Create another sale with partial payment
- Customer: `BuildMart`
- Product: `Steel Bars`
- Quantity: `10`, Rate: `5000`, Total: `50000`, Paid: `30000`
- **Expected**: Remaining balance Rs. 20,000 (orange text)

### Test: Filter by customer and date
Same behavior as Vendor Ledger filters

### Test: Edit sale (update payment)
Same as Vendor Ledger — only paid_amount can be modified on existing entries

### Test: Delete sale
Deletes entry AND restores inventory quantity

---

## 8. Expenses Module

### Test: View expense categories
1. Go to Expenses page
2. Click "Categories" tab
3. **Expected**: 7 pre-seeded categories: Electricity Bill, Travelling Expense, Employee Salary, Daily Wages, Vehicle Expenses, Office Rent, Miscellaneous Expenses

### Test: Create expense category
1. Click "Add Category"
2. Name: `Stationery`
3. **Expected**: New category appears in list

### Test: Edit category
Click pencil → rename → save

### Test: Delete category
Click trash → confirm → category removed (existing expenses with this category are not affected because FK prevents cascade — update or handle accordingly)

### Test: Create expense
1. Switch to "Expenses" tab
2. Click "Add Expense"
3. Select Category: `Electricity Bill`
4. Date: today
5. Amount: `15000`
6. Description: `July bill`
7. Save
8. **Expected**: Expense appears in table

### Test: Filter expenses by category
Select a category → only matching expenses shown

### Test: Filter by month
Use the month input → expenses for that month only

### Test: Monthly expense view
(Backend has `getMonthlyExpenses` endpoint available if you want to display grouped data)

---

## 9. Day Closing

### Test: Generate day closing
1. Go to Day Closing page
2. Click "Generate Today's Report"
3. **Expected**: Success message "Day closing report generated successfully"
4. Report appears in the table with:
   - Total Sales (sum of today's customer ledger entries)
   - Total Purchases (sum of today's vendor ledger entries)
   - Total Expenses (sum of today's expenses)
   - Net = Sales - Purchases - Expenses

### Test: Day closing table shows history
1. Generate reports on different days (change transaction dates)
2. **Expected**: Each day appears as a separate row

### Test: Regenerate for same day
1. Click "Generate Today's Report" again
2. **Expected**: Confirmation dialog "A closing report for today already exists. Generate again?"
3. Confirm → report regenerates with updated data

### Test: Dashboard reflects day totals
Today's Sales/Purchases/Expenses on Dashboard match what's in the Day Closing report

---

## 10. Settings

### Test: Settings page
1. Navigate to Settings
2. **Expected**:
   - Shows logged-in user's name and email
   - Logout button works
   - App version displayed

### Test: Logout
1. Click "Logout"
2. **Expected**: Redirected to login page, can't access dashboard without logging in again

---

## 11. Navigation & Routing

### Test: Sidebar navigation
Each sidebar item navigates to the correct page:
- Dashboard → `/dashboard`
- Vendors → `/vendors`
- Customers → `/customers`
- Inventory → `/inventory`
- Vendor Ledger → `/vendor-ledger`
- Customer Ledger → `/customer-ledger`
- Expenses → `/expenses`
- Day Closing → `/day-closing`
- Settings → `/settings`

### Test: Protected routes
1. Logout
2. Try manually navigating to `/dashboard`
3. **Expected**: Redirected to `/login`

### Test: Responsive sidebar
1. Shrink browser width
2. **Expected**: Sidebar collapses, hamburger menu appears in header
3. Click hamburger → sidebar slides in

---

## 12. Data Integrity Tests

### Test: Soft deletes preserve history
1. Delete a vendor who has ledger entries
2. Ledger entries should still appear (they JOIN on vendor ID — soft delete sets `deleted_at`, doesn't remove the row)

### Test: Foreign key constraints
Try inserting a vendor_ledger entry with a non-existent vendor_id
- **Expected**: SQLite throws FOREIGN KEY constraint error (caught by IPC handler)

### Test: CHECK constraints
Try updating inventory quantity to negative directly (if possible through UI) — should be blocked

### Test: WAL mode
Open the app, make changes, hard-kill the process, reopen
- **Expected**: Database is not corrupted (WAL mode is crash-safe)

---

## 13. Build Verification

```bash
npm run transpile:electron   # Compiles main process TypeScript
npm run build                # Full production build
npm run dev                  # Development mode (hot reload)
```

All three commands should exit with 0 errors.

---

## 14. Test Data Quick Reference

| Module | Suggested Test Data |
|---|---|
| Vendors | ABC Suppliers, XYZ Traders, Test Vendor |
| Customers | BuildMart, HomeConstruct, Test Customer |
| Inventory | Cement (bags), Steel Bars (kg), Bricks (pieces), Sand (cubic ft) |
| Purchases | Buy 100 cement @ 1200 from ABC, Buy 50 steel @ 5000 from XYZ |
| Sales | Sell 20 cement @ 1500 to BuildMart, Sell 10 steel @ 6000 to HomeConstruct |
| Expenses | Electricity 15000, Employee Salary 50000, Vehicle 8000 |
| Day Closing | Generate after entering data for the day |
