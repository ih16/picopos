import {
  findRowChange,
  mergePendingEdits,
  pendingEditFields,
  type PendingChange,
  type PendingEdit,
} from '../../domain/outbox';
import type { Workbook } from '../../domain/workbook';
import {
  applyChanges,
  HEADERS,
  emptyWorkbook,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  RETURN_CONDITIONS,
  RETURN_STATUSES,
  STOCK_TYPES,
  validateChanges,
  type RowChange,
  type TableRows,
  type WorkbookData,
} from '../../domain/workbook';
import { request, SheetsError } from './sheets-client';

type Tab = keyof TableRows;
type Cell = string | number | boolean;
type GridRow = Cell[];
type Sheet = {
  sheetId: number;
  title: string;
  sheetType?: string;
  gridProperties?: { rowCount: number; columnCount: number };
};
type SheetRequest = Record<string, unknown>;

type DocumentState = {
  id: string;
  title: string;
  sheets: Map<string, Sheet>;
  rows: Map<string, GridRow[]>;
};

const TABS = Object.keys(HEADERS) as Tab[];
const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  productId: 'Product ID',
  categoryId: 'Category ID',
  parentId: 'Parent Category ID',
  orderId: 'Order ID',
  customerId: 'Customer ID',
  purchaseLotId: 'Purchase Lot ID',
  orderItemId: 'Order Item ID',
  variantId: 'Variant ID',
  sku: 'SKU',
  number: 'Order Number',
  onHandDelta: 'On Hand Change',
  unavailableDelta: 'Unavailable Change',
};
const INVENTORY_HEADERS = [
  'Variant ID',
  'SKU',
  'Product',
  'Options',
  'On Hand',
  'Reserved',
  'Unavailable',
  'Available',
];
const PRODUCT_IMAGE_COLUMN = HEADERS.Products.indexOf('image');
const MANAGED_TABS = [...TABS, 'Inventory'] as const;
const NUMBER_FIELDS = new Set([
  'totalAmount',
  'totalUnits',
  'price',
  'quantity',
  'unitPrice',
  'onHandDelta',
  'unavailableDelta',
  'discount',
  'shippingCharge',
]);
const CHOICES: Partial<Record<Tab, Record<string, readonly string[]>>> = {
  Orders: { status: ORDER_STATUSES, paymentStatus: PAYMENT_STATUSES },
  Returns: { status: RETURN_STATUSES, condition: RETURN_CONDITIONS },
  'Stock Entries': { type: STOCK_TYPES },
};

function headers(tab: string): string[] {
  if (tab === 'Inventory') return INVENTORY_HEADERS;
  return HEADERS[tab as Tab].map(
    (field) =>
      FIELD_LABELS[field] ?? field.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase()),
  );
}

function columnName(index: number): string {
  let name = '';
  for (let remaining = index + 1; remaining > 0; remaining = Math.floor((remaining - 1) / 26)) {
    name = String.fromCharCode(65 + ((remaining - 1) % 26)) + name;
  }
  return name;
}

function a1(tab: string, range: string): string {
  return `'${tab.replaceAll("'", "''")}'!${range}`;
}

