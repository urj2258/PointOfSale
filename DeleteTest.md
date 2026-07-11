# Delete Feature — Test Cases

All deletes in this POS system are **soft deletes** via `softDeleteRow()` in `dbHelpers.ts`, which sets:
- `deleted_at` = ISO 8601 timestamp
- `updated_at` = same ISO 8601 timestamp
- `synced` = `0`

Every query in the app filters `WHERE deleted_at IS NULL` to hide deleted records.

---

## 1. Vendors

### TC-V-001: Soft delete a vendor
- **Preconditions:** Vendor exists with no ledger entries
- **Action:** Delete the vendor
- **Expected:** `deleted_at` is set to ISO timestamp, `synced = 0`. Vendor no longer appears in vendor list.

### TC-V-002: Delete a vendor that has vendor_ledger entries
- **Preconditions:** Vendor has 3 ledger entries
- **Action:** Delete the vendor
- **Expected:** Vendor gets `deleted_at` set. Ledger entries remain **untouched** (no cascade). Ledger queries that JOIN on vendors will not return these entries because the vendor's `deleted_at IS NULL` filter excludes it. **Verify no FK constraint error.**

### TC-V-003: Delete a vendor that has vendor_invoices
- **Preconditions:** Vendor has 2 invoices
- **Action:** Delete the vendor
- **Expected:** Vendor gets `deleted_at`. Invoices remain. No cascade.

### TC-V-004: Delete a non-existent vendor
- **Preconditions:** No vendor with the given ID
- **Action:** Call `vendors:delete` with a random UUID
- **Expected:** `softDeleteRow` runs `UPDATE ... WHERE id = ?` — affects 0 rows. No error thrown. Return `{ success: true }`.

### TC-V-005: Delete same vendor twice
- **Preconditions:** Vendor exists, already soft-deleted
- **Action:** Delete again
- **Expected:** `deleted_at` is overwritten with a new timestamp. `synced` is reset to `0` again. No error.

### TC-V-006: Delete vendor with empty string ID
- **Action:** Call `vendors:delete` with `""`
- **Expected:** `assertNonEmptyString` throws validation error.

---

## 2. Customers

### TC-C-001: Soft delete a customer
- **Preconditions:** Customer exists with no ledger entries
- **Action:** Delete the customer
- **Expected:** `deleted_at` set, `synced = 0`. Customer hidden from list.

### TC-C-002: Delete a customer that has customer_ledger entries
- **Preconditions:** Customer has 5 ledger entries
- **Action:** Delete the customer
- **Expected:** Customer soft-deleted. Ledger entries remain untouched. No cascade.

### TC-C-003: Delete a customer that has invoices
- **Preconditions:** Customer has unpaid invoices
- **Action:** Delete the customer
- **Expected:** Customer soft-deleted. Invoices remain. No cascade.

### TC-C-004: Delete a non-existent customer
- **Action:** Call with random UUID
- **Expected:** 0 rows affected. Returns `{ success: true }`.

---

## 3. Inventory

### TC-I-001: Soft delete an inventory item
- **Preconditions:** Item exists, quantity = 50, not referenced by any ledger/invoice
- **Action:** Delete the item
- **Expected:** `deleted_at` set, `synced = 0`. Item hidden from inventory list.

### TC-I-002: Delete inventory item referenced by vendor_ledger
- **Preconditions:** Item has 3 vendor_ledger entries referencing it
- **Action:** Delete the item
- **Expected:** Item soft-deleted. Ledger entries remain (orphaned `product_id`). **No cascade. Verify no crash on ledger page when displaying orphaned product references.**

### TC-I-003: Delete inventory item referenced by customer_ledger
- **Preconditions:** Item has 2 customer_ledger entries
- **Action:** Delete the item
- **Expected:** Same as TC-I-002 — orphaned references, no cascade.

### TC-I-004: Delete inventory item referenced by invoice_items
- **Preconditions:** Item is in 4 invoice_items
- **Action:** Delete the item
- **Expected:** Item soft-deleted. invoice_items remain.

### TC-I-005: Verify quantity is NOT restored on delete
- **Preconditions:** Item has quantity = 100. A vendor_ledger entry added +50. Item current quantity = 150.
- **Action:** Delete the inventory item
- **Expected:** Quantity change only happens on **ledger entry** delete, not inventory item delete. Verify quantity field is irrelevant after soft-delete since item is hidden.

