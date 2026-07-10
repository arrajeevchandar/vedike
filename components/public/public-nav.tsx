"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./public-nav.module.css";

export function PublicNav({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  return <nav className={`${styles.nav} ${overlay ? styles.overlay : ""}`} aria-label="Primary navigation">
    <Link href="/" className={styles.brand}><span className="kannada">ವೇ</span><strong className="display">VEDIKE</strong></Link>
    <button className={styles.menuButton} onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="public-menu">{open ? "Close" : "Menu"}</button>
    <div id="public-menu" className={`${styles.links} ${open ? styles.open : ""}`}>
      <Link href="/">Home</Link><Link href="/events">Events</Link><Link href="/competitions">Competitions</Link><Link href="/leaderboard">Leaderboard</Link><Link href="/admin/login" className={styles.admin}>Admin Login</Link>
    </div>
  </nav>;
}
