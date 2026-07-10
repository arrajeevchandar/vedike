import Link from "next/link";
import Image from "next/image";
import { formatDateRange } from "@/lib/domain";
import type { PublicCompetition, PublicEvent, PublicSubmission } from "@/lib/types";
import { StatusBadge } from "./status-badge";
import styles from "./cards.module.css";

export function EventCard({event}:{event:PublicEvent}){return <Link href={`/events/${event.slug}`} className={`${styles.card} glass rise`}><Visual banner={event.banner} url={event.bannerUrl} glyph={event.glyph}/><div className={styles.body}><StatusBadge status={event.status}/><h2>{event.title}</h2><p>{event.description}</p><div className={styles.meta}><span>{formatDateRange(event.startsAt,event.endsAt)}</span><span>{event.competitionCount} competitions</span></div></div></Link>}
export function CompetitionCard({competition}:{competition:PublicCompetition}){return <Link href={`/competitions/${competition.slug}`} className={`${styles.card} glass rise`}><Visual banner={competition.banner} url={competition.bannerUrl} glyph={competition.glyph}/><div className={styles.body}><StatusBadge status={competition.status}/><h2>{competition.title}</h2><small>{competition.eventTitle}</small><p>{competition.description}</p><div className={styles.meta}><span>{competition.submissionCount} entries</span><span>{competition.voteCount.toLocaleString("en-IN")} votes</span></div></div></Link>}
export function SubmissionCard({submission,children}:{submission:PublicSubmission;children?:React.ReactNode}){return <article className={`${styles.submission} glass`}><Visual banner={submission.tile} url={submission.imageUrl} glyph={submission.glyph}/><div className={styles.body}><div className={styles.voteCount}>▲ {submission.voteCount.toLocaleString("en-IN")}</div><h3>{submission.name}</h3><p>{submission.description}</p>{children}</div></article>}
function Visual({banner,url,glyph}:{banner:string;url?:string|null;glyph:string}){return <div className={styles.visual} style={{background:banner}}>{url?<Image src={url} alt="" fill sizes="(max-width: 760px) 100vw, 33vw" style={{objectFit:"cover"}}/>:<span className="kannada">{glyph}</span>}</div>}