---

## 4. Vendor Ledger Entries

### TC-VL-001: Soft delete a vendor ledger entry (no linked invoice)
- **Preconditions:** Ledger entry with `vendor_invoice_id = NULL`, quantity = 10, product_id = P1
- **Action:** Delete the entry
- **Expected:**
  1. Entry gets `deleted_at` set, `synced = 0`
  2. `inventory.quantity` for P1 is **decremented by 10** (stock reversal)
  3. No invoice sync occurs (`vendor_invoice_id` is NULL)

### TC-VL-002: Soft delete a vendor ledger entry with linked vendor_invoice
- **Preconditions:** Ledger entry with `vendor_invoice_id = INV-1`, quantity = 20, paid_amount = 500
- **Action:** Delete the entry
- **Expected:**
  1. Entry soft-deleted
  2. Inventory quantity reduced by 20
  3. `syncVendorInvoiceFromLedger()` is called — INV-1's `subtotal`, `paid_amount`, `remaining_balance`, and `status` are recalculated excluding this entry

### TC-VL-003: Verify inventory quantity does not go negative
- **Preconditions:** Item P1 has quantity = 5. Ledger entry for P1 has quantity = 10 (should not be possible with CHECK constraint, but test edge case).
- **Action:** Delete the ledger entry
- **Expected:** `quantity = quantity - 10` would make it negative. Verify if CHECK constraint `quantity >= 0` on inventory prevents this. **This is a potential bug** — deleting a ledger entry could violate the inventory CHECK constraint.

### TC-VL-004: Delete a non-existent ledger entry
- **Action:** Call with random UUID
- **Expected:** `getVendorLedgerById` returns undefined → `throw new Error('Vendor ledger entry not found')`. Error propagates to IPC caller.

### TC-VL-005: Transaction rollback on failure
- **Preconditions:** Ledger entry exists, but inventory update fails (e.g., DB locked)
- **Action:** Delete the entry
- **Expected:** The entire `db.transaction()` rolls back — ledger entry is NOT soft-deleted, inventory is NOT changed.

---

## 5. Customer Ledger Entries

### TC-CL-001: Soft delete a customer ledger entry (no linked invoice)
- **Preconditions:** Entry with `invoice_id = NULL`, quantity = 10, product_id = P1
- **Action:** Delete the entry
- **Expected:**
  1. Entry soft-deleted
  2. `inventory.quantity` for P1 is **incremented by 10** (stock returned)
  3. No invoice sync

### TC-CL-002: Soft delete a customer ledger entry with linked invoice
- **Preconditions:** Entry with `invoice_id = INV-2`, paid_amount = 300
- **Action:** Delete the entry
- **Expected:**
  1. Entry soft-deleted
  2. Inventory quantity increased by entry.quantity
  3. `syncCustomerInvoiceFromLedger()` recalculates INV-2's totals excluding this entry

### TC-CL-003: Delete non-existent customer ledger entry
- **Expected:** Throws `'Customer ledger entry not found'`

### TC-CL-004: Verify invoice status recalculation
- **Preconditions:** Invoice INV-2 has 3 ledger entries. Total = 1000, paid = 800 (across entries). Status = 'Pending'.
- **Action:** Delete the entry that contributed paid_amount = 800
- **Expected:** After delete, INV-2's `paid_amount` drops to 0. `remaining_balance` = 1000. Status recalculated (likely still 'Pending' or 'Overdue').

---

## 6. Invoices (cascades to invoice_items)

### TC-INV-001: Soft delete an invoice
- **Preconditions:** Invoice with 3 items, `deleted_at IS NULL` on all items
- **Action:** Delete the invoice
- **Expected (within a single transaction):**
  1. Invoice gets `deleted_at` set, `synced = 0`
  2. All 3 invoice_items get `deleted_at` set, `synced = 0`
  3. Invoice and items disappear from invoice list and detail view

### TC-INV-002: Delete invoice where some items are already soft-deleted
- **Preconditions:** Invoice with 5 items total. 2 already soft-deleted (`deleted_at IS NULL` is false).
- **Action:** Delete the invoice
- **Expected:** Only the 3 non-deleted items get `deleted_at` set. The 2 already-deleted items are untouched (the `AND deleted_at IS NULL` clause skips them).

