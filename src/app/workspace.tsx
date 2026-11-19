import { $, component$, useComputed$, useSignal, useTask$ } from '@builder.io/qwik';
import { SYNC_INTERVALS } from '../domain/sync-timing';
import { customerDirectory, emptyWorkbook } from '../domain/workbook';
import { Connection, ReconnectNotice } from '../features/auth/connection';
import { Catalog } from '../features/catalog/catalog';
import { Customers } from '../features/customers/customers';
import { Dashboard } from '../features/dashboard/dashboard';
import { Inventory } from '../features/inventory/inventory';
import { Orders } from '../features/orders/orders';
import { BusinessSettings } from '../features/settings/business-settings';
import { SyncSettings } from '../features/sync/sync-settings';
import { ActionBar, Button, Disclosure, Modal, Panel } from '../shared/ui/controls';
import { Icon } from '../shared/ui/icon';
import { ThemeToggle } from '../shared/ui/theme-toggle';
import { WorkspacePage } from './navigation/workspace-page';

import { parseScreenRoute, screenTabKey } from './navigation/screen-route';

import { useWorkspaceNavigation } from './navigation/use-workspace-navigation';
import { useWorkbook } from './use-workbook';
import { WorkspacePreview } from './workspace-preview';

const PAGES = ['Dashboard', 'Orders', 'Catalog', 'Customers', 'Inventory'] as const;

const Brand = component$(() => (
  <span class="brand">
    <span class="brand-mark" aria-hidden="true" />
    <span class="brand-wordmark">
      pico<span>pos</span>
    </span>
  </span>
));

