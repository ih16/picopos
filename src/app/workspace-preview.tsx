import { dashboardSummary } from '../domain/dashboard';
import { demoWorkbook } from '../domain/demo';
import { workbookCurrency, workbookNumberFormat } from '../domain/settings';
import { money } from '../shared/lib/format';

// The inactive backdrop is decorative. Real screens mount after the workbook is available.
export function WorkspacePreview() {
  const now = new Date();
  const data = demoWorkbook(now);
  const report = dashboardSummary(data, 30, now);
  const amount = (value: number) => money(value, workbookCurrency(data), workbookNumberFormat(data));
  const maximum = Math.max(1, ...report.trend.map((day) => day.value));
  const points = report.trend
    .map((day, i) => `${48 + (632 * i) / (report.trend.length - 1)},${184 - (150 * day.value) / maximum}`)
    .join(' ');
  return (
    <div class="dashboard-page" aria-hidden="true">
      <header class="dashboard-header">
        <div>
          <h1>Sales report</h1>
          <p class="muted">Sales performance, top products, and outstanding payments.</p>
        </div>
      </header>
      <div class="dashboard-scroll stack">
        <dl class="dashboard-metrics">
          {[
            ['Sales value', amount(report.value)],
            ['Orders placed', String(report.orders)],
            ['Average sale', amount(report.average)],
            ['Outstanding payments', amount(report.unpaid)],
          ].map(([label, value]) => (
            <div class="panel dashboard-metric">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div class="dashboard-charts">
          <div class="panel stack dashboard-trend">
            <h2>Sales trend</h2>
            <svg class="dashboard-line-chart" viewBox="0 0 700 210">
              <path d="M 48 34 H 680 M 48 109 H 680 M 48 184 H 680" class="dashboard-gridline" fill="none" />
              <polyline points={points} fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
