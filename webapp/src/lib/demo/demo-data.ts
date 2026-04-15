/**
 * All fake data for the demo mode — college admissions consulting theme.
 * When the fetch interceptor is active, these are served to real React components.
 */

export const DEMO_THREAD_ID = "00000000-demo-sarah-chen-thread";
export const DEMO_CONTACT_ID = "00000000-demo-sarah-chen-contact";

// ── AI Chat ─────────────────────────────────────────────────────────────────

export const AI_CHAT_QUERY = "What should I focus on today?";

export const AI_CHAT_RESPONSE =
  `You have 14 active email threads across 9 families. Here's what needs attention:\n\n` +
  `1. Sarah Chen (fit score 92) — parent of a junior at Westfield Prep — emailed 2 days ago asking about SAT prep and your college application packages. No reply yet. She's been researching private counselors and is a strong fit. I'd prioritize responding to her first.\n\n` +
  `2. Marcus Rivera followed up yesterday on his son's Common App essay draft. He has 3 questions about the personal statement angle and needs your feedback before the Early Decision deadline.\n\n` +
  `3. You have a meeting with the Liu family at 3:00 PM today — they want to discuss a comprehensive admissions package for their daughter targeting T20 schools.\n\n` +
  `On the lead generation side, your last Facebook group scan found 14 parents asking about SAT prep in college admissions communities. 6 have been contacted, 8 are still in queue.\n\n` +
  `I'd recommend: reply to Sarah Chen first, then prep for the Liu family meeting, then review Marcus's essay questions tonight.`;

export const DRAFT_REPLY =
  `Hi Sarah,\n\n` +
  `Thank you so much for reaching out — I'm glad you found us! Sounds like an exciting time for your family with Emma starting to think about college.\n\n` +
  `We offer a few different packages depending on what you're looking for:\n\n` +
  `• SAT/ACT Prep Package ($1,800) — 12 sessions of 1-on-1 tutoring with diagnostic testing, custom study plan, and two full practice exams\n` +
  `• College Application Package ($3,500) — covers school list strategy, Common App essay coaching, supplemental essays, activity list optimization, and interview prep for up to 12 schools\n` +
  `• Comprehensive Package ($4,800) — everything above plus SAT prep, financial aid guidance, and ongoing mentor check-ins through senior year\n\n` +
  `Most families with juniors starting now go with the Comprehensive Package since it gives us time to build a really strong application before Early Decision deadlines.\n\n` +
  `Would you and Emma have 20 minutes this Thursday or Friday for a free introductory call? I can walk you through our process and some recent results — last year 89% of our students got into at least one of their top-3 choices.\n\n` +
  `Looking forward to connecting!\n\n` +
  `Best,\nAnish`;

export const RESEARCH_SUMMARY =
  `Sarah Chen is a parent in the Westfield, NJ area with a daughter (Emma, junior at Westfield Preparatory Academy). She's been actively researching college admissions consultants for the past month, posting in several Facebook groups about SAT prep options.\n\n` +
  `From her LinkedIn, Sarah is VP of Product at a fintech company — suggesting strong household income and willingness to invest in education. She's shared posts about the importance of early college planning and has liked content from several competing admissions counselors.\n\n` +
  `Emma appears to be a strong student (honor roll mentions in school newsletter) with interests in computer science and debate. Based on parent-group discussions, they're targeting selective schools — likely Ivy League or top-20 programs.\n\n` +
  `Conversation starters / talking points:\n` +
  `- Her specific concern about SAT timing for a junior starting prep now\n` +
  `- Emma's CS + debate combination (great for application narrative)\n` +
  `- Westfield Prep sends 15-20 students to T20 schools annually — frame your track record\n` +
  `- Early Decision strategy for high-reach schools\n\n` +
  `Estimated deal potential: $3,500–4,800 (application or comprehensive package).`;

export const LEAD_FINDER_QUERY = "parents asking about SAT prep in college admissions groups";

export const MEETING_TITLE = "Intro call — Sarah Chen / College Prep";
export const MEETING_DESCRIPTION = "Introductory call to discuss SAT prep and college application packages for Emma (junior at Westfield Prep). Walk through process, recent results, and package options.";

// ── Threads list ────────────────────────────────────────────────────────────

const now = Date.now();
const DAY = 86_400_000;

