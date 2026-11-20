import { createResizeObserver } from '@solid-primitives/resize-observer';
import { createMemo, createSignal, Show, useContext } from 'solid-js';

import { ScreenNavigation } from '../../app/navigation/screen-navigation';
import {
  dashboardDateRange,
  dashboardOrderDays,
  dashboardPresetRange,
  dashboardSummary,
} from '../../domain/dashboard';
import { workbookCurrency, workbookNumberFormat } from '../../domain/settings';
import type { WorkbookData } from '../../domain/workbook';
import { money as formatMoney } from '../../shared/lib/format';
import { PagedRows } from '../../shared/ui/paged-rows';
import { Button, Input, Modal, Panel } from '../../shared/ui/controls';
import { ProductLabel } from '../../shared/ui/product-thumbnail';

const colors = ['#8993aa', '#a38be0', '#5c9ed6', '#4caa91', '#d98585'];

type DashboardProps = { data: WorkbookData };

export function Dashboard(props: DashboardProps) {
  const [days, setDays] = createSignal(30);
  const [customStart, setCustomStart] = createSignal('');
  const [customEnd, setCustomEnd] = createSignal('');
  const [rangeOpen, setRangeOpen] = createSignal(false);
  const [draftStart, setDraftStart] = createSignal('');
  const [draftEnd, setDraftEnd] = createSignal('');
  const availableDays = createMemo(() => dashboardOrderDays(props.data));
  const firstDay = createMemo(() => availableDays()[0]);
  const lastDay = createMemo(() => availableDays().at(-1));
  const customRange = createMemo(() => dashboardDateRange(customStart(), customEnd(), availableDays()));
  const draftRange = createMemo(() =>
    draftStart() >= firstDay() && draftEnd() <= (lastDay() ?? '')
      ? dashboardDateRange(draftStart(), draftEnd(), availableDays())
      : undefined,
  );
  const periodDays = createMemo(() => customRange()?.days ?? days());
  const periodLabel = createMemo(() =>
    customRange() ? `${customStart()} – ${customEnd()}` : `last ${days()} days`,
  );
  const intervals = createMemo(() => Math.max(1, periodDays() - 1));
  const [chart, setChart] = createSignal<SVGSVGElement>();
  const [chartWidth, setChartWidth] = createSignal(700);
  createResizeObserver(chart, (rect) => setChartWidth(rect.width));
  const plotWidth = createMemo(() => chartWidth() - 68);
  const [activeDay, setActiveDay] = createSignal<number>();
  const [showCost, setShowCost] = createSignal(false);
  const [showAllStock, setShowAllStock] = createSignal(false);
  const { navigate } = useContext(ScreenNavigation);
  const summary = createMemo(() => dashboardSummary(props.data, periodDays(), customRange()?.end));
  const currency = createMemo(() => workbookCurrency(props.data));
  const numberFormat = createMemo(() => workbookNumberFormat(props.data));
  const money = (value: number) => formatMoney(value, currency(), numberFormat());
  const max = createMemo(() =>
    Math.max(1, ...summary().trend.map((day) => Math.max(day.value, showCost() ? (day.cost ?? 0) : 0))),
  );
  const costPath = createMemo(() =>
    summary()
      .trend.map((day, index) =>
        day.cost === null
          ? ''
          : `${index === 0 || summary().trend[index - 1].cost === null ? 'M' : 'L'}${48 + (index * plotWidth()) / intervals()},${184 - (day.cost / max()) * 150}`,
      )
      .join(' '),
  );
  const uncostedUnits = createMemo(() => summary().trend.reduce((sum, day) => sum + day.uncostedUnits, 0));
  const costedUnits = createMemo(() => summary().trend.reduce((sum, day) => sum + day.costedUnits, 0));
  const costedValue = createMemo(() => summary().trend.reduce((sum, day) => sum + day.costedValue, 0));
  const estimatedCost = createMemo(() => summary().trend.reduce((sum, day) => sum + (day.cost ?? 0), 0));
  const points = createMemo(() =>
    summary()
      .trend.map(
        (day, index) => `${48 + (index * plotWidth()) / intervals()},${184 - (day.value / max()) * 150}`,
      )
      .join(' '),
  );
  const highlighted = createMemo(() => {
    const index = activeDay();
    return index === undefined ? undefined : summary().trend[index];
  });
  const tooltipX = createMemo(() =>
    Math.min(chartWidth() - 244, Math.max(48, 48 + ((activeDay() ?? 0) * plotWidth()) / intervals() - 112)),
  );
  const tooltipY = createMemo(() =>
    highlighted()
      ? Math.max(0, 184 - ((highlighted()?.value ?? 0) / max()) * 150 - (showCost() ? 122 : 100))
      : 0,
  );
  const topUnits = createMemo(() => Math.max(1, ...summary().products.map((product) => product.units)));

  return (
    <section class="dashboard-page">
      <header class="dashboard-header">
        <div>
          <h1>Sales report</h1>
          <p class="muted">Sales performance, top products, and outstanding payments.</p>
        </div>
        <div class="row catalog-tabs" role="group" aria-label="Dashboard period">
          {[7, 30, 90].map((period) => (
            <Button
              class={!customRange() && days() === period ? '' : 'secondary'}
              aria-pressed={!customRange() && days() === period ? 'true' : 'false'}
              disabled={
                !dashboardDateRange(
                  dashboardPresetRange(period).start,
                  dashboardPresetRange(period).end,
                  availableDays(),
                )
              }
              onClick={() => {
                setDays(period);
                setCustomStart('');
                setCustomEnd('');
                setActiveDay(undefined);
              }}
            >
              {period} days
            </Button>
          ))}
          <Button
            mobileIconOnly
            icon="calendar"
            label={customRange() ? periodLabel() : 'Date range'}
            class={customRange() ? '' : 'secondary'}
            disabled={!availableDays().length}
            aria-pressed={Boolean(customRange()) ? 'true' : 'false'}
            onClick={() => {
              setDraftStart(customRange() ? customStart() : firstDay());
              setDraftEnd(customRange() ? customEnd() : lastDay()!);
              setRangeOpen(true);
            }}
          />
        </div>
      </header>
      <Modal
        open={rangeOpen()}
        onDismiss={() => setRangeOpen(false)}
        title="Select date range"
        footer={
          <footer class="modal-footer">
            <Button
              class="secondary"
              onClick={() => {
                setRangeOpen(false);
              }}
              icon="close"
              label="Cancel"
            />
            <Button
              disabled={!draftRange()}
              onClick={() => {
                if (!draftRange()) return;
                setCustomStart(draftStart());
                setCustomEnd(draftEnd());
                setActiveDay(undefined);
                setRangeOpen(false);
              }}
            >
              Apply range
            </Button>
          </footer>
        }
      >
        <div class="stack">
          <p class="muted">
            Available order history: {firstDay()} – {lastDay()}
          </p>
          <label>
            From
            <Input
              type="date"
              min={firstDay()}
              max={draftEnd() || lastDay()}
              value={draftStart()}
              onInput={(event) => {
                const element = event.currentTarget;
                setDraftStart(element.value);
              }}
            />
          </label>
          <label>
            To
            <Input
              type="date"
              min={draftStart() || firstDay()}
              max={lastDay()}
              value={draftEnd()}
              onInput={(event) => {
                const element = event.currentTarget;
                setDraftEnd(element.value);
              }}
            />
          </label>
          {!draftRange() && (
            <p class="muted" role="status">
              Choose a valid range within the available history containing at least one order.
            </p>
          )}
        </div>
      </Modal>
      <div class="dashboard-scroll stack">
        <dl class="dashboard-metrics">
          {[
            {
              label: 'Sales value',
              value: money(summary().value),
              detail: `${summary().sales} confirmed orders`,
            },
            {
              label: 'Orders placed',
              value: summary().orders.toLocaleString(numberFormat()),
              detail: `All states · ${periodLabel()}`,
            },
            {
              label: 'Average sale',
              value: money(summary().average),
              detail: 'Per confirmed order',
            },
            {
              label: 'Outstanding payments',
              value: money(summary().unpaid),
              detail: 'In progress, shipped & completed',
            },
          ].map((metric) => (
            <div class="panel dashboard-metric">
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
              <p class="muted">{metric.detail}</p>
            </div>
          ))}
        </dl>
        <div class="dashboard-charts">
          <Panel class="stack dashboard-trend">
            <div class="panel-heading dashboard-trend-heading">
              <div>
                <h2>Sales trend</h2>
                <p class="muted">By order creation date · {currency()}</p>
              </div>
              <dl class="dashboard-trend-totals">
                <div>
                  <dt>Sales</dt>
                  <dd class="dashboard-highlight">{money(summary().value)}</dd>
                </div>
                {showCost() && (
                  <>
                    <div>
                      <dt>Estimated cost</dt>
                      <dd class="dashboard-total-cost">
                        {uncostedUnits() && !costedUnits() ? '—' : money(estimatedCost())}
                      </dd>
                    </div>
                    <div>
                      <dt>Estimated profit</dt>
                      <dd>
                        {uncostedUnits() && !costedUnits() ? '—' : money(costedValue() - estimatedCost())}
                      </dd>
                    </div>
                    {uncostedUnits() > 0 && (
                      <div>
                        <dt>Units missing cost</dt>
                        <dd>
                          {uncostedUnits()} of {costedUnits() + uncostedUnits()}
                        </dd>
                      </div>
                    )}
                  </>
                )}
              </dl>
            </div>
            <div class="panel-heading">
              <div class="row dashboard-chart-legend">
                <span>
                  <i style={{ background: 'var(--dashboard-accent)' }} />
                  Sales
                </span>
                {showCost() && (
                  <span>
                    <i style={{ background: 'var(--dashboard-cost)' }} />
                    Estimated cost
                  </span>
                )}
              </div>
              <Button
                class="secondary compact"
                aria-pressed={showCost() ? 'true' : 'false'}
                onClick={() => {
                  setShowCost(!showCost());
                }}
              >
                {showCost() ? 'Hide cost' : 'Show cost'}
              </Button>
            </div>
            <svg
              class="dashboard-line-chart"
              ref={(el) => {
                setChart(el);
              }}
              viewBox={`0 0 ${chartWidth()} 225`}
              role="group"
              onPointerLeave={() => {
                setActiveDay(undefined);
              }}
              aria-label={`Sales value for ${periodLabel()}: ${money(summary().value)}`}
            >
              {[0, 0.5, 1].map((fraction) => (
                <g>
                  <line
                    x1="48"
                    x2={chartWidth() - 20}
                    y1={184 - fraction * 150}
                    y2={184 - fraction * 150}
                    class="dashboard-gridline"
                  />
                  <text x="40" y={188 - fraction * 150} text-anchor="end">
                    {new Intl.NumberFormat(numberFormat(), {
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }).format(max() * fraction)}
                  </text>
                </g>
              ))}
              {periodDays() > 1 && (
                <polygon
                  points={`48,184 ${points()} ${chartWidth() - 20},184`}
                  fill="var(--dashboard-accent)"
                  opacity=".1"
                />
              )}
              <polyline
                points={points()}
                fill="none"
                stroke="var(--dashboard-accent)"
                stroke-width="2"
                stroke-linejoin="round"
              />
              {showCost() && (
                <path
                  class="dashboard-cost-line"
                  d={costPath()}
                  fill="none"
                  stroke="var(--dashboard-cost)"
                  stroke-width="2"
                  stroke-dasharray="6 4"
                  stroke-linejoin="round"
                />
              )}
              {summary().trend.map((day, index) => (
                <g>
                  {showCost() && day.cost !== null && (
                    <circle
                      cx={48 + (index * plotWidth()) / intervals()}
                      cy={184 - (day.cost / max()) * 150}
                      r={activeDay() === index ? 4 : 3}
                      class="dashboard-cost-point"
                      fill="var(--dashboard-cost)"
                      onPointerEnter={() => {
                        setActiveDay(index);
                      }}
                      onPointerLeave={() => {
                        setActiveDay(undefined);
                      }}
                      onClick={() => {
                        setActiveDay(index);
                      }}
                    />
                  )}

                  <circle
                    cx={48 + (index * plotWidth()) / intervals()}
                    cy={184 - (day.value / max()) * 150}
                    r={activeDay() === index ? 4 : day.value ? 3 : 2}
                    fill="var(--dashboard-accent)"
                    pointer-events="none"
                  />
                  <circle
                    class="dashboard-chart-point"
                    cx={48 + (index * plotWidth()) / intervals()}
                    cy={184 - (day.value / max()) * 150}
                    r="9"
                    fill="transparent"
                    tabindex={0}
                    role="img"
                    aria-label={`${day.day}: ${money(day.value)} · ${day.sales} sales${showCost() ? ` · Estimated cost: ${day.cost === null ? '—' : money(day.cost)}` : ''} · Estimated profit: ${day.cost === null ? '—' : money(day.costedValue - day.cost)}`}
                    onPointerEnter={() => {
                      setActiveDay(index);
                    }}
                    onPointerLeave={() => {
                      setActiveDay(undefined);
                    }}
                    onFocus={() => {
                      setActiveDay(index);
                    }}
                    onBlur={() => {
                      setActiveDay(undefined);
                    }}
                    onClick={() => {
                      setActiveDay(index);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setActiveDay(undefined);
                    }}
                  />
                </g>
              ))}
              {[...new Set([0, Math.floor((periodDays() - 1) / 2), periodDays() - 1])].map((index) => (
                <text
                  x={48 + (index * plotWidth()) / intervals()}
                  y="213"
                  text-anchor={index === 0 ? 'start' : index === periodDays() - 1 ? 'end' : 'middle'}
                >
                  {summary().trend[index].day.slice(5)}
                </text>
              ))}
              <Show when={highlighted()} keyed>
                {(day) => (
                  <g
                    class="dashboard-chart-tooltip"
                    transform={`translate(${tooltipX()} ${tooltipY()})`}
                    pointer-events="none"
                    aria-hidden="true"
                  >
                    <rect width="224" height={showCost() ? 112 : 90} rx="8" />
                    <text x="12" y="20">
                      {day.day}
                    </text>
                    <text x="12" y="40" class="dashboard-tooltip-value">
                      Sales: {money(day.value)}
                    </text>
                    {showCost() && (
                      <text x="12" y="58">
                        Cost: {day.cost === null ? '—' : money(day.cost)}
                      </text>
                    )}
                    <text x="12" y={showCost() ? 78 : 58}>
                      Est. profit: {day.cost === null ? '—' : money(day.costedValue - day.cost)}
                    </text>
                    <text x="12" y={showCost() ? 98 : 78}>
                      {day.sales} sales
                    </text>
                  </g>
                )}
              </Show>
            </svg>
            {showCost() && (
              <p class="muted">
                Estimated product cost uses quantity-weighted purchase-lot averages recorded by each sale
                date; excludes delivery and operating expenses.
                {uncostedUnits() > 0 && ' Estimates include only items with a matching purchase cost.'}
              </p>
            )}
            {!summary().sales && <p class="muted">No sales in this period.</p>}
          </Panel>
          <Panel class="stack dashboard-summary-card">
            <div>
              <h2>Order status</h2>
              <p class="muted">Orders placed in this period</p>
            </div>
            <div class="dashboard-status">
              <svg
                viewBox="0 0 160 160"
                role="img"
                aria-label={`${summary().orders} orders: ${summary()
                  .statuses.map((entry) => `${entry.count} ${entry.status}`)
                  .join(', ')}`}
              >
                <circle cx="80" cy="80" r="60" fill="none" stroke="var(--line)" stroke-width="18" />
                {summary().statuses.map((entry, index) => {
                  const percent = summary().orders ? (entry.count / summary().orders) * 100 : 0;
                  const start = summary().orders
                    ? (summary()
                        .statuses.slice(0, index)
                        .reduce((sum, status) => sum + status.count, 0) *
                        100) /
                      summary().orders
                    : 0;
                  return (
                    <circle
                      cx="80"
                      cy="80"
                      r="60"
                      pathLength="100"
                      fill="none"
                      stroke={colors[index]}
                      stroke-width="18"
                      stroke-dasharray={`${percent} ${100 - percent}`}
                      stroke-dashoffset={-start}
                      transform="rotate(-90 80 80)"
                    >
                      <title>{`${entry.status}: ${entry.count}`}</title>
                    </circle>
                  );
                })}
                <text x="80" y="80" text-anchor="middle" class="dashboard-donut-total">
                  {summary().orders}
                </text>
                <text x="80" y="101" text-anchor="middle">
                  orders
                </text>
              </svg>
              <ul class="dashboard-legend">
                {summary().statuses.map((entry, index) => (
                  <li>
                    <span class="dashboard-dot" style={{ background: colors[index] }} />
                    <span>{entry.status}</span>
                    <strong>{entry.count}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
          <Panel class="stack dashboard-summary-card">
            <div>
              <h2>Top products</h2>
              <p class="muted">Units sold on confirmed orders · before returns</p>
            </div>
            {summary().products.length ? (
              <ol class="dashboard-bars paged-viewport" tabindex={0} aria-label="Top products by units sold">
                <PagedRows list rows={summary().products} estimate={56}>
                  {(page) => (
                    <>
                      {page().map((product) => (
                        <li>
                          <div class="panel-heading">
                            <ProductLabel
                              name={product.name}
                              image={props.data.Products.find((row) => row.id === product.id)?.image}
                            >
                              {product.name}
                            </ProductLabel>
                            <strong>{product.units} units</strong>
                          </div>
                          <div class="dashboard-bar-track">
                            <div style={{ width: `${(product.units / topUnits()) * 100}%` }} />
                          </div>
                        </li>
                      ))}
                    </>
                  )}
                </PagedRows>
              </ol>
            ) : (
              <p class="empty">Products will appear when orders are confirmed.</p>
            )}
          </Panel>
          <Panel class="stack dashboard-inventory">
            <div class="panel-heading">
              <div>
                <h2>Inventory health</h2>
                <p class="muted">Current stock · all dates</p>
              </div>
              <Button
                class="secondary compact"
                onClick={() => navigate('/inventory')}
                icon="arrow-right"
                label="View stock"
              />
            </div>
            <dl class="dashboard-stock">
              {(['available', 'reserved', 'unavailable', 'onHand'] as const).map((key, index) => (
                <div>
                  <dt>{['Available', 'Reserved', 'Unavailable', 'On hand'][index]}</dt>
                  <dd class={summary().stock[key] < 0 ? 'negative' : undefined}>
                    {summary().stock[key].toLocaleString(numberFormat())}
                  </dd>
                </div>
              ))}
            </dl>
            <div class="stock-board-heading">
              <h3>
                Low stock <span>{summary().lowStock.length}</span>
              </h3>
              <small>5 or fewer units available</small>
            </div>
            {summary().lowStock.length ? (
              <ul class="dashboard-low-stock paged-viewport">
                <PagedRows
                  list
                  rows={showAllStock() ? summary().lowStock : summary().lowStock.slice(0, 18)}
                  estimate={28}
                  resetKey={String(showAllStock())}
                >
                  {(page) => (
                    <>
                      {page().map((item) => (
                        <li
                          data-level={
                            item.available <= 0 ? 'empty' : item.available <= 2 ? 'critical' : 'low'
                          }
                        >
                          <span class="stock-tile-sku">{item.sku}</span>
                          <strong class="stock-tile-quantity">
                            {item.available.toLocaleString(numberFormat())}{' '}
                            <small>{item.available <= 0 ? 'avail.' : 'left'}</small>
                          </strong>
                          <span class="stock-tile-name">{item.name}</span>
                        </li>
                      ))}
                    </>
                  )}
                </PagedRows>
              </ul>
            ) : (
              <p class="muted">All active variants have more than 5 units available.</p>
            )}
            {summary().lowStock.length > 18 && (
              <Button
                class="secondary compact stock-board-toggle"
                onClick={() => setShowAllStock(!showAllStock())}
              >
                {showAllStock() ? 'Show fewer' : `Show all ${summary().lowStock.length} variants`}
              </Button>
            )}
          </Panel>
        </div>
      </div>
    </section>
  );
}
