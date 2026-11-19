import {
  component$,
  createContextId,
  useContext,
  useSignal,
  useVisibleTask$,
  type QRL,
  type Signal,
} from '@builder.io/qwik';
import {
  getAccessToken,
  isGoogleConfigured,
  pickSpreadsheet,
  prepareGoogle,
  requestGoogleAccess,
  type SpreadsheetSelection,
} from '../../infrastructure/google/google';
import { createSpreadsheet } from '../../infrastructure/google/sheets-client';
import { Button, Panel } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';

interface GoogleConnectionProps {
  saved?: SpreadsheetSelection;
  pickerActive?: Signal<boolean>;
  busy?: boolean;
  offline?: boolean;
  error?: string;
  onSelect$: QRL<(selection: SpreadsheetSelection) => void | Promise<void>>;
}

type ConnectionProps = GoogleConnectionProps &
  (
    | { reconnectOnly: true; onDismiss$?: QRL<() => void> }
    | {
        reconnectOnly?: false;
        authorized?: boolean;
        reauthorizing?: boolean;
        onDemo$: QRL<() => void | Promise<void>>;
      }
  );

export const ReconnectContext = createContextId<{
  saved: Signal<SpreadsheetSelection | undefined>;
  expired: Signal<boolean>;
  dismissed: Signal<boolean>;
  busy: Signal<boolean>;
  error: Signal<string>;
  onReconnect$: GoogleConnectionProps['onSelect$'];
}>('piecom.google-reconnect');

export const ReconnectNotice = component$(() => {
  const { saved, expired, dismissed, busy, error, onReconnect$ } = useContext(ReconnectContext);
  if (!expired.value || !saved.value || dismissed.value) return null;
  return (
    <Connection
      reconnectOnly
      onDismiss$={() => {
        dismissed.value = true;
      }}
      saved={saved.value}
      busy={busy.value}
      error={error.value}
      onSelect$={onReconnect$}
    />
  );
});