export const DEMO_THREADS = [
  {
    id: DEMO_THREAD_ID,
    userId: "demo",
    gmailThreadId: "demo-gmail-1",
    contactId: DEMO_CONTACT_ID,
    subject: "SAT prep & college application help for my daughter",
    snippet: "Hi, I found you through the Westfield parents group. My daughter Emma is a junior and we're looking into SAT prep...",
    businessCategory: "lead",
    urgency: "high",
    currentState: "received",
    agentObjective: "Reply with package pricing and schedule intro call",
    automationStatus: null,
    automationTurns: 0,
    lastMessageAt: new Date(now - 2 * DAY).toISOString(),
    lastMessageDirection: "inbound",
    messageCount: 2,
    classification: { recommendedAction: "reply", businessCategory: "lead", urgency: "high", confidence: 0.95 },
    createdAt: new Date(now - 3 * DAY).toISOString(),
    updatedAt: new Date(now - 2 * DAY).toISOString(),
    contactName: "Sarah Chen",
    contactEmail: "sarah.chen@westfieldprep.family",
  },
  {
    id: "demo-thread-marcus",
    userId: "demo",
    gmailThreadId: "demo-gmail-2",
    contactId: "demo-contact-marcus",
    subject: "Re: Jayden's Common App essay — draft 2",
    snippet: "Thanks for the feedback on draft 1. I have a few questions about the personal statement angle...",
    businessCategory: "active_client",
    urgency: "medium",
    currentState: "needs_reply",
    agentObjective: "Review essay questions and send feedback",
    automationStatus: null,
    automationTurns: 0,
    lastMessageAt: new Date(now - 1 * DAY).toISOString(),
    lastMessageDirection: "inbound",
    messageCount: 5,
    classification: { recommendedAction: "reply", businessCategory: "active_client", urgency: "medium", confidence: 0.88 },
    createdAt: new Date(now - 14 * DAY).toISOString(),
    updatedAt: new Date(now - 1 * DAY).toISOString(),
    contactName: "Marcus Rivera",
    contactEmail: "marcus.r@gmail.com",
  },
  {
    id: "demo-thread-james",
    userId: "demo",
    gmailThreadId: "demo-gmail-3",
    contactId: "demo-contact-james",
    subject: "Liu family — comprehensive admissions package",
    snippet: "Looking forward to our call at 3pm. I've sent over Sophie's transcript and activity list...",
    businessCategory: "lead",
    urgency: "medium",
    currentState: "meeting_scheduled",
    agentObjective: "Prepare for intro call, review student profile",
    automationStatus: null,
    automationTurns: 0,
    lastMessageAt: new Date(now - 4 * 3600_000).toISOString(),
    lastMessageDirection: "outbound",
    messageCount: 3,
    classification: { recommendedAction: "monitor", businessCategory: "lead", urgency: "medium", confidence: 0.82 },
    createdAt: new Date(now - 7 * DAY).toISOString(),
    updatedAt: new Date(now - 4 * 3600_000).toISOString(),
    contactName: "James Liu",
    contactEmail: "james.liu.nj@gmail.com",
  },
  {
    id: "demo-thread-emily",
    userId: "demo",
    gmailThreadId: "demo-gmail-4",
    contactId: "demo-contact-emily",
    subject: "Invoice — Rivera family (Oct package)",
    snippet: "Please find attached the invoice for Jayden's October college counseling sessions...",
    businessCategory: "payment",
    urgency: "low",
    currentState: "replied",
    agentObjective: null,
    automationStatus: null,
    automationTurns: 0,
    lastMessageAt: new Date(now - 3 * DAY).toISOString(),
    lastMessageDirection: "outbound",
    messageCount: 2,
    classification: { recommendedAction: "monitor", businessCategory: "payment", urgency: "low", confidence: 0.91 },
    createdAt: new Date(now - 5 * DAY).toISOString(),
    updatedAt: new Date(now - 3 * DAY).toISOString(),
    contactName: "Emily Watson",
    contactEmail: "emily.watson@westfieldprep.edu",
  },
  {
    id: "demo-thread-lisa",
    userId: "demo",
    gmailThreadId: "demo-gmail-5",
    contactId: "demo-contact-lisa",
    subject: "Referred by the Patels — SAT prep for twins",
    snippet: "The Patel family recommended you. Our twins are sophomores and we want to start SAT prep early...",
    businessCategory: "lead",
    urgency: "medium",
    currentState: "received",
    agentObjective: "Respond to warm referral, schedule consult",
    automationStatus: null,
    automationTurns: 0,
    lastMessageAt: new Date(now - 1.5 * DAY).toISOString(),
    lastMessageDirection: "inbound",
    messageCount: 1,
    classification: { recommendedAction: "reply", businessCategory: "lead", urgency: "medium", confidence: 0.79 },
    createdAt: new Date(now - 1.5 * DAY).toISOString(),
    updatedAt: new Date(now - 1.5 * DAY).toISOString(),
    contactName: "Lisa Thompson",
    contactEmail: "lisa.thompson@yahoo.com",
  },
  {
    id: "demo-thread-jennifer",
    userId: "demo",
    gmailThreadId: "demo-gmail-6",
    contactId: "demo-contact-jennifer",
    subject: "College app help — daughter applying to Stanford",
    snippet: "Tom Park suggested I reach out. My daughter is a senior and we need help with her Stanford supplement...",
    businessCategory: "lead",
    urgency: "high",
    currentState: "received",
    agentObjective: "Respond to referral, assess timeline urgency",
    automationStatus: null,
    automationTurns: 0,
    lastMessageAt: new Date(now - 0.8 * DAY).toISOString(),
    lastMessageDirection: "inbound",
    messageCount: 1,
    classification: { recommendedAction: "reply", businessCategory: "lead", urgency: "high", confidence: 0.93 },
    createdAt: new Date(now - 0.8 * DAY).toISOString(),
    updatedAt: new Date(now - 0.8 * DAY).toISOString(),
    contactName: "Jennifer Kim",
    contactEmail: "jen.kim.nj@gmail.com",
  },
  {
    id: "demo-thread-michael",
    userId: "demo",
    gmailThreadId: "demo-gmail-7",
    contactId: "demo-contact-michael",
    subject: "Monthly mentoring check-in — Ethan Adams",
    snippet: "Quick reminder that our monthly session is coming up. Ethan has some questions about his course selection...",
    businessCategory: "active_client",
    urgency: "low",
    currentState: "replied",
    agentObjective: null,
    automationStatus: null,
    automationTurns: 0,
    lastMessageAt: new Date(now - 4 * DAY).toISOString(),
    lastMessageDirection: "outbound",
    messageCount: 4,
    classification: { recommendedAction: "monitor", businessCategory: "active_client", urgency: "low", confidence: 0.87 },
    createdAt: new Date(now - 30 * DAY).toISOString(),
    updatedAt: new Date(now - 4 * DAY).toISOString(),
    contactName: "Michael Adams",
    contactEmail: "michael.adams@outlook.com",
  },
];

