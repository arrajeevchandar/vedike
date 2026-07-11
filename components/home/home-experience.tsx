"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { createVedikeScene } from "./three-scene";
import styles from "./home.module.css";

const chapters = [
  {
    kicker: "ನಮಸ್ಕಾರ ಬೆಂಗಳೂರು",
    title: <><span data-word>Where</span> <span data-word>Culture</span> <span data-word className={styles.shimmer}>Meets</span> <span data-word>Community</span></>,
    copy: "A modern digital space for Kannada communities to celebrate, compete, participate, and vote together.",
  },
  {
    kicker: "ಕರ್ನಾಟಕ",
    title: <><span data-word>Rooted</span> <span data-word>in</span> <span data-word className={styles.gold}>Pride</span></>,
    copy: "Inspired by the spirit of Karnataka, built for today’s connected communities.",
  },
  {
    kicker: "ನಮ್ಮ ಬೆಂಗಳೂರು",
    title: <><span data-word>Namma</span> <span data-word className={styles.neon}>Bengaluru</span> <span data-word>Energy</span></>,
    copy: "From cultural gatherings to friendly competitions, every celebration gets a digital stage.",
  },
  {
    kicker: "ಉತ್ಸವ",
    title: <><span data-word>Every</span> <span data-word>Event</span> <span data-word>Has</span> <span data-word>a</span> <span data-word className={styles.orange}>Stage</span></>,
    copy: "Create events, host competitions, collect submissions, and let the community vote.",
  },
];

function HomeNavigation() {
  return (
    <nav className={styles.nav} aria-label="Primary navigation">
      <Link href="/" className={styles.brand}><span className="kannada">ವೇ</span><strong>VEDIKE</strong></Link>
      <div className={styles.navLinks}>
        <Link href="/events">Events</Link>
        <Link href="/leaderboard">Leaderboard</Link>
        <Link href="/admin/login" className={styles.adminLink}>Admin Login</Link>
      </div>
    </nav>
  );
}

