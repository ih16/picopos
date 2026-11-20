import { createEffect, createMemo, createSignal, For } from 'solid-js';

import { type PendingChange } from '../../domain/outbox';
import { PagedRows } from '../../shared/ui/paged-rows';
import { Button, Disclosure, SelectField } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';

type SyncSettingsProps = {
  intervalSeconds: number;
  intervals: readonly { value: string; label: string }[];
  onIntervalChange: (seconds: string) => void | Promise<void>;
  pending: PendingChange[];
  online: boolean;
  expired: boolean;
  syncing: boolean;
  busy: boolean;
  nextSyncAt?: number;
  lastSyncedAt?: number;
  syncError?: string;
  onSync: () => void | Promise<void>;
  onDiscard: (id: string) => void | Promise<void>;
};

function describeChange({ edits }: PendingChange) {
  const { before, after } = edits[0];
  const action = before ? 'Update' : 'Create';
  switch (after.tab) {
    case 'Orders':
      return `${action} order ${after.row.number}`;
    case 'Products':
      return `${action} product ${after.row.name}`;
    case 'Variants':
      return `${action} variant ${after.row.sku}`;
    case 'Customers':
      return `${action} customer ${after.row.name}`;
    case 'Categories':
      return `${action} category ${after.row.name}`;
    case 'Order Items':
      return `${action} order item ${after.row.sku}`;
    case 'Returns':
      return after.row.status === 'Received' ? 'Receive return' : `${action} return request`;
    case 'Stock Entries':
      return `${action} stock entry · ${after.row.type}`;
    case 'Purchase Lots':
      return `${action} purchase lot ${after.row.name}`;
    case 'Settings':
      return `${action} workbook setting`;
  }
}

export function SyncSettings(props: SyncSettingsProps) {
  const [now, setNow] = createSignal(0);
  createEffect(
    () => props.nextSyncAt,
    (nextSyncAt) => {
      if (!nextSyncAt) return;
      setNow(Date.now());
      const timer = window.setInterval(() => setNow(Date.now()), 1_000);
      return () => window.clearInterval(timer);
    },
  );
  const seconds = createMemo(() =>
    now() && props.nextSyncAt ? Math.max(0, Math.ceil((props.nextSyncAt - now()) / 1_000)) : undefined,
  );
  const countdown = () => {
    const value = seconds();
    return value === undefined ? '' : Math.floor(value / 60) + ':' + String(value % 60).padStart(2, '0');
  };
  const count = createMemo(() => props.pending.length);
  const blocked = createMemo(() => props.pending.filter((item) => item.issue).length);
  const queueLabel = createMemo(() => `${count()} queued ${count() === 1 ? 'change' : 'changes'}`);
  const lastSync = createMemo(() =>
    props.lastSyncedAt
      ? new Date(props.lastSyncedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : undefined,
  );
  const status = createMemo(() =>
    !props.online
      ? 'Offline'
      : props.syncing
        ? 'Syncing…'
        : props.expired
          ? 'Reconnect to sync'
          : props.syncError
            ? 'Sync delayed'
            : blocked() && blocked() === count()
              ? 'Changes need attention'
              : count()
                ? 'Waiting to sync'
                : lastSync()
                  ? `Last synced ${lastSync()}`
                  : 'Ready to sync',
  );

  return (
    <>
      <div class="row sync-settings-row">
        <SelectField
          class="sync-settings-interval"
          label="Minimum sync interval"
          value={String(props.intervalSeconds)}
          options={[...props.intervals]}
          onChange={props.onIntervalChange}
        />
        <Button
          type="button"
          disabled={props.busy || props.syncing || !props.online}
          aria-label={count() ? `Sync now, ${queueLabel()}` : 'Sync now'}
          onClick={props.onSync}
        >
          <Icon name="upload" />
          Sync now
          {count() > 0 && (
            <span class="badge sync-settings-count" aria-hidden="true">
              {count()}
            </span>
          )}
        </Button>
        <span class="muted" role="status">
          {status()}
        </span>
        {countdown() && (
          <span class="muted" role="timer">
            Next sync in {countdown()}
          </span>
        )}
      </div>
      {props.syncError && (
        <p class="notice" role="status">
          {props.syncError}
        </p>
      )}
      {count() > 0 && (
        <Disclosure label="Preview queued changes">
          <ul class="sync-queue paged-viewport">
            <PagedRows rows={props.pending} list estimate={100}>
              {(page) => (
                <For each={page()}>
                  {(item) => (
                    <li class="sync-queue-item">
                      <div>
                        <strong>{describeChange(item)}</strong>
                        {item.edits.length > 1 && (
                          <p class="muted sync-queue-detail">{item.edits.length} related records</p>
                        )}
                        {item.issue && <p class="negative sync-queue-detail">{item.issue}</p>}
                      </div>
                      {item.issue && (
                        <Button
                          type="button"
                          class="secondary compact"
                          disabled={props.busy || props.syncing}
                          onClick={() => props.onDiscard(item.id)}
                        >
                          Discard local change
                        </Button>
                      )}
                    </li>
                  )}
                </For>
              )}
            </PagedRows>
          </ul>
        </Disclosure>
      )}
    </>
  );
}
