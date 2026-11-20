import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';

import { SYNC_INTERVALS } from '../domain/sync-timing';
import { customerDirectory, emptyWorkbook } from '../domain/workbook';
import { Connection, ReconnectNotice } from '../features/auth/connection';
import { ReconnectContext } from '../features/auth/reconnect-context';
import { Catalog } from '../features/catalog/catalog';
import { Customers } from '../features/customers/customers';
import { Dashboard } from '../features/dashboard/dashboard';
import { Inventory } from '../features/inventory/inventory';
import { Orders } from '../features/orders/orders';
import { BusinessSettings } from '../features/settings/business-settings';
import { SyncSettings } from '../features/sync/sync-settings';
import { PagedRows } from '../shared/ui/paged-rows';
import { ActionBar, Button, Disclosure, Modal, Panel } from '../shared/ui/controls';
import { Icon } from '../shared/ui/icon';
import { ThemeToggle } from '../shared/ui/theme-toggle';
import { parseScreenRoute, screenTabKey } from './navigation/screen-route';
import { useWorkspaceNavigation } from './navigation/use-workspace-navigation';
import { WorkspacePage } from './navigation/workspace-page';
import { useWorkbook } from './use-workbook';
import { WorkspacePreview } from './workspace-preview';

const PAGES = ['Dashboard', 'Orders', 'Catalog', 'Customers', 'Inventory'] as const;

function Brand() {
  return (
    <span class="brand">
      <span class="brand-mark" aria-hidden="true" />
      <span class="brand-wordmark">
        pico<span>pos</span>
      </span>
    </span>
  );
}

