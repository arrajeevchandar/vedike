import type { CompetitionDetail, PublicCompetition, PublicEvent, PublicSubmission } from "@/lib/types";
import { rankSubmissions } from "@/lib/domain";

const grad = (a: string, b: string, c: string) => `linear-gradient(135deg,${a},${b} 55%,${c})`;

export const showcaseEvents: PublicEvent[] = [
  { id: "11111111-1111-4111-8111-111111111111", slug: "kannada-sangama-2026", title: "Kannada Sangama 2026", glyph: "ಸ", banner: grad("#3B0A12", "#7a1622", "#b8341f"), status: "showcase", startsAt: "2026-07-01T12:30:00.000Z", endsAt: "2026-07-20T15:30:00.000Z", description: "The flagship gathering of our Kannada community — three weeks of art, poetry, music and friendly rivalry.", competitionCount: 3, isShowcase: true },
  { id: "22222222-2222-4222-8222-222222222222", slug: "bengaluru-community-fest", title: "Bengaluru Community Fest", glyph: "ಬ", banner: grad("#241030", "#4A1E5C", "#7a2f8f"), status: "showcase", startsAt: "2026-06-28T11:30:00.000Z", endsAt: "2026-07-12T16:30:00.000Z", description: "Namma ooru, namma habba. A city-wide celebration of Bengaluru street culture, photography, food and folk performance.", competitionCount: 2, isShowcase: true },
  { id: "33333333-3333-4333-8333-333333333333", slug: "namma-habba-night", title: "Namma Habba Night", glyph: "ಹ", banner: grad("#33150a", "#8a3d0f", "#d9761c"), status: "showcase", startsAt: "2026-08-15T13:00:00.000Z", endsAt: "2026-08-15T19:30:00.000Z", description: "One electric night of music, mimicry and lamps on the lawn for the young and the young-at-heart.", competitionCount: 1, isShowcase: true },
  { id: "44444444-4444-4444-8444-444444444444", slug: "rajyotsava-celebration", title: "Rajyotsava Celebration", glyph: "ರ", banner: grad("#3a0d12", "#a3121b", "#e8b90f"), status: "showcase", startsAt: "2026-11-01T03:30:00.000Z", endsAt: "2026-11-03T15:30:00.000Z", description: "Flag hoisting, kavana recitals, storytelling and the grand red-and-yellow procession.", competitionCount: 1, isShowcase: true },
  { id: "55555555-5555-4555-8555-555555555555", slug: "ugadi-utsava", title: "Ugadi Utsava", glyph: "ಉ", banner: grad("#12240f", "#2e5a1e", "#59C265"), status: "showcase", startsAt: "2026-03-19T03:30:00.000Z", endsAt: "2026-03-22T15:30:00.000Z", description: "A new-year festival with bevu-bella, obbattu contests and fancy dress for the little ones.", competitionCount: 1, isShowcase: true },
];

