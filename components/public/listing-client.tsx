"use client";
import { useMemo, useState } from "react";
import type { PublicCompetition, PublicEvent } from "@/lib/types";
import { CompetitionCard, EventCard } from "./cards";

type Item = PublicEvent | PublicCompetition;
export function ListingClient({kind,items}:{kind:"events"|"competitions";items:Item[]}){
  const [filter,setFilter]=useState("all"),[search,setSearch]=useState("");
  const filtered=useMemo(()=>items.filter(item=>(filter==="all"||item.status===filter||filter==="showcase"&&item.isShowcase)&&(item.title+" "+item.description).toLowerCase().includes(search.toLowerCase())),[items,filter,search]);
  return <><div style={{display:"flex",gap:12,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",margin:"26px 0 30px"}}><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["all","live","upcoming","ended","showcase"].map(key=><button key={key} className={`btn ${filter===key?"btn-primary":"btn-secondary"}`} style={{padding:"8px 15px",fontSize:12}} onClick={()=>setFilter(key)}>{key[0].toUpperCase()+key.slice(1)}</button>)}</div><input className="field" style={{maxWidth:280,borderRadius:999}} value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${kind}…`} aria-label={`Search ${kind}`}/></div>{filtered.length?<div className="card-grid">{filtered.map(item=>kind==="events"?<EventCard key={item.id} event={item as PublicEvent}/>:<CompetitionCard key={item.id} competition={item as PublicCompetition}/>)}</div>:<div className="empty">No {kind} match this view.</div>}</>
}
