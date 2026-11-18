import { money as formatMoney } from '../../shared/lib/format';
import { workbookCurrency } from '../../domain/settings';
import { component$, useContext, useSignal } from '@builder.io/qwik';
import { ScreenNavigation } from '../../app/navigation/screen-navigation';
import { dashboardSummary } from '../../domain/dashboard';
import type { WorkbookData } from '../../domain/workbook';
import { Button, Panel, Table } from '../../shared/ui/controls';
import { ProductLabel } from '../../shared/ui/product-thumbnail';

const colors = ['#8993aa', '#a38be0', '#5c9ed6', '#4caa91', '#d98585'];

export const Dashboard = component$<{ data: WorkbookData }>(({ data }) => {
  const days = useSignal(30);
  const { navigate$ } = useContext(ScreenNavigation);
  const summary = dashboardSummary(data, days.value);
  const currency = workbookCurrency(data);
  const money = (value: number) => formatMoney(value, currency);
  const max = Math.max(1, ...summary.trend.map((day) => day.value));
  const points = summary.trend
    .map(
      (day, index) => `${48 + (index * 632) / (summary.trend.length - 1)},${184 - (day.value / max) * 150}`,
    )
    .join(' ');
  const topUnits = Math.max(1, ...summary.products.map((product) => product.units));
  let offset = 0;
  return (
    <section class="dashboard-page">
      <header class="dashboard-header">
        <div>
          <h1>Business overview</h1>
          <p class="muted">A clear view of orders, sales, and stock.</p>
        </div>
        <div class="row catalog-tabs" role="group" aria-label="Dashboard period">
          {[7, 30, 90].map((period) => (
            <Button
              key={period}
              class={days.value === period ? '' : 'secondary'}
              aria-pressed={days.value === period}
              onClick$={() => {
                days.value = period;
              }}
            >
              {period} days
            </Button>
          ))}
        </div>
      </header>
      <div class="dashboard-scroll stack">
        <dl class="dashboard-metrics">
          {[
            {
              label: 'Fulfilled order value',
              value: money(summary.value),
              detail: `${summary.fulfilled} shipped or completed orders`,
            },
            {
              label: 'Orders placed',
              value: summary.orders.toLocaleString(),
              detail: `All states · last ${days.value} days`,
            },
            {
              label: 'Average fulfilled order',
              value: money(summary.average),
              detail: 'Per shipped or completed order',
            },
            {
              label: 'Unpaid order value',
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
            <div class="panel-heading">
              <div>
                <h2>Fulfilled order trend</h2>
                <p class="muted">By order creation date · {currency}</p>
              </div>
              <span class="dashboard-highlight">{money(summary.value)}</span>
            </div>
            <svg
              class="dashboard-line-chart"
              viewBox="0 0 700 225"
              role="img"
              aria-label={`Fulfilled order value over the last ${days.value} days: ${money(summary.value)}`}
            >
              {[0, 0.5, 1].map((fraction) => (
                <g key={fraction}>
                  <line
                    x1="48"
                    x2="680"
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
              <polygon points={`48,184 ${points} 680,184`} fill="var(--dashboard-accent)" opacity=".1" />
              <polyline
                points={points}
                fill="none"
                stroke="var(--dashboard-accent)"
                stroke-width="3"
                stroke-linejoin="round"
              />
              {summary.trend.map((day, index) => (
                <circle
                  key={day.day}
                  cx={48 + (index * 632) / (summary.trend.length - 1)}
                  cy={184 - (day.value / max) * 150}
                  r={day.value ? 4 : 2}
                  fill="var(--dashboard-accent)"
                >
                  <title>{`${day.day}: ${money(day.value)} · ${day.orders} orders placed`}</title>
                </circle>
              ))}
              {[0, Math.floor((days.value - 1) / 2), days.value - 1].map((index) => (
                <text
                  key={index}
                  x={48 + (index * 632) / (days.value - 1)}
                  y="213"
                  text-anchor={index === 0 ? 'start' : index === days.value - 1 ? 'end' : 'middle'}
                >
                  {summary.trend[index].day.slice(5)}
                </text>
              ))}
            </svg>
            {!summary.fulfilled && <p class="muted">No fulfilled orders in this period.</p>}
            <details class="dashboard-data">
              <summary>View daily values</summary>
              <Table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th class="numeric">Orders</th>
                    <th class="numeric">Fulfilled value</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.trend.map((day) => (
                    <tr key={day.day}>
                      <td>{day.day}</td>
                      <td class="numeric">{day.orders}</td>
                      <td class="numeric">{money(day.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </details>
          </Panel>
          <Panel class="stack">
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
          <Panel class="stack">
            <div>
              <h2>Top products</h2>
              <p class="muted">Units on shipped & completed orders · before returns</p>
            </div>
            {summary.products.length ? (
              <ol class="dashboard-bars">
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
              <p class="empty">Products will appear when orders are shipped.</p>
            )}
          </Panel>
          <Panel class="stack">
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
        <p class="dashboard-footnote muted">
          Order metrics use creation dates in your local time zone. Fulfilled value includes discounts and
          shipping; refunded orders are excluded. Returns are not deducted because refund amounts are not
          recorded. These figures are not profit or cash received.
        </p>
      </div>
    </section>
  );
});