const competitionBase: Omit<PublicCompetition, "submissionCount" | "voteCount">[] = [
  { id: "a1111111-1111-4111-8111-111111111111", eventId: showcaseEvents[0].id, eventSlug: showcaseEvents[0].slug, eventTitle: showcaseEvents[0].title, slug: "rangoli-art-challenge", title: "Rangoli Art Challenge", glyph: "ರ", banner: grad("#3B0A12", "#8a1b2a", "#E63946"), status: "showcase", startsAt: "2026-07-02T03:30:00.000Z", endsAt: "2026-07-18T12:30:00.000Z", description: "Chalk, colour and geometry — recreate tradition or invent your own pattern language.", rules: ["One original rangoli per participant.", "Natural light photography only.", "Traditional or contemporary patterns welcome.", "Community voting decides the winners."], maxEntriesPerParticipant: 1, isShowcase: true },
  { id: "a2222222-2222-4222-8222-222222222222", eventId: showcaseEvents[0].id, eventSlug: showcaseEvents[0].slug, eventTitle: showcaseEvents[0].title, slug: "kannada-poetry-recital", title: "Kannada Poetry Recital", glyph: "ಕ", banner: grad("#33150a", "#7a3d12", "#FF8A00"), status: "showcase", startsAt: "2026-07-03T04:30:00.000Z", endsAt: "2026-07-15T14:30:00.000Z", description: "From Kuvempu to your own kavana — recite, record and move the sabha.", rules: ["Recitals must be in Kannada.", "Three minutes maximum.", "One entry per participant."], maxEntriesPerParticipant: 1, isShowcase: true },
  { id: "a3333333-3333-4333-8333-333333333333", eventId: showcaseEvents[0].id, eventSlug: showcaseEvents[0].slug, eventTitle: showcaseEvents[0].title, slug: "singing-competition", title: "Singing Competition", glyph: "ಗ", banner: grad("#241030", "#5b1a4d", "#9A4DFF"), status: "showcase", startsAt: "2026-07-10T11:30:00.000Z", endsAt: "2026-07-19T15:30:00.000Z", description: "Film hits, bhavageete or janapada — pick your song and own the stage.", rules: ["Solo performances only.", "Four minutes maximum."], maxEntriesPerParticipant: 1, isShowcase: true },
  { id: "a4444444-4444-4444-8444-444444444444", eventId: showcaseEvents[1].id, eventSlug: showcaseEvents[1].slug, eventTitle: showcaseEvents[1].title, slug: "photography-contest", title: "Photography Contest", glyph: "ಚ", banner: grad("#0f1c2e", "#1d3a5f", "#3a6ea5"), status: "showcase", startsAt: "2026-06-29T02:30:00.000Z", endsAt: "2026-07-11T16:30:00.000Z", description: "One frame that says Bengaluru: streets, trees, chai, metro and rain.", rules: ["One photograph per participant.", "No composites.", "Add a caption and location."], maxEntriesPerParticipant: 1, isShowcase: true },
  { id: "a5555555-5555-4555-8555-555555555555", eventId: showcaseEvents[1].id, eventSlug: showcaseEvents[1].slug, eventTitle: showcaseEvents[1].title, slug: "folk-dance-showcase", title: "Folk Dance Showcase", glyph: "ನ", banner: grad("#3a0d12", "#94261b", "#e8b90f"), status: "showcase", startsAt: "2026-06-30T11:30:00.000Z", endsAt: "2026-07-12T15:30:00.000Z", description: "Dollu Kunitha, Kamsale, Kolata and more — tradition on full display.", rules: ["Solo or group entries.", "Costume and props encouraged."], maxEntriesPerParticipant: 1, isShowcase: true },
  { id: "a6666666-6666-4666-8666-666666666666", eventId: showcaseEvents[2].id, eventSlug: showcaseEvents[2].slug, eventTitle: showcaseEvents[2].title, slug: "mimicry-mania", title: "Mimicry Mania", glyph: "ಮ", banner: grad("#2a1305", "#8a4510", "#FF8A00"), status: "showcase", startsAt: "2026-08-15T13:30:00.000Z", endsAt: "2026-08-15T18:30:00.000Z", description: "Voices, characters and pure Bengaluru timing on one stage.", rules: ["Five minutes maximum.", "Keep the performance community friendly."], maxEntriesPerParticipant: 1, isShowcase: true },
  { id: "a7777777-7777-4777-8777-777777777777", eventId: showcaseEvents[3].id, eventSlug: showcaseEvents[3].slug, eventTitle: showcaseEvents[3].title, slug: "storytelling-contest", title: "Storytelling Contest", glyph: "ತ", banner: grad("#33150a", "#6e3a10", "#c98a1a"), status: "showcase", startsAt: "2026-11-01T04:30:00.000Z", endsAt: "2026-11-03T12:30:00.000Z", description: "Folk tales, grandmother stories or your own — five minutes to hold the room.", rules: ["Stories in Kannada or English about Karnataka.", "Open to all ages."], maxEntriesPerParticipant: 1, isShowcase: true },
  { id: "a8888888-8888-4888-8888-888888888888", eventId: showcaseEvents[4].id, eventSlug: showcaseEvents[4].slug, eventTitle: showcaseEvents[4].title, slug: "traditional-cooking-contest", title: "Traditional Cooking Contest", glyph: "ಅ", banner: grad("#12240f", "#3d6b23", "#7fb03a"), status: "showcase", startsAt: "2026-03-19T04:30:00.000Z", endsAt: "2026-03-21T12:30:00.000Z", description: "Obbattu, kosambari and tambuli — the classics, judged by the community.", rules: ["One traditional dish.", "Photo plus a short recipe note."], maxEntriesPerParticipant: 1, isShowcase: true },
];

