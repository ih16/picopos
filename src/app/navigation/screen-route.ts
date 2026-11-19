export const PAGE_PATHS = {
  Dashboard: '/dashboard',
  Orders: '/orders',
  Catalog: '/catalog',
  Customers: '/customers',
  Inventory: '/inventory',
  Connection: '/settings',
} as const;
export type Page = keyof typeof PAGE_PATHS;
export type ScreenRoute = {
  page: Page;
  path: string;
  orderId: string;
  customerKey: string;
  creating: boolean;
  catalogPage: 'products' | 'categories';
  inventoryPage: 'stock' | 'entries' | 'lots';
};

export const customerPath = (key: string) => `/customers/${encodeURIComponent(key)}`;

export const orderPath = (id: string) => `/orders/${encodeURIComponent(id)}`;

export function parseScreenRoute(value: string): ScreenRoute {
  const path = value.replace(/^#/, '').replace(/\/+$/, '') || '/dashboard';
  const route: ScreenRoute = {
    page: 'Dashboard',
    path: '/dashboard',
    orderId: '',
    customerKey: '',
    creating: false,
    catalogPage: 'products',
    inventoryPage: 'stock',
  };
  for (const [page, base] of Object.entries(PAGE_PATHS)) {
    if (path === base) return { ...route, page: page as Page, path };
  }
  if (path === '/orders/new') return { ...route, page: 'Orders', path, creating: true };
  if (path === '/catalog/categories') return { ...route, page: 'Catalog', path, catalogPage: 'categories' };
  if (path === '/inventory/entries') return { ...route, page: 'Inventory', path, inventoryPage: 'entries' };
  if (path === '/inventory/lots') return { ...route, page: 'Inventory', path, inventoryPage: 'lots' };
  const customerMatch = /^\/customers\/([^/]+)$/.exec(path);
  if (customerMatch) {
    try {
      const customerKey = decodeURIComponent(customerMatch[1]);
      return { ...route, page: 'Customers', path: customerPath(customerKey), customerKey };
    } catch {
      return route;
    }
  }
  const match = /^\/orders\/([^/]+)$/.exec(path);
  if (match) {
    try {
      const orderId = decodeURIComponent(match[1]);
      return { ...route, page: 'Orders', path: orderPath(orderId), orderId };
    } catch {
      /* Malformed URLs fall back to the dashboard. */
    }
  }
  return route;
}

export function screenTabKey(route: ScreenRoute): string {
  return route.creating || route.orderId || route.customerKey ? route.path : route.page;
}

export function addScreenTab(tabs: string[], route: ScreenRoute, replaceKey?: string): string[] {
  const key = screenTabKey(route);
  const next = replaceKey && replaceKey !== key ? tabs.filter((tab) => tab !== replaceKey) : [...tabs];
  // Direct detail links also leave a list tab available.
  if (!next.includes(route.page)) next.push(route.page);
  if (!next.includes(key)) {
    const index = replaceKey ? tabs.indexOf(replaceKey) : -1;
    if (index >= 0) next.splice(Math.min(index, next.length), 0, key);
    else next.push(key);
  }
  return next;
}
