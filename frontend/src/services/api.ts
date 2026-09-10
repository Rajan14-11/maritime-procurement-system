import {
  User,
  Vessel,
  Vendor,
  PurchaseRequest,
  Rfq,
  PurchaseOrder,
  GoodsReceipt,
  AuditLog,
  DashboardSummary,
} from '../types/index.js';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  statusCode: number;
  data: any;

  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('maritime_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as any)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  let responseData: any;
  try {
    responseData = await response.json();
  } catch (err) {
    responseData = null;
  }

  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      // Clear token and redirect to login on 401 unauthorized
      localStorage.removeItem('maritime_token');
      localStorage.removeItem('maritime_user');
      window.location.href = '/login';
    }
    const message = responseData?.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, responseData);
  }

  return responseData.data !== undefined ? responseData.data : responseData;
}

function buildQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '' && val !== 'undefined' && val !== 'ALL') {
      searchParams.append(key, String(val));
    }
  });
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

// 1. Auth API
export const authApi = {
  login: (credentials: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  getMe: () => request<{ user: User }>('/auth/me'),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
};

// 2. Dashboard API
export const dashboardApi = {
  getSummary: () => request<DashboardSummary>('/dashboard/summary'),
};

// 3. Purchase Requests API
export const purchaseRequestsApi = {
  list: (params?: { search?: string; status?: string; vesselId?: string; priority?: string }) => {
    return request<{ purchaseRequests: PurchaseRequest[] }>(`/purchase-requests${buildQuery(params)}`);
  },
  getById: (id: string) =>
    request<{ purchaseRequest: PurchaseRequest; auditLogs: AuditLog[] }>(`/purchase-requests/${id}`),
  create: (data: any) =>
    request<{ purchaseRequest: PurchaseRequest }>('/purchase-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  submit: (id: string) =>
    request<{ purchaseRequest: PurchaseRequest }>(`/purchase-requests/${id}/submit`, {
      method: 'POST',
    }),
  approve: (id: string, comments?: string) =>
    request<{ purchaseRequest: PurchaseRequest }>(`/purchase-requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comments }),
    }),
  reject: (id: string, reason: string) =>
    request<{ purchaseRequest: PurchaseRequest }>(`/purchase-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

// 4. Approvals Queue API
export const approvalsApi = {
  getPending: () =>
    request<{
      totalPending: number;
      purchaseRequests: PurchaseRequest[];
      purchaseOrders: PurchaseOrder[];
    }>('/approvals/pending'),
};

// 5. RFQs & Quotations API
export const rfqsApi = {
  list: (params?: { search?: string; status?: string }) => {
    return request<{ rfqs: Rfq[] }>(`/rfqs${buildQuery(params)}`);
  },
  getById: (id: string) =>
    request<{ rfq: Rfq; auditLogs: AuditLog[] }>(`/rfqs/${id}`),
  create: (data: { purchaseRequestId: string; vendorIds: string[]; deadline: string }) =>
    request<{ rfq: Rfq }>('/rfqs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  addQuotation: (rfqId: string, data: any) =>
    request<{ quotation: any }>(`/rfqs/${rfqId}/quotations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  selectQuotation: (rfqId: string, data: { quotationId: string; selectionReason?: string }) =>
    request<{ selectedQuotation: any }>(`/rfqs/${rfqId}/select-quotation`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// 6. Purchase Orders API
export const purchaseOrdersApi = {
  list: (params?: { search?: string; status?: string; vendorId?: string; vesselId?: string }) => {
    return request<{ purchaseOrders: PurchaseOrder[] }>(`/purchase-orders${buildQuery(params)}`);
  },
  getById: (id: string) =>
    request<{ purchaseOrder: PurchaseOrder; auditLogs: AuditLog[] }>(`/purchase-orders/${id}`),
  create: (data: { purchaseRequestId: string; taxRate?: number; deliveryDate?: string; paymentTerms?: string }) =>
    request<{ purchaseOrder: PurchaseOrder }>('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  approve: (id: string, comments?: string) =>
    request<{ purchaseOrder: PurchaseOrder }>(`/purchase-orders/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comments }),
    }),
  reject: (id: string, reason: string) =>
    request<{ purchaseOrder: PurchaseOrder }>(`/purchase-orders/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

// 7. Deliveries API
export const deliveriesApi = {
  list: (params?: { search?: string; condition?: string; vesselId?: string }) => {
    return request<{ receipts: GoodsReceipt[] }>(`/deliveries${buildQuery(params)}`);
  },
  recordReceipt: (poId: string, data: { deliveryDate?: string; condition: string; notes?: string; items: { poItemId: string; quantityReceived: number }[] }) =>
    request<{ goodsReceipt: GoodsReceipt; poStatus: string; completed: boolean }>(`/deliveries/${poId}/receipts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// 8. Vendors API
export const vendorsApi = {
  list: (params?: { search?: string; status?: string; category?: string }) => {
    return request<{ vendors: Vendor[] }>(`/vendors${buildQuery(params)}`);
  },
  getById: (id: string) => request<{ vendor: Vendor }>(`/vendors/${id}`),
  create: (data: any) => request<{ vendor: Vendor }>('/vendors', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<{ vendor: Vendor }>(`/vendors/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// 9. Vessels API
export const vesselsApi = {
  list: (params?: { search?: string; status?: string }) => {
    return request<{ vessels: Vessel[] }>(`/vessels${buildQuery(params)}`);
  },
  getById: (id: string) => request<{ vessel: Vessel }>(`/vessels/${id}`),
  create: (data: any) => request<{ vessel: Vessel }>('/vessels', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<{ vessel: Vessel }>(`/vessels/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// 10. Users API
export const usersApi = {
  list: (params?: { search?: string; role?: string; status?: string }) => {
    return request<{ users: User[] }>(`/users${buildQuery(params)}`);
  },
  getById: (id: string) => request<{ user: User }>(`/users/${id}`),
  create: (data: any) => request<{ user: User }>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<{ user: User }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// 11. Audit Logs API
export const auditLogsApi = {
  list: (params?: { search?: string; entityType?: string; entityId?: string; action?: string; limit?: number }) => {
    return request<{ logs: AuditLog[] }>(`/audit-logs${buildQuery(params)}`);
  },
};
