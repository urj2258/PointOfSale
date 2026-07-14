const e = (window as any).electron

export const api = {
  vendors: {
    list: (search?: string, page?: number, limit?: number) => e.vendors.list(search, page, limit),
    get: (id: string) => e.vendors.get(id),
    create: (name: string, phone?: string, address?: string, millName?: string) => e.vendors.create(name, phone, address, millName),
    update: (id: string, name: string, phone?: string, address?: string, millName?: string) => e.vendors.update(id, name, phone, address, millName),
    delete: (id: string) => e.vendors.delete(id),
    outstanding: (id: string) => e.vendors.outstanding(id),
  },
  customers: {
    list: (search?: string, page?: number, limit?: number) => e.customers.list(search, page, limit),
    get: (id: string) => e.customers.get(id),
    create: (name: string, phone?: string, address?: string, shopName?: string) => e.customers.create(name, phone, address, shopName),
    update: (id: string, name: string, phone?: string, address?: string, shopName?: string) => e.customers.update(id, name, phone, address, shopName),
    delete: (id: string) => e.customers.delete(id),
    outstanding: (id: string) => e.customers.outstanding(id),
  },
  inventory: {
    list: (search?: string, page?: number, limit?: number) => e.inventory.list(search, page, limit),
    get: (id: string) => e.inventory.get(id),
    create: (name: string, unit: string, quantity: number, description?: string) => e.inventory.create(name, unit, quantity, description),
    update: (id: string, name: string, unit: string, description?: string) => e.inventory.update(id, name, unit, description),
    adjustStock: (id: string, quantityChange: number) => e.inventory.adjustStock(id, quantityChange),
    delete: (id: string) => e.inventory.delete(id),
    lowStockCount: (threshold?: number) => e.inventory.lowStockCount(threshold),
  },
  vendorLedger: {
    list: (vendorId?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number) => e.vendorLedger.list(vendorId, dateFrom, dateTo, page, limit),
    get: (id: string) => e.vendorLedger.get(id),
    create: (vendorId: string, transactionDatetime: string, items: { productId: string; quantity: number; ratePerUnit: number }[], totalPayment: number, paidAmount: number, description?: string, vehicleNumber?: string, dueDate?: string) => e.vendorLedger.create(vendorId, transactionDatetime, items, totalPayment, paidAmount, description, vehicleNumber, dueDate),
    createWithNewVendor: (
      vendorData: { name: string; phone: string; address: string; mill_name?: string },
      purchaseData: { items: { productId: string; quantity: number; ratePerUnit: number }[]; transactionDatetime: string; totalPayment: number; paidAmount: number; description?: string; vehicleNumber?: string; dueDate?: string }
    ) => e.vendorLedger.createWithNewVendor(vendorData, purchaseData),
    update: (id: string, vendorId: string, transactionDatetime: string, items: { productId: string; quantity: number; ratePerUnit: number }[], totalPayment: number, paidAmount: number, description?: string, vehicleNumber?: string, dueDate?: string) => e.vendorLedger.update(id, vendorId, transactionDatetime, items, totalPayment, paidAmount, description, vehicleNumber, dueDate),
    delete: (id: string) => e.vendorLedger.delete(id),
    pending: (vendorId: string) => e.vendorLedger.pending(vendorId),
    linkToInvoice: (entryIds: string[], invoiceId: string) => e.vendorLedger.linkToInvoice(entryIds, invoiceId),
  },
    customerLedger: {
      list: (customerId?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number) => e.customerLedger.list(customerId, dateFrom, dateTo, page, limit),
      get: (id: string) => e.customerLedger.get(id),
      createMultiItem: (
        customerData: { id?: string; name: string; phone: string; address: string; shop_name?: string },
        saleData: { items: { productId: string; quantity: number; ratePerUnit: number }[]; transactionDatetime: string; totalPayment: number; paidAmount: number; description?: string; vehicleNumber?: string; dueDate?: string }
      ) => e.customerLedger.createMultiItem(customerData, saleData),
      updateMultiItem: (id: string, customerId: string, saleData: { items: { productId: string; quantity: number; ratePerUnit: number }[]; transactionDatetime: string; totalPayment: number; paidAmount: number; description?: string; vehicleNumber?: string; dueDate?: string }) => e.customerLedger.updateMultiItem(id, customerId, saleData),
      delete: (id: string) => e.customerLedger.delete(id),
      pending: (customerId: string) => e.customerLedger.pending(customerId),
      linkToInvoice: (entryIds: string[], invoiceId: string) => e.customerLedger.linkToInvoice(entryIds, invoiceId),
    },

  vendorInvoices: {
    list: (status?: string, vendorId?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number) => e.vendorInvoices.list(status, vendorId, dateFrom, dateTo, page, limit),
    get: (id: string) => e.vendorInvoices.get(id),
    getWithItems: (id: string) => e.vendorInvoices.getWithItems(id),
    create: (vendorId: string, invoiceNumber: string, issueDate: string, dueDate: string, subtotal: number, taxAmount: number, discountAmount: number, total: number, paidAmount: number, notes: string | undefined, items: { productId: string; quantity: number; ratePerUnit: number }[]) => e.vendorInvoices.create(vendorId, invoiceNumber, issueDate, dueDate, subtotal, taxAmount, discountAmount, total, paidAmount, notes, items),
    update: (id: string, vendorId: string, invoiceNumber: string, issueDate: string, dueDate: string, subtotal: number, taxAmount: number, discountAmount: number, total: number, paidAmount: number, status: string, notes?: string) => e.vendorInvoices.update(id, vendorId, invoiceNumber, issueDate, dueDate, subtotal, taxAmount, discountAmount, total, paidAmount, status, notes),
    replaceItems: (id: string, items: { productId: string; quantity: number; ratePerUnit: number }[]) => e.vendorInvoices.replaceItems(id, items),
    delete: (id: string) => e.vendorInvoices.delete(id),
    markPaid: (id: string) => e.vendorInvoices.markPaid(id),
    summary: () => e.vendorInvoices.summary(),
  },
  invoices: {
    list: (status?: string, customerId?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number) => e.invoices.list(status, customerId, dateFrom, dateTo, page, limit),
    get: (id: string) => e.invoices.get(id),
    getWithItems: (id: string) => e.invoices.getWithItems(id),
    create: (customerId: string, invoiceNumber: string, issueDate: string, dueDate: string, subtotal: number, taxAmount: number, discountAmount: number, total: number, paidAmount: number, notes: string | undefined, items: { productId: string; quantity: number; ratePerUnit: number }[]) => e.invoices.create(customerId, invoiceNumber, issueDate, dueDate, subtotal, taxAmount, discountAmount, total, paidAmount, notes, items),
    update: (id: string, customerId: string, invoiceNumber: string, issueDate: string, dueDate: string, subtotal: number, taxAmount: number, discountAmount: number, total: number, paidAmount: number, status: string, notes?: string) => e.invoices.update(id, customerId, invoiceNumber, issueDate, dueDate, subtotal, taxAmount, discountAmount, total, paidAmount, status, notes),
    replaceItems: (id: string, items: { productId: string; quantity: number; ratePerUnit: number }[]) => e.invoices.replaceItems(id, items),
    delete: (id: string) => e.invoices.delete(id),
    markPaid: (id: string) => e.invoices.markPaid(id),
    summary: () => e.invoices.summary(),
  },
  expenseCategories: {
    list: () => e.expenseCategories.list(),
    create: (name: string) => e.expenseCategories.create(name),
    update: (id: string, name: string) => e.expenseCategories.update(id, name),
    delete: (id: string) => e.expenseCategories.delete(id),
  },
  expenses: {
    list: (categoryId?: string, month?: string, page?: number, limit?: number) => e.expenses.list(categoryId, month, page, limit),
    create: (categoryId: string, transactionDatetime: string, amount: number, description?: string) => e.expenses.create(categoryId, transactionDatetime, amount, description),
    update: (id: string, categoryId: string, transactionDatetime: string, amount: number, description?: string) => e.expenses.update(id, categoryId, transactionDatetime, amount, description),
    delete: (id: string) => e.expenses.delete(id),
    monthly: () => e.expenses.monthly(),
  },
  dayClosing: {
    list: (page?: number, limit?: number) => e.dayClosing.list(page, limit),
    get: (date: string) => e.dayClosing.get(date),
    generate: (businessDate: string) => e.dayClosing.generate(businessDate),
  },
  dashboard: {
    stats: (threshold?: number, period?: string, startDate?: string, endDate?: string) => e.dashboard.stats(threshold, period, startDate, endDate),
  },
  auth: {
    login: (email: string, password: string) => e.auth.login(email, password),
    ownerStatus: () => e.auth.ownerStatus(),
  },
  sync: {
    run: () => e.sync.run(),
    pull: () => e.sync.pull(),
    getLastSyncTime: () => e.sync.getLastSyncTime(),
    onProgress: (callback: (progress: any) => void) => e.sync.onProgress(callback),
  },
  db: {
    export: (destDir?: string) => e.db.export(destDir),
    import: () => e.db.import(),
    selectExportPath: () => e.db.selectExportPath(),
    nuke: () => e.db.nuke(),
    openSyncLogDir: () => e.db.openSyncLogDir(),
  },
  auditLog: {
    list: (page?: number, limit?: number) => e.auditLog.list(page, limit),
  },
}
