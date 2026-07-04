export interface Vendor {
  id: string
  name: string
  phone: string | null
  address: string | null
  mill_name: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  address: string | null
  shop_name: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
}

export interface InventoryItem {
  id: string
  name: string
  unit: string
  quantity: number
  description: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
}

export interface VendorLedgerEntry {
  id: string
  vendor_id: string
  product_id: string
  transaction_datetime: string
  description: string | null
  vehicle_number: string | null
  quantity: number
  rate_per_unit: number
  total_payment: number
  paid_amount: number
  remaining_balance: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
  vendor_name?: string
  product_name?: string
}

export interface CustomerLedgerEntry {
  id: string
  customer_id: string
  product_id: string
  transaction_datetime: string
  description: string | null
  vehicle_number: string | null
  quantity: number
  rate_per_unit: number
  total_payment: number
  paid_amount: number
  remaining_balance: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
  customer_name?: string
  product_name?: string
}

export interface ExpenseCategory {
  id: string
  name: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
}

export interface Expense {
  id: string
  category_id: string
  transaction_datetime: string
  amount: number
  description: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
  category_name?: string
}

export interface DayClosingReport {
  id: string
  business_date: string
  total_sales: number
  total_purchases: number
  total_expenses: number
  created_at: string
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