### TC-INV-003: Delete invoice does NOT cascade to customer_ledger
- **Preconditions:** Invoice INV-2 has `invoice_id` referenced by 3 customer_ledger entries
- **Action:** Delete INV-2
- **Expected:** Invoice and invoice_items are soft-deleted. Customer ledger entries remain with `invoice_id = INV-2`. **Orphaned references — verify no crash when viewing those ledger entries.**

### TC-INV-004: Delete invoice does NOT restore inventory
- **Preconditions:** Invoice items reduced inventory when created
- **Action:** Delete the invoice
- **Expected:** Inventory quantities are NOT restored. Invoice items are soft-deleted but no inventory adjustment occurs. **This is a potential business logic gap.**

### TC-INV-005: Verify transaction atomicity
- **Preconditions:** Invoice with 3 items
- **Action:** Delete invoice (transaction wraps both soft-deletes)
- **Expected:** Either both invoice and all items are soft-deleted, or neither is. No partial state.

---

## 7. Vendor Invoices (cascades to vendor_invoice_items)

### TC-VI-001: Soft delete a vendor invoice
- **Preconditions:** Vendor invoice with 4 items, all non-deleted
- **Action:** Delete the vendor invoice
- **Expected:**
  1. Vendor invoice soft-deleted
  2. All 4 vendor_invoice_items soft-deleted (within transaction)
  3. `synced = 0` on all affected rows

### TC-VI-002: Delete vendor invoice where items are partially deleted
- **Preconditions:** Vendor invoice with 3 items, 1 already deleted
- **Action:** Delete the vendor invoice
- **Expected:** Only 2 remaining items get `deleted_at` set. The already-deleted item is skipped.

### TC-VI-003: Delete vendor invoice does NOT cascade to vendor_ledger
- **Preconditions:** Vendor invoice has `vendor_ledger` entries with `vendor_invoice_id` pointing to it
- **Action:** Delete the vendor invoice
- **Expected:** Vendor ledger entries remain with their `vendor_invoice_id`. **Orphaned reference.**

### TC-VI-004: Delete vendor invoice does NOT restore inventory
- **Expected:** Same gap as TC-INV-004. No inventory adjustment on vendor invoice delete.

---

## 8. Expenses

### TC-E-001: Soft delete an expense
- **Preconditions:** Expense exists with amount = 500
- **Action:** Delete the expense
- **Expected:** `deleted_at` set, `synced = 0`. Expense hidden from list. No inventory or ledger side effects.

### TC-E-002: Delete expense does NOT cascade to expense_categories
- **Expected:** Category remains untouched.

---

## 9. Expense Categories

### TC-EC-001: Soft delete an expense category
- **Preconditions:** Category has 5 expenses
- **Action:** Delete the category
- **Expected:** Category soft-deleted. 5 expenses remain (orphaned `category_id`). **No cascade.**

### TC-EC-002: Verify orphaned expenses display
- **Preconditions:** Category deleted, expenses still reference it
- **Action:** View expenses list
- **Expected:** Check if the category name JOIN returns NULL or crashes. Verify UI handles missing category gracefully.

---

## 10. Day Closing Reports

### TC-DCR-001: Delete a day closing report (if delete is implemented)
- **Preconditions:** Report exists for 2026-07-11
- **Action:** Delete the report
- **Expected:** `deleted_at` set. Report hidden. No cascade to customer_ledger/vendor_ledger/expenses.

---

## 11. Sync Behavior After Delete

### TC-SYNC-001: Push deleted record to Turso
- **Preconditions:** Vendor soft-deleted locally, `synced = 0`
- **Action:** Run sync
- **Expected:** Pusher upserts the entire row (including `deleted_at` timestamp) to Turso. Local `synced` becomes `1`.

### TC-SYNC-002: Pull deleted record from Turso to second device
- **Preconditions:** Device A deletes vendor, pushes to Turso. Device B has not synced.
- **Action:** Device B runs sync
- **Expected:** Puller fetches vendor with `deleted_at` set via `INSERT OR REPLACE`. Vendor disappears on Device B.