async function readDocument(token: string, id: string, initializing = false): Promise<DocumentState> {
  const document = await request<{
    spreadsheetId: string;
    properties: { title: string };
    sheets?: { properties: Sheet }[];
  }>(
    token,
    id,
    '',
    new URLSearchParams({
      fields:
        'spreadsheetId,properties(title),sheets(properties(sheetId,title,sheetType,gridProperties(rowCount,columnCount)))',
    }),
  );
  const sheets = new Map((document.sheets ?? []).map(({ properties }) => [properties.title, properties]));
  const presentTabs = MANAGED_TABS.filter((tab) => sheets.has(tab));
  const ranges = new URLSearchParams({
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  for (const tab of presentTabs) {
    const sheet = sheets.get(tab)!;
    if (sheet.sheetType && sheet.sheetType !== 'GRID')
      throw new SheetsError(`"${tab}" must be a regular sheet.`);
    const lastColumn = columnName(
      Math.min(headers(tab).length, sheet.gridProperties?.columnCount ?? headers(tab).length) - 1,
    );
    ranges.append(
      'ranges',
      a1(tab, tab === 'Inventory' && !initializing ? `A1:${lastColumn}1` : `A:${lastColumn}`),
    );
  }
  const result = presentTabs.length
    ? await request<{ valueRanges?: { values?: GridRow[] }[] }>(token, id, '/values:batchGet', ranges)
    : null;
  const rows = new Map<string, GridRow[]>();
  presentTabs.forEach((tab, index) => rows.set(tab, result?.valueRanges?.[index]?.values ?? []));
  return { id: document.spreadsheetId, title: document.properties.title, sheets, rows };
}

function nonempty(value: Cell | undefined): boolean {
  return value !== undefined && value !== '';
}

function isEmpty(rows: GridRow[]): boolean {
  return !rows.some((row) => row.some(nonempty));
}

function checkHeader(tab: string, rows: GridRow[]): void {
  const names = headers(tab);
  if (names.every((name, index) => rows[0]?.[index] === name)) return;
  const legacyLength =
    tab === 'Orders' ? 11 : tab === 'Categories' ? 2 : tab === 'Stock Entries' ? 7 : undefined;
  if (
    legacyLength !== undefined &&
    names.every(
      (name, index) => rows[0]?.[index] === name || (index >= legacyLength && !nonempty(rows[0]?.[index])),
    )
  )
    return;
  if (
    tab === 'Products' &&
    names.slice(0, PRODUCT_IMAGE_COLUMN).every((name, index) => rows[0]?.[index] === name)
  )
    return;
  throw new SheetsError(`"${tab}" has unexpected column headers. Expected: ${names.join(', ')}.`);
}

function hasProductImageColumn(rows: GridRow[]) {
  return rows[0]?.[PRODUCT_IMAGE_COLUMN] === headers('Products')[PRODUCT_IMAGE_COLUMN];
}

async function addProductImageColumn(token: string, document: DocumentState): Promise<SheetRequest[]> {
  const sheet = document.sheets.get('Products')!;
  const rows = document.rows.get('Products')!;
  if (hasProductImageColumn(rows)) return [];

  if (rows.some((row) => nonempty(row[PRODUCT_IMAGE_COLUMN]))) return [];

  const sheetId = sheet.sheetId;
  const columnCount = sheet.gridProperties?.columnCount ?? HEADERS.Products.length;
  const requests: SheetRequest[] = [];
  if (columnCount <= PRODUCT_IMAGE_COLUMN) {
    requests.push({
      appendDimension: { sheetId, dimension: 'COLUMNS', length: PRODUCT_IMAGE_COLUMN + 1 - columnCount },
    });
  } else {
    // Check the exact target before claiming it, including formulas that display a blank value.
    const column = columnName(PRODUCT_IMAGE_COLUMN);
    const result = await request<{ valueRanges?: { values?: GridRow[] }[] }>(
      token,
      document.id,
      '/values:batchGet',
      new URLSearchParams({ ranges: a1('Products', `${column}:${column}`), valueRenderOption: 'FORMULA' }),
    );
    if (!isEmpty(result.valueRanges?.[0]?.values ?? [])) return [];
  }
  const headerRange = (column: number) => ({
    sheetId,
    startRowIndex: 0,
    endRowIndex: 1,
    startColumnIndex: column,
    endColumnIndex: column + 1,
  });
  requests.push(updateCells(sheetId, 0, PRODUCT_IMAGE_COLUMN, [headers('Products')[PRODUCT_IMAGE_COLUMN]]), {
    copyPaste: {
      source: headerRange(PRODUCT_IMAGE_COLUMN - 1),
      destination: headerRange(PRODUCT_IMAGE_COLUMN),
      pasteType: 'PASTE_FORMAT',
    },
  });
  return requests;
}

async function upgradeWorkbook(token: string, document: DocumentState): Promise<boolean> {
  const requests: SheetRequest[] = [];
  const ids = new Set(Array.from(document.sheets.values(), (sheet) => sheet.sheetId));
  for (const tab of ['Customers', 'Purchase Lots'] as const) {
    if (document.sheets.has(tab)) continue;
    let sheetId = 1;
    while (ids.has(sheetId)) sheetId++;
    ids.add(sheetId);
    requests.push(...initializeTab(tab, sheetId));
  }
  for (const [tab, field] of [
    ['Orders', 'customerId'],
    ['Orders', 'shippingOption'],
    ['Categories', 'parentId'],
    ['Stock Entries', 'purchaseLotId'],
  ] as const) {
    const sheet = document.sheets.get(tab);
    const rows = document.rows.get(tab);
    const column = (HEADERS[tab] as readonly string[]).indexOf(field);
    if (sheet && rows && rows[0]?.[column] !== headers(tab)[column]) {
      checkHeader(tab, rows);
      const columnCount = sheet.gridProperties?.columnCount ?? HEADERS[tab].length;
      if (columnCount <= column) {
        requests.push({
          appendDimension: { sheetId: sheet.sheetId, dimension: 'COLUMNS', length: column + 1 - columnCount },
        });
        if (sheet.gridProperties) sheet.gridProperties.columnCount = column + 1;
      } else {
        const name = columnName(column);
        const result = await request<{ valueRanges?: { values?: GridRow[] }[] }>(
          token,
          document.id,
          '/values:batchGet',
          new URLSearchParams({ ranges: a1(tab, `${name}:${name}`), valueRenderOption: 'FORMULA' }),
        );
        if (!isEmpty(result.valueRanges?.[0]?.values ?? []))
          throw new SheetsError(
            `${tab} column ${name} contains existing data. Move it before adding the new reference column.`,
          );
      }
      requests.push(updateCells(sheet.sheetId, 0, column, [headers(tab)[column]]));
    }
  }
  if (!requests.length) return false;
  await request(token, document.id, ':batchUpdate', undefined, { requests });
  return true;
}

function parseCell(tab: Tab, field: string, value: Cell | undefined, location: string): Cell {
  if (field === 'active') {
    if (!nonempty(value)) return true;
    if (typeof value === 'boolean') return value;
    throw new SheetsError(`${location} Active must be TRUE or FALSE.`);
  }
  if (NUMBER_FIELDS.has(field)) {
    if (!nonempty(value) && (field === 'discount' || field === 'shippingCharge')) return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    throw new SheetsError(`${location} ${FIELD_LABELS[field] ?? field} must be a number.`);
  }
  const string = String(value ?? '').trim();
  const choices = CHOICES[tab]?.[field];
  if (choices && !choices.includes(string) && !(field === 'condition' && string === '')) {
    throw new SheetsError(
      `${location} ${FIELD_LABELS[field] ?? field} must be one of: ${choices.join(', ')}.`,
    );
  }
  return string;
}

function readRows<T extends Tab>(tab: T, rows: GridRow[]): TableRows[T][] {
  const entries: TableRows[T][] = [];
  const ids = new Set<string>();
  const readImages = tab === 'Products' && hasProductImageColumn(rows);
  for (let index = 1; index < rows.length; index++) {
    const cells =
      tab === 'Products' && !readImages ? rows[index].slice(0, PRODUCT_IMAGE_COLUMN) : rows[index];
    if (!cells.some(nonempty)) continue;
    const location = `"${tab}", row ${index + 1}:`;
    const id = String(cells[0] ?? '').trim();
    if (!id) throw new SheetsError(`${location} Enter a unique ID in column A.`);
    if (ids.has(id)) throw new SheetsError(`${location} Duplicate ID "${id}".`);
    ids.add(id);
    entries.push(
      Object.fromEntries(
        HEADERS[tab].map((field, column) => [field, parseCell(tab, field, cells[column], location)]),
      ) as TableRows[T],
    );
  }
  return entries;
}

function workbook(document: DocumentState): Workbook {
  const data = {} as WorkbookData;
  for (const tab of MANAGED_TABS) {
    const rows = document.rows.get(tab);
    if (!rows && (tab === 'Customers' || tab === 'Purchase Lots')) {
      data[tab] = [];
      continue;
    }
    if (!rows) throw new SheetsError(`"${tab}" is missing. Reconnect to initialize the workbook.`);
    checkHeader(tab, rows);
    if (tab !== 'Inventory') Object.assign(data, { [tab]: readRows(tab, rows) });
  }
  if (data.Settings.find((row) => row.id === 'schemaVersion')?.value !== '1') {
    throw new SheetsError('This workbook has an unsupported schema version in Settings.');
  }
  return { id: document.id, title: document.title, data };
}

async function loadWorkbook(token: string, spreadsheetId: string): Promise<Workbook> {
  return workbook(await readDocument(token, spreadsheetId));
}

function cell(value: Cell) {
  if (typeof value === 'number') return { userEnteredValue: { numberValue: value } };
  if (typeof value === 'boolean') return { userEnteredValue: { boolValue: value } };
  return { userEnteredValue: { stringValue: value } };
}

function updateCells(
  sheetId: number,
  rowIndex: number,
  columnIndex: number,
  ...rows: GridRow[]
): SheetRequest {
  return {
    updateCells: {
      start: { sheetId, rowIndex, columnIndex },
      rows: rows.map((values) => ({ values: values.map(cell) })),
      fields: 'userEnteredValue',
    },
  };
}

function appendCells(sheetId: number, rows: GridRow[]): SheetRequest {
  return {
    appendCells: {
      sheetId,
      rows: rows.map((values) => ({ values: values.map(cell) })),
      fields: 'userEnteredValue',
    },
  };
}

function cellRange(tab: Tab, field: string): string {
  const column = columnName((HEADERS[tab] as readonly string[]).indexOf(field));
  return a1(tab, `${column}2:${column}`);
}

function lookup(from: string, tab: Tab, field: string): string {
  const index = (HEADERS[tab] as readonly string[]).indexOf(field);
  return `IFNA(VLOOKUP(${from},${a1(tab, `A2:${columnName(index)}`)},${index + 1},FALSE),"")`;
}

// Derive quantities from the workbook itself so direct Sheets edits do not need
// a running app or a second write to an inventory counter.
function inventoryFormula(): string {
  const variantIds = cellRange('Variants', 'id');
  const variantProducts = cellRange('Variants', 'productId');
  const orderItems = cellRange('Order Items', 'id');
  const itemOrder = cellRange('Order Items', 'orderId');
  const itemVariant = cellRange('Order Items', 'variantId');
  const itemQty = cellRange('Order Items', 'quantity');
  const returnItem = cellRange('Returns', 'orderItemId');
  const returnStatus = cellRange('Returns', 'status');
  const returnCondition = cellRange('Returns', 'condition');
  const returnQty = cellRange('Returns', 'quantity');
  const stockVariant = cellRange('Stock Entries', 'variantId');
  return `=IF(COUNTA(${variantIds})=0,"",LET(
    variant_ids,FILTER(${variantIds},${variantIds}<>""),
    sku_values,FILTER(${cellRange('Variants', 'sku')},${variantIds}<>""),
    product_names,FILTER(ARRAYFORMULA(${lookup(variantProducts, 'Products', 'name')}),${variantIds}<>""),
    option_values,FILTER(${cellRange('Variants', 'optionValues')},${variantIds}<>""),
    item_states,ARRAYFORMULA(${lookup(itemOrder, 'Orders', 'status')}),
    item_quantities,ARRAYFORMULA(IFERROR(${itemQty}*1,0)),
    return_variants,ARRAYFORMULA(${lookup(returnItem, 'Order Items', 'variantId')}),
    return_quantities,ARRAYFORMULA(IFERROR(${returnQty}*1,0)),
    on_hand_values,MAP(variant_ids,LAMBDA(variant_key,
      SUMIF(${stockVariant},variant_key,${cellRange('Stock Entries', 'onHandDelta')})
      -SUMPRODUCT((${orderItems}<>"")*(${itemVariant}=variant_key)*((item_states="Shipped")+(item_states="Completed"))*item_quantities)
      +SUMPRODUCT((return_variants=variant_key)*(${returnStatus}="Received")*((${returnCondition}="Sellable")+(${returnCondition}="Damaged"))*return_quantities)
    )),
    reserved_values,MAP(variant_ids,LAMBDA(variant_key,
      SUMPRODUCT((${orderItems}<>"")*(${itemVariant}=variant_key)*(item_states="In progress")*item_quantities)
    )),
    unavailable_values,MAP(variant_ids,LAMBDA(variant_key,
      SUMIF(${stockVariant},variant_key,${cellRange('Stock Entries', 'unavailableDelta')})
      +SUMPRODUCT((return_variants=variant_key)*(${returnStatus}="Received")*(${returnCondition}="Damaged")*return_quantities)
    )),
    HSTACK(variant_ids,sku_values,product_names,option_values,on_hand_values,reserved_values,unavailable_values,ARRAYFORMULA(on_hand_values-reserved_values-unavailable_values))
  ))`.replace(/\s*\n\s*/g, '');
}

function initializeTab(tab: string, sheetId: number, existing?: Sheet): SheetRequest[] {
  const names = headers(tab);
  const requests: SheetRequest[] = [];
  const rowCount = tab === 'Inventory' ? 5001 : 1000;
  if (!existing) {
    requests.push({
      addSheet: {
        properties: {
          sheetId,
          title: tab,
          gridProperties: { frozenRowCount: 1, rowCount, columnCount: names.length },
        },
      },
    });
  } else {
    const gridProperties = {
      frozenRowCount: 1,
      rowCount: Math.max(existing.gridProperties?.rowCount ?? rowCount, tab === 'Inventory' ? rowCount : 4),
      columnCount: Math.max(existing.gridProperties?.columnCount ?? 26, names.length),
    };
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, gridProperties },
        fields: 'gridProperties.frozenRowCount,gridProperties.rowCount,gridProperties.columnCount',
      },
    });
  }
  requests.push(updateCells(sheetId, 0, 0, names));
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: names.length },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.12, green: 0.18, blue: 0.17 },
          textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          verticalAlignment: 'MIDDLE',
        },
      },
      fields: 'userEnteredFormat',
    },
  });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: names.length },
      properties: { pixelSize: 158 },
      fields: 'pixelSize',
    },
  });

  if (tab !== 'Inventory') {
    for (const [index, field] of HEADERS[tab as Tab].entries()) {
      const range = { sheetId, startRowIndex: 1, startColumnIndex: index, endColumnIndex: index + 1 };
      if (
        field === 'id' ||
        field.endsWith('Id') ||
        ['sku', 'number', 'contact', 'createdAt', 'receivedAt', 'date'].includes(field)
      ) {
        requests.push({
          repeatCell: {
            range,
            cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } },
            fields: 'userEnteredFormat.numberFormat',
          },
        });
      }
      const choices = CHOICES[tab as Tab]?.[field];
      if (choices) {
        requests.push({
          setDataValidation: {
            range,
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: choices.map((userEnteredValue) => ({ userEnteredValue })),
              },
              strict: true,
              showCustomUi: true,
            },
          },
        });
      }
    }
  } else {
    requests.push({
      updateCells: {
        start: { sheetId, rowIndex: 1, columnIndex: 0 },
        rows: [{ values: [{ userEnteredValue: { formulaValue: inventoryFormula() } }] }],
        fields: 'userEnteredValue',
      },
    });
    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId },
          description: 'Calculated inventory. Edit source rows to change stock.',
          warningOnly: true,
        },
      },
    });
  }
  return requests;
}

