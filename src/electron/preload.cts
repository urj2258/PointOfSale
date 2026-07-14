import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  vendors: {
    list: (search?: string, page?: number, limit?: number) => ipcRenderer.invoke('vendors:list', search, page, limit),
    get: (id: string) => ipcRenderer.invoke('vendors:get', id),
    create: (name: string, phone?: string, address?: string, mill_name?: string) => ipcRenderer.invoke('vendors:create', name, phone, address, mill_name),
    update: (id: string, name: string, phone?: string, address?: string, mill_name?: string) => ipcRenderer.invoke('vendors:update', id, name, phone, address, mill_name),
    delete: (id: string) => ipcRenderer.invoke('vendors:delete', id),
    outstanding: (id: string) => ipcRenderer.invoke('vendors:outstanding', id),
  },
  customers: {
    list: (search?: string, page?: number, limit?: number) => ipcRenderer.invoke('customers:list', search, page, limit),
    get: (id: string) => ipcRenderer.invoke('customers:get', id),
    create: (name: string, phone?: string, address?: string, shop_name?: string) => ipcRenderer.invoke('customers:create', name, phone, address, shop_name),
    update: (id: string, name: string, phone?: string, address?: string, shop_name?: string) => ipcRenderer.invoke('customers:update', id, name, phone, address, shop_name),
    delete: (id: string) => ipcRenderer.invoke('customers:delete', id),
    outstanding: (id: string) => ipcRenderer.invoke('customers:outstanding', id),
  },
  inventory: {
    list: (search?: string, page?: number, limit?: number) => ipcRenderer.invoke('inventory:list', search, page, limit),
    get: (id: string) => ipcRenderer.invoke('inventory:get', id),
    create: (name: string, unit: string, quantity: number, description?: string) => ipcRenderer.invoke('inventory:create', name, unit, quantity, description),
    update: (id: string, name: string, unit: string, description?: string) => ipcRenderer.invoke('inventory:update', id, name, unit, description),
    adjustStock: (id: string, quantityChange: number) => ipcRenderer.invoke('inventory:adjust-stock', id, quantityChange),
    delete: (id: string) => ipcRenderer.invoke('inventory:delete', id),
    lowStockCount: (threshold?: number) => ipcRenderer.invoke('inventory:low-stock-count', threshold),
  },
  vendorLedger: {
    list: (vendorId?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number) => ipcRenderer.invoke('vendor-ledger:list', vendorId, dateFrom, dateTo, page, limit),
    get: (id: string) => ipcRenderer.invoke('vendor-ledger:get', id),
    create: (vendorId: string, transactionDatetime: string, items: { productId: string; quantity: number; ratePerUnit: number }[], totalPayment: number, paidAmount: number, description?: string, vehicleNumber?: string, dueDate?: string) => ipcRenderer.invoke('vendor-ledger:create', vendorId, transactionDatetime, items, totalPayment, paidAmount, description, vehicleNumber, dueDate),
    createWithNewVendor: (vendorData: { name: string; phone: string; address: string; mill_name?: string }, purchaseData: { items: { productId: string; quantity: number; ratePerUnit: number }[]; transactionDatetime: string; totalPayment: number; paidAmount: number; description?: string; vehicleNumber?: string; dueDate?: string }) => ipcRenderer.invoke('vendor-ledger:create-with-new-vendor', vendorData, purchaseData),
    update: (id: string, vendorId: string, transactionDatetime: string, items: { productId: string; quantity: number; ratePerUnit: number }[], totalPayment: number, paidAmount: number, description?: string, vehicleNumber?: string, dueDate?: string) => ipcRenderer.invoke('vendor-ledger:update', id, vendorId, transactionDatetime, items, totalPayment, paidAmount, description, vehicleNumber, dueDate),
    delete: (id: string) => ipcRenderer.invoke('vendor-ledger:delete', id),
    pending: (vendorId: string) => ipcRenderer.invoke('vendor-ledger:pending', vendorId),
    linkToInvoice: (entryIds: string[], invoiceId: string) => ipcRenderer.invoke('vendor-ledger:link-to-invoice', entryIds, invoiceId),
  },
    customerLedger: {
      list: (customerId?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number) => ipcRenderer.invoke('customer-ledger:list', customerId, dateFrom, dateTo, page, limit),
      get: (id: string) => ipcRenderer.invoke('customer-ledger:get', id),
      createMultiItem: (customerData: any, saleData: any) => ipcRenderer.invoke('customer-ledger:create-multi-item', customerData, saleData),
      updateMultiItem: (id: string, customerId: string, saleData: any) => ipcRenderer.invoke('customer-ledger:update-multi-item', id, customerId, saleData),
      delete: (id: string) => ipcRenderer.invoke('customer-ledger:delete', id),
      pending: (customerId: string) => ipcRenderer.invoke('customer-ledger:pending', customerId),
      linkToInvoice: (entryIds: string[], invoiceId: string) => ipcRenderer.invoke('customer-ledger:link-to-invoice', entryIds, invoiceId),
    },

  vendorInvoices: {
    list: (status?: string, vendorId?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number) => ipcRenderer.invoke('vendor-invoices:list', status, vendorId, dateFrom, dateTo, page, limit),
    get: (id: string) => ipcRenderer.invoke('vendor-invoices:get', id),
    getWithItems: (id: string) => ipcRenderer.invoke('vendor-invoices:get-with-items', id),
    create: (vendorId: string, invoiceNumber: string, issueDate: string, dueDate: string, subtotal: number, taxAmount: number, discountAmount: number, total: number, paidAmount: number, notes: string | undefined, items: { productId: string; quantity: number; ratePerUnit: number }[]) => ipcRenderer.invoke('vendor-invoices:create', vendorId, invoiceNumber, issueDate, dueDate, subtotal, taxAmount, discountAmount, total, paidAmount, notes, items),
    update: (id: string, vendorId: string, invoiceNumber: string, issueDate: string, dueDate: string, subtotal: number, taxAmount: number, discountAmount: number, total: number, paidAmount: number, status: string, notes?: string) => ipcRenderer.invoke('vendor-invoices:update', id, vendorId, invoiceNumber, issueDate, dueDate, subtotal, taxAmount, discountAmount, total, paidAmount, status, notes),
    replaceItems: (id: string, items: { productId: string; quantity: number; ratePerUnit: number }[]) => ipcRenderer.invoke('vendor-invoices:replace-items', id, items),
    delete: (id: string) => ipcRenderer.invoke('vendor-invoices:delete', id),
    markPaid: (id: string) => ipcRenderer.invoke('vendor-invoices:mark-paid', id),
    summary: () => ipcRenderer.invoke('vendor-invoices:summary'),
  },
  invoices: {
    list: (status?: string, customerId?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number) => ipcRenderer.invoke('invoices:list', status, customerId, dateFrom, dateTo, page, limit),
    get: (id: string) => ipcRenderer.invoke('invoices:get', id),
    getWithItems: (id: string) => ipcRenderer.invoke('invoices:get-with-items', id),
    create: (customerId: string, invoiceNumber: string, issueDate: string, dueDate: string, subtotal: number, taxAmount: number, discountAmount: number, total: number, paidAmount: number, notes: string | undefined, items: { productId: string; quantity: number; ratePerUnit: number }[]) => ipcRenderer.invoke('invoices:create', customerId, invoiceNumber, issueDate, dueDate, subtotal, taxAmount, discountAmount, total, paidAmount, notes, items),
    update: (id: string, customerId: string, invoiceNumber: string, issueDate: string, dueDate: string, subtotal: number, taxAmount: number, discountAmount: number, total: number, paidAmount: number, status: string, notes?: string) => ipcRenderer.invoke('invoices:update', id, customerId, invoiceNumber, issueDate, dueDate, subtotal, taxAmount, discountAmount, total, paidAmount, status, notes),
    replaceItems: (id: string, items: { productId: string; quantity: number; ratePerUnit: number }[]) => ipcRenderer.invoke('invoices:replace-items', id, items),
    delete: (id: string) => ipcRenderer.invoke('invoices:delete', id),
    markPaid: (id: string) => ipcRenderer.invoke('invoices:mark-paid', id),
    summary: () => ipcRenderer.invoke('invoices:summary'),
  },
  expenseCategories: {
    list: () => ipcRenderer.invoke('expense-categories:list'),
    create: (name: string) => ipcRenderer.invoke('expense-categories:create', name),
    update: (id: string, name: string) => ipcRenderer.invoke('expense-categories:update', id, name),
    delete: (id: string) => ipcRenderer.invoke('expense-categories:delete', id),
  },
  expenses: {
    list: (categoryId?: string, month?: string, page?: number, limit?: number) => ipcRenderer.invoke('expenses:list', categoryId, month, page, limit),
    create: (categoryId: string, transactionDatetime: string, amount: number, description?: string) => ipcRenderer.invoke('expenses:create', categoryId, transactionDatetime, amount, description),
    update: (id: string, categoryId: string, transactionDatetime: string, amount: number, description?: string) => ipcRenderer.invoke('expenses:update', id, categoryId, transactionDatetime, amount, description),
    delete: (id: string) => ipcRenderer.invoke('expenses:delete', id),
    monthly: () => ipcRenderer.invoke('expenses:monthly'),
  },
  dayClosing: {
    list: (page?: number, limit?: number) => ipcRenderer.invoke('day-closing:list', page, limit),
    get: (date: string) => ipcRenderer.invoke('day-closing:get', date),
    generate: (businessDate: string) => ipcRenderer.invoke('day-closing:generate', businessDate),
    exportExcel: (businessDate: string) => ipcRenderer.invoke('day-closing:export-excel', businessDate),
    getExportDir: () => ipcRenderer.invoke('day-closing:get-export-dir'),
    chooseExportDir: () => ipcRenderer.invoke('day-closing:choose-export-dir'),
  },
  dashboard: {
    stats: (threshold?: number, period?: string, startDate?: string, endDate?: string) => ipcRenderer.invoke('dashboard:stats', threshold, period, startDate, endDate),
  },
  auth: {
    login: (email: string, password: string) => ipcRenderer.invoke('auth:login', email, password),
    ownerStatus: () => ipcRenderer.invoke('auth:owner-status'),
  },
  sync: {
    run: () => ipcRenderer.invoke('sync:run'),
    pull: () => ipcRenderer.invoke('sync:pull'),
    getLastSyncTime: () => ipcRenderer.invoke('sync:last-time'),
    onProgress: (callback: (progress: any) => void) => {
      const handler = (_event: any, progress: any) => callback(progress);
      ipcRenderer.on('sync:progress', handler);
      return () => ipcRenderer.removeListener('sync:progress', handler);
    },
  },
  db: {
    export: (destDir?: string) => ipcRenderer.invoke('db:export', destDir),
    import: () => ipcRenderer.invoke('db:import'),
    selectExportPath: () => ipcRenderer.invoke('db:select-export-path'),
    nuke: () => ipcRenderer.invoke('db:nuke'),
    openSyncLogDir: () => ipcRenderer.invoke('db:open-sync-log-dir'),
  },
  auditLog: {
    list: (page?: number, limit?: number) => ipcRenderer.invoke('audit-log:list', page, limit),
  },
})
