import { getCompetition } from "@/lib/data";
export async function GET(_:Request,{params}:{params:Promise<{slug:string}>}){const {slug}=await params;const competition=await getCompetition(slug);if(!competition)return Response.json({error:"Not found"},{status:404});return Response.json({rows:competition.leaderboard},{headers:{"Cache-Control":"no-store"}})}