export async function initializeWorkbook(
  token: string,
  spreadsheetId: string,
  initialSettings?: RowChange[],
): Promise<Workbook | undefined> {
  const document = await readDocument(token, spreadsheetId, true);
  const settingsRows = document.rows.get('Settings') ?? [];
  // A header-only Settings tab is safe to initialize. Keep the existing checks
  // for occupied tabs and unsupported schema versions before making any writes.
  const needsSetup = isEmpty(settingsRows.slice(1));
  const preferences = initialSettings?.filter(
    ({ tab, row }) => tab === 'Settings' && ['currency', 'numberFormat', 'shippingOptions'].includes(row.id),
  );
  if (needsSetup && preferences) validateChanges(emptyWorkbook(), preferences);
  if (needsSetup && document.sheets.has('Settings')) {
    const columns = document.sheets.get('Settings')?.gridProperties?.columnCount ?? HEADERS.Settings.length;
    const lastColumn = columnName(Math.min(columns, HEADERS.Settings.length) - 1);
    const result = await request<{ valueRanges?: { values?: GridRow[] }[] }>(
      token,
      spreadsheetId,
      '/values:batchGet',
      new URLSearchParams({ ranges: a1('Settings', `A:${lastColumn}`), valueRenderOption: 'FORMULA' }),
    );
    const cells = result.valueRanges?.[0]?.values ?? [];
    if (!isEmpty(cells.slice(isEmpty(settingsRows) ? 0 : 1))) {
      throw new SheetsError(
        'Settings contains existing data. Use a blank sheet or a supported picopos workbook.',
      );
    }
  }
  const requests: SheetRequest[] = [];
  const existingIds = new Set(Array.from(document.sheets.values(), (sheet) => sheet.sheetId));
  let nextId = 1;
  for (const tab of MANAGED_TABS) {
    const existing = document.sheets.get(tab);
    const rows = document.rows.get(tab);
    if (rows && !isEmpty(rows)) {
      checkHeader(tab, rows);
      if (tab === 'Products') requests.push(...(await addProductImageColumn(token, document)));
      const settings = tab === 'Settings' ? readRows(tab, rows) : undefined;
      if (settings && !needsSetup && settings.find((row) => row.id === 'schemaVersion')?.value !== '1') {
        throw new SheetsError('This workbook has an unsupported schema version in Settings.');
      }
      if (tab !== 'Settings' || !needsSetup) continue;
    }
    while (existingIds.has(nextId)) nextId++;
    const sheetId = existing?.sheetId ?? nextId++;
    requests.push(...initializeTab(tab, sheetId, existing));
    if (tab === 'Settings') {
      requests.push(
        updateCells(
          sheetId,
          1,
          0,
          ['schemaVersion', '1'],
          ['businessName', document.title],
          ...(preferences ?? []).flatMap((change) =>
            change.tab === 'Settings' ? [[change.row.id, change.row.value]] : [],
          ),
        ),
      );
    }
  }
  if (needsSetup && !initialSettings) return undefined;
  if (requests.length) await request(token, spreadsheetId, ':batchUpdate', undefined, { requests });
  const updated = requests.length ? await readDocument(token, spreadsheetId) : document;
  if (await upgradeWorkbook(token, updated)) return loadWorkbook(token, spreadsheetId);
  return workbook(updated);
}

