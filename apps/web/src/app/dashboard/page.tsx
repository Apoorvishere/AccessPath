"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { SCAN_TARGETS } from "@/lib/scan-targets";
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
  const liveEnabled = process.env.NEXT_PUBLIC_ACCESSPATH_LIVE_SCANS_ENABLED === "true";
  const [targetUrl, setTargetUrl] = useState<string>(SCAN_TARGETS[0].url);
  const [liveTask, setLiveTask] = useState<string>(SCAN_TARGETS[0].exampleGoal);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [liveMessage, setLiveMessage] = useState("");

  async function loadScans(silent = false) {
    if (!silent) { setLoading(true); setError(""); }
    try {
      const response = await fetch("/api/scans", { cache: "no-store" });
      if (response.status === 401) { window.location.assign("/login"); return; }
      const data: { scans?: SavedScan[]; error?: string } = await response.json();
      if (!response.ok || !Array.isArray(data.scans)) throw new Error(data.error || "Could not load scans.");
      setScans(data.scans);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load scans."); }
    finally { if (!silent) setLoading(false); }
  }

  useEffect(() => { if (configured) void loadScans(); else setLoading(false); }, [configured]);
  useEffect(() => {
    if (!scans.some(scan => scan.status === "queued" || scan.status === "running")) return;
    const timer = setTimeout(() => { void loadScans(true); }, 8000);
    return () => clearTimeout(timer);
  }, [scans]);

  async function startLive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (liveBusy || !liveEnabled) return;
    setLiveBusy(true); setLiveError(""); setLiveMessage("");
    try {
      const response = await fetch("/api/scans", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ targetUrl, task: liveTask.trim() }),
      });
      if (response.status === 401) { window.location.assign("/login"); return; }
      const data: { id?: string; error?: string } = await response.json();
      if (!response.ok || !data.id) throw new Error(data.error || "Could not queue this scan.");
      setLiveMessage("Scan queued. This list refreshes while it runs.");
      await loadScans(true);
    } catch (cause) { setLiveError(cause instanceof Error ? cause.message : "Could not queue this scan."); }
    finally { setLiveBusy(false); }
  }

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
      {liveEnabled && <section className={styles.importPanel} aria-labelledby="live-title">
        <div><span className={styles.sectionIndex}>01 / LIVE CONTROLLED SCAN</span><h2 id="live-title">Follow a real route.</h2><p>Choose an approved public site and write your own visitor goal. The agent can read up to three visited pages within the chosen site. Tasks that need login, form submission, or pages outside the approved area cannot complete.</p></div>
        <div className={styles.importForm}>
          <form onSubmit={startLive}>
            <label>APPROVED SITE<select className={styles.siteSelect} value={targetUrl} onChange={event => {
              const selected = SCAN_TARGETS.find(target => target.url === event.target.value);
              if (selected) { setTargetUrl(selected.url); setLiveTask(selected.exampleGoal); }
            }} disabled={liveBusy}>{SCAN_TARGETS.map(target => <option value={target.url} key={target.url}>{target.label}</option>)}</select></label>
            <small className={styles.siteUrl}>{targetUrl}</small>
            <label>VISITOR GOAL<input required minLength={12} maxLength={180} value={liveTask} onChange={event => setLiveTask(event.target.value)} disabled={liveBusy} /></label>
            <button type="submit" disabled={liveBusy || !configured}>{liveBusy ? "Queuing…" : "Start controlled scan"}<span aria-hidden="true">↗</span></button>
          </form>
          {liveError && <p className={styles.error} role="alert">{liveError}</p>}
          {liveMessage && <p className={styles.success} role="status">{liveMessage}</p>}
        </div>
      </section>}
      <section className={styles.importPanel} aria-labelledby="import-title">
        <div><span className={styles.sectionIndex}>{liveEnabled ? "02" : "01"} / SAVE EVIDENCE</span><h2 id="import-title">Bring in your audit.</h2><p>The existing JSON export is enough. This import does not run TinyFish or use API credits.</p></div>
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
        <div className={styles.sectionHead}><span>{liveEnabled ? "03" : "02"} / MY SAVED SCANS</span><span>OWNER ONLY</span></div>
        <h2 id="saved-title">Evidence library.</h2>
        {loading && <p className={styles.status}>Loading your reports…</p>}
        {!loading && configured && scans.length === 0 && <p className={styles.status}>No saved reports yet. Import the audit you downloaded from the journey studio.</p>}
        <ol>
          {scans.map((scan, index) => <li key={scan.id}>
            <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
            <div><strong>{scan.task}</strong><small>{scan.target_url}</small><span>{scan.source.toUpperCase()} / {scan.status.toUpperCase()} / {new Date(scan.created_at).toLocaleDateString()}</span></div>
            {scan.status === "completed" || scan.status === "partial"
              ? <a href={`/reports/local?scan=${encodeURIComponent(scan.id)}`}>Open report ↗</a>
              : <span className={styles.scanState}>{scan.status === "queued" ? "WAITING" : scan.status === "running" ? "IN PROGRESS" : "NO REPORT"}</span>}
          </li>)}
        </ol>
      </section>
      <p className={styles.scope}>{liveEnabled ? "Automated findings require human review. A completed scan is not a conformance certificate." : "Live multi-user scans remain disabled until the private worker and spend limits are connected."}</p>
    </div>
  </main>;
}
