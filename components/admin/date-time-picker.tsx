"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addIstMinutes, formatIstInput, istInputToMinute, minuteToIstInput, utcToIstInput } from "@/lib/admin-schedule";
import styles from "./date-time-picker.module.css";

type DateTimePickerProps = {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (value: number) => String(value).padStart(2, "0");

function clamp(value: string, min?: string, max?: string) {
  const current = istInputToMinute(value);
  const minimum = min ? istInputToMinute(min) : null;
  const maximum = max ? istInputToMinute(max) : null;
  if (current === null) return min && minimum !== null ? min : value;
  if (minimum !== null && current < minimum) return minuteToIstInput(minimum);
  if (maximum !== null && current > maximum) return minuteToIstInput(maximum);
  return value;
}

function dateValue(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function DateTimePicker({
  name,
  label,
  value,
  onChange,
  min,
  max,
  hint,
  error,
  required,
  disabled,
}: DateTimePickerProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [view, setView] = useState({ year: 2026, month: 0 });

  const openPicker = () => {
    const now = utcToIstInput(new Date());
    const initial = clamp(value || min || now, min, max);
    const minute = istInputToMinute(initial) ?? istInputToMinute(now)!;
    const date = new Date(minute * 60_000);
    setDraft(initial);
    setView({ year: date.getUTCFullYear(), month: date.getUTCMonth() });
    setOpen(true);
  };

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  const days = useMemo(() => {
    const first = new Date(Date.UTC(view.year, view.month, 1));
    const gridStart = new Date(first);
    gridStart.setUTCDate(1 - first.getUTCDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setUTCDate(gridStart.getUTCDate() + index);
      return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
    });
  }, [view]);

  const dayEnabled = (date: string) => {
    const start = istInputToMinute(`${date}T00:00`)!;
    const end = istInputToMinute(`${date}T23:59`)!;
    const minimum = min ? istInputToMinute(min) : null;
    const maximum = max ? istInputToMinute(max) : null;
    return (minimum === null || end >= minimum) && (maximum === null || start <= maximum);
  };

  const chooseDay = (date: string) => {
    const time = draft.slice(11) || "00:00";
    setDraft(clamp(`${date}T${time}`, min, max));
  };

  const moveDay = (amount: number, target: HTMLButtonElement) => {
    const current = `${target.dataset.date}T${draft.slice(11) || "00:00"}`;
    const moved = addIstMinutes(current, amount * 24 * 60);
    if (!dayEnabled(moved.slice(0, 10))) return;
    chooseDay(moved.slice(0, 10));
    const minute = istInputToMinute(moved)!;
    const date = new Date(minute * 60_000);
    setView({ year: date.getUTCFullYear(), month: date.getUTCMonth() });
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-date="${moved.slice(0, 10)}"]`)?.focus();
    });
  };

  const moveMonth = (amount: number, target: HTMLButtonElement) => {
    const current = new Date(`${target.dataset.date}T00:00:00Z`);
    const wantedDay = current.getUTCDate();
    const destination = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + amount, 1));
    const lastDay = new Date(Date.UTC(destination.getUTCFullYear(), destination.getUTCMonth() + 1, 0)).getUTCDate();
    destination.setUTCDate(Math.min(wantedDay, lastDay));
    const moved = dateValue(destination.getUTCFullYear(), destination.getUTCMonth(), destination.getUTCDate());
    if (!dayEnabled(moved)) return;
    chooseDay(moved);
    setView({ year: destination.getUTCFullYear(), month: destination.getUTCMonth() });
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-date="${moved}"]`)?.focus());
  };

  const setTimePart = (part: "hour" | "minute", next: string) => {
    const date = draft.slice(0, 10);
    const [hour = "00", minute = "00"] = (draft.slice(11) || "00:00").split(":");
    setDraft(clamp(`${date}T${part === "hour" ? next : hour}:${part === "minute" ? next : minute}`, min, max));
  };

  const selectedDate = draft.slice(0, 10);
  const today = utcToIstInput(new Date()).slice(0, 10);
  const [draftHour = "00", draftMinute = "00"] = (draft.slice(11) || "00:00").split(":");
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const timeAllowed = (hour: string, minute: string) => {
    const candidate = istInputToMinute(`${selectedDate}T${hour}:${minute}`);
    const minimum = min ? istInputToMinute(min) : null;
    const maximum = max ? istInputToMinute(max) : null;
    return candidate !== null && (minimum === null || candidate >= minimum) && (maximum === null || candidate <= maximum);
  };
  const hourAllowed = (hour: string) => Array.from({ length: 60 }, (_, minute) => pad(minute)).some((minute) => timeAllowed(hour, minute));

  return (
    <div className={styles.root}>
      <label className="form-label" id={`${id}-label`}>{label}</label>
      <input type="hidden" name={name} value={value} required={required} />
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={styles.trigger}
        aria-labelledby={`${id}-label ${id}`}
        aria-describedby={describedBy}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={openPicker}
      >
        <span className={value ? undefined : styles.placeholder}>{formatIstInput(value)}</span>
        <svg className={styles.calendarIcon} width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 2v3m10-3v3M3.5 9.5h17M5.5 4h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
      </button>
      {error ? <p id={`${id}-error`} className={styles.error} role="alert">{error}</p> : hint ? <p id={`${id}-hint`} className={styles.hint}>{hint}</p> : null}
      {open && createPortal(
        <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-dialog-title`}>
            <div className={styles.topline}>
              <div><p className={styles.eyebrow}>India Standard Time</p><h2 className={styles.title} id={`${id}-dialog-title`}>{label}</h2></div>
              <button ref={closeRef} className={styles.close} type="button" onClick={close} aria-label="Close date picker">×</button>
            </div>
            <div className={styles.monthHeader}>
              <button className={styles.monthButton} type="button" aria-label="Previous month" onClick={() => setView(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })}>‹</button>
              <div className={styles.monthName}>{new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(view.year, view.month)))}</div>
              <button className={styles.monthButton} type="button" aria-label="Next month" onClick={() => setView(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })}>›</button>
            </div>
            <div className={styles.weekdays} aria-hidden="true">{weekdays.map((day) => <div className={styles.weekday} key={day}>{day.slice(0, 2)}</div>)}</div>
            <div className={styles.grid} role="grid" aria-label="Calendar">
              {days.map((item) => {
                const date = dateValue(item.year, item.month, item.day);
                const enabled = dayEnabled(date);
                const className = [styles.day, item.month !== view.month ? styles.outside : "", date === today ? styles.today : "", date === selectedDate ? styles.selected : ""].filter(Boolean).join(" ");
                return <button key={date} type="button" role="gridcell" data-date={date} disabled={!enabled} aria-selected={date === selectedDate} aria-label={new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`))} className={className} onClick={() => chooseDay(date)} onKeyDown={(event) => {
                  const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
                  if (event.key in moves) { event.preventDefault(); moveDay(moves[event.key], event.currentTarget); }
                  if (event.key === "Home") { event.preventDefault(); moveDay(-new Date(`${date}T00:00:00Z`).getUTCDay(), event.currentTarget); }
                  if (event.key === "End") { event.preventDefault(); moveDay(6 - new Date(`${date}T00:00:00Z`).getUTCDay(), event.currentTarget); }
                  if (event.key === "PageUp") { event.preventDefault(); moveMonth(event.shiftKey ? -12 : -1, event.currentTarget); }
                  if (event.key === "PageDown") { event.preventDefault(); moveMonth(event.shiftKey ? 12 : 1, event.currentTarget); }
                }}>{item.day}</button>;
              })}
            </div>
            <div className={styles.timeArea}>
              <label className={styles.timeLabel} htmlFor={`${id}-hour`}>24-hour time</label>
              <div className={styles.timeRow}>
                <select className={styles.select} id={`${id}-hour`} aria-label="Hour" value={draftHour} onChange={(event) => setTimePart("hour", event.target.value)}>{Array.from({ length: 24 }, (_, hour) => <option value={pad(hour)} key={hour} disabled={!hourAllowed(pad(hour))}>{pad(hour)}</option>)}</select>
                <span className={styles.colon}>:</span>
                <select className={styles.select} aria-label="Minute" value={draftMinute} onChange={(event) => setTimePart("minute", event.target.value)}>{Array.from({ length: 60 }, (_, minute) => <option value={pad(minute)} key={minute} disabled={!timeAllowed(draftHour, pad(minute))}>{pad(minute)}</option>)}</select>
              </div>
              <p className={styles.summary}>{formatIstInput(draft)}</p>
            </div>
            <div className={styles.actions}>
              <button className={styles.clear} type="button" onClick={() => { onChange(""); close(); }}>Clear</button>
              <button className={styles.confirm} type="button" onClick={() => { onChange(clamp(draft, min, max)); close(); }}>Set date &amp; time</button>
            </div>
          </section>
        </div>, document.body)}
    </div>
  );
}
