"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrandLoader, BrandLogo } from "@/components/brand/brand-logo";
import styles from "./site-splash.module.css";

const SPLASH_COOKIE = "savitri_foundation_splash_seen";
const SPLASH_DURATION = 2600;
const EXIT_DURATION = 760;

export function SiteSplash({ initialVisible }: { initialVisible: boolean }) {
  const [visible, setVisible] = useState(initialVisible);
  const [leaving, setLeaving] = useState(false);
  const completed = useRef(false);

  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    setLeaving(true);
    window.setTimeout(() => {
      document.cookie = `${SPLASH_COOKIE}=1; Path=/; SameSite=Lax`;
      setVisible(false);
    }, EXIT_DURATION);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(finish, reducedMotion ? 300 : SPLASH_DURATION);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [finish, visible]);

  if (!visible) return null;

  return (
    <section
      className={`${styles.splash} ${leaving ? styles.leaving : ""}`}
      aria-label="Savitri Foundation opening screen"
      aria-live="polite"
    >
      <div className={styles.aura} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.rangoli} aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      <div className={styles.content}>
        <div className={styles.eyebrow}><span />A cultural digital stage</div>
        <p className={styles.creation}>SRI <span className="kannada">ವಸುದಾ</span> CREATION</p>
        <BrandLogo size={94} className={styles.brandLockup} />
        <p className={styles.tagline}>Where culture meets community.</p>
        <div className={styles.loader}><BrandLoader mode="inline" label="Opening the stage" /></div>
        <button type="button" className={styles.skip} onClick={finish}>Skip intro</button>
      </div>
      <div className={styles.wipe} aria-hidden="true" />
    </section>
  );
}