export const Connection = component$<ConnectionProps>((props) => {
  const connectButton = useSignal<HTMLButtonElement>();
  const pickerButton = useSignal<HTMLButtonElement>();
  const createButton = useSignal<HTMLButtonElement>();
  const shopName = useSignal('My shop');
  const accountButton = useSignal<HTMLButtonElement>();
  const ready = useSignal(false);
  const pending = useSignal(false);
  const error = useSignal('');
  const loadingFailed = useSignal(false);
  const loadAttempt = useSignal(0);

  // Google must open its OAuth window synchronously from a native click.
  useVisibleTask$(
    ({ track, cleanup }) => {
      const connect = track(() => connectButton.value);
      const choose = track(() => pickerButton.value);
      const create = track(() => createButton.value);
      const account = track(() => accountButton.value);
      track(() => loadAttempt.value);
      const offline = track(() => props.offline);
      if (!isGoogleConfigured || offline || (!connect && !choose && !create && !account)) return;

      const controller = new AbortController();
      const { signal } = controller;
      ready.value = false;
      loadingFailed.value = false;
      const select = async (action: 'saved' | 'picker' | 'account' | 'create') => {
        if (!ready.value || pending.value || props.busy) return;
        pending.value = true;
        error.value = '';
        try {
          const cachedToken = props.reconnectOnly || action === 'account' ? undefined : getAccessToken();
          const token = cachedToken ?? (await requestGoogleAccess(signal, action !== 'saved'));
          if (signal.aborted) return;
          if (action === 'picker' && props.pickerActive) {
            // Native modal dialogs sit above Google's picker. Wait for the welcome
            // dialog to leave the top layer before opening the file chooser.
            const dialog = choose?.closest('dialog');
            const closed = new Promise<void>((resolve) => {
              if (!dialog?.open) return resolve();
              const finish = () => {
                dialog.removeEventListener('close', finish);
                signal.removeEventListener('abort', finish);
                resolve();
              };
              dialog.addEventListener('close', finish, { once: true });
              signal.addEventListener('abort', finish, { once: true });
            });
            props.pickerActive.value = true;
            await closed;
            if (signal.aborted) return;
          }
          const selection =
            action === 'picker'
              ? await pickSpreadsheet(token, signal)
              : action === 'create'
                ? await createSpreadsheet(token, shopName.value)
                : props.saved;
          if (!signal.aborted && selection) await props.onSelect$(selection);
        } catch (cause) {
          if (!signal.aborted)
            error.value = cause instanceof Error ? cause.message : 'Unable to open the workbook.';
        } finally {
          if (props.pickerActive) props.pickerActive.value = false;
          pending.value = false;
        }
      };

      const reconnect = () => {
        void select('saved');
      };
      const openPicker = () => {
        void select('picker');
      };
      const createWorkbook = () => {
        void select('create');
      };
      const chooseAccount = () => {
        void select('account');
      };
      connect?.addEventListener('click', reconnect);
      choose?.addEventListener('click', openPicker);
      create?.addEventListener('click', createWorkbook);
      account?.addEventListener('click', chooseAccount);

      void prepareGoogle()
        .then(() => {
          if (!signal.aborted) ready.value = true;
        })
        .catch((cause: unknown) => {
          if (signal.aborted) return;
          loadingFailed.value = true;
          error.value = cause instanceof Error ? cause.message : 'Google authorization could not load.';
        });

      cleanup(() => {
        controller.abort();
        connect?.removeEventListener('click', reconnect);
        choose?.removeEventListener('click', openPicker);
        create?.removeEventListener('click', createWorkbook);
        account?.removeEventListener('click', chooseAccount);
      });
    },
    { strategy: 'document-ready' },
  );

  const busy = pending.value || props.busy;
  const disabled = !ready.value || busy || props.offline;
  const reconnectOnly = props.reconnectOnly;
  const authorized = !reconnectOnly && props.authorized;
  const canReconnect = props.saved && !authorized && (reconnectOnly || !props.reauthorizing);

  return (
    <Panel
      class={['stack', reconnectOnly && 'reconnect-notice reconnect-toast']}
      role="region"
      aria-label="Google Sheets connection"
    >
      {reconnectOnly && (
        <Button
          unstyled
          class="utility-button toast-close"
          aria-label="Dismiss reconnect notification"
          onClick$={props.onDismiss$}
        >
          <Icon name="close" />
        </Button>
      )}
      {reconnectOnly ? (
        <p role="status">
          <strong>Reconnect to Google Sheets.</strong> You can keep saving changes on this device.
        </p>
      ) : (
        <div>
          <p class="eyebrow">Google Sheets</p>
          <h2>{authorized ? 'Workbook connection' : 'Connect a workbook'}</h2>
          <p class="muted">
            Create a workbook for your shop or choose an existing one you can edit. Each person connects with
            their own Google account.
          </p>
        </div>
      )}

      {!reconnectOnly && props.saved && (
        <div class="notice">
          {authorized ? 'Connected to ' : 'Saved workbook: '}
          <strong>{props.saved.name}</strong>
        </div>
      )}

      {!isGoogleConfigured && (
        <p class="notice">Google Sheets access is unavailable on this site. You can explore the demo.</p>
      )}
      {props.offline && (
        <p class="notice" role="status">
          You’re offline. Connect to the internet to open a Google workbook.
        </p>
      )}
      {(error.value || props.error) && (
        <p class="notice error" role="alert">
          {error.value || props.error}
        </p>
      )}

      {isGoogleConfigured && !reconnectOnly && (
        <label class="field">
          <span>Shop name for a new workbook</span>
          <input type="text" bind:value={shopName} disabled={busy} placeholder="My shop" />
          <span class="muted">New file: picopos · {shopName.value.trim() || 'My shop'}</span>
        </label>
      )}
      {!reconnectOnly && (
        <p class="muted">
          The chooser searches for “picopos” files. To use an older workbook, add “picopos” to its filename in
          Google Drive first.
        </p>
      )}
      <div class="row">
        {isGoogleConfigured && !reconnectOnly && (
          <Button type="button" elementRef={createButton} disabled={disabled}>
            Create new workbook
          </Button>
        )}
        {isGoogleConfigured && canReconnect && (
          <Button type="button" elementRef={connectButton} disabled={disabled}>
            {reconnectOnly ? 'Reconnect' : 'Reconnect saved workbook'}
          </Button>
        )}
        {isGoogleConfigured && !reconnectOnly && (
          <Button type="button" class="secondary" elementRef={pickerButton} disabled={disabled}>
            Choose existing workbook
          </Button>
        )}
        {isGoogleConfigured && canReconnect && (
          <Button type="button" class="secondary" elementRef={accountButton} disabled={disabled}>
            Use another Google account
          </Button>
        )}
        {loadingFailed.value && (
          <Button
            type="button"
            class="secondary"
            onClick$={() => {
              error.value = '';
              loadAttempt.value += 1;
            }}
          >
            Retry Google setup
          </Button>
        )}
        {!reconnectOnly && (
          <Button type="button" class="secondary" onClick$={props.onDemo$} disabled={busy}>
            Try the demo
          </Button>
        )}
      </div>

      {isGoogleConfigured && !props.offline && !ready.value && !loadingFailed.value && (
        <p class="muted" role="status">
          Loading Google authorization…
        </p>
      )}
      {pending.value && (
        <p class="muted" role="status">
          Connecting to Google Sheets…
        </p>
      )}
    </Panel>
  );
});
