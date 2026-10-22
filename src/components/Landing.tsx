"use client";

import Link from "next/link";
import { useEffect } from "react";
import "@/app/landing.css";
import { BrandLogo, BrandMark } from "./BrandMark";
import { PLANS } from "@/lib/plans";
import {
  ApartmentOutlined, AuditOutlined, BgColorsOutlined, BranchesOutlined, ClockCircleOutlined, LockOutlined,
  SafetyCertificateOutlined, TableOutlined, ThunderboltOutlined,
} from "@ant-design/icons";

const BRAND = "Synapsas";

export function Landing({ loginHref, registerHref }: { loginHref: string; registerHref: string }) {
  const lim = (n: number) => (n === -1 ? "Unlimited" : n);
  // Paint the document itself green so any overscroll area matches the hero instead of flashing grey.
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const prev = { html: html.style.background, body: body.style.background };
    html.style.background = "#003b32";
    body.style.background = "#003b32";
    return () => { html.style.background = prev.html; body.style.background = prev.body; };
  }, []);
  return (
    <div className="lp">
      {/* NAV */}
      <header className="lp-nav">
        <div className="wrap">
          <Link href="/" aria-label={BRAND}><BrandLogo color="#FFFDF0" height={28} name={BRAND} /></Link>
          <nav className="lp-nav-links">
            <a href="#product">Product</a>
            <a href="#how">How it works</a>
            <a href="#usecases">Use cases</a>
            <a href="#security">Security</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="lp-nav-cta">
            <Link className="lp-btn lp-btn-ghost" href={loginHref}>Sign in</Link>
            <Link className="lp-btn lp-btn-cream" href={registerHref}>Start free</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-hero-glow" />
        <div className="wrap">
          <div>
            <span className="lp-eyebrow"><i /> Approval workflows, white-labelled for your clients</span>
            <h1 className="lp-h1">Every memo, requisition and document, <em>approved</em> the way your organisation actually works.</h1>
            <p className="lp-lead">
              {BRAND} turns paper trails and email chains into configurable approval chains. Design the form, set the levels,
              add SLAs, and let the right people sign off from any device.
            </p>
            <div className="lp-hero-cta">
              <Link className="lp-btn lp-btn-cream lp-btn-lg" href={registerHref}>Create your workspace</Link>
              <Link className="lp-btn lp-btn-ghost lp-btn-lg" href={`${loginHref}?org=acme`}>Explore the live demo</Link>
            </div>
            <div className="lp-hero-meta">
              <div><b>6</b>approver types</div>
              <div><b>∞</b>approval levels</div>
              <div><b>2FA</b>and full audit trail</div>
              <div><b>15 min</b>to first workflow</div>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <div className="lp-mock" aria-hidden="true">
              <div className="lp-mock-bar"><i /><i /><i /> <span style={{ marginLeft: 6 }}>PR-2026-0142 · Purchase requisition</span></div>
              <div className="lp-mock-body">
                <div className="lp-mock-card">
                  <h5>Line items</h5>
                  <div className="lp-mock-row"><span>Dell Latitude laptops × 4</span><b>$5,800.00</b></div>
                  <div className="lp-mock-row"><span>Docking stations × 4</span><b>$720.00</b></div>
                  <div className="lp-mock-row"><span>Total</span><b>$6,520.00</b></div>
                  <div style={{ marginTop: 10, display: "flex", gap: 6 }}><span className="lp-mock-tag">Operations</span><span className="lp-mock-tag wait">Pending · Level 2</span></div>
                </div>
                <div className="lp-mock-card">
                  <h5>Approval flow</h5>
                  <div className="lp-mock-step"><i>✓</i><div>Line manager<small>Approved · 2h ago</small></div></div>
                  <div className="lp-mock-step"><i>2</i><div>Procurement review<small>Waiting · SLA 48h</small></div></div>
                  <div className="lp-mock-step"><i className="dim">3</i><div>CFO approval<small>Runs when total ≥ $5,000</small></div></div>
                </div>
              </div>
            </div>
            <div className="lp-float a"><b>Escalated</b>Overdue step routed to Head of Ops</div>
            <div className="lp-float b"><b>Approved via mobile</b>Sam approved MEMO-0031 in 40s</div>
          </div>
        </div>
      </section>

      {/* STRIP */}
      <div className="lp-strip">
        <div className="wrap">
          <span>Finance</span><span>Operations</span><span>HR</span><span>Legal</span><span>Procurement</span><span>Public sector</span><span>NGOs</span>
        </div>
      </div>

      {/* PRODUCT BENTO */}
      <section className="lp-section" id="product">
        <div className="wrap">
          <div className="lp-kicker">The product</div>
          <h2 className="lp-h2">One engine for every sign-off in the business.</h2>
          <p className="lp-sub">Build the form, describe who approves at each level, and {BRAND} handles routing, reminders, escalation and the paper trail.</p>
          <div className="lp-bento">
            <div className="lp-tile big">
              <span className="lp-tile-icon"><ApartmentOutlined /></span>
              <h4>Configurable approval levels</h4>
              <p>Chain as many levels as you need. Route to a named person, a role, the requester&apos;s line manager, a department head, or whoever was picked on the form. Any-one or all-must-approve per level, with conditions like &ldquo;only when the total is over $5,000&rdquo;.</p>
              <div className="lp-levels"><span className="on">1 · Line manager</span><span className="on">2 · Procurement</span><span>3 · CFO (≥ $5k)</span><span>4 · Legal (contracts)</span></div>
            </div>
            <div className="lp-tile">
              <span className="lp-tile-icon"><TableOutlined /></span>
              <h4>Custom forms with line items</h4>
              <p>Drag in text, money, dates, pickers and item tables with your own columns, formulas and totals.</p>
            </div>
            <div className="lp-tile">
              <span className="lp-tile-icon"><ClockCircleOutlined /></span>
              <h4>SLAs &amp; escalation</h4>
              <p>Hours per level, overdue flags, automatic escalation and out-of-office delegation so nothing stalls.</p>
            </div>
            <div className="lp-tile">
              <span className="lp-tile-icon"><BgColorsOutlined /></span>
              <h4>White-label</h4>
              <p>Your clients see their own name, logo, colours and domain. You run the platform.</p>
            </div>
            <div className="lp-tile">
              <span className="lp-tile-icon"><AuditOutlined /></span>
              <h4>Audit trail</h4>
              <p>Every action logged with who, when, IP and device. Export to CSV for auditors.</p>
            </div>
            <div className="lp-tile wide">
              <span className="lp-tile-icon"><ThunderboltOutlined /></span>
              <h4>Notifications, API &amp; webhooks</h4>
              <p>In-app and email notifications, signed webhooks for every state change, and an API-key protected REST API to raise and read requests from your other systems.</p>
            </div>
            <div className="lp-tile wide">
              <span className="lp-tile-icon"><BranchesOutlined /></span>
              <h4>Reports that find the bottleneck</h4>
              <p>Turnaround by workflow, slowest levels, approver activity and monthly volume, ready for the leadership deck.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW */}
      <section className="lp-section dark" id="how">
        <div className="wrap">
          <div className="lp-kicker">How it works</div>
          <h2 className="lp-h2">From blank page to first approval in one sitting.</h2>
          <p className="lp-sub">No consultants, no code. Start from a preset for memos, requisitions or document approvals and adjust.</p>
          <div className="lp-steps">
            <div className="lp-step"><h4>Design the form</h4><p>Pick fields, add a line-items table, mark what is required and what only shows when a condition is met.</p></div>
            <div className="lp-step"><h4>Define the levels</h4><p>Decide who approves at each step, whether one or all must agree, how many hours they get, and who it escalates to.</p></div>
            <div className="lp-step"><h4>Switch it on</h4><p>Staff raise requests from the web or their phone. Approvers get notified, act in one tap, and the audit trail writes itself.</p></div>
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="lp-section alt" id="usecases">
        <div className="wrap">
          <div className="lp-kicker">Use cases</div>
          <h2 className="lp-h2">Built for the documents that keep an organisation moving.</h2>
          <p className="lp-sub">Three presets ship out of the box. Duplicate, rename and tailor them per department.</p>
          <div className="lp-cases">
            <div className="lp-case"><h4>Internal memos</h4><p>Circulate decisions and notices with the right sign-off before they go out.</p><ul><li>Manager review, department-head sign-off</li><li>Confidential flag adds a level</li><li>Print-ready output</li></ul></div>
            <div className="lp-case"><h4>Purchase requisitions</h4><p>Line items with quantities, unit prices and computed totals that drive routing.</p><ul><li>CFO only above a threshold</li><li>Procurement checks supplier and budget</li><li>Export to CSV for the ERP</li></ul></div>
            <div className="lp-case"><h4>Document approvals</h4><p>Policies, contracts and reports reviewed by the people you name on the form.</p><ul><li>Reviewer picked per document</li><li>Legal and executive must both approve</li><li>Attachments required before submission</li></ul></div>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="lp-section" id="security">
        <div className="wrap">
          <div className="lp-kicker">Security</div>
          <h2 className="lp-h2">Enterprise controls without the enterprise procurement cycle.</h2>
          <div className="lp-bento" style={{ marginTop: 36 }}>
            <div className="lp-tile wide"><span className="lp-tile-icon"><SafetyCertificateOutlined /></span><h4>Two-factor authentication</h4><p>Authenticator-app codes with backup codes. Workspaces can require it for every administrator.</p></div>
            <div className="lp-tile wide"><span className="lp-tile-icon"><LockOutlined /></span><h4>Hardened sign-in</h4><p>Strong password policy, rate limiting, account lockout, instant session revocation and single-use password resets.</p></div>
            <div className="lp-tile"><h4>Tenant isolation</h4><p>Every record is scoped to your workspace; API keys and webhooks are per tenant.</p></div>
            <div className="lp-tile"><h4>Audit everything</h4><p>Sign-ins, failures, changes and decisions, with IP and device, exportable.</p></div>
            <div className="lp-tile"><h4>Your data, your DB</h4><p>Runs on MySQL or Postgres, on our cloud or yours.</p></div>
          </div>
        </div>
      </section>

      {/* QUOTES */}
      <section className="lp-section alt">
        <div className="wrap">
          <div className="lp-kicker">What teams say</div>
          <h2 className="lp-h2">Less chasing. Faster decisions.</h2>
          <div className="lp-quotes" style={{ marginTop: 32 }}>
            <div className="lp-quote"><p>&ldquo;Requisitions used to sit in inboxes for a week. Now the CFO step only fires when it needs to and everything else clears in a day.&rdquo;</p><small>Finance lead, logistics group</small></div>
            <div className="lp-quote"><p>&ldquo;We white-labelled it for six client organisations in an afternoon. Each one thinks it is their own system.&rdquo;</p><small>Managing partner, advisory firm</small></div>
            <div className="lp-quote"><p>&ldquo;The audit export answered every question the auditors had. First year with no findings on approvals.&rdquo;</p><small>Compliance manager, public utility</small></div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="lp-section" id="pricing">
        <div className="wrap">
          <div className="lp-kicker">Pricing</div>
          <h2 className="lp-h2">Start free. Grow into the plan that fits.</h2>
          <p className="lp-sub">Every plan includes unlimited approvers, the workflow builder, notifications and the audit trail.</p>
          <div className="lp-plans">
            {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((k) => {
              const p = PLANS[k];
              const hot = k === "BUSINESS";
              return (
                <div className={`lp-plan ${hot ? "hot" : ""}`} key={k} style={{ position: "relative" }}>
                  {hot && <span className="lp-badge">MOST POPULAR</span>}
                  <h4>{p.name}</h4>
                  <div className="price">{p.priceMonthly === 0 ? "Free" : `$${p.priceMonthly}`}{p.priceMonthly > 0 && <small> / month</small>}</div>
                  <ul>
                    <li>{lim(p.users)} users</li>
                    <li>{lim(p.templates)} workflows</li>
                    <li>{lim(p.requestsPerMonth)} requests / month</li>
                    <li>{p.storageMb >= 1024 ? `${p.storageMb / 1024} GB` : `${p.storageMb} MB`} storage</li>
                    <li className={p.whiteLabel ? "" : "no"}>White-label branding</li>
                    <li className={p.apiAccess ? "" : "no"}>API access</li>
                    <li className={p.webhooks ? "" : "no"}>Webhooks</li>
                    <li className={p.customDomain ? "" : "no"}>Custom domain</li>
                  </ul>
                  <Link className={`lp-btn ${hot ? "lp-btn-green" : "lp-btn-outline"}`} href={registerHref} style={{ justifyContent: "center" }}>{p.priceMonthly === 0 ? "Start free" : `Choose ${p.name}`}</Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta">
        <div className="wrap">
          <BrandMark size={44} color="#FFFDF0" />
          <h2 className="lp-h2" style={{ marginTop: 18 }}>Ready to retire the email chain?</h2>
          <p className="lp-sub" style={{ margin: "0 auto 28px", color: "rgba(255,253,240,.72)" }}>Create a workspace, load a preset, and send your first request for approval today.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link className="lp-btn lp-btn-cream lp-btn-lg" href={registerHref}>Create your workspace</Link>
            <Link className="lp-btn lp-btn-ghost lp-btn-lg" href={loginHref}>Sign in</Link>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="wrap">
          <BrandLogo color="rgba(255,253,240,.85)" height={22} name={BRAND} />
          <div>© {new Date().getFullYear()} {BRAND}<a href="#security">Security</a><a href="#pricing">Pricing</a><Link href={loginHref}>Sign in</Link></div>
        </div>
      </footer>
    </div>
  );
}
