import { component$ } from '@builder.io/qwik';

const paths = {
  dashboard: ['M3 3h7v7H3V3Zm11 0h7v11h-7V3ZM3 14h7v7H3v-7Zm11 4h7v3h-7v-3Z'],
  customers: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87',
    'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  ],
  orders: ['M6 3h12v18l-3-2-3 2-3-2-3 2V3Z', 'M9 8h6M9 12h6'],
  inventory: ['m3 7 9-4 9 4v10l-9 4-9-4V7Z', 'm3 7 9 4 9-4M12 11v10M7 5l10 4'],
  settings: [
    'M4 7h7m4 0h5M4 17h3m4 0h9',
    'M11 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM7 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z',
  ],
  external: ['M13 5h6v6m0-6-8 8', 'M19 14v5H5V5h5'],
  upload: ['M12 16V4m-5 5 5-5 5 5', 'M4 16v4h16v-4'],
  plus: ['M12 5v14M5 12h14'],
  search: ['M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1.5 4.5L21 21'],
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

type IconName = keyof typeof paths;

export const Icon = component$<{ name: IconName; class?: string }>(({ name, class: className }) => (
  <svg
    class={['icon', className]}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
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