function buildRowRequests(
  document: DocumentState,
  data: WorkbookData,
  changes: RowChange[],
  writeImages: boolean,
): SheetRequest[] {
  const requests: SheetRequest[] = [];
  const appended = new Map<Tab, GridRow[]>();
  for (const { tab, row } of changes) {
    const fields =
      tab === 'Products' && !writeImages ? HEADERS.Products.slice(0, PRODUCT_IMAGE_COLUMN) : HEADERS[tab];
    const values = row as Record<string, Cell>;
    const saved = data[tab].find((entry) => entry.id === row.id) as Record<string, Cell> | undefined;
    if (!saved) {
      const rows = appended.get(tab) ?? [];
      rows.push(fields.map((field) => values[field] ?? ''));
      appended.set(tab, rows);
      continue;
    }
    const rowIndex = document.rows
      .get(tab)!
      .findIndex((cells, index) => index > 0 && String(cells[0] ?? '').trim() === row.id);
    const sheetId = document.sheets.get(tab)!.sheetId;
    fields.forEach((field, column) => {
      if (values[field] !== saved[field])
        requests.push(updateCells(sheetId, rowIndex, column, [values[field] ?? '']));
    });
  }
  for (const [tab, rows] of appended) requests.push(appendCells(document.sheets.get(tab)!.sheetId, rows));
  return requests;
}