// ── Thread detail (Sarah Chen) ──────────────────────────────────────────────

export const DEMO_SARAH_MESSAGES = [
  {
    id: "demo-msg-1",
    direction: "inbound",
    senderEmail: "sarah.chen@westfieldprep.family",
    senderName: "Sarah Chen",
    bodySummary: null,
    bodyFull:
      "Hi,\n\nI found your name through the Westfield parents Facebook group — several families recommended you. My daughter Emma is a junior at Westfield Prep and we're starting to think seriously about the college process.\n\nShe's a strong student (3.9 GPA, AP CS and AP Calc this year) and is on the debate team, but we're not sure where to start with SAT prep and building her application. We've heard it's getting more competitive every year.\n\nCould you share your rates and what your packages include? We're especially interested in SAT prep and someone to help guide her through the whole application process.\n\nThank you!\nSarah Chen",
    sentAt: new Date(now - 3 * DAY).toISOString(),
    isAgentGenerated: false,
  },
  {
    id: "demo-msg-2",
    direction: "inbound",
    senderEmail: "sarah.chen@westfieldprep.family",
    senderName: "Sarah Chen",
    bodySummary: null,
    bodyFull:
      "One more thing — Emma is really interested in computer science programs, and we've been looking at schools like Carnegie Mellon, MIT, and Georgia Tech. If you have experience with those kinds of programs specifically, that would be great to know.\n\nAlso, is it too late to start SAT prep now for a junior? Some of the other parents said she should have started sophomore year.\n\nThanks again,\nSarah",
    sentAt: new Date(now - 2 * DAY).toISOString(),
    isAgentGenerated: false,
  },
];

