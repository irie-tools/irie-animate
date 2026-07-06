"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Save } from "lucide-react";
import type { TenantSettings } from "@/src/lib/tenantStore";
import styles from "./SaasShell.module.css";

export function AdminConsole() {
  const [tenant, setTenant] = useState<TenantSettings | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadTenant = useCallback(async () => {
    const response = await fetch("/api/tenant", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok && payload.ok) {
      setTenant(payload.tenant as TenantSettings);
    }
  }, []);

  useEffect(() => {
    void loadTenant();
  }, [loadTenant]);

  const saveTenant = useCallback(async (patch: Partial<TenantSettings>) => {
    if (!tenant) return;
    const response = await fetch("/api/tenant", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      setToast(payload.error || "Tenant save failed.");
      return;
    }
    setTenant(payload.tenant as TenantSettings);
    setToast("Tenant settings saved.");
  }, [tenant]);

  const patchLocal = useCallback((patch: Partial<TenantSettings>) => {
    setTenant((current) => current ? { ...current, ...patch } : current);
  }, []);

  if (!tenant) {
    return (
      <main className={styles.siteShell}>
        <nav className={styles.topNav}><Link className={styles.mark} href="/"><i /><strong>IRIE ANIMATE</strong></Link></nav>
        <section className={styles.adminHeader}><h1>Loading admin</h1></section>
      </main>
    );
  }

  const completed = tenant.onboarding.filter((item) => item.done).length;

  return (
    <main className={`${styles.siteShell} ${styles.adminPage}`}>
      <nav className={styles.topNav} aria-label="Admin navigation">
        <Link className={styles.mark} href="/"><i /><strong>IRIE ANIMATE</strong></Link>
        <div className={styles.navLinks}>
          <Link href="/">Front Door</Link>
          <Link className={styles.primaryLink} href="/studio">Open Studio <ArrowRight size={15} /></Link>
        </div>
      </nav>

      <header className={styles.adminHeader}>
        <h1>Tenant back door</h1>
        <p>Manage the active workspace, feature gates, local usage limits, and onboarding truth behind the builder.</p>
      </header>

      <div className={styles.adminGrid}>
        <aside className={styles.adminCard}>
          <div className={styles.tenantBadge}>{tenant.ownerInitials}</div>
          <h2>{tenant.workspaceName}</h2>
          <p>{tenant.status} {tenant.plan} workspace for {tenant.ownerName}.</p>
          <div className={styles.statGrid}>
            <span className={styles.statTile}><strong>{tenant.limits.projects}</strong> Projects</span>
            <span className={styles.statTile}><strong>{tenant.limits.sourceMinutes}</strong> Source min</span>
            <span className={styles.statTile}><strong>{tenant.limits.monthlyExports}</strong> Exports</span>
            <span className={styles.statTile}><strong>{completed}/{tenant.onboarding.length}</strong> Onboarded</span>
          </div>
          <button className={styles.adminButton} onClick={() => saveTenant(tenant)}><Save size={15} /> Save tenant</button>
          {toast ? <p className={styles.toast}>{toast}</p> : null}
        </aside>

        <section className={styles.adminPanel}>
          <h2>Workspace identity</h2>
          <p>This replaces the hard-coded AK idea with a tenant profile the app can read and display.</p>
          <div className={styles.formGrid}>
            <label className={styles.field}>Workspace name
              <input value={tenant.workspaceName} onChange={(event) => patchLocal({ workspaceName: event.target.value })} />
            </label>
            <label className={styles.field}>Tenant slug
              <input value={tenant.slug} onChange={(event) => patchLocal({ slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
            </label>
            <label className={styles.field}>Owner name
              <input value={tenant.ownerName} onChange={(event) => patchLocal({ ownerName: event.target.value })} />
            </label>
            <label className={styles.field}>Owner initials
              <input value={tenant.ownerInitials} maxLength={3} onChange={(event) => patchLocal({ ownerInitials: event.target.value.toUpperCase() })} />
            </label>
            <label className={styles.field}>Plan
              <select value={tenant.plan} onChange={(event) => patchLocal({ plan: event.target.value as TenantSettings["plan"] })}>
                <option value="Studio">Studio</option>
                <option value="Pro">Pro</option>
                <option value="Agency">Agency</option>
              </select>
            </label>
            <label className={styles.field}>Status
              <select value={tenant.status} onChange={(event) => patchLocal({ status: event.target.value as TenantSettings["status"] })}>
                <option value="Trial">Trial</option>
                <option value="Active">Active</option>
                <option value="Paused">Paused</option>
              </select>
            </label>
            <label className={styles.field}>Primary domain
              <input value={tenant.primaryDomain} onChange={(event) => patchLocal({ primaryDomain: event.target.value })} />
            </label>
            <label className={styles.field}>Billing email
              <input value={tenant.billingEmail} onChange={(event) => patchLocal({ billingEmail: event.target.value })} />
            </label>
          </div>

          <h2>Limits</h2>
          <div className={styles.formGrid}>
            <label className={styles.field}>Projects
              <input type="number" min={1} value={tenant.limits.projects} onChange={(event) => patchLocal({ limits: { ...tenant.limits, projects: Number(event.target.value) || 1 } })} />
            </label>
            <label className={styles.field}>Source minutes
              <input type="number" min={1} value={tenant.limits.sourceMinutes} onChange={(event) => patchLocal({ limits: { ...tenant.limits, sourceMinutes: Number(event.target.value) || 1 } })} />
            </label>
            <label className={styles.field}>Monthly exports
              <input type="number" min={1} value={tenant.limits.monthlyExports} onChange={(event) => patchLocal({ limits: { ...tenant.limits, monthlyExports: Number(event.target.value) || 1 } })} />
            </label>
          </div>

          <h2>Feature flags</h2>
          <div className={styles.flagGrid}>
            {[
              ["publicFrontDoor", "Public front door"],
              ["videoSourceCook", "Video source cooking"],
              ["exportPackages", "Static export packages"],
              ["requireApproval", "Require approval before export"]
            ].map(([key, label]) => (
              <label className={styles.flagRow} key={key}>
                <input
                  type="checkbox"
                  checked={tenant.features[key as keyof TenantSettings["features"]]}
                  onChange={(event) => patchLocal({ features: { ...tenant.features, [key]: event.target.checked } })}
                />
                {label}
              </label>
            ))}
          </div>

          <h2>Onboarding gates</h2>
          <div className={styles.onboardingList}>
            {tenant.onboarding.map((item, index) => (
              <label className={styles.onboardingRow} key={item.label}>
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(event) => {
                    const onboarding = tenant.onboarding.map((entry, entryIndex) => entryIndex === index ? { ...entry, done: event.target.checked } : entry);
                    patchLocal({ onboarding });
                  }}
                />
                {item.label}
              </label>
            ))}
          </div>
          <button className={styles.adminButton} onClick={() => saveTenant(tenant)}><Save size={15} /> Save tenant controls</button>
        </section>
      </div>
    </main>
  );
}
