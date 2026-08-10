import { useId } from "react";
import styles from "./brand-logo.module.css";

type BrandVariant = "lockup" | "mark" | "pulse";

type BrandLogoProps = {
  variant?: BrandVariant;
  size?: number;
  className?: string;
  decorative?: boolean;
  hideWordmarkOnMobile?: boolean;
  label?: string;
};

export function BrandLogo({
  variant = "lockup",
  size = 42,
  className = "",
  decorative = false,
  hideWordmarkOnMobile = false,
  label = "Savitri Foundation",
}: BrandLogoProps) {
  const gradientId = useId().replaceAll(":", "");
  const flameId = useId().replaceAll(":", "");
  const classes = [
    styles.logo,
    styles[variant],
    hideWordmarkOnMobile ? styles.mobileMarkOnly : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <span
      className={classes}
      style={{ "--brand-mark-size": `${size}px` } as React.CSSProperties}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    >
      <span className={styles.mark}>
        <svg viewBox="0 0 180 200" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id={gradientId} x1="12%" y1="8%" x2="88%" y2="92%">
              <stop className={styles.flowGold} offset="0" stopColor="#f2b705" />
              <stop className={styles.flowOrange} offset="0.56" stopColor="#ff8a00" />
              <stop className={styles.flowRed} offset="1" stopColor="#e63946" />
            </linearGradient>
            <linearGradient id={flameId} x1="50%" y1="0" x2="50%" y2="100%">
              <stop offset="0" stopColor="#fff3dc" />
              <stop offset="0.38" stopColor="#f2b705" />
              <stop offset="1" stopColor="#ff8a00" />
            </linearGradient>
          </defs>

          <g className={styles.aura} fill="none" stroke={`url(#${gradientId})`} strokeLinecap="round">
            <path d="M42 65C22 84 17 119 31 148" strokeWidth="7" />
            <path d="M138 65C158 84 163 119 149 148" strokeWidth="7" />
            <path d="M45 170C69 188 111 188 135 170" strokeWidth="7" />
          </g>

          <circle cx="31" cy="58" r="7" fill={`url(#${gradientId})`} />
          <circle cx="149" cy="154" r="7" fill={`url(#${gradientId})`} />
          <circle cx="90" cy="184" r="8" fill={`url(#${gradientId})`} />

          <path
            d="M90 5C77 24 70 38 75 52C78 61 84 68 91 73C87 57 90 43 98 31C110 43 111 56 106 69C120 61 126 48 122 35C118 21 104 10 90 5Z"
            fill={`url(#${flameId})`}
          />
          <path d="M97 38C91 47 88 55 91 63C93 68 96 72 99 75C105 66 108 58 105 51C103 45 100 41 97 38Z" fill="#e63946" />

          <text
            className={styles.glyph}
            x="90"
            y="139"
            fill={`url(#${gradientId})`}
            textAnchor="middle"
          >
            ಸ
          </text>

          <g className={styles.rangoli} fill={`url(#${gradientId})`}>
            <path d="M53 159C62 151 72 151 80 159C72 167 62 167 53 159Z" />
            <path d="M100 159C108 151 118 151 127 159C118 167 108 167 100 159Z" />
            <path d="M81 168C87 158 93 158 99 168C93 177 87 177 81 168Z" />
          </g>
        </svg>
      </span>

      {variant === "lockup" ? (
        <span className={styles.wordmark} aria-hidden="true">
          <strong>SAVITRI</strong>
          <small>FOUNDATION</small>
        </span>
      ) : null}
    </span>
  );
}

export function BrandLoader({
  label = "Preparing the stage",
  mode = "page",
}: {
  label?: string;
  mode?: "page" | "inline";
}) {
  return (
    <span className={`${styles.loader} ${styles[`${mode}Loader`]}`} role="status" aria-live="polite">
      <span className={styles.loaderMark}>
        <BrandLogo variant="mark" size={mode === "page" ? 66 : 18} decorative />
      </span>
      <span className={styles.loaderLabel}>{label}</span>
    </span>
  );
}