export const DEMO_SARAH_CONTACT = {
  id: DEMO_CONTACT_ID,
  name: "Sarah Chen",
  email: "sarah.chen@westfieldprep.family",
  company: "Westfield Prep Parent",
  role: "Parent — Emma Chen (Junior)",
  relationshipType: "lead",
  fitScore: 92,
  totalInteractions: 2,
};

export const DEMO_SARAH_THREAD_META = {
  id: DEMO_THREAD_ID,
  subject: "SAT prep & college application help for my daughter",
  businessCategory: "lead",
  urgency: "high",
  currentState: "received",
  agentObjective: "Reply with package pricing and schedule intro call",
  automationStatus: null as string | null,
  automationTurns: 0,
  lastMessageAt: new Date(now - 2 * DAY).toISOString(),
  messageCount: 2,
  classification: { recommendedAction: "reply", businessCategory: "lead", urgency: "high", confidence: 0.95, riskLevel: "low" },
};

// ── Contacts list ───────────────────────────────────────────────────────────

export const DEMO_CONTACTS = [
  {
    id: DEMO_CONTACT_ID,
    name: "Sarah Chen",
    email: "sarah.chen@westfieldprep.family",
    company: "Westfield Prep Parent",
    role: "Parent — Emma Chen (Junior)",
    relationshipType: "lead",
    relationshipStage: "qualified",
    fitScore: 92,
    revenuePotential: "4800",
    lastContactAt: new Date(now - 1 * 3600_000).toISOString(),
    totalInteractions: 2,
  },
  {
    id: "demo-contact-marcus",
    name: "Marcus Rivera",
    email: "marcus.r@gmail.com",
    company: "Westfield Prep Parent",
    role: "Parent — Jayden Rivera (Senior)",
    relationshipType: "active_client",
    relationshipStage: "engaged",
    fitScore: 78,
    revenuePotential: "3500",
    lastContactAt: new Date(now - 1 * DAY).toISOString(),
    totalInteractions: 12,
  },
  {
    id: "demo-contact-james",
    name: "James Liu",
    email: "james.liu.nj@gmail.com",
    company: "Millburn Parent",
    role: "Parent — Sophie Liu (Junior)",
    relationshipType: "lead",
    relationshipStage: "meeting",
    fitScore: 85,
    revenuePotential: "4800",
    lastContactAt: new Date(now - 2 * DAY).toISOString(),
    totalInteractions: 3,
  },
  {
    id: "demo-contact-jennifer",
    name: "Jennifer Kim",
    email: "jen.kim.nj@gmail.com",
    company: "Ridge HS Parent",
    role: "Parent — Mia Kim (Senior)",
    relationshipType: "lead",
    relationshipStage: "new",
    fitScore: 88,
    revenuePotential: "3500",
    lastContactAt: new Date(now - 0.8 * DAY).toISOString(),
    totalInteractions: 1,
  },
  {
    id: "demo-contact-lisa",
    name: "Lisa Thompson",
    email: "lisa.thompson@yahoo.com",
    company: "Scotch Plains Parent",
    role: "Parent — twins (Sophomores)",
    relationshipType: "lead",
    relationshipStage: "new",
    fitScore: 74,
    revenuePotential: "9600",
    lastContactAt: new Date(now - 1.5 * DAY).toISOString(),
    totalInteractions: 1,
  },
  {
    id: "demo-contact-emily",
    name: "Emily Watson",
    email: "emily.watson@westfieldprep.edu",
    company: "Westfield Preparatory Academy",
    role: "School Counselor",
    relationshipType: "partner",
    relationshipStage: null,
    fitScore: 60,
    revenuePotential: null,
    lastContactAt: new Date(now - 3 * DAY).toISOString(),
    totalInteractions: 6,
  },
  {
    id: "demo-contact-michael",
    name: "Michael Adams",
    email: "michael.adams@outlook.com",
    company: "Summit HS Parent",
    role: "Parent — Ethan Adams (Junior)",
    relationshipType: "active_client",
    relationshipStage: "retained",
    fitScore: 70,
    revenuePotential: "1800",
    lastContactAt: new Date(now - 4 * DAY).toISOString(),
    totalInteractions: 8,
  },
];