export function HomeExperience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const runwayRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLElement>(null);
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const runway = runwayRef.current;
    const reveal = revealRef.current;
    if (!root || !canvas || !runway || !reveal) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = reduced ? null : createVedikeScene(canvas, { density: 1, drift: true });
    let dead = false;
    let frame = 0;
    const introStart = performance.now();
    const chapterWindows = [[0, 0.2], [0.22, 0.44], [0.46, 0.64], [0.66, 0.86]] as const;
    const clampSegment = (value: number, start: number, end: number) => Math.min(1, Math.max(0, (value - start) / (end - start)));

    const loop = () => {
      if (dead) return;
      frame = requestAnimationFrame(loop);
      const viewport = window.innerHeight;
      const runwayHeight = Math.max(1, runway.offsetHeight - viewport);
      const scrollY = window.scrollY;
      const progress = Math.min(1, Math.max(0, scrollY / runwayHeight));
      scene?.setProgress(progress);
      canvas.style.opacity = String(1 - Math.min(1, Math.max(0, (scrollY - runwayHeight) / (viewport * 0.7))) * 0.92);
      const introProgress = Math.min(1, (performance.now() - introStart) / 2200);

      chapterWindows.forEach(([start, end], chapterIndex) => {
        const element = chapterRefs.current[chapterIndex];
        if (!element) return;
        const fadeIn = chapterIndex === 0 ? 1 : clampSegment(progress, start, start + 0.05);
        const fadeOut = 1 - clampSegment(progress, end - 0.05, end);
        const opacity = Math.min(fadeIn, fadeOut);
        element.style.opacity = String(opacity);
        element.style.transform = `translateY(${(1 - fadeIn) * 40 - (1 - fadeOut) * 30}px)`;
        element.style.visibility = opacity <= 0.01 ? "hidden" : "visible";
        element.querySelectorAll<HTMLElement>("[data-word]").forEach((word, wordIndex) => {
          const wordProgress = chapterIndex === 0
            ? clampSegment(introProgress, wordIndex * 0.1, 0.35 + wordIndex * 0.1)
            : clampSegment(clampSegment(progress, start, start + 0.1), 0.1 + wordIndex * 0.09, 0.45 + wordIndex * 0.09);
          word.style.opacity = String(wordProgress);
          word.style.transform = `translateY(${(1 - wordProgress) * 22}px)`;
        });
      });
    };
    loop();
    return () => {
      dead = true;
      cancelAnimationFrame(frame);
      scene?.dispose();
    };
  }, []);

  const magnet = (event: React.MouseEvent<HTMLElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    element.style.transition = "transform .12s ease-out";
    element.style.transform = `translate(${(event.clientX - (rect.left + rect.width / 2)) * 0.18}px,${(event.clientY - (rect.top + rect.height / 2)) * 0.3}px)`;
  };
  const magnetLeave = (event: React.MouseEvent<HTMLElement>) => {
    event.currentTarget.style.transition = "transform .4s cubic-bezier(.2,1.4,.4,1)";
    event.currentTarget.style.transform = "translate(0,0)";
  };

  return (
    <div ref={rootRef} className={styles.home}>
      <div ref={canvasRef} className={styles.canvas} data-home-canvas aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />
      <HomeNavigation />
      <div ref={runwayRef} className={styles.runway} data-home-runway>
        {chapters.map((chapter, index) => {
          const ChapterTag = index === 0 ? "h1" : "h2";
          return (
            <section
              key={chapter.kicker}
              ref={(element) => { chapterRefs.current[index] = element; }}
              data-home-chapter={index}
              style={index === 0 ? { opacity: 1, visibility: "visible" } : undefined}
              className={`${styles.chapter} ${index === 1 || index === 3 ? styles.bottom : ""} ${index === 2 ? styles.left : ""}`}
            >
              <div className={`kannada ${styles.kicker}`}>{chapter.kicker}</div>
              <ChapterTag className="display">{chapter.title}</ChapterTag>
              <p data-word>{chapter.copy}</p>
              {index === 0 && <>
                <div data-word className={styles.ctas}>
                  <Link href="/events" onMouseMove={magnet} onMouseLeave={magnetLeave} className={styles.primary}>Explore Events</Link>
                  <Link href="/events" onMouseMove={magnet} onMouseLeave={magnetLeave} className={styles.secondary}>Join the Celebration</Link>
                </div>
                <div className={styles.scroll}><span>Scroll to travel</span><i /></div>
              </>}
            </section>
          );
        })}
      </div>

      <section ref={revealRef} className={styles.reveal}>
        <div className={styles.revealInner}>
          <div className={styles.revealBadge}><span />The Celebration Reveal</div>
          <h2 className="display">Your Community,<br /><span>Now Online</span></h2>
          <p>A modern platform for Kannada community events, competitions, submissions, voting, and winner reveals.</p>
          <div className={styles.revealCtas}>
            <Link href="/events" onMouseMove={magnet} onMouseLeave={magnetLeave} className={styles.primary}>View Events</Link>
            <Link href="/admin/login" onMouseMove={magnet} onMouseLeave={magnetLeave} className={styles.secondary}>Admin Login</Link>
          </div>
          <div className={styles.collage}>
            <div className={styles.confetti} aria-hidden="true"><i /><i /><i /><i /><i /></div>
            <article className={`${styles.previewCard} ${styles.eventPreview}`}>
              <div className={styles.eventBanner}><span className="kannada">ಸ</span><b>● LIVE</b></div>
              <div><strong>Kannada Sangama 2026</strong><small>Jul 1 – Jul 20 · 3 competitions</small><em>View Event →</em></div>
            </article>
            <article className={`${styles.previewCard} ${styles.votePreview}`}>
              <label>Cast Your Vote</label><div><span className="kannada">ರ</span><p><b>Ananya Hegde</b><small>Rangoli Art Challenge</small></p></div><i /><i /><button>Pay ₹2 &amp; Vote</button>
            </article>
            <article className={`${styles.previewCard} ${styles.podiumPreview}`}>
              <label>Winner Reveal</label><div><span>🥈<i /></span><span>👑<i /></span><span>🥉<i /></span></div>
            </article>
            <article className={`${styles.previewCard} ${styles.adminPreview}`}>
              <label>Admin Dashboard</label><div className={styles.stats}><span><b>1,284</b><small>Total votes</small></span><span><b>₹2,568</b><small>Revenue</small></span></div><div className={styles.chart}><i /><i /><i /><i /><i /></div>
            </article>
          </div>
        </div>
        <footer className={styles.footer}>
          <div><span className="kannada">ವೇ</span><b>VEDIKE</b><small>Namma stage. Namma pride.</small></div>
          <nav><Link href="/events">Events</Link><Link href="/leaderboard">Leaderboard</Link><Link href="/admin/login">Admin</Link></nav>
        </footer>
      </section>
    </div>
  );
}
