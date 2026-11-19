import { component$ } from '@builder.io/qwik';

// The inactive backdrop is decorative. Real screens mount after the workbook is available.
export const WorkspacePreview = component$(() => (
  <div class="dashboard-page" aria-hidden="true">
    <header class="dashboard-header">
      <div>
        <h1>Sales report</h1>
        <p class="muted">Sales performance, top products, and outstanding payments.</p>
      </div>
    </header>
    <div class="dashboard-scroll stack">
      <dl class="dashboard-metrics">
        {['Sales value', 'Orders placed', 'Average sale', 'Outstanding payments'].map((label) => (
          <div class="panel dashboard-metric" key={label}>
            <dt>{label}</dt>
            <dd>—</dd>
          </div>
        ))}
      </dl>
      <div class="dashboard-charts">
        <div class="panel stack dashboard-trend">
          <h2>Sales trend</h2>
          <svg class="dashboard-line-chart" viewBox="0 0 700 210">
            <path d="M 48 34 H 680 M 48 109 H 680 M 48 184 H 680" class="dashboard-gridline" fill="none" />
          </svg>
        </div>
      </div>
    </div>
  </div>
));