// ── Watchtower / Tasks ──────────────────────────────────────────────────────

export const DEMO_ALERTS = [
  {
    id: "demo-alert-sarah",
    type: "lead_cooling",
    title: "No reply sent in 2 days",
    description: "Sarah Chen asked about SAT prep and college app packages 2 days ago. High-fit lead — respond ASAP.",
    threadId: DEMO_THREAD_ID,
    threadSubject: "SAT prep & college application help for my daughter",
    counterpartyLabel: "Sarah Chen",
    urgency: "high",
    daysSinceLastAction: 2,
    suggestedAction: "Draft and send a reply with package pricing",
  },
  {
    id: "demo-alert-marcus",
    type: "client_waiting",
    title: "Essay feedback questions unanswered",
    description: "Marcus Rivera replied about Jayden's Common App essay draft with follow-up questions.",
    threadId: "demo-thread-marcus",
    threadSubject: "Re: Jayden's Common App essay — draft 2",
    counterpartyLabel: "Marcus Rivera",
    urgency: "high",
    daysSinceLastAction: 1,
    suggestedAction: "Review essay and send feedback on personal statement angle",
  },
  {
    id: "demo-alert-jennifer",
    type: "new_lead",
    title: "Warm referral — respond within 24hrs",
    description: "Jennifer Kim was referred by Tom Park. Stanford supplement help for daughter Mia.",
    threadId: "demo-thread-jennifer",
    threadSubject: "College app help — daughter applying to Stanford",
    counterpartyLabel: "Jennifer Kim",
    urgency: "medium",
    daysSinceLastAction: 0,
    suggestedAction: "Send intro reply acknowledging referral, assess deadline urgency",
  },
  {
    id: "demo-alert-mentoring",
    type: "deadline_approaching",
    title: "Monthly mentoring session in 3 days",
    description: "Ethan Adams's monthly check-in is coming up. Review course selection questions.",
    threadId: "demo-thread-michael",
    threadSubject: "Monthly mentoring check-in — Ethan Adams",
    counterpartyLabel: "Michael Adams",
    urgency: "low",
    daysSinceLastAction: 4,
    suggestedAction: "Prep for session: review Ethan's course selection plan",
  },
];

// ── Meetings ────────────────────────────────────────────────────────────────

function nextWeekday(daysAhead: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  return d;
}