type WorkbookSyncResult = {
  base: Workbook;
  acknowledged: string[];
  blocked: Record<string, string>;
  remaining: boolean;
};

const batchByteLimit = 1_500_000;
const batchEnvelopeBytes = '{"requests":[]}'.length;
const rowKey = ({ tab, row }: RowChange) => `${tab}:${row.id}`;

function matchesEdit(data: WorkbookData, edit: PendingEdit): boolean {
  const saved = findRowChange(data, edit.after.tab, edit.after.row.id)?.row as
    Record<string, Cell> | undefined;
  const desired = edit.after.row as Record<string, Cell>;
  return !!saved && pendingEditFields(edit).every((field) => (saved[field] ?? '') === (desired[field] ?? ''));
}

function referencedRows(data: WorkbookData, change: RowChange): string[] {
  switch (change.tab) {
    case 'Categories':
      return change.row.parentId ? [`Categories:${change.row.parentId}`] : [];
    case 'Products':
      return change.row.categoryId ? [`Categories:${change.row.categoryId}`] : [];
    case 'Variants':
      return [`Products:${change.row.productId}`];
    case 'Orders':
      return [
        ...(change.row.customerId ? [`Customers:${change.row.customerId}`] : []),
        ...data['Order Items']
          .filter((item) => item.orderId === change.row.id)
          .flatMap((item) => [`Order Items:${item.id}`, `Variants:${item.variantId}`]),
      ];
    case 'Order Items':
      return [`Orders:${change.row.orderId}`, `Variants:${change.row.variantId}`];
    case 'Returns': {
      const item = data['Order Items'].find(({ id }) => id === change.row.orderItemId);
      return [`Order Items:${change.row.orderItemId}`, ...(item ? [`Orders:${item.orderId}`] : [])];
    }
    case 'Stock Entries':
      return [
        `Variants:${change.row.variantId}`,
        ...(change.row.purchaseLotId ? [`Purchase Lots:${change.row.purchaseLotId}`] : []),
      ];
    default:
      return [];
  }
}