### TC-SYNC-003: Conflicting delete — Device A deletes, Device B updates
- **Preconditions:** Device A soft-deletes vendor at T1. Device B updates vendor name at T2 (T2 > T1).
- **Action:** Both sync
- **Expected:** Last-write-wins by `updated_at`. If B's update is later, the vendor reappears (deleted_at cleared by the update). If A's delete is later, vendor stays deleted.

### TC-SYNC-004: Deleted vendor with unsynced ledger entries
- **Preconditions:** Vendor has 3 ledger entries, all `synced = 0`. Vendor is deleted.
- **Action:** Run sync
- **Expected:** Vendor is pushed first (SYNC_TABLE_ORDER), then ledger entries. Ledger entries reference the now-deleted vendor on Turso. **FK constraint may fail if `PRAGMA foreign_keys = OFF` does not persist. Verify no push failures.**

### TC-SYNC-005: Re-delete after pull
- **Preconditions:** Device A deletes vendor, syncs. Device B pulls (vendor deleted). Device A force-undoes the delete (clears deleted_at locally), syncs.
- **Action:** Device B syncs again
- **Expected:** Vendor reappears on Device B via last-write-wins.

---

## 12. Edge Cases & Potential Bugs

### TC-EDGE-001: Double delete race condition
- **Preconditions:** Two rapid clicks on delete button
- **Action:** Two delete calls fire for the same ID
- **Expected:** First sets `deleted_at`. Second overwrites with new timestamp, resets `synced = 0`. No error. Mildly wasteful but not harmful.

### TC-EDGE-002: Delete with null/undefined ID
- **Action:** Call `vendors:delete` with `null` or `undefined`
- **Expected:** `assertNonEmptyString` throws. No DB operation.

### TC-EDGE-003: Delete during active sync
- **Preconditions:** Sync is pushing vendor_ledger rows
- **Action:** User deletes a vendor_ledger entry mid-sync
- **Expected:** SQLite WAL mode handles concurrency. The sync uses `better-sqlite3` (synchronous) so there's no true parallelism in the main process, but verify no锁 contention.

### TC-EDGE-004: Inventory quantity reversal goes negative
- **Preconditions:** Vendor ledger entry exists with quantity = 100. Item has quantity = 50 (should not happen with CHECK constraint but test).
- **Action:** Delete the vendor ledger entry
- **Expected:** `inventory.quantity = 50 - 100 = -50`. CHECK constraint `quantity >= 0` should **reject this** and roll back the transaction. **This is a real bug scenario — user could create entries in wrong order or bypass constraints.**

### TC-EDGE-005: Orphaned FK references after parent delete
- **Preconditions:** Vendor deleted. vendor_ledger entries still reference `vendor_id`.
- **Action:** View vendor ledger page
- **Expected:** Verify the JOIN query doesn't crash. Check if deleted vendor's name shows as NULL/blank or if the entry is filtered out.

### TC-EDGE-006: Soft-delete then re-create same entity
- **Preconditions:** Vendor "ABC" deleted. User creates new vendor "ABC" (new UUID).
- **Action:** Create vendor_ledger entry for new "ABC"
- **Expected:** Works fine — different UUID means no conflict. Old ledger entries still reference old UUID (orphaned).

### TC-EDGE-007: Replace invoice items after invoice is soft-deleted
- **Preconditions:** Invoice is soft-deleted (`deleted_at` set)
- **Action:** Call `replaceInvoiceItems` on the deleted invoice
- **Expected:** `getInvoiceItems` returns items (no `deleted_at` filter in that query). Old items soft-deleted again (harmless). New items inserted. **But the invoice is deleted — verify no UI path allows this.**

---

## 13. UI/UX Tests

### TC-UI-001: Delete confirmation modal
- **Action:** Click delete on any entity
- **Expected:** `ConfirmModal` with `danger` styling appears. Shows confirmation text.

### TC-UI-002: Cancel delete
- **Action:** Open delete modal, click cancel
- **Expected:** Modal closes, nothing deleted, `deletingId` reset to `null`.

### TC-UI-003: List refreshes after delete
- **Action:** Confirm delete
- **Expected:** `load()` is called, list refreshes, deleted item no longer visible.

### TC-UI-004: Error handling on delete failure
- **Preconditions:** Delete throws an error (e.g., non-existent ID for ledger entries)
- **Action:** Attempt delete
- **Expected:** Verify error is caught and user sees appropriate feedback (check if `try/catch` exists in the frontend page components).
