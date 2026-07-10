"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PublicNav } from "@/components/public/public-nav";
import { createVedikeScene } from "./three-scene";
import styles from "./home.module.css";

const chapters=[
  {kicker:"ನಮಸ್ಕಾರ ಬೆಂಗಳೂರು",title:<><span>Where</span> <span>Culture</span> <span className={styles.shimmer}>Meets</span> <span>Community</span></>,copy:"A modern digital space for Kannada communities to celebrate, compete, participate, and vote together."},
  {kicker:"ಕರ್ನಾಟಕ",title:<><span>Rooted</span> <span>in</span> <span className={styles.gold}>Pride</span></>,copy:"Inspired by the spirit of Karnataka, built for today’s connected communities."},
  {kicker:"ನಮ್ಮ ಬೆಂಗಳೂರು",title:<><span>Namma</span> <span className={styles.neon}>Bengaluru</span> <span>Energy</span></>,copy:"From cultural gatherings to friendly competitions, every celebration gets a digital stage."},
  {kicker:"ಉತ್ಸವ",title:<><span>Every</span> <span>Event</span> <span>Has</span> <span>a</span> <span className={styles.orange}>Stage</span></>,copy:"Create events, host competitions, collect submissions, and let the community vote."},
];

export function HomeExperience(){
  const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLDivElement>(null),runway=useRef<HTMLDivElement>(null);
  useEffect(()=>{gsap.registerPlugin(ScrollTrigger);if(!canvas.current||!runway.current||!root.current)return;const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;const scene=reduced?null:createVedikeScene(canvas.current);const ctx=gsap.context(()=>{
    const chapterEls=gsap.utils.toArray<HTMLElement>(`.${styles.chapter}`);chapterEls.forEach((el,index)=>{const starts=[0,.22,.46,.66][index],ends=[.20,.44,.64,.86][index];gsap.set(el,{autoAlpha:index===0?1:0,y:index===0?0:35});if(index>0)gsap.to(el,{autoAlpha:1,y:0,duration:.12,scrollTrigger:{trigger:runway.current,start:`${starts*100}% top`,end:`${(starts+.05)*100}% top`,scrub:true}});gsap.to(el,{autoAlpha:0,y:-28,duration:.1,scrollTrigger:{trigger:runway.current,start:`${(ends-.05)*100}% top`,end:`${ends*100}% top`,scrub:true}});gsap.fromTo(el.querySelectorAll("h1 span,h2 span,p"),{opacity:index===0?0:0,y:22},{opacity:1,y:0,stagger:.08,duration:.65,delay:index===0?.15:0,scrollTrigger:index===0?undefined:{trigger:runway.current,start:`${starts*100}% top`,end:`${(starts+.12)*100}% top`,scrub:true}})});
    ScrollTrigger.create({trigger:runway.current,start:"top top",end:"bottom bottom",scrub:true,onUpdate:self=>scene?.setProgress(self.progress)});
  },root);return()=>{ctx.revert();scene?.dispose()}},[]);
  const magnet=(event:React.MouseEvent<HTMLElement>)=>{if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;const el=event.currentTarget,r=el.getBoundingClientRect();gsap.to(el,{x:(event.clientX-r.left-r.width/2)*.18,y:(event.clientY-r.top-r.height/2)*.28,duration:.25})};
  const reset=(event:React.MouseEvent<HTMLElement>)=>gsap.to(event.currentTarget,{x:0,y:0,duration:.55,ease:"elastic.out(1,.45)"});
  return <div ref={root} className={styles.home}><div ref={canvas} className={styles.canvas}/><div className={styles.vignette}/><PublicNav overlay/><div ref={runway} className={styles.runway}>
    {chapters.map((ch,index)=><section key={ch.kicker} className={`${styles.chapter} ${index===2?styles.left:""}`}><div className="kannada">{ch.kicker}</div>{index===0?<h1 className="display">{ch.title}</h1>:<h2 className="display">{ch.title}</h2>}<p>{ch.copy}</p>{index===0&&<><div className={styles.ctas}><Link className="btn btn-primary" href="/events" onMouseMove={magnet} onMouseLeave={reset}>Explore Events</Link><Link className="btn btn-secondary" href="/competitions" onMouseMove={magnet} onMouseLeave={reset}>Join the Celebration</Link></div><div className={styles.scroll}>Scroll to travel<span/></div></>}</section>)}
  </div><section className={styles.reveal}><div className="shell"><div className="eyebrow">● The Celebration Reveal</div><h2 className="display">Your Community,<br/><span className="gradient-text">Now Online</span></h2><p>A modern platform for Kannada community events, competitions, submissions, voting and winner reveals.</p><div className={styles.ctas}><Link href="/events" className="btn btn-primary">View Events</Link><Link href="/admin/login" className="btn btn-secondary">Admin Login</Link></div><div className={styles.collage}>{["Live Events","₹2 Community Vote","Winner Reveal","Admin Control"].map((label,i)=><div key={label} style={{"--r":`${i%2?2:-2}deg`} as React.CSSProperties} className="glass"><span className="kannada">{["ಉ","ಮ","ವ","ವೇ"][i]}</span><b className="display">{label}</b><small>{["Discover concurrent celebrations","One secure vote at a time","Top three, locked fairly","Events, entries and payments"][i]}</small></div>)}</div></div></section></div>;
}
