import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, omit, type Accessor } from 'solid-js';

import { Table } from './controls';
import { PagedRows } from './paged-rows';

type Column<T> = {
  label: string;
  value?: (row: T) => string | number;
  class?: string;
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function SortableTable<T>(
  props: Omit<Parameters<typeof Table>[0], 'children'> & {
    rows: T[];
    columns: Column<T>[];
    estimate: number;
    resetKey?: string;
    emptyMessage?: string;
    children: (rows: Accessor<T[]>) => JSX.Element;
  },
) {
  const [sort, setSort] = createSignal<{ index: number; descending: boolean }>();
  const ordered = createMemo(() => {
    const active = sort();
    const value = active && props.columns[active.index]?.value;
    if (!value) return props.rows;
    return props.rows
      .map((row) => ({ row, key: value(row) }))
      .sort((a, b) => {
        const difference =
          typeof a.key === 'number' && typeof b.key === 'number'
            ? a.key - b.key
            : collator.compare(String(a.key), String(b.key));
        return active.descending ? -difference : difference;
      })
      .map((entry) => entry.row);
  });
  return (
    <Table {...omit(props, 'rows', 'columns', 'estimate', 'resetKey', 'emptyMessage', 'children')}>
      <thead>
        <tr>
          {props.columns.map((column, index) => {
            const direction = () =>
              sort()?.index === index ? (sort()?.descending ? 'descending' : 'ascending') : undefined;
            return (
              <th scope="col" class={column.class} aria-sort={direction()}>
                {column.value ? (
                  <button
                    type="button"
                    class="table-sort"
                    onClick={() =>
                      setSort((previous) => ({
                        index,
                        descending: previous?.index === index && !previous.descending,
                      }))
                    }
                  >
                    {column.label}
                    <span aria-hidden="true">
                      {direction() === 'ascending' ? '↑' : direction() === 'descending' ? '↓' : '↕'}
                    </span>
                  </button>
                ) : (
                  <span class="sr-only">{column.label}</span>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <PagedRows
        table
        rows={ordered()}
        estimate={props.estimate}
        resetKey={JSON.stringify([props.resetKey, sort()])}
      >
        {props.children}
      </PagedRows>
      {props.emptyMessage && !props.rows.length && (
        <tbody>
          <tr>
            <td colspan={props.columns.length}>{props.emptyMessage}</td>
          </tr>
        </tbody>
      )}
    </Table>
  );
}
