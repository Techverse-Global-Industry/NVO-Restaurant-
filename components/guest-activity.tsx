"use client";
import type { ActivityReport } from "@/lib/analytics";

export function GuestActivity({
  report,
  refresh,
}: {
  report: ActivityReport;
  refresh: () => void;
}) {
  const count = (event: string) =>
    report.counts.find((c) => c.event === event)?.count || 0;
  const stats = [
    [
      "Visitor browsers",
      report.browsers,
      "Distinct browser cookies. One person can use several browsers; this is not a headcount.",
    ],
    [
      "Visits",
      report.visits,
      "A new visit starts after 30 minutes of inactivity. One browser can make several visits.",
    ],
    [
      "Page views",
      report.pageViews,
      "Public pages opened or reloaded. Viewing five pages can produce five views from one visitor.",
    ],
    [
      "WhatsApp order clicks",
      count("whatsapp_order_clicked"),
      "Clicks to send a saved order request. A click does not prove the message was sent or an order was paid.",
    ],
  ];
  return (
    <>
      <div className="activity-note">
        <strong>Guest activity · last 30 days</strong>
        <p>
          Only consented public browsing is included. Staff browsers, admin
          pages, local development, showcase preview mode and recognised bots
          are excluded. Guests who decline analytics are not counted.
        </p>
        <p>
          Local testing can correctly show <strong>zero</strong>. The older
          mixed counts are kept separately below. No visits are invented to make
          the restaurant look busy.
        </p>
        <button className="button small outline" onClick={refresh}>
          Refresh activity
        </button>
        <p className="form-note">
          Updated{" "}
          {new Intl.DateTimeFormat("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Africa/Porto-Novo",
          }).format(new Date(report.generatedAt))}{" "}
          · Cotonou time
        </p>
      </div>
      <div className="stats-grid activity-stats">
        {stats.map(([label, value, help]) => (
          <div className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{help}</small>
          </div>
        ))}
      </div>
      <div className="admin-grid activity-grid">
        <div className="admin-panel">
          <h2>What catches their attention?</h2>
          {[
            ["Menu page views", report.menuViews],
            ["Dish detail views", report.dishViews],
            ["Current special page views", report.specialViews],
            ["Special enquiries on WhatsApp", count("special_order_clicked")],
          ].map(([label, value]) => (
            <div className="admin-row" key={label}>
              <span className="row-copy">{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          <p className="form-note">
            Views can repeat. Enquiries count button clicks, not completed
            purchases.
          </p>
        </div>
        <div className="admin-panel activity-cart">
          <h2>How guests change their cart</h2>
          <div className="admin-row">
            <span className="row-copy">Meal units added</span>
            <strong>{count("add_to_cart")}</strong>
          </div>
          <div className="admin-row">
            <span className="row-copy">Meal units removed by guests</span>
            <strong>{count("remove_from_cart")}</strong>
          </div>
          <p>
            <strong>Added:</strong> adding a meal or increasing its quantity.
            Going from 1 portion to 4 adds 3 units.
          </p>
          <p>
            <strong>Removed:</strong> decreasing a quantity, deleting a meal or
            choosing “Clear selection”. Deleting a line of 3 portions removes 3
            units.
          </p>
          <p>
            <strong>After an order:</strong> the ordered items clear
            automatically. This does not count as a customer removal.
          </p>
          <p className="form-note">
            These are activity totals, not the current contents of all carts,
            customer numbers or abandoned orders. Clicks that do not change
            the quantity do not count.
          </p>
        </div>
      </div>
      <div className="admin-panel">
        <h2>Daily page views</h2>
        <p>Dates use Cotonou time. Days with no recorded views are omitted.</p>
        {report.trend.length ? (
          <div className="activity-trend">
            {report.trend.map((day) => (
              <div className="activity-day" key={day.day}>
                <span>{day.day}</span>
                <div className="activity-bar" aria-hidden="true">
                  <i
                    style={{
                      width: `${(day.count / Math.max(...report.trend.map((d) => d.count))) * 100}%`,
                    }}
                  />
                </div>
                <strong>{day.count}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="notice">No eligible guest page views in this period.</p>
        )}
      </div>
      <div className="admin-grid activity-grid">
        <div className="admin-panel">
          <h2>Popular pages</h2>
          {report.pages.length ? (
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Public page</th>
                  <th>Views</th>
                </tr>
              </thead>
              <tbody>
                {report.pages.map((p) => (
                  <tr key={p.page}>
                    <td>{p.page}</td>
                    <td>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No page data yet.</p>
          )}
        </div>
        <div className="admin-panel">
          <h2>Where visits start</h2>
          <p>
            Campaign links supply the source. “Direct” includes links with no
            source label; it does not prove someone typed the address.
          </p>
          {report.sources.length ? (
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Link source</th>
                  <th>Visits</th>
                </tr>
              </thead>
              <tbody>
                {report.sources.map((s) => (
                  <tr key={s.source}>
                    <td>{s.source}</td>
                    <td>{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No source data yet.</p>
          )}
        </div>
      </div>
      {!!report.legacy.pageViews && (
        <details className="activity-legacy">
          <summary>
            Earlier mixed records · excluded from the totals above
          </summary>
          <p>
            The previous counter stored{" "}
            <strong>{report.legacy.pageViews} page views</strong> across{" "}
            <strong>{report.legacy.browsers} browser identities</strong>,
            including{" "}
            <strong>{report.legacy.adminViews} admin-page views</strong>. These
            are all-time historical records from before the counting fix.
          </p>
          <p>
            Repeated browsing and staff testing were mixed with guest activity.
            We cannot reliably identify which earlier visits were customers, so
            the records are preserved without presenting them as verified guest
            traffic. Browser identities are not individual people.
          </p>
        </details>
      )}
    </>
  );
}