export default component$(() => {
  const error = useSignal('');
  const navigation = useWorkspaceNavigation(error);
  const { route, page, openPages, mobileTabsOpen, tabPaths, navigate, openPage, closePage } = navigation;
  const {
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
    openDemo,
    disconnect,
    discardChange,
    commit,
    syncNow,
    changeSyncInterval,
    leaveDemo,
  } = useWorkbook(error, navigation);
  const loginOpen = useSignal(false);
  const connectRequested = useSignal(false);
  const pickerActive = useSignal(false);
  const setupData = useSignal(emptyWorkbook());
  const pageData = useComputed$(() => workbook.value?.data ?? setupData.value);
  const cancelSetup = $(() => {
    if (connectionBusy.value) {
      loginOpen.value = true;
      return;
    }
    setupSelection.value = undefined;
    authError.value = '';
  });
  useTask$(({ track }) => {
    const checking = track(() => checkingSavedSession.value);
    const selection = track(() => saved.value);
    const current = track(() => workbook.value);
    const choosing = track(() => pickerActive.value);
    const setup = track(() => setupSelection.value);
    const requested = track(() => connectRequested.value);
    if (current || selection) connectRequested.value = false;
    loginOpen.value = !choosing && (Boolean(setup) || (requested && !checking && !selection && !current));
  });
  const customerLabels = useComputed$(() => {
    const labels = new Map<string, string>();
    const data = workbook.value?.data;
    if (!data) return labels;
    for (const entry of customerDirectory(data)) {
      if (!labels.has(entry.key)) labels.set(entry.key, entry.customer.name);
    }
    return labels;
  });
  const current = workbook.value;
  const tabLabel = (key: string) => {
    const screen = parseScreenRoute(tabPaths[key]);
    if (screen.creating) return 'New order';
    if (screen.orderId)
      return current?.data.Orders.find((order) => order.id === screen.orderId)?.number || 'Order details';
    if (screen.customerKey) return customerLabels.value.get(screen.customerKey) || 'Customer details';
    return screen.page === 'Connection' ? 'Settings' : screen.page === 'Catalog' ? 'Products' : screen.page;
  };
  const fresh = !checkingSavedSession.value && !saved.value && !workbook.value;
  const reconnecting = Boolean(local.value && !demo.value && expired.value);
  const connection = (
    <Connection
      pickerActive={pickerActive}
      saved={saved.value}
      authorized={Boolean(local.value && !demo.value && !expired.value)}
      reauthorizing={reconnecting}
      busy={connectionBusy.value}
      offline={!online.value}
      error={needsReconnect.value && local.value ? undefined : authError.value}
      onSelect$={connect}
      onDemo$={demo.value ? undefined : openDemo}
    >
      {!demo.value && local.value && (
        <SyncSettings
          intervalSeconds={syncInterval.value}
          intervals={SYNC_INTERVALS}
          onIntervalChange$={changeSyncInterval}
          pending={local.value.pending}
          online={online.value}
          expired={expired.value}
          syncing={syncing.value}
          busy={busy.value}
          nextSyncAt={nextSyncAt.value}
          lastSyncedAt={local.value.lastSyncedAt}
          syncError={syncError.value}
          onSync$={syncNow}
          onDiscard$={discardChange}
        />
      )}
    </Connection>
  );

  const renderPages = (workbookId: string) =>
    openPages.value.map((tabKey) => {
      const item = parseScreenRoute(tabPaths[tabKey]).page;
      return (
        <WorkspacePage
          key={`${workbookId}-${tabKey}`}
          tabKey={tabKey}
          path={tabPaths[tabKey]}
          active={screenTabKey(route.value) === tabKey}
          label={tabLabel(tabKey)}
          onNavigate$={navigate}
          onClose$={closePage}
        >
          {item === 'Dashboard' && <Dashboard data={pageData.value} />}
          {item === 'Orders' && (
            <Orders
              key={workbookId}
              data={pageData.value}
              busy={busy.value}
              saveError={error.value}
              onCommit$={commit}
            />
          )}
          {item === 'Catalog' && (
            <Catalog
              key={workbookId}
              data={pageData.value}
              busy={busy.value}
              error={error.value}
              onCommit$={commit}
            />
          )}
          {item === 'Customers' && (
            <Customers
              key={workbookId}
              data={pageData.value}
              busy={busy.value}
              error={error.value}
              onCommit$={commit}
            />
          )}
          {item === 'Inventory' && (
            <Inventory
              key={workbookId}
              data={pageData.value}
              busy={busy.value}
              saveError={error.value}
              onCommit$={commit}
            />
          )}
          {item === 'Connection' && (
            <>
              <div class="settings-title">
                <h1>Settings</h1>
              </div>
              <div class="settings-grid">
                <BusinessSettings
                  data={pageData.value}
                  busy={busy.value}
                  error={error.value}
                  onCommit$={commit}
                />
                <div class="panel settings-connection stack">
                  {connection}
                  {!demo.value && (
                    <p class="muted">
                      Offline data stays available in this browser profile. On a shared device, sync your
                      changes and disconnect when finished. Disconnect removes this workbook’s local copy;
                      unsynced changes must be synced first.
                    </p>
                  )}
                  <ActionBar label="Workbook actions" class="settings-workbook-actions">
                    {!demo.value && (
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
                    {!demo.value ? (
                      <Button
                        class="secondary disconnect"
                        type="button"
                        disabled={connectionBusy.value}
                        onClick$={disconnect}
                      >
                        Disconnect workbook
                      </Button>
                    ) : (
                      <Button
                        class="secondary disconnect"
                        type="button"
                        disabled={busy.value}
                        onClick$={leaveDemo}
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
    });

  return (
    <div class="app-shell">
      <Modal
        open={loginOpen}
        title={setupSelection.value ? 'Set up your workbook' : 'Welcome to picopos'}
        class={setupSelection.value ? 'login-modal workbook-setup-modal' : 'login-modal'}
        onClose$={async () => {
          if (pickerActive.value) return;
          if (setupSelection.value) await cancelSetup();
          else connectRequested.value = false;
        }}
      >
        {setupSelection.value ? (
          <div class="stack">
            <p class="muted">
              Choose the starting settings for <strong>{setupSelection.value.name}</strong>. You can change
              them later in Settings.
            </p>
            <BusinessSettings
              data={setupData.value}
              busy={connectionBusy.value || !online.value}
              error={!online.value ? 'Go online to finish workbook setup.' : authError.value}
              setup={{
                interval: syncInterval.value,
                onFinish$: $(async (settings, interval) => {
                  const selection = setupSelection.value;
                  if (selection) await connect(selection, { settings, interval });
                }),
                onCancel$: cancelSetup,
              }}
            />
          </div>
        ) : (
          <div class="stack">
            <div class="login-intro">
              <h1>Run your shop from a spreadsheet</h1>
              <p class="muted">Manage inventory and orders in a Google workbook your team owns.</p>
            </div>
            {connection}
          </div>
        )}
      </Modal>
      <ReconnectNotice />
      {!saved.value && !workbook.value && !loginOpen.value && !pickerActive.value && (
        <main class="workspace-welcome stack">
          <h1>
            <Brand />
          </h1>
          <div class="welcome-intro">
            <h2>Your shop, powered by Google Sheets</h2>
            <p class="muted">
              Track stock, customers, and orders in a spreadsheet you control. Connect your workbook with your
              Google account or explore picopos with sample data.
            </p>
          </div>
          <div class="row">
            <Button
              disabled={!fresh}
              onClick$={() => {
                connectRequested.value = true;
              }}
            >
              Connect a workbook
            </Button>
            <Button class="secondary" disabled={!fresh} onClick$={openDemo}>
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
      {!workbook.value && saved.value && (
        <div class="workspace-loading" role="status">
          {checkingSavedSession.value
            ? 'Opening your workspace…'
            : online.value
              ? 'Reconnect to load your workbook.'
              : 'You’re offline. Your workbook will load when you’re back online.'}
        </div>
      )}
      <div
        class={['workspace', !workbook.value && 'workspace-preview']}
        inert={!workbook.value}
        aria-hidden={!workbook.value ? 'true' : undefined}
      >
        <header class="topbar">
          <Brand />
          <nav class="workspace-tabs" aria-label="Open pages">
            {openPages.value.map((item) => (
              <div key={item} class={['workspace-tab', screenTabKey(route.value) === item && 'active']}>
                <Button
                  unstyled
                  class="workspace-tab-label"
                  aria-current={screenTabKey(route.value) === item ? 'page' : undefined}
                  onClick$={() => openPage(item)}
                >
                  {tabLabel(item)}
                </Button>
                <Button
                  unstyled
                  class="workspace-tab-close"
                  aria-label={`Close ${tabLabel(item)} tab`}
                  onClick$={() => closePage(item)}
                >
                  ×
                </Button>
              </div>
            ))}
          </nav>
          <div class="desktop-theme-toggle">
            <ThemeToggle />
          </div>
          <Button
            class="secondary mobile-tabs-trigger"
            title="Open tabs"
            aria-label={`Open tabs, ${openPages.value.length} open`}
            aria-expanded={mobileTabsOpen.value}
            aria-haspopup="dialog"
            onClick$={() => {
              mobileTabsOpen.value = true;
            }}
          >
            <Icon name="layers" />
            <span class="open-tabs-count" aria-hidden="true">
              {openPages.value.length}
            </span>
          </Button>
        </header>
        <Modal open={mobileTabsOpen} title="Open tabs" class="mobile-tabs-sidebar">
          <nav class="mobile-workspace-tabs" aria-label="Open pages">
            {openPages.value.map((item) => (
              <div key={item} class={['workspace-tab', screenTabKey(route.value) === item && 'active']}>
                <Button
                  unstyled
                  class="workspace-tab-label"
                  aria-current={screenTabKey(route.value) === item ? 'page' : undefined}
                  onClick$={async () => {
                    await openPage(item);
                    mobileTabsOpen.value = false;
                  }}
                >
                  {tabLabel(item)}
                </Button>
                <Button
                  unstyled
                  class="workspace-tab-close"
                  title={`Close ${tabLabel(item)} tab`}
                  aria-label={`Close ${tabLabel(item)} tab`}
                  onClick$={() => closePage(item)}
                >
                  ×
                </Button>
              </div>
            ))}
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
                  key={item}
                  class={['nav-item', page.value === item && 'selected']}
                  aria-current={page.value === item ? 'page' : undefined}
                  onClick$={() => openPage(item)}
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
            <main class="main-content stack" aria-label={page.value}>
              {demo.value && (
                <div class="notice demo-notice">
                  <span>Demo changes last until you reload or leave the demo.</span>
                  <Button class="secondary compact" type="button" disabled={busy.value} onClick$={leaveDemo}>
                    Leave Demo
                  </Button>
                </div>
              )}
              {error.value && (
                <p class="notice error" role="alert">
                  {error.value}
                </p>
              )}
              {issues.value.length > 0 && (
                <Panel class="issue-panel">
                  <Disclosure
                    label={`${issues.value.length} inventory ${issues.value.length === 1 ? 'issue' : 'issues'}`}
                  >
                    <ul>
                      {issues.value.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </Disclosure>
                </Panel>
              )}
              {!current && <WorkspacePreview />}
              {current && renderPages(current.id)}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
});
