import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, createSignal, useContext } from 'solid-js';

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
import { ReconnectContext } from './reconnect-context';

interface GoogleConnectionProps {
  saved?: SpreadsheetSelection;
  onPickerActiveChange?: (active: boolean) => void;
  busy?: boolean;
  offline?: boolean;
  error?: string;
  onSelect: (selection: SpreadsheetSelection) => void | Promise<void>;
}

type ConnectionProps = GoogleConnectionProps &
  (
    | { reconnectOnly: true; onDismiss?: () => void }
    | {
        reconnectOnly?: false;
        authorized?: boolean;
        reauthorizing?: boolean;
        onDemo?: () => void | Promise<void>;
      }
  );

export function ReconnectNotice() {
  const { saved, expired, dismissed, dismiss, busy, error, onReconnect } = useContext(ReconnectContext);
  return (
    <>
      {expired() && saved() && !dismissed() && (
        <Connection
          reconnectOnly
          onDismiss={dismiss}
          saved={saved()}
          busy={busy()}
          error={error()}
          onSelect={onReconnect}
        />
      )}
    </>
  );
}

export const Connection = (props: ConnectionProps & { children?: JSX.Element }) => {
  const [connectButton, setConnectButton] = createSignal<HTMLButtonElement>();
  const [pickerButton, setPickerButton] = createSignal<HTMLButtonElement>();
  const [createButton, setCreateButton] = createSignal<HTMLButtonElement>();
  const [shopName, setShopName] = createSignal('');
  const [accountButton, setAccountButton] = createSignal<HTMLButtonElement>();
  const [ready, setReady] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal('');
  const [loadingFailed, setLoadingFailed] = createSignal(false);
  const [loadAttempt, setLoadAttempt] = createSignal(0);

  // Google must open its OAuth window synchronously from a native click.
  createEffect(
    () =>
      [
        connectButton(),
        pickerButton(),
        createButton(),
        accountButton(),
        loadAttempt(),
        props.offline,
      ] as const,
    ([connect, choose, create, account, , offline]) => {
      if (!isGoogleConfigured || offline || (!connect && !choose && !create && !account)) return;

      const controller = new AbortController();
      const { signal } = controller;
      setReady(false);
      setLoadingFailed(false);
      const select = async (action: 'saved' | 'picker' | 'account' | 'create') => {
        if (!ready() || pending() || props.busy) return;
        setPending(true);
        setError('');
        try {
          const cachedToken = props.reconnectOnly || action === 'account' ? undefined : getAccessToken();
          const token = cachedToken ?? (await requestGoogleAccess(signal, action !== 'saved'));
          if (signal.aborted) return;
          if (action === 'picker' && props.onPickerActiveChange) {
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
            props.onPickerActiveChange(true);
            await closed;
            if (signal.aborted) return;
          }
          const selection =
            action === 'picker'
              ? await pickSpreadsheet(token, signal)
              : action === 'create'
                ? await createSpreadsheet(token, shopName())
                : props.saved;
          if (!signal.aborted && selection) await props.onSelect(selection);
        } catch (cause) {
          if (!signal.aborted)
            setError(cause instanceof Error ? cause.message : 'Unable to open the workbook.');
        } finally {
          if (props.onPickerActiveChange) props.onPickerActiveChange(false);
          setPending(false);
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
          if (!signal.aborted) setReady(true);
        })
        .catch((cause: unknown) => {
          if (signal.aborted) return;
          setLoadingFailed(true);
          setError(cause instanceof Error ? cause.message : 'Google authorization could not load.');
        });

      return () => {
        controller.abort();
        connect?.removeEventListener('click', reconnect);
        choose?.removeEventListener('click', openPicker);
        create?.removeEventListener('click', createWorkbook);
        account?.removeEventListener('click', chooseAccount);
      };
    },
  );

  const busy = createMemo(() => pending() || props.busy);
  const disabled = createMemo(() => !ready() || busy() || props.offline);

  const authorized = createMemo(() => !props.reconnectOnly && props.authorized);
  const canReconnect = createMemo(
    () => props.saved && !authorized() && (props.reconnectOnly || !props.reauthorizing),
  );

  return (
    <Panel
      class={['stack', props.reconnectOnly && 'reconnect-notice reconnect-toast']}
      role="region"
      aria-label="Google Sheets connection"
    >
      {props.reconnectOnly && (
        <Button
          unstyled
          class="utility-button toast-close"
          aria-label="Dismiss reconnect notification"
          onClick={props.onDismiss}
        >
          <Icon name="close" />
        </Button>
      )}
      {props.reconnectOnly ? (
        <p role="status">
          <strong>Reconnect to Google Sheets.</strong> You can keep saving changes on this device.
        </p>
      ) : (
        <div>
          <p class="eyebrow">Google Sheets</p>
          <h2>{authorized() ? 'Workbook connection' : 'Connect a workbook'}</h2>
          <p class="muted">Sign in with the Google account you use for your shop.</p>
        </div>
      )}

      {!props.reconnectOnly && props.saved && (
        <div class="notice">
          {authorized() ? 'Connected to ' : 'Saved workbook: '}
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
      {(error() || props.error) && (
        <p class="notice error" role="alert">
          {error() || props.error}
        </p>
      )}

      {((isGoogleConfigured && canReconnect()) || loadingFailed()) && (
        <div class="row">
          {isGoogleConfigured && canReconnect() && (
            <Button type="button" ref={setConnectButton} disabled={disabled()}>
              {props.reconnectOnly ? 'Reconnect' : 'Reconnect saved workbook'}
            </Button>
          )}
          {isGoogleConfigured && canReconnect() && (
            <Button type="button" class="secondary" ref={setAccountButton} disabled={disabled()}>
              Use another Google account
            </Button>
          )}
          {loadingFailed() && (
            <Button
              type="button"
              class="secondary"
              onClick={() => {
                setError('');
                setLoadAttempt((v) => v + 1);
              }}
            >
              Retry Google setup
            </Button>
          )}
        </div>
      )}

      {isGoogleConfigured && !props.reconnectOnly && (
        <div class="workbook-options">
          <details class="workbook-create">
            <summary class="workbook-option">
              <Icon name="plus" />
              <span>
                <strong>Create a new workbook</strong>
                <small>Start with a fresh spreadsheet in Google Drive.</small>
              </span>
            </summary>
            <div class="workbook-create-fields">
              <label class="field">
                <span>Shop name</span>
                <input
                  type="text"
                  value={shopName()}
                  onInput={(event) => {
                    setShopName(event.currentTarget.value);
                  }}
                  disabled={disabled()}
                  placeholder="My shop"
                />
              </label>
              <p class="muted workbook-filename">
                File name: <strong>picopos · {shopName().trim() || 'My shop'}</strong>
              </p>
              <Button type="button" ref={setCreateButton} disabled={disabled()}>
                Create workbook
              </Button>
            </div>
          </details>
          <Button unstyled class="workbook-option" ref={setPickerButton} disabled={disabled()}>
            <Icon name="orders" />
            <span>
              <strong>{props.saved ? 'Choose another workbook' : 'Choose an existing workbook'}</strong>
              <small>Find a picopos spreadsheet you can edit.</small>
            </span>
            <Icon name="arrow-right" />
          </Button>
          <p class="muted workbook-picker-hint">Missing a workbook? Search by its filename in the picker.</p>
        </div>
      )}

      {props.children}
      {isGoogleConfigured && !props.offline && !ready() && !loadingFailed() && (
        <p class="muted" role="status">
          Loading Google authorization…
        </p>
      )}
      {pending() && (
        <p class="muted" role="status">
          Connecting to Google Sheets…
        </p>
      )}
      {!props.reconnectOnly && props.onDemo && (
        <div class="workbook-demo">
          <div>
            <strong>Just looking?</strong>
            <p class="muted">Explore with sample data. No sign-in needed.</p>
          </div>
          <Button type="button" class="secondary" onClick={props.onDemo} disabled={busy()}>
            Try the demo
          </Button>
        </div>
      )}
      {!props.reconnectOnly && (
        <p class="muted">
          <a href="/privacy.html">Privacy policy</a> · <a href="/terms.html">Terms of service</a>
        </p>
      )}
    </Panel>
  );
};