export async function syncWorkbookBatch(
  token: string,
  workbookId: string,
  pending: readonly PendingChange[],
): Promise<WorkbookSyncResult> {
  let document = await readDocument(token, workbookId);
  if (await upgradeWorkbook(token, document)) document = await readDocument(token, workbookId);
  const current = workbook(document);
  let projected = current.data;
  let writeImages = hasProductImageColumn(document.rows.get('Products')!);
  let imageSetup: SheetRequest[] | undefined;
  const requests: SheetRequest[] = [];
  const planned: PendingChange[] = [];
  const acknowledged: string[] = [];
  const blocked: Record<string, string> = {};
  const plannedRows = new Set<string>();
  const blockedRows = new Set<string>();
  const deferredRows = new Set<string>();
  const encoder = new TextEncoder();
  let bytes = batchEnvelopeBytes;

  for (const group of pending) {
    const keys = group.edits.map((edit) => rowKey(edit.after));
    const dependencies = [...keys, ...group.edits.flatMap((edit) => referencedRows(projected, edit.after))];
    if (dependencies.some((key) => blockedRows.has(key))) {
      blocked[group.id] = 'This change depends on an earlier edit that needs attention.';
      keys.forEach((key) => blockedRows.add(key));
      continue;
    }
    // A later edit to a row must wait until the first value is verified. That
    // keeps an interrupted batch distinguishable from a conflicting edit.
    if (keys.some((key) => plannedRows.has(key)) || dependencies.some((key) => deferredRows.has(key))) {
      keys.forEach((key) => deferredRows.add(key));
      continue;
    }

    let changes: RowChange[];
    try {
      changes = mergePendingEdits(projected, group.edits);
      if (changes.length) validateChanges(projected, changes);
    } catch (cause) {
      blocked[group.id] = cause instanceof Error ? cause.message : 'This edit needs attention.';
      keys.forEach((key) => blockedRows.add(key));
      continue;
    }
    if (!changes.length) {
      acknowledged.push(group.id);
      continue;
    }

    const needsImageColumn =
      !writeImages && changes.some((change) => change.tab === 'Products' && !!change.row.image);
    if (needsImageColumn) {
      imageSetup ??= await addProductImageColumn(token, document);
      if (!imageSetup.length) {
        blocked[group.id] =
          'Products column G contains existing data. Move it to another column before saving a picture.';
        keys.forEach((key) => blockedRows.add(key));
        continue;
      }
    }
    const writes = [
      ...(needsImageColumn ? imageSetup! : []),
      ...buildRowRequests(document, current.data, changes, writeImages || needsImageColumn),
    ];
    const writeBytes = encoder.encode(JSON.stringify(writes)).byteLength;
    if (batchEnvelopeBytes + writeBytes > batchByteLimit) {
      blocked[group.id] = 'This edit is too large to sync in one batch.';
      keys.forEach((key) => blockedRows.add(key));
      continue;
    }
    if (bytes + writeBytes > batchByteLimit) {
      keys.forEach((key) => deferredRows.add(key));
      continue;
    }

    bytes += writeBytes;
    writeImages ||= needsImageColumn;
    requests.push(...writes);
    planned.push(group);
    keys.forEach((key) => plannedRows.add(key));
    projected = applyChanges(projected, changes);
  }

  if (!requests.length) return { base: current, acknowledged, blocked, remaining: false };

  // On a failed POST or readback, the caller retains the outbox. The next
  // fresh read recognizes rows already applied by their stable IDs and values.
  await request(token, workbookId, ':batchUpdate', undefined, { requests });
  const base = await loadWorkbook(token, workbookId);
  const acknowledgedBeforeWrite = acknowledged.length;
  for (const group of planned) {
    if (group.edits.every((edit) => matchesEdit(base.data, edit))) {
      acknowledged.push(group.id);
    } else {
      blocked[group.id] =
        'Google Sheets did not retain this change. picopos will check again during the next sync.';
    }
  }
  return {
    base,
    acknowledged,
    blocked,
    remaining: deferredRows.size > 0 && acknowledged.length > acknowledgedBeforeWrite,
  };
}
