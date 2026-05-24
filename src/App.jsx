import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Dumbbell,
  Home,
  Pencil,
  Plus,
  RotateCw,
  Settings,
  Tag,
  Trash2,
  Weight,
  X,
} from "lucide-react";

const VALID_REASONS = ["Sick", "Travel", "Work Emergency", "Family Emergency", "Other"];
const DEFAULT_TAGS = ["Push", "Pull", "Legs", "Upper", "Lower", "Full Body", "Cardio", "Arms", "Core"];
const STORAGE_KEY = "gymTrackerData_v3";
const SCRIPT_URL_KEY = "gymScriptUrl";
const EMPTY_DATA = { logs: {}, proteinGoal: 100, customTags: [], weights: {} };

const pad = (n) => String(n).padStart(2, "0");
const toLocalStr = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const getTodayStr = () => toLocalStr(new Date());
const parseLocal = (dateString) => {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const isSunday = (dateString) => parseLocal(dateString).getDay() === 0;
const formatDate = (dateString) =>
  parseLocal(dateString).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

function getDateRange(year, month) {
  const days = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(toLocalStr(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function computeStreak(logs) {
  let streak = 0;
  const date = new Date();
  while (true) {
    const dateString = toLocalStr(date);
    if (isSunday(dateString)) {
      date.setDate(date.getDate() - 1);
      continue;
    }
    const log = logs[dateString];
    if (!log) break;
    if (log.wentGym || (log.skipped && log.reason)) streak += 1;
    else break;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY_DATA, ...JSON.parse(raw) } : EMPTY_DATA;
  } catch {
    return EMPTY_DATA;
  }
}

function saveLocal(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function Toggle({ value, onChange }) {
  return (
    <div className="segmented" role="group">
      <button className={value === true ? "segment active good" : "segment"} onClick={() => onChange(true)} type="button">
        Yes
      </button>
      <button className={value === false ? "segment active bad" : "segment"} onClick={() => onChange(false)} type="button">
        No
      </button>
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button className={active ? "chip active" : "chip"} onClick={onClick} type="button">
      {label}
    </button>
  );
}

function Section({ icon: Icon, title, action, children }) {
  return (
    <section className="section">
      <div className="section-header">
        <Icon size={18} />
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h2>{title}</h2>
          {onClose && (
            <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
              <X size={18} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function StreakCard({ streak }) {
  return (
    <section className="streak-card">
      <div>
        <span className="eyebrow">Current streak</span>
        <strong>{streak}</strong>
        <span>{streak === 1 ? "day" : "days"} locked in</span>
      </div>
      <div className="streak-ring">
        <Activity size={32} />
      </div>
    </section>
  );
}

function SyncBadge({ status }) {
  if (status === "idle") return null;
  const copy = { syncing: "Syncing", ok: "Synced", error: "Sync failed" }[status];
  return <div className={`sync-badge ${status}`}>{copy}</div>;
}

export default function App() {
  const today = getTodayStr();
  const [data, setData] = useState(loadLocal);
  const [view, setView] = useState("today");
  const [scriptUrl, setScriptUrl] = useState(() => localStorage.getItem(SCRIPT_URL_KEY) || "");
  const [urlInput, setUrlInput] = useState("");
  const [syncStatus, setSyncStatus] = useState("idle");
  const [showUrlModal, setShowUrlModal] = useState(() => !localStorage.getItem(SCRIPT_URL_KEY));
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [editing, setEditing] = useState(true);
  const [testMode, setTestMode] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [protein, setProtein] = useState(() => loadLocal().logs[getTodayStr()]?.protein ?? "");
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);

  const todayLog = data.logs[today] || {};
  const allTags = useMemo(() => [...DEFAULT_TAGS, ...(data.customTags || [])], [data.customTags]);
  const streak = useMemo(() => computeStreak(data.logs), [data.logs]);

  useEffect(() => {
    if (data.logs[today]?.wentGym !== undefined) setEditing(false);
  }, []);

  const updateData = useCallback((patch) => {
    setData((previous) => {
      const next = { ...previous, ...patch };
      saveLocal(next);
      return next;
    });
  }, []);

  const updateLog = useCallback((date, patch) => {
    setData((previous) => {
      const next = {
        ...previous,
        logs: { ...previous.logs, [date]: { ...previous.logs[date], ...patch } },
      };
      saveLocal(next);
      return next;
    });
  }, []);

  const syncToSheet = useCallback(
    async (date, entry, url = scriptUrl) => {
      if (!url) return;
      setSyncStatus("syncing");
      try {
        await fetch(url, {
          method: "POST",
          body: JSON.stringify({ date, entry }),
          headers: { "Content-Type": "text/plain" },
          mode: "no-cors",
        });
        setSyncStatus("ok");
        setTimeout(() => setSyncStatus("idle"), 1800);
      } catch {
        setSyncStatus("error");
        setTimeout(() => setSyncStatus("idle"), 2500);
      }
    },
    [scriptUrl]
  );

  const pullFromSheet = useCallback(
    async (url = scriptUrl) => {
      if (!url) return null;
      setSyncStatus("syncing");
      try {
        const response = await fetch(`${url}?action=get`);
        const json = await response.json();
        if (json.ok) {
          setSyncStatus("ok");
          setTimeout(() => setSyncStatus("idle"), 1800);
          return json.logs;
        }
      } catch {
        setSyncStatus("error");
        setTimeout(() => setSyncStatus("idle"), 2500);
      }
      return null;
    },
    [scriptUrl]
  );

  useEffect(() => {
    if (!scriptUrl) return;
    if (Object.keys(data.logs).length > 0) setShowSyncModal(true);
    else pullFromSheet(scriptUrl).then((logs) => logs && updateData({ logs }));
  }, []);

  const saveUrl = (url) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    localStorage.setItem(SCRIPT_URL_KEY, trimmed);
    setScriptUrl(trimmed);
    setShowUrlModal(false);
    setUrlInput("");
    if (Object.keys(data.logs).length > 0) setShowSyncModal(true);
    else pullFromSheet(trimmed).then((logs) => logs && updateData({ logs }));
  };

  const saveToday = () => {
    syncToSheet(today, data.logs[today]);
    setEditing(false);
  };

  return (
    <div className="app-shell">
      {showUrlModal && (
        <Modal title="Connect Google Sheets" onClose={() => setShowUrlModal(false)}>
          <p className="muted">Paste your Apps Script web app URL to keep logs synced.</p>
          <input className="input" value={urlInput} onChange={(event) => setUrlInput(event.target.value)} placeholder="https://script.google.com/..." />
          <div className="modal-actions">
            <button className="primary-button" onClick={() => saveUrl(urlInput)} type="button">Connect</button>
            <button className="secondary-button" onClick={() => setShowUrlModal(false)} type="button">Skip for now</button>
          </div>
        </Modal>
      )}

      {showSyncModal && (
        <Modal title="Sync existing data" onClose={() => setShowSyncModal(false)}>
          <p className="muted">Local logs and a connected sheet were found. Choose which source should lead.</p>
          <div className="modal-actions">
            <button className="primary-button" onClick={async () => {
              setShowSyncModal(false);
              const logs = await pullFromSheet();
              if (logs) updateData({ logs });
            }} type="button">Pull from Sheet</button>
            <button className="secondary-button" onClick={() => {
              setShowSyncModal(false);
              Object.entries(data.logs).forEach(([date, entry]) => syncToSheet(date, entry));
            }} type="button">Push local logs</button>
          </div>
        </Modal>
      )}

      <header className="topbar">
        <div>
          <span className="eyebrow">GymLog</span>
          <h1>{view === "today" ? "Today" : view[0].toUpperCase() + view.slice(1)}</h1>
        </div>
        <Dumbbell size={28} />
      </header>

      <main className="content">
        {view === "today" && (
          <TodayView
            allTags={allTags}
            data={data}
            editing={editing}
            log={todayLog}
            protein={protein}
            saveToday={saveToday}
            setEditing={setEditing}
            setProtein={setProtein}
            setTestMode={setTestMode}
            streak={streak}
            syncStatus={syncStatus}
            testMode={testMode}
            today={today}
            updateLog={updateLog}
          />
        )}
        {view === "calendar" && (
          <CalendarView
            calMonth={calMonth}
            calYear={calYear}
            data={data}
            selectedDay={selectedDay}
            setCalMonth={setCalMonth}
            setCalYear={setCalYear}
            setSelectedDay={setSelectedDay}
            today={today}
          />
        )}
        {view === "stats" && <StatsView data={data} streak={streak} />}
        {view === "settings" && (
          <SettingsView
            data={data}
            newTag={newTag}
            scriptUrl={scriptUrl}
            setData={setData}
            setNewTag={setNewTag}
            setShowSyncModal={setShowSyncModal}
            setShowUrlModal={setShowUrlModal}
            setUrlInput={setUrlInput}
            today={today}
            updateData={updateData}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        {[
          ["today", "Today", Home],
          ["calendar", "Log", CalendarDays],
          ["stats", "Stats", BarChart3],
          ["settings", "Settings", Settings],
        ].map(([id, label, Icon]) => (
          <button className={view === id ? "nav-button active" : "nav-button"} key={id} onClick={() => setView(id)} type="button">
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function TodayView({ allTags, data, editing, log, protein, saveToday, setEditing, setProtein, setTestMode, streak, syncStatus, testMode, today, updateLog }) {
  const proteinNumber = Number(protein) || 0;
  const pct = Math.min(100, Math.round((proteinNumber / data.proteinGoal) * 100));
  const hitGoal = proteinNumber >= data.proteinGoal;

  if (isSunday(today) && !testMode) {
    return (
      <section className="rest-panel">
        <Activity size={42} />
        <h2>Rest day</h2>
        <p>Sunday is reserved for recovery.</p>
        <button className="text-button" onClick={() => setTestMode(true)} type="button">Test today screen</button>
      </section>
    );
  }

  if (!editing) {
    const gymStatus = log.wentGym ? "Hit" : log.skipped ? log.reason : "Missed";
    return (
      <>
        <StreakCard streak={streak} />
        <span className="date-pill">{formatDate(today)}</span>
        <Section icon={Dumbbell} title="Today's Log" action={<button className="icon-button" onClick={() => setEditing(true)} type="button" aria-label="Edit log"><Pencil size={17} /></button>}>
          <DetailRows rows={[
            ["Gym", gymStatus],
            log.tag && ["Workout", log.tag],
            ["Creatine", log.creatine === true ? "Yes" : log.creatine === false ? "No" : "Not logged"],
            ["Whey", log.whey === true ? "Yes" : log.whey === false ? "No" : "Not logged"],
            ["Protein", log.protein != null ? `${log.protein}g (${pct}%)` : "Not logged"],
          ]} />
        </Section>
        <SyncBadge status={syncStatus} />
      </>
    );
  }

  return (
    <>
      <StreakCard streak={streak} />
      <span className="date-pill">{formatDate(today)}</span>
      <Section icon={Dumbbell} title="Gym">
        <Toggle value={log.wentGym} onChange={(value) => updateLog(today, { wentGym: value, skipped: !value, reason: value ? null : log.reason, tag: value ? log.tag : null })} />
        {log.wentGym === false && <Picker label="Reason" options={VALID_REASONS} active={log.reason} onSelect={(reason) => updateLog(today, { reason })} />}
        {log.wentGym === true && <Picker label="Workout" options={allTags} active={log.tag} onSelect={(tag) => updateLog(today, { tag })} />}
      </Section>
      <div className="supplement-grid">
        {[
          ["creatine", "Creatine"],
          ["whey", "Whey"],
        ].map(([key, label]) => (
          <section className={log[key] ? "mini-panel active" : "mini-panel"} key={key}>
            <Check size={20} />
            <h3>{label}</h3>
            <Toggle value={log[key]} onChange={(value) => updateLog(today, { [key]: value })} />
          </section>
        ))}
      </div>
      <Section icon={Activity} title="Protein" action={<span className={hitGoal ? "status-pill good" : "status-pill"}>{pct}%</span>}>
        <input className="input" min="0" onChange={(event) => {
          setProtein(event.target.value);
          updateLog(today, { protein: event.target.value === "" ? undefined : Number(event.target.value) });
        }} placeholder={`Goal: ${data.proteinGoal}g`} type="number" value={protein} />
        <div className="progress-track"><span className={hitGoal ? "progress-fill good" : "progress-fill"} style={{ width: `${pct}%` }} /></div>
        <div className="progress-labels"><span>0g</span><span>{data.proteinGoal}g goal</span></div>
      </Section>
      <button className="save-button" onClick={saveToday} type="button">Save Today's Log</button>
      <SyncBadge status={syncStatus} />
    </>
  );
}

function Picker({ label, options, active, onSelect }) {
  return (
    <div className="field-group">
      <label>{label}</label>
      <div className="chip-row">{options.map((option) => <Chip key={option} label={option} active={active === option} onClick={() => onSelect(option)} />)}</div>
    </div>
  );
}

function DetailRows({ rows }) {
  return (
    <dl className="detail-list">
      {rows.filter(Boolean).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
    </dl>
  );
}

function CalendarView({ calMonth, calYear, data, selectedDay, setCalMonth, setCalYear, setSelectedDay, today }) {
  const days = getDateRange(calYear, calMonth);
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const monthName = new Date(calYear, calMonth, 1).toLocaleString(undefined, { month: "long" });
  const moveMonth = (direction) => {
    if (direction === -1 && calMonth === 0) {
      setCalMonth(11);
      setCalYear((year) => year - 1);
    } else if (direction === 1 && calMonth === 11) {
      setCalMonth(0);
      setCalYear((year) => year + 1);
    } else setCalMonth((month) => month + direction);
  };
  const cellState = (dateString) => {
    if (isSunday(dateString)) return "rest";
    if (dateString > today) return "future";
    const log = data.logs[dateString];
    if (!log || log.wentGym === undefined) return "miss";
    if (log.wentGym) return "hit";
    return log.skipped && log.reason ? "skip" : "miss";
  };

  return (
    <>
      <div className="calendar-header">
        <button className="icon-button" onClick={() => moveMonth(-1)} type="button" aria-label="Previous month"><ChevronLeft size={20} /></button>
        <h2>{monthName} {calYear}</h2>
        <button className="icon-button" onClick={() => moveMonth(1)} type="button" aria-label="Next month"><ChevronRight size={20} /></button>
      </div>
      <div className="calendar-grid">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span className="weekday" key={day}>{day}</span>)}
        {Array.from({ length: firstDay }).map((_, index) => <span key={`empty-${index}`} />)}
        {days.map((dateString) => {
          const state = cellState(dateString);
          const disabled = state === "rest" || state === "future";
          return (
            <button className={`day-cell ${state} ${dateString === today ? "today" : ""} ${dateString === selectedDay ? "selected" : ""}`} disabled={disabled} key={dateString} onClick={() => setSelectedDay(dateString === selectedDay ? null : dateString)} type="button">
              {parseLocal(dateString).getDate()}
            </button>
          );
        })}
      </div>
      <div className="legend">{[["hit", "Gym"], ["skip", "Skip"], ["miss", "Miss"], ["rest", "Rest"]].map(([state, label]) => <span key={state}><i className={state} />{label}</span>)}</div>
      {selectedDay && <DayDetail data={data} selectedDay={selectedDay} />}
    </>
  );
}

function DayDetail({ data, selectedDay }) {
  const log = data.logs[selectedDay] || {};
  const pct = Math.min(100, Math.round(((log.protein || 0) / data.proteinGoal) * 100));
  return (
    <Section icon={CalendarDays} title={formatDate(selectedDay)}>
      <DetailRows rows={[
        ["Gym", log.wentGym ? "Hit" : log.skipped ? log.reason : "Missed"],
        log.tag && ["Workout", log.tag],
        ["Creatine", log.creatine === true ? "Yes" : log.creatine === false ? "No" : "Not logged"],
        ["Whey", log.whey === true ? "Yes" : log.whey === false ? "No" : "Not logged"],
        ["Protein", log.protein != null ? `${log.protein}g (${pct}%)` : "Not logged"],
      ]} />
    </Section>
  );
}

function StatsView({ data, streak }) {
  const allLogs = Object.entries(data.logs).filter(([dateString]) => !isSunday(dateString));
  const hit = allLogs.filter(([, log]) => log.wentGym).length;
  const missed = allLogs.filter(([, log]) => !log.wentGym && !(log.skipped && log.reason)).length;
  const validSkip = allLogs.filter(([, log]) => log.skipped && log.reason).length;
  const total = allLogs.length;
  const proteinDays = allLogs.filter(([, log]) => log.protein != null);
  const avgProtein = proteinDays.length ? Math.round(proteinDays.reduce((sum, [, log]) => sum + Number(log.protein || 0), 0) / proteinDays.length) : 0;
  const tagCounts = {};
  allLogs.forEach(([, log]) => { if (log.tag) tagCounts[log.tag] = (tagCounts[log.tag] || 0) + 1; });
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  const weightEntries = Object.entries(data.weights || {}).sort(([a], [b]) => a.localeCompare(b));
  const latestWeight = weightEntries.at(-1)?.[1] ?? null;
  const firstWeight = weightEntries[0]?.[1] ?? null;
  const weightDelta = latestWeight && firstWeight ? (latestWeight - firstWeight).toFixed(1) : null;
  const stats = [
    ["Days Hit", hit],
    ["Missed", missed],
    ["Valid Skips", validSkip],
    ["Attendance", total ? `${Math.round((hit / total) * 100)}%` : "0%"],
    ["Avg Protein", `${avgProtein}g`],
    ["Creatine Days", allLogs.filter(([, log]) => log.creatine).length],
    ["Current Weight", latestWeight ? `${latestWeight}kg` : "-"],
    ["Total Change", weightDelta ? `${Number(weightDelta) > 0 ? "+" : ""}${weightDelta}kg` : "-"],
  ];

  return (
    <>
      <section className="stats-hero"><span className="eyebrow">Momentum</span><strong>{streak}</strong><p>current streak</p></section>
      <div className="stat-grid">{stats.map(([label, value]) => <section className="stat-card" key={label}><strong>{value}</strong><span>{label}</span></section>)}</div>
      {topTags.length > 0 && (
        <Section icon={Tag} title="Workout Breakdown">
          <div className="bar-list">{topTags.map(([tagName, count]) => <div className="bar-row" key={tagName}><span>{tagName}</span><div><i style={{ width: `${hit ? Math.round((count / hit) * 100) : 0}%` }} /></div><b>{count}x</b></div>)}</div>
        </Section>
      )}
      {weightEntries.length > 1 && (
        <Section icon={Weight} title="Weight History">
          <div className="history-list">{[...weightEntries].reverse().slice(0, 8).map(([dateString, weight], index, entries) => {
            const previous = entries[index + 1]?.[1];
            const diff = previous != null ? (weight - previous).toFixed(1) : null;
            return <div key={dateString}><span>{formatDate(dateString)}</span><strong>{weight}kg{diff != null && <small className={Number(diff) < 0 ? "good-change" : "bad-change"}>{Number(diff) < 0 ? "-" : "+"}{Math.abs(diff)}kg</small>}</strong></div>;
          })}</div>
        </Section>
      )}
    </>
  );
}

function SettingsView({ data, newTag, scriptUrl, setData, setNewTag, setShowSyncModal, setShowUrlModal, setUrlInput, today, updateData }) {
  const [goal, setGoal] = useState(data.proteinGoal);
  const [weightInput, setWeightInput] = useState("");
  const weightEntries = Object.entries(data.weights || {}).sort(([a], [b]) => b.localeCompare(a));
  const logWeight = () => {
    const weight = Number(weightInput);
    if (!weight || weight < 20 || weight > 300) return;
    const next = { ...data, weights: { ...(data.weights || {}), [today]: weight } };
    saveLocal(next);
    setData(next);
    setWeightInput("");
  };

  return (
    <>
      <Section icon={Activity} title="Protein Goal">
        <div className="inline-form"><input className="input" type="number" value={goal} onChange={(event) => setGoal(event.target.value)} /><button className="primary-button" onClick={() => updateData({ proteinGoal: Number(goal) || 100 })} type="button">Save</button></div>
      </Section>
      <Section icon={Weight} title="Log Weight">
        <div className="inline-form"><input className="input" onChange={(event) => setWeightInput(event.target.value)} placeholder="e.g. 72.5" type="number" value={weightInput} /><button className="primary-button" onClick={logWeight} type="button">Log</button></div>
        <div className="history-list compact">{weightEntries.slice(0, 5).map(([dateString, weight]) => <div key={dateString}><span>{formatDate(dateString)}</span><strong>{weight}kg</strong></div>)}</div>
      </Section>
      <Section icon={Tag} title="Workout Tags">
        <div className="chip-row">{(data.customTags || []).map((tagName) => <span className="tag-token" key={tagName}>{tagName}<button aria-label={`Remove ${tagName}`} onClick={() => updateData({ customTags: data.customTags.filter((item) => item !== tagName) })} type="button"><Trash2 size={14} /></button></span>)}</div>
        <div className="inline-form"><input className="input" onChange={(event) => setNewTag(event.target.value)} placeholder="e.g. Chest Day" value={newTag} /><button className="primary-button icon-label" onClick={() => {
          const trimmed = newTag.trim();
          if (!trimmed) return;
          updateData({ customTags: [...(data.customTags || []), trimmed] });
          setNewTag("");
        }} type="button"><Plus size={16} />Add</button></div>
      </Section>
      <Section icon={Cloud} title="Google Sheets Sync" action={<span className={scriptUrl ? "status-pill good" : "status-pill"}>{scriptUrl ? "Connected" : "Offline"}</span>}>
        <button className="secondary-button" onClick={() => { setUrlInput(scriptUrl); setShowUrlModal(true); }} type="button">{scriptUrl ? "Update URL" : "Connect Sheet"}</button>
        {scriptUrl && <button className="text-button icon-label" onClick={() => setShowSyncModal(true)} type="button"><RotateCw size={15} />Manual Sync</button>}
      </Section>
    </>
  );
}