const todayAt = (h: number, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

export const DEMO_MEETINGS_BASE = [
  {
    id: "demo-meeting-standup",
    summary: "Morning planning",
    start: { dateTime: todayAt(9, 0).toISOString() },
    end: { dateTime: todayAt(9, 15).toISOString() },
    attendees: [],
    meetLink: null,
    location: null,
    brief: null,
  },
  {
    id: "demo-meeting-liu",
    summary: "Liu family — admissions consult",
    start: { dateTime: todayAt(15, 0).toISOString() },
    end: { dateTime: todayAt(16, 0).toISOString() },
    attendees: [{ email: "james.liu.nj@gmail.com" }],
    meetLink: null,
    location: null,
    brief: null,
  },
];

const schedDate = nextWeekday(2);
schedDate.setHours(14, 0, 0, 0);
const schedEnd = new Date(schedDate);
schedEnd.setMinutes(schedEnd.getMinutes() + 30);

export const DEMO_MEETING_SARAH = {
  id: "demo-meeting-sarah",
  summary: MEETING_TITLE,
  start: { dateTime: schedDate.toISOString() },
  end: { dateTime: schedEnd.toISOString() },
  attendees: [{ email: "sarah.chen@westfieldprep.family" }],
  meetLink: null,
  location: null,
  brief: null,
};

export const MEETING_START_ISO = schedDate.toISOString();
export const MEETING_END_ISO = schedEnd.toISOString();

// ── Leads (for Reports) ─────────────────────────────────────────────────────

export const DEMO_LEADS_REPORT = {
  leads: [
    { id: DEMO_CONTACT_ID, name: "Sarah Chen", email: "sarah.chen@westfieldprep.family", stage: "new", fitScore: 92, relationshipType: "lead" },
    { id: "demo-contact-marcus", name: "Marcus Rivera", email: "marcus.r@gmail.com", stage: "engaged", fitScore: 78, relationshipType: "active_client" },
    { id: "demo-contact-james", name: "James Liu", email: "james.liu.nj@gmail.com", stage: "meeting_scheduled", fitScore: 85, relationshipType: "lead" },
    { id: "demo-contact-jennifer", name: "Jennifer Kim", email: "jen.kim.nj@gmail.com", stage: "new", fitScore: 88, relationshipType: "lead" },
    { id: "demo-contact-lisa", name: "Lisa Thompson", email: "lisa.thompson@yahoo.com", stage: "new", fitScore: 74, relationshipType: "lead" },
    { id: "demo-contact-michael", name: "Michael Adams", email: "michael.adams@outlook.com", stage: "contacted", fitScore: 70, relationshipType: "active_client" },
  ],
  stages: {
    new: [
      { id: DEMO_CONTACT_ID, name: "Sarah Chen", email: "sarah.chen@westfieldprep.family", stage: "new", fitScore: 92 },
      { id: "demo-contact-jennifer", name: "Jennifer Kim", email: "jen.kim.nj@gmail.com", stage: "new", fitScore: 88 },
      { id: "demo-contact-lisa", name: "Lisa Thompson", email: "lisa.thompson@yahoo.com", stage: "new", fitScore: 74 },
    ],
    engaged: [
      { id: "demo-contact-marcus", name: "Marcus Rivera", email: "marcus.r@gmail.com", stage: "engaged", fitScore: 78 },
    ],
    draft_ready: [],
    contacted: [
      { id: "demo-contact-michael", name: "Michael Adams", email: "michael.adams@outlook.com", stage: "contacted", fitScore: 70 },
    ],
    meeting_scheduled: [
      { id: "demo-contact-james", name: "James Liu", email: "james.liu.nj@gmail.com", stage: "meeting_scheduled", fitScore: 85 },
    ],
  },
  total: 6,
};

// ── Intelligence (for Reports) ──────────────────────────────────────────────

// ── Lead Finder results ─────────────────────────────────────────────────────

export const DEMO_LEAD_FINDER_LEADS = [
  {
    name: "Priya Sharma",
    location: "Millburn, NJ",
    student: "daughter, junior at Millburn HS",
    post: "Looking for SAT tutoring recommendations. My daughter scored 1280 on the PSAT and we want to get her to 1450+. Anyone have experience with local tutors?",
    messageSent: "Hi Priya! I noticed your post about SAT prep. I run a college admissions practice here in NJ and we specialize in exactly this — getting students from the 1300 range into the 1450+ bracket. We have a diagnostic + 12-session program with great results. Would love to chat if you're interested!",
  },
  {
    name: "David Park",
    location: "Summit, NJ",
    student: "son, junior at Summit HS",
    post: "When should we start the college application process? My son is a junior and I feel like we're already behind. He's interested in engineering programs.",
    messageSent: "Hi David! Saw your question about college app timelines — you're actually right on schedule for a junior. I help families in Summit navigate the whole process, especially for engineering-focused students. Happy to share a quick timeline breakdown if you'd like!",
  },
  {
    name: "Rachel Goldstein",
    location: "Westfield, NJ",
    student: "daughter, sophomore at Westfield HS",
    post: "Are test-optional schools actually test-optional? Should we still prep for the SAT even if top schools say scores aren't required?",
    messageSent: "Hi Rachel! Great question about test-optional policies. Short answer: submitting a strong score still helps at most 'test-optional' schools. I work with a lot of Westfield families and the data is pretty clear on this — happy to share what we've seen if you'd like to connect!",
  },
  {
    name: "Kevin O'Brien",
    location: "Chatham, NJ",
    student: "son, junior at Chatham HS",
    post: "Can anyone recommend a good SAT prep program? Looking for something more personalized than the big chains like Kaplan. Budget around $2k.",
    messageSent: "Hi Kevin! I saw you're looking for personalized SAT prep — that's exactly what we do. Our 12-session 1-on-1 program is $1,800 and includes diagnostic testing, a custom study plan, and two full practice exams. We're based right here in NJ. Happy to tell you more!",
  },
  {
    name: "Aisha Williams",
    location: "Scotch Plains, NJ",
    student: "daughter, junior at SPFHS",
    post: "Looking for a college counselor who can help with the whole process — school list, essays, applications. Our school counselor has 400 students and can't give individual attention.",
    messageSent: "Hi Aisha! I completely understand the frustration with overcrowded school counseling. I work with families 1-on-1 through the entire process — school list strategy, essay coaching, application review, and interview prep. Would love to chat about how I can help your daughter!",
  },
];

// ── Lead Finder log lines with realistic variable delays (ms) ───────────────

export const DEMO_LOG_ENTRIES: { text: string; delay: number }[] = [
  { text: 'Scanning "NJ College Admissions Parents" group for recent posts...', delay: 1400 },
  { text: "📍 Group loaded — 847 members", delay: 800 },
  { text: "   Scanning... 8 posts found, 3 potential leads identified", delay: 1100 },
  { text: "   Scanning... 15 posts found, 7 potential leads identified", delay: 900 },
  { text: "   Scanning... 23 posts found, 11 potential leads identified", delay: 1000 },
  { text: "✅ Scan complete: 23 posts → 11 leads queued", delay: 600 },
  { text: "   Cross-referencing with existing contacts database...", delay: 1800 },
  { text: "   Filtering already-contacted leads... 5 new leads found", delay: 1000 },
  { text: "   Ready to message.", delay: 500 },
  { text: "── STARTING OUTREACH ──", delay: 800 },
  { text: "📬 Loading message template...", delay: 1200 },
  { text: "🔑 Browser session loaded", delay: 1500 },
  { text: "✉️  Opening conversation with Priya Sharma...", delay: 800 },
  { text: '   → "Hi Priya! I noticed your post about SAT prep..."', delay: 500 },
  { text: "✅ Message sent to Priya Sharma", delay: 400 },
  { text: "⏳ Waiting 35s before next message...", delay: 2200 },
  { text: "✉️  Opening conversation with David Park...", delay: 700 },
  { text: '   → "Hi David! Saw your question about college app timelines..."', delay: 500 },
  { text: "✅ Message sent to David Park", delay: 400 },
  { text: "⏳ Waiting 28s before next message...", delay: 1800 },
  { text: "✉️  Opening conversation with Rachel Goldstein...", delay: 700 },
  { text: '   → "Hi Rachel! Great question about test-optional policies..."', delay: 500 },
  { text: "✅ Message sent to Rachel Goldstein", delay: 400 },
  { text: "⏳ Waiting 42s before next message...", delay: 2500 },
  { text: "✉️  Opening conversation with Kevin O'Brien...", delay: 700 },
  { text: '   → "Hi Kevin! I saw you\'re looking for personalized SAT prep..."', delay: 500 },
  { text: "✅ Message sent to Kevin O'Brien", delay: 400 },
  { text: "⏳ Waiting 31s before next message...", delay: 2000 },
  { text: "✉️  Opening conversation with Aisha Williams...", delay: 700 },
  { text: '   → "Hi Aisha! I completely understand the frustration..."', delay: 500 },
  { text: "✅ Message sent to Aisha Williams", delay: 400 },
  { text: "✅ Outreach complete — 5 new leads contacted", delay: 600 },
];

// ── Intelligence (for Reports) ──────────────────────────────────────────────

export const DEMO_INTELLIGENCE = {
  chunks: [
    { id: "demo-intel-1", title: "SAT prep demand surge — NJ suburbs", content: "Demand for private SAT prep tutoring in northern NJ has increased 28% year-over-year. Parents in Westfield, Millburn, and Summit are the most active in online communities.", createdAt: new Date(now - 1 * DAY).toISOString(), sourceName: "Facebook Groups" },
    { id: "demo-intel-2", title: "Common App essay trends 2025–26", content: "The most successful Common App essays this cycle focus on specific moments of growth rather than broad achievement narratives. Schools are favoring authenticity over polish.", createdAt: new Date(now - 3 * DAY).toISOString(), sourceName: "Admissions Blog" },
    { id: "demo-intel-3", title: "Early Decision acceptance rates", content: "Early Decision acceptance rates at top-20 schools averaged 18.2% this cycle, compared to 5.1% for Regular Decision — reinforcing the strategic value of ED advising.", createdAt: new Date(now - 5 * DAY).toISOString(), sourceName: "College Data" },
  ],
  sources: [
    { id: "src-1", name: "Facebook Groups" },
    { id: "src-2", name: "Admissions Blog" },
    { id: "src-3", name: "College Data" },
  ],
  results: [],
};
