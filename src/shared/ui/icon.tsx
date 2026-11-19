import { component$ } from '@builder.io/qwik';

const paths = {
  dashboard: ['M3 3h7v7H3V3Zm11 0h7v11h-7V3ZM3 14h7v7H3v-7Zm11 4h7v3h-7v-3Z'],
  customers: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87',
    'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  ],
  orders: ['M6 3h12v18l-3-2-3 2-3-2-3 2V3Z', 'M9 8h6M9 12h6'],
  inventory: ['m3 7 9-4 9 4v10l-9 4-9-4V7Z', 'm3 7 9 4 9-4M12 11v10M7 5l10 4'],
  more: ['M12 5h.01M12 12h.01M12 19h.01'],
  settings: [
    'M4 7h7m4 0h5M4 17h3m4 0h9',
    'M11 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM7 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z',
  ],
  external: ['M13 5h6v6m0-6-8 8', 'M19 14v5H5V5h5'],
  upload: ['M12 16V4m-5 5 5-5 5 5', 'M4 16v4h16v-4'],
  'product-add': ['m3 7 8-4 8 4-8 4-8-4Zm0 0v9l8 4v-9m8-4v5', 'M18 15v7m-3.5-3.5h7'],
  return: ['m9 4-6 6 6 6M3 10h11a6 6 0 0 1 0 12'],
  'order-add': ['M14 21H5V3h12l3 3v6M8 8h7m-7 4h5', 'M18 15v7m-3.5-3.5h7'],
  'category-add': ['M13 20 3 10V3h7l10 10-2 2M7 7h.01', 'M18 16v6m-3-3h6'],
  'customer-add': [
    'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM2 21v-2a6 6 0 0 1 6-6h2a6 6 0 0 1 4 1.5',
    'M18 14v7m-3.5-3.5h7',
  ],
  'customer-edit': [
    'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM2 21v-2a6 6 0 0 1 6-6h3',
    'm12 18 7-7 3 3-7 7-4 1 1-4Z',
  ],
  'stock-in': ['M3 12h5l2 4h4l2-4h5v8H3v-8Zm0 0 3-6h2m13 6-3-6h-2', 'M12 2v9m-3-3 3 3 3-3'],
  'lot-add': ['m11 2 9 5-9 5-9-5 9-5Zm-9 9 9 5 4-2m-13 1 9 5', 'M19 14v8m-4-4h8'],
  plus: ['M12 5v14M5 12h14'],
  filter: ['M3 4h18l-7 8v6l-4 2v-8L3 4Z'],
  search: ['M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1.5 4.5L21 21'],
  calendar: ['M4 5h16v15H4zM4 10h16M8 3v4m8-4v4'],
  save: ['M4 3h13l3 3v15H4V3Z', 'M8 3v6h8V3M8 21v-8h8v8'],
  edit: ['m15 5 4 4M4 20l4-1L20 7a2.83 2.83 0 0 0-4-4L4 15v5Z'],
  close: ['m6 6 12 12M6 18 18 6'],
  moon: ['M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z'],
  sun: [
    'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  ],
  'arrow-right': ['M5 12h14m-6-6 6 6-6 6'],
  help: [
    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    'M9.5 9a2.5 2.5 0 1 1 4.3 1.7c-1 .6-1.8 1.1-1.8 2.3M12 16.5h.01',
  ],
  layers: ['m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5'],
} as const;

export type IconName = keyof typeof paths;

export const Icon = component$<{ name: IconName; class?: string }>(({ name, class: className }) => (
  <svg
    class={['icon', className]}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={name === 'more' ? 3.5 : 1.6}
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {paths[name].map((path) => (
      <path key={path} d={path} />
    ))}
  </svg>
));
