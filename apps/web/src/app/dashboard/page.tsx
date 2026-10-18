"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type SavedScan = { id: string; source: string; target_url: string; task: string; status: string; created_at: string; finished_at: string | null };
type Draft = { report: unknown; key: string; name: string };

export default function DashboardPage() {
  const [scans, setScans] = useState<SavedScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [task, setTask] = useState("Find the contact form through the support page.");
  const [saving, setSaving] = useState(false);
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  async function loadScans() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/scans", { cache: "no-store" });
      if (response.status === 401) { window.location.assign("/login"); return; }
      const data: { scans?: SavedScan[]; error?: string } = await response.json();
      if (!response.ok || !Array.isArray(data.scans)) throw new Error(data.error || "Could not load scans.");
      setScans(data.scans);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load scans."); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (configured) void loadScans(); else setLoading(false); }, [configured]);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(""); setMessage(""); setDraft(null);
    try {
      if (file.size > 800_000) throw new Error("Choose an audit JSON smaller than 800 KB.");
      const report: unknown = JSON.parse(await file.text());
      if (!report || typeof report !== "object" || !Array.isArray((report as { pages?: unknown }).pages)) {
        throw new Error("This is not an AccessPath audit export.");
      }
      setDraft({ report, key: crypto.randomUUID(), name: file.name });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read this file."); }
    finally { event.target.value = ""; }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/scans/import", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", "Idempotency-Key": draft.key },
        body: JSON.stringify({ task: task.trim(), report: draft.report }),
      });
      if (response.status === 401) { window.location.assign("/login"); return; }
      const data: { id?: string; error?: string } = await response.json();
      if (!response.ok || !data.id) throw new Error(data.error || "Could not save this audit.");
      setDraft(null);
      setMessage("Audit saved to your workspace.");
      await loadScans();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this audit."); }
    finally { setSaving(false); }
  }

  async function signOut() {
    try { await createBrowserSupabase().auth.signOut({ scope: "local" }); }
    finally { window.location.assign("/"); }
  }

  return <main className={styles.page}>
    <header className={styles.header}><a href="/" className={styles.brand}>accesspath<span>.</span></a><span>PRIVATE WORKSPACE</span><button type="button" onClick={signOut} disabled={!configured}>Sign out ↗</button></header>
    <div className={styles.shell}>
      <div className={styles.eyebrow}>WORKSPACE / SAVED EVIDENCE</div>
      <div className={styles.hero}><div><h1>Your reports,<br /><em>in one place.</em></h1><p>Import a controlled-demo audit and keep its findings available across visits. Each account sees only its own saved scans.</p></div><div className={styles.heroCount}><strong>{scans.length}</strong><span>RECENT SCANS</span></div></div>
      {!configured && <p className={styles.alert} role="status">Create the Supabase project and add its settings to enable accounts and saved reports.</p>}
      <section className={styles.importPanel} aria-labelledby="import-title">
        <div><span className={styles.sectionIndex}>01 / SAVE EVIDENCE</span><h2 id="import-title">Bring in your audit.</h2><p>The existing JSON export is enough. This import does not run TinyFish or use API credits.</p></div>
        <div className={styles.importForm}>
          <label className={styles.fileLabel}>AUDIT JSON<input type="file" accept=".json,application/json" onChange={selectFile} disabled={!configured || saving} /></label>
          {draft && <form onSubmit={save}>
            <small>SELECTED / {draft.name}</small>
            <label>VISITOR GOAL<input required minLength={12} maxLength={180} value={task} onChange={event => setTask(event.target.value)} disabled={saving} /></label>
            <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save to my workspace"} <span aria-hidden="true">↗</span></button>
          </form>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {message && <p className={styles.success} role="status">{message}</p>}
        </div>
      </section>
      <section className={styles.saved} aria-labelledby="saved-title">
        <div className={styles.sectionHead}><span>02 / MY SAVED SCANS</span><span>OWNER ONLY</span></div>
        <h2 id="saved-title">Evidence library.</h2>
        {loading && <p className={styles.status}>Loading your reports…</p>}
        {!loading && configured && scans.length === 0 && <p className={styles.status}>No saved reports yet. Import the audit you downloaded from the journey studio.</p>}
        <ol>
          {scans.map((scan, index) => <li key={scan.id}>
            <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
            <div><strong>{scan.task}</strong><small>{scan.target_url}</small><span>{scan.source.toUpperCase()} / {scan.status.toUpperCase()} / {new Date(scan.created_at).toLocaleDateString()}</span></div>
            <a href={`/reports/local?scan=${encodeURIComponent(scan.id)}`}>Open report ↗</a>
          </li>)}
        </ol>
      </section>
      <p className={styles.scope}>This is the saved-report foundation. Live multi-user scans remain disabled until the private worker and spend limits are connected.</p>
    </div>
  </main>;
}
