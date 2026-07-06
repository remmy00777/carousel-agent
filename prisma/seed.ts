import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nicheKeywords, scorePost } from "../src/lib/ranking";

const db = new PrismaClient();

const SAMPLE_POSTS = [
  { caption: "5 money habits that quietly made me six figures in savings. Number 3 takes 10 minutes a month. Save this.", topic: "money habits", likeCount: 8400, commentCount: 320, daysAgo: 3 },
  { caption: "How to build a budget you will actually stick to (the 50/30/20 rule is broken for most people).", topic: "budgeting systems", likeCount: 5200, commentCount: 210, daysAgo: 5 },
  { caption: "The beginner's roadmap to index fund investing. Step-by-step, no jargon.", topic: "index fund investing", likeCount: 12100, commentCount: 540, daysAgo: 8 },
  { caption: "3 signs you are financially ahead of 90% of people your age (even if it does not feel like it).", topic: "financial milestones", likeCount: 9800, commentCount: 610, daysAgo: 2 },
  { caption: "Why your emergency fund should NOT sit in your checking account, and where to put it instead.", topic: "emergency funds", likeCount: 4300, commentCount: 150, daysAgo: 12 },
];

async function main() {
  const email = "demo@example.com";
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const user = await db.user.upsert({
    where: { email },
    create: { email, name: "Demo User", passwordHash },
    update: {},
  });

  const existing = await db.agent.findFirst({ where: { userId: user.id, name: "Finance Carousel Agent" } });
  if (existing) {
    console.log("Seed already applied.");
    return;
  }

  const agent = await db.agent.create({
    data: {
      userId: user.id,
      name: "Finance Carousel Agent",
      niche: "personal finance for young professionals",
      tone: "clear, encouraging, no-hype",
      audience: "25-35 year olds starting to invest and save seriously",
      goals: "grow followers, drive saves and shares, build trust with practical money advice",
      scheduleCron: "0 9 * * 1,3,5",
      mode: "APPROVAL",
      brand: { template: "bold", bg: "#0f172a", fg: "#f8fafc", accent: "#38bdf8", handle: "@demo.finance" },
    },
  });

  const manual = await db.inspirationSource.create({
    data: { agentId: agent.id, type: "MANUAL", value: "Seeded inspiration examples" },
  });
  await db.inspirationSource.create({
    data: { agentId: agent.id, type: "IG_HANDLE", value: "examplefinancecreator" },
  });
  await db.inspirationSource.create({
    data: { agentId: agent.id, type: "HASHTAG", value: "personalfinance" },
  });

  const keywords = nicheKeywords(agent);
  for (const [i, p] of SAMPLE_POSTS.entries()) {
    const postedAt = new Date(Date.now() - p.daysAgo * 86_400_000);
    const scores = scorePost({ ...p, postedAt }, keywords);
    await db.collectedPost.create({
      data: {
        agentId: agent.id,
        sourceId: manual.id,
        sourceType: "MANUAL",
        sourceUrl: `https://example.com/seed/${i}`,
        author: "seed",
        caption: p.caption,
        topic: p.topic,
        format: "CAROUSEL_ALBUM",
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        postedAt,
        ...scores,
      },
    });
  }

  console.log("Seeded demo user: demo@example.com / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