export default function Workspace() {
  const [error, setError] = createSignal('');
  const navigation = useWorkspaceNavigation(setError);
  const {
    route,
    page,
    openPages,
    mobileTabsOpen,
    setMobileTabsOpen,
    tabPaths,
    navigate,
    openPage,
    closePage,
  } = navigation;
  const {
    reconnectContext,
    saved,
    local,
    demo,
    workbook,
    busy,
    syncing,
    checkingSavedSession,
    syncError,
    authError,
    expired,
    online,
    syncInterval,
    nextSyncAt,
    needsReconnect,
    connectionBusy,
    issues,
    connect,
    setupSelection,
    setSetupSelection,
    setAuthError,
    openDemo,
    disconnect,
    discardChange,
    commit,
    syncNow,
    changeSyncInterval,
    leaveDemo,
  } = useWorkbook(setError, navigation);
  const [loginOpen, setLoginOpen] = createSignal(false);
  const [connectRequested, setConnectRequested] = createSignal(false);
  const [pickerActive, setPickerActive] = createSignal(false);
  const setupData = emptyWorkbook();
  const pageData = createMemo(() => workbook()?.data ?? setupData);
  const cancelSetup = () => {
    if (connectionBusy()) {
      setLoginOpen(true);
      return;
    }
    setSetupSelection(undefined);
    setAuthError('');
  };
  createEffect(
    () =>
      [
        checkingSavedSession(),
        saved(),
        workbook(),
        pickerActive(),
        setupSelection(),
        connectRequested(),
      ] as const,
    ([checking, selection, current, choosing, setup, requested]) => {
      if (current || selection) setConnectRequested(false);
      setLoginOpen(!choosing && (Boolean(setup) || (requested && !checking && !selection && !current)));
    },
  );
  const customerLabels = createMemo(() => {
    const labels = new Map<string, string>();
    const data = workbook()?.data;
    if (!data) return labels;
    for (const entry of customerDirectory(data)) {
      if (!labels.has(entry.key)) labels.set(entry.key, entry.customer.name);
    }
    return labels;
  });

  const tabLabel = (key: string) => {
    const screen = parseScreenRoute(tabPaths[key]);
    if (screen.creating) return 'New order';
    if (screen.orderId)
      return workbook()?.data.Orders.find((order) => order.id === screen.orderId)?.number || 'Order details';
    if (screen.customerKey) return customerLabels().get(screen.customerKey) || 'Customer details';
    return screen.page === 'Connection' ? 'Settings' : screen.page === 'Catalog' ? 'Products' : screen.page;
  };
  const fresh = createMemo(() => !checkingSavedSession() && !saved() && !workbook());
  const reconnecting = createMemo(() => Boolean(local() && !demo() && expired()));
  const connection = () => (
    <Connection
      onPickerActiveChange={setPickerActive}
      saved={saved()}
      authorized={Boolean(local() && !demo() && !expired())}
      reauthorizing={reconnecting()}
      busy={connectionBusy()}
      offline={!online()}
      error={needsReconnect() && local() ? undefined : authError()}
      onSelect={connect}
      onDemo={demo() ? undefined : openDemo}
    >
      {!demo() && local() && (
        <SyncSettings
          intervalSeconds={syncInterval()}
          intervals={SYNC_INTERVALS}
          onIntervalChange={changeSyncInterval}
          pending={local()?.pending ?? []}
          online={online()}
          expired={expired()}
          syncing={syncing()}
          busy={busy()}
          nextSyncAt={nextSyncAt()}
          lastSyncedAt={local()?.lastSyncedAt}
          syncError={syncError()}
          onSync={syncNow}
          onDiscard={discardChange}
        />
      )}
    </Connection>
  );

  const renderPages = (workbookId: string) => (
    <For each={openPages()}>
      {(tabKey) => {
        const item = () => parseScreenRoute(tabPaths[tabKey]).page;
        return (
          <WorkspacePage
            tabKey={tabKey}
            path={tabPaths[tabKey]}
            active={screenTabKey(route()) === tabKey}
            label={tabLabel(tabKey)}
            onNavigate={navigate}
            onClose={closePage}
          >
            {item() === 'Dashboard' && <Dashboard data={pageData()} />}
            {item() === 'Orders' && (
              <Orders data={pageData()} busy={busy()} saveError={error()} onCommit={commit} />
            )}
            {item() === 'Catalog' && (
              <Catalog data={pageData()} busy={busy()} error={error()} onCommit={commit} />
            )}
            {item() === 'Customers' && (
              <Customers data={pageData()} busy={busy()} error={error()} onCommit={commit} />
            )}
            {item() === 'Inventory' && (
              <Inventory data={pageData()} busy={busy()} saveError={error()} onCommit={commit} />
            )}
            {item() === 'Connection' && (
              <>
                <div class="settings-title">
                  <h1>Settings</h1>
                </div>
                <div class="settings-grid">
                  <BusinessSettings data={pageData()} busy={busy()} error={error()} onCommit={commit} />
                  <div class="panel settings-connection stack">
                    {connection()}
                    {!demo() && (
                      <p class="muted">
                        Offline data stays available in this browser profile. On a shared device, sync your
                        changes and disconnect when finished. Disconnect removes this workbook’s local copy;
                        unsynced changes must be synced first.
                      </p>
                    )}
                    <ActionBar label="Workbook actions" class="settings-workbook-actions">
                      {!demo() && (
                        <a
                          class="button secondary"
                          title="Open sheet in a new tab"
                          href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(workbookId)}/edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Icon name="external" /> Go to sheet
                        </a>
                      )}
                      {!demo() ? (
                        <Button
                          class="secondary disconnect"
                          type="button"
                          disabled={connectionBusy()}
                          onClick={disconnect}
                        >
                          Disconnect workbook
                        </Button>
                      ) : (
                        <Button
                          class="secondary disconnect"
                          type="button"
                          disabled={busy()}
                          onClick={leaveDemo}
                        >
                          Leave demo
                        </Button>
                      )}
                    </ActionBar>
                  </div>
                </div>
              </>
            )}
          </WorkspacePage>
        );
      }}
    </For>
  );

  return (
    <ReconnectContext value={reconnectContext}>
      <div class="app-shell">
        <Modal
          dismissLabel={setupSelection() ? undefined : 'Close'}
          open={loginOpen()}
          title={setupSelection() ? 'Set up your workbook' : 'Welcome to picopos'}
          class={setupSelection() ? 'login-modal workbook-setup-modal' : 'login-modal'}
          onDismiss={async () => {
            if (pickerActive()) return;
            if (setupSelection()) await cancelSetup();
            else setConnectRequested(false);
          }}
        >
          {setupSelection() ? (
            <BusinessSettings
              data={setupData}
              busy={connectionBusy() || !online()}
              error={!online() ? 'Go online to finish workbook setup.' : authError()}
              setup={{
                interval: syncInterval(),
                onFinish: async (settings, interval) => {
                  const selection = setupSelection();
                  if (selection) await connect(selection, { settings, interval });
                },
                onCancel: cancelSetup,
              }}
            >
              <p class="muted">
                Choose the starting settings for <strong>{setupSelection()?.name}</strong>. You can change
                them later in Settings.
              </p>
            </BusinessSettings>
          ) : (
            <div class="stack">
              <div class="login-intro">
                <h1>Run your shop from a spreadsheet</h1>
                <p class="muted">Manage inventory and orders in a Google workbook your team owns.</p>
              </div>
              {connection()}
            </div>
          )}
        </Modal>
        <ReconnectNotice />
        {!saved() && !workbook() && !loginOpen() && !pickerActive() && (
          <main class="workspace-welcome stack">
            <h1>
              <Brand />
            </h1>
            <div class="welcome-intro">
              <h2>Your shop, powered by Google Sheets</h2>
              <p class="muted">
                Track stock, customers, and orders in a spreadsheet you control. Connect your workbook with
                your Google account or explore picopos with sample data.
              </p>
            </div>
            <div class="row">
              <Button
                disabled={!fresh()}
                onClick={() => {
                  setConnectRequested(true);
                }}
              >
                Connect a workbook
              </Button>
              <Button class="secondary" disabled={!fresh()} onClick={openDemo}>
                Try the demo
              </Button>
            </div>
            <nav class="row" aria-label="About picopos">
              <a href="/about.html">About picopos</a>
              <a href="/privacy.html">Privacy policy</a>
              <a href="/terms.html">Terms of service</a>
            </nav>
          </main>
        )}
        {!workbook() && saved() && (
          <div class="workspace-loading" role="status">
            {checkingSavedSession()
              ? 'Opening your workspace…'
              : online()
                ? 'Reconnect to load your workbook.'
                : 'You’re offline. Your workbook will load when you’re back online.'}
          </div>
        )}
        <div
          class={['workspace', !workbook() && 'workspace-preview']}
          inert={!workbook()}
          aria-hidden={!workbook() ? 'true' : undefined}
        >
          <header class="topbar">
            <Brand />
            <nav class="workspace-tabs" aria-label="Open pages">
              <For each={openPages()}>
                {(item) => (
                  <div class={['workspace-tab', screenTabKey(route()) === item && 'active']}>
                    <Button
                      unstyled
                      class="workspace-tab-label"
                      aria-current={screenTabKey(route()) === item ? 'page' : undefined}
                      onClick={() => openPage(item)}
                    >
                      {tabLabel(item)}
                    </Button>
                    <Button
                      unstyled
                      class="workspace-tab-close"
                      aria-label={`Close ${tabLabel(item)} tab`}
                      onClick={() => closePage(item)}
                    >
                      ×
                    </Button>
                  </div>
                )}
              </For>
            </nav>
            <div class="desktop-theme-toggle">
              <ThemeToggle />
            </div>
            <Button
              class="secondary mobile-tabs-trigger"
              title="Open tabs"
              aria-label={`Open tabs, ${openPages().length} open`}
              aria-expanded={mobileTabsOpen() ? 'true' : 'false'}
              aria-haspopup="dialog"
              onClick={() => {
                setMobileTabsOpen(true);
              }}
            >
              <Icon name="layers" />
              <span class="open-tabs-count" aria-hidden="true">
                {openPages().length}
              </span>
            </Button>
          </header>
          <Modal
            dismissLabel="Done"
            open={mobileTabsOpen()}
            onDismiss={() => setMobileTabsOpen(false)}
            title="Open tabs"
            class="mobile-tabs-sidebar"
          >
            <nav class="mobile-workspace-tabs" aria-label="Open pages">
              <For each={openPages()}>
                {(item) => (
                  <div class={['workspace-tab', screenTabKey(route()) === item && 'active']}>
                    <Button
                      unstyled
                      class="workspace-tab-label"
                      aria-current={screenTabKey(route()) === item ? 'page' : undefined}
                      onClick={async () => {
                        await openPage(item);
                        setMobileTabsOpen(false);
                      }}
                    >
                      {tabLabel(item)}
                    </Button>
                    <Button
                      unstyled
                      class="workspace-tab-close"
                      title={`Close ${tabLabel(item)} tab`}
                      aria-label={`Close ${tabLabel(item)} tab`}
                      onClick={() => closePage(item)}
                    >
                      ×
                    </Button>
                  </div>
                )}
              </For>
            </nav>
            <div class="mobile-sidebar-theme">
              <span>Appearance</span>
              <ThemeToggle />
            </div>
          </Modal>
          <div class="workspace-body">
            <aside class="workspace-sidebar" aria-label="Workspace navigation">
              <nav class="primary-nav" aria-label="Workspace">
                {[...PAGES, 'Connection' as const].map((item) => (
                  <Button
                    unstyled
                    title={item === 'Connection' ? 'Settings' : item === 'Catalog' ? 'Products' : item}
                    class={[
                      'nav-item',
                      item === 'Connection' && 'desktop-settings',
                      page() === item && 'selected',
                    ]}
                    aria-current={page() === item ? 'page' : undefined}
                    onClick={() => openPage(item)}
                  >
                    <Icon
                      name={
                        item === 'Dashboard'
                          ? 'dashboard'
                          : item === 'Orders'
                            ? 'orders'
                            : item === 'Customers'
                              ? 'customers'
                              : item === 'Catalog'
                                ? 'layers'
                                : item === 'Inventory'
                                  ? 'inventory'
                                  : 'settings'
                      }
                    />
                    <span>{item === 'Connection' ? 'Settings' : item === 'Catalog' ? 'Products' : item}</span>
                  </Button>
                ))}
              </nav>
              <div class="mobile-nav-more">
                <Button
                  unstyled
                  class={['nav-item', page() === 'Connection' && 'selected']}
                  aria-label="More options"
                  popovertarget="mobile-nav-options"
                >
                  <Icon name="more" />
                </Button>
                <nav
                  id="mobile-nav-options"
                  class="mobile-nav-options"
                  popover="auto"
                  aria-label="More options"
                >
                  <Button
                    unstyled
                    class="nav-item"
                    aria-current={page() === 'Connection' ? 'page' : undefined}
                    popovertarget="mobile-nav-options"
                    popovertargetaction="hide"
                    onClick={() => openPage('Connection')}
                  >
                    <Icon name="settings" /> Settings
                  </Button>
                  <a
                    class="nav-item"
                    href="/help/"
                    target="_blank"
                    rel="noopener"
                    aria-label="Help (opens in a new tab)"
                    onClick={(event) => {
                      const link = event.currentTarget;
                      return link.closest<HTMLElement>('[popover]')?.hidePopover();
                    }}
                  >
                    <Icon name="help" /> Help
                  </a>
                </nav>
              </div>
              <footer class="workspace-sidebar-footer">
                <a
                  class="nav-item"
                  href="/help/"
                  target="_blank"
                  rel="noopener"
                  title="Help (opens in a new tab)"
                  aria-label="Help (opens in a new tab)"
                >
                  <Icon name="help" />
                  <span>Help</span>
                </a>
              </footer>
            </aside>
            <div class="workspace-main">
              <main class="main-content stack" aria-label={page()}>
                {demo() && (
                  <div class="notice demo-notice">
                    <span>Demo changes reset on reload or exit.</span>
                    <Button class="secondary compact" type="button" disabled={busy()} onClick={leaveDemo}>
                      Leave Demo
                    </Button>
                  </div>
                )}
                {error() && (
                  <p class="notice error" role="alert">
                    {error()}
                  </p>
                )}
                {issues().length > 0 && (
                  <Panel class="issue-panel">
                    <Disclosure
                      label={`${issues().length} inventory ${issues().length === 1 ? 'issue' : 'issues'}`}
                    >
                      <ul class="paged-viewport">
                        <PagedRows list rows={issues()} estimate={44}>
                          {(page) => <For each={page()}>{(issue) => <li>{issue}</li>}</For>}
                        </PagedRows>
                      </ul>
                    </Disclosure>
                  </Panel>
                )}
                {!workbook() && <WorkspacePreview />}
                <Show when={workbook()?.id} keyed>
                  {renderPages}
                </Show>
              </main>
            </div>
          </div>
        </div>
      </div>
    </ReconnectContext>
  );
}