const names = ["Ananya Hegde", "Bhoomika Patil", "Deeksha Rao", "Chaitra Shastri", "Divya Angadi", "Meghana Bhat", "Raghav Joshi", "Pallavi Urs", "Vinay Achar", "Tejas Hiremath", "Kiran Shetty", "Sandeep Naik", "Sneha Kamath", "Nithin Byregowda", "Harsha Devadiga", "Shruthi Nayak", "Prajwal Gowda", "Anusha Kotian", "Manoj Kulkarni", "Lakshmi Bhagwat", "Girija Hebbar", "Sowmya Adiga", "Ramesh Pai", "Veena Kulal", "Aarav Gowda", "Ira Shetty", "Dhruva Rao", "Myra Hegde"];
const descriptions = ["A peacock-lotus mandala in nine colours, drawn at dawn.", "A freehand Mysuru-style pattern with marigold borders.", "A geometric chukki design built from a dot grid.", "A Hampi-inspired entry made over four patient hours.", "An eco-friendly piece made with petals and leaves.", "A family pattern passed down through generations."];
const tiles = [grad("#3B0A12", "#8a1b2a", "#E63946"), grad("#241030", "#5b1a4d", "#9A4DFF"), grad("#0f1c2e", "#1d3a5f", "#3a6ea5"), grad("#12240f", "#3d6b23", "#59C265")];
const glyphs = ["ಕ", "ನ", "ಡ", "ವ", "ಉ", "ಹ", "ಸ", "ಬ"];
const compAssignments = [0,0,0,0,0,0,1,1,1,1,3,3,3,3,3,4,4,4,4,7,7,7,7,7,7,7,7,7];
const votes = [214,189,167,142,98,71,156,134,88,64,203,181,149,122,95,176,158,121,87,342,298,251,190,143,288,246,205,152];

export const showcaseSubmissions: PublicSubmission[] = names.map((name, index) => ({
  id: `b${String(index + 1).padStart(7, "0")}-0000-4000-8000-000000000000`,
  competitionId: competitionBase[compAssignments[index]].id,
  name,
  description: descriptions[index % descriptions.length],
  tile: tiles[index % tiles.length],
  glyph: glyphs[index % glyphs.length],
  voteCount: votes[index],
  createdAt: new Date(Date.UTC(2026, 6, 1 + (index % 8), 10, 0)).toISOString(),
}));

export const showcaseCompetitions: PublicCompetition[] = competitionBase.map((competition) => {
  const rows = showcaseSubmissions.filter((s) => s.competitionId === competition.id);
  return { ...competition, submissionCount: rows.length, voteCount: rows.reduce((sum, row) => sum + row.voteCount, 0) };
});

export function getShowcaseCompetition(slug: string): CompetitionDetail | null {
  const competition = showcaseCompetitions.find((item) => item.slug === slug);
  if (!competition) return null;
  const submissions = showcaseSubmissions.filter((item) => item.competitionId === competition.id);
  const sorted = rankSubmissions(submissions);
  const max = Math.max(1, ...sorted.map((item) => item.voteCount));
  return {
    ...competition,
    submissions,
    leaderboard: sorted.map((item, index) => ({ ...item, rank: index + 1, percentage: Math.round((item.voteCount / max) * 100) })),
    winners: sorted.slice(0, 3).map((item, index) => ({ ...item, rank: index + 1, voteCountSnapshot: item.voteCount })),
  };
}
