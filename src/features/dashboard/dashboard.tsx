import { money as formatMoney } from '../../shared/lib/format';
import { workbookCurrency } from '../../domain/settings';
import { component$, useContext, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { ScreenNavigation } from '../../app/navigation/screen-navigation';
import {
  dashboardSummary,
  dashboardOrderDays,
  dashboardDateRange,
  dashboardPresetRange,
} from '../../domain/dashboard';
import type { WorkbookData } from '../../domain/workbook';
import { Button, Panel, Modal, Input } from '../../shared/ui/controls';
import { ProductLabel } from '../../shared/ui/product-thumbnail';

const colors = ['#8993aa', '#a38be0', '#5c9ed6', '#4caa91', '#d98585'];

export const Dashboard = component$<{ data: WorkbookData }>(({ data }) => {
  const days = useSignal(30);
  const customStart = useSignal('');
  const customEnd = useSignal('');
  const rangeOpen = useSignal(false);
  const draftStart = useSignal('');
  const draftEnd = useSignal('');
  const availableDays = dashboardOrderDays(data);
  const firstDay = availableDays[0];
  const lastDay = availableDays.at(-1);
  const customRange = dashboardDateRange(customStart.value, customEnd.value, availableDays);
  const draftRange =
    draftStart.value >= firstDay && draftEnd.value <= (lastDay ?? '')
      ? dashboardDateRange(draftStart.value, draftEnd.value, availableDays)
      : undefined;
  const periodDays = customRange?.days ?? days.value;
  const periodLabel = customRange ? `${customStart.value} – ${customEnd.value}` : `last ${days.value} days`;
  const intervals = Math.max(1, periodDays - 1);
  const chart = useSignal<SVGSVGElement>();
  const chartWidth = useSignal(700);
  useVisibleTask$(({ cleanup }) => {
    const element = chart.value;
    if (!element) return;
    const measure = () => {
      chartWidth.value = element.getBoundingClientRect().width;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    cleanup(() => observer.disconnect());
  });
  const plotWidth = chartWidth.value - 68;
  const activeDay = useSignal<number>();
  const showCost = useSignal(false);
  const { navigate$ } = useContext(ScreenNavigation);
  const summary = dashboardSummary(data, periodDays, customRange?.end);
  const currency = workbookCurrency(data);
  const money = (value: number) => formatMoney(value, currency);
  const max = Math.max(
    1,
    ...summary.trend.map((day) => Math.max(day.value, showCost.value ? (day.cost ?? 0) : 0)),
  );
  const costPath = summary.trend
    .map((day, index) =>
      day.cost === null
        ? ''
        : `${index === 0 || summary.trend[index - 1].cost === null ? 'M' : 'L'}${48 + (index * plotWidth) / intervals},${184 - (day.cost / max) * 150}`,
    )
    .join(' ');
  const uncostedUnits = summary.trend.reduce((sum, day) => sum + day.uncostedUnits, 0);
  const estimatedCost = uncostedUnits ? null : summary.trend.reduce((sum, day) => sum + (day.cost ?? 0), 0);
  const points = summary.trend
    .map((day, index) => `${48 + (index * plotWidth) / intervals},${184 - (day.value / max) * 150}`)
    .join(' ');
  const highlighted = activeDay.value === undefined ? undefined : summary.trend[activeDay.value];
  const tooltipX = Math.min(
    chartWidth.value - 244,
    Math.max(48, 48 + ((activeDay.value ?? 0) * plotWidth) / intervals - 112),
  );
  const tooltipY = highlighted
    ? Math.max(0, 184 - (highlighted.value / max) * 150 - (showCost.value ? 122 : 100))
    : 0;
  const topUnits = Math.max(1, ...summary.products.map((product) => product.units));
  let offset = 0;
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
              key={period}
              class={!customRange && days.value === period ? '' : 'secondary'}
              aria-pressed={!customRange && days.value === period}
              disabled={
                !dashboardDateRange(
                  dashboardPresetRange(period).start,
                  dashboardPresetRange(period).end,
                  availableDays,
                )
              }
              onClick$={() => {
                days.value = period;
                customStart.value = '';
                customEnd.value = '';
                activeDay.value = undefined;
              }}
            >
              {period} days
            </Button>
          ))}
          <Button
            class={customRange ? '' : 'secondary'}
            disabled={!availableDays.length}
            aria-pressed={Boolean(customRange)}
            onClick$={() => {
              draftStart.value = customRange ? customStart.value : firstDay;
              draftEnd.value = customRange ? customEnd.value : lastDay!;
              rangeOpen.value = true;
            }}
          >
            {customRange ? periodLabel : 'Date range'}
          </Button>
        </div>
      </header>
      <Modal open={rangeOpen} title="Select date range">
        <div class="stack">
          <p class="muted">
            Available order history: {firstDay} – {lastDay}
          </p>
          <label>
            From
            <Input
              type="date"
              min={firstDay}
              max={draftEnd.value || lastDay}
              value={draftStart.value}
              onInput$={(_, element) => {
                draftStart.value = element.value;
              }}
            />
          </label>
          <label>
            To
            <Input
              type="date"
              min={draftStart.value || firstDay}
              max={lastDay}
              value={draftEnd.value}
              onInput$={(_, element) => {
                draftEnd.value = element.value;
              }}
            />
          </label>
          {!draftRange && (
            <p class="muted" role="status">
              Choose a valid range within the available history containing at least one order.
            </p>
          )}
          <div class="row">
            <Button
              class="secondary"
              onClick$={() => {
                rangeOpen.value = false;
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!draftRange}
              onClick$={() => {
                if (!draftRange) return;
                customStart.value = draftStart.value;
                customEnd.value = draftEnd.value;
                activeDay.value = undefined;
                rangeOpen.value = false;
              }}
            >
              Apply range
            </Button>
          </div>
        </div>
      </Modal>
      <div class="dashboard-scroll stack">
        <dl class="dashboard-metrics">
          {[
            {
              label: 'Sales value',
              value: money(summary.value),
              detail: `${summary.sales} confirmed orders`,
            },
            {
              label: 'Orders placed',
              value: summary.orders.toLocaleString(),
              detail: `All states · ${periodLabel}`,
            },
            {
              label: 'Average sale',
              value: money(summary.average),
              detail: 'Per confirmed order',
            },
            {
              label: 'Outstanding payments',
              value: money(summary.unpaid),
              detail: 'In progress, shipped & completed',
            },
          ].map((metric) => (
            <div class="panel dashboard-metric" key={metric.label}>
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
                <p class="muted">By order creation date · {currency}</p>
              </div>
              <dl class="dashboard-trend-totals">
                <div>
                  <dt>Sales</dt>
                  <dd class="dashboard-highlight">{money(summary.value)}</dd>
                </div>
                {showCost.value && (
                  <>
                    <div>
                      <dt>Estimated cost</dt>
                      <dd class="dashboard-total-cost">
                        {estimatedCost === null ? 'Unavailable' : money(estimatedCost)}
                      </dd>
                    </div>
                    <div>
                      <dt>Estimated profit</dt>
                      <dd>{estimatedCost === null ? 'Unavailable' : money(summary.value - estimatedCost)}</dd>
                    </div>
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
                {showCost.value && (
                  <span>
                    <i style={{ background: 'var(--dashboard-cost)' }} />
                    Estimated cost
                  </span>
                )}
              </div>
              <Button
                class="secondary compact"
                aria-pressed={showCost.value}
                onClick$={() => {
                  showCost.value = !showCost.value;
                }}
              >
                {showCost.value ? 'Hide cost' : 'Show cost'}
              </Button>
            </div>
            <svg
              class="dashboard-line-chart"
              ref={chart}
              viewBox={`0 0 ${chartWidth.value} 225`}
              role="group"
              onPointerLeave$={() => {
                activeDay.value = undefined;
              }}
              aria-label={`Sales value for ${periodLabel}: ${money(summary.value)}`}
            >
              {[0, 0.5, 1].map((fraction) => (
                <g key={fraction}>
                  <line
                    x1="48"
                    x2={chartWidth.value - 20}
                    y1={184 - fraction * 150}
                    y2={184 - fraction * 150}
                    class="dashboard-gridline"
                  />
                  <text x="40" y={188 - fraction * 150} text-anchor="end">
                    {new Intl.NumberFormat(undefined, {
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }).format(max * fraction)}
                  </text>
                </g>
              ))}
              {periodDays > 1 && (
                <polygon
                  points={`48,184 ${points} ${chartWidth.value - 20},184`}
                  fill="var(--dashboard-accent)"
                  opacity=".1"
                />
              )}
              <polyline
                points={points}
                fill="none"
                stroke="var(--dashboard-accent)"
                stroke-width="2"
                stroke-linejoin="round"
              />
              {showCost.value && (
                <path
                  class="dashboard-cost-line"
                  d={costPath}
                  fill="none"
                  stroke="var(--dashboard-cost)"
                  stroke-width="2"
                  stroke-dasharray="6 4"
                  stroke-linejoin="round"
                />
              )}
              {summary.trend.map((day, index) => (
                <g key={day.day}>
                  {showCost.value && day.cost !== null && (
                    <circle
                      cx={48 + (index * plotWidth) / intervals}
                      cy={184 - (day.cost / max) * 150}
                      r={activeDay.value === index ? 4 : 3}
                      class="dashboard-cost-point"
                      fill="var(--dashboard-cost)"
                      onPointerEnter$={() => {
                        activeDay.value = index;
                      }}
                      onPointerLeave$={() => {
                        activeDay.value = undefined;
                      }}
                      onClick$={() => {
                        activeDay.value = index;
                      }}
                    />
                  )}

                  <circle
                    cx={48 + (index * plotWidth) / intervals}
                    cy={184 - (day.value / max) * 150}
                    r={activeDay.value === index ? 4 : day.value ? 3 : 2}
                    fill="var(--dashboard-accent)"
                    pointer-events="none"
                  />
                  <circle
                    class="dashboard-chart-point"
                    cx={48 + (index * plotWidth) / intervals}
                    cy={184 - (day.value / max) * 150}
                    r="9"
                    fill="transparent"
                    tabindex={0}
                    role="img"
                    aria-label={`${day.day}: ${money(day.value)} · ${day.sales} sales${showCost.value ? ` · Estimated cost: ${day.cost === null ? 'Unavailable' : money(day.cost)}` : ''} · Estimated profit: ${day.cost === null ? 'Unavailable' : money(day.value - day.cost)}`}
                    onPointerEnter$={() => {
                      activeDay.value = index;
                    }}
                    onPointerLeave$={() => {
                      activeDay.value = undefined;
                    }}
                    onFocus$={() => {
                      activeDay.value = index;
                    }}
                    onBlur$={() => {
                      activeDay.value = undefined;
                    }}
                    onClick$={() => {
                      activeDay.value = index;
                    }}
                    onKeyDown$={(event) => {
                      if (event.key === 'Escape') activeDay.value = undefined;
                    }}
                  />
                </g>
              ))}
              {[...new Set([0, Math.floor((periodDays - 1) / 2), periodDays - 1])].map((index) => (
                <text
                  key={index}
                  x={48 + (index * plotWidth) / intervals}
                  y="213"
                  text-anchor={index === 0 ? 'start' : index === periodDays - 1 ? 'end' : 'middle'}
                >
                  {summary.trend[index].day.slice(5)}
                </text>
              ))}
              {highlighted && (
                <g
                  class="dashboard-chart-tooltip"
                  transform={`translate(${tooltipX} ${tooltipY})`}
                  pointer-events="none"
                  aria-hidden="true"
                >
                  <rect width="224" height={showCost.value ? 112 : 90} rx="8" />
                  <text x="12" y="20">
                    {highlighted.day}
                  </text>
                  <text x="12" y="40" class="dashboard-tooltip-value">
                    Sales: {money(highlighted.value)}
                  </text>
                  {showCost.value && (
                    <text x="12" y="58">
                      Cost: {highlighted.cost === null ? 'Unavailable' : money(highlighted.cost)}
                    </text>
                  )}
                  <text x="12" y={showCost.value ? 78 : 58}>
                    Est. profit:{' '}
                    {highlighted.cost === null ? 'Unavailable' : money(highlighted.value - highlighted.cost)}
                  </text>
                  <text x="12" y={showCost.value ? 98 : 78}>
                    {highlighted.sales} sales
                  </text>
                </g>
              )}
            </svg>
            {showCost.value && (
              <p class="muted">
                Estimated product cost uses quantity-weighted purchase-lot averages recorded by each sale
                date; excludes delivery and operating expenses.
                {uncostedUnits > 0
                  ? ` Costs missing for ${uncostedUnits} sold units; affected days have gaps.`
                  : ''}
              </p>
            )}
            {!summary.sales && <p class="muted">No sales in this period.</p>}
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
                aria-label={`${summary.orders} orders: ${summary.statuses.map((entry) => `${entry.count} ${entry.status}`).join(', ')}`}
              >
                <circle cx="80" cy="80" r="60" fill="none" stroke="var(--line)" stroke-width="18" />
                {summary.statuses.map((entry, index) => {
                  const percent = summary.orders ? (entry.count / summary.orders) * 100 : 0;
                  const start = offset;
                  offset += percent;
                  return (
                    <circle
                      key={entry.status}
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
                  {summary.orders}
                </text>
                <text x="80" y="101" text-anchor="middle">
                  orders
                </text>
              </svg>
              <ul class="dashboard-legend">
                {summary.statuses.map((entry, index) => (
                  <li key={entry.status}>
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
            {summary.products.length ? (
              <ol class="dashboard-bars" tabIndex={0} aria-label="Top products by units sold">
                {summary.products.map((product) => (
                  <li key={product.id}>
                    <div class="panel-heading">
                      <ProductLabel
                        name={product.name}
                        image={data.Products.find((row) => row.id === product.id)?.image}
                      >
                        {product.name}
                      </ProductLabel>
                      <strong>{product.units} units</strong>
                    </div>
                    <div class="dashboard-bar-track">
                      <div style={{ width: `${(product.units / topUnits) * 100}%` }} />
                    </div>
                  </li>
                ))}
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
              <Button class="secondary compact" onClick$={() => navigate$('/inventory')}>
                View stock
              </Button>
            </div>
            <dl class="dashboard-stock">
              {(['available', 'reserved', 'unavailable', 'onHand'] as const).map((key, index) => (
                <div key={key}>
                  <dt>{['Available', 'Reserved', 'Unavailable', 'On hand'][index]}</dt>
                  <dd class={summary.stock[key] < 0 ? 'negative' : undefined}>
                    {summary.stock[key].toLocaleString()}
                  </dd>
                </div>
              ))}
            </dl>
            <h3>{summary.lowStock.length} variants need attention</h3>
            <p class="muted">Active variants with 5 or fewer available units</p>
            {summary.lowStock.length ? (
              <ul class="dashboard-low-stock">
                {summary.lowStock.slice(0, 5).map((item) => (
                  <li key={item.variantId}>
                    <ProductLabel
                      name={item.name}
                      image={
                        data.Products.find(
                          (product) =>
                            product.id ===
                            data.Variants.find((variant) => variant.id === item.variantId)?.productId,
                        )?.image
                      }
                    >
                      <strong>{item.name}</strong>
                      <span class="inventory-row-meta">{item.sku}</span>
                    </ProductLabel>
                    <span class={item.available <= 0 ? 'negative' : ''}>
                      {item.available <= 0 ? `${item.available} available` : `${item.available} left`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p class="muted">All active variants have more than 5 units available.</p>
            )}
          </Panel>
        </div>
      </div>
    </section>
  );
});
