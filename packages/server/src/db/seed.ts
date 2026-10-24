import { eq } from "drizzle-orm";
import {
  createDbConnection,
  db as defaultDb,
  users,
  symbols,
  portfolios,
  securitiesHoldings,
  type Database,
} from "./index.js";
import { fileURLToPath } from "node:url";

export const INITIAL_SYMBOLS = [
  {
    symbolId: "TCS",
    companyName: "Tata Consultancy Services Ltd",
    tickSize: "0.05",
    lotSize: 1,
    basePrice: "3500.00",
    circuitLimitPct: "10.00",
    isHalted: false,
  },
  {
    symbolId: "INFY",
    companyName: "Infosys Ltd",
    tickSize: "0.05",
    lotSize: 1,
    basePrice: "1500.00",
    circuitLimitPct: "10.00",
    isHalted: false,
  },
  {
    symbolId: "RELIANCE",
    companyName: "Reliance Industries Ltd",
    tickSize: "0.05",
    lotSize: 1,
    basePrice: "2500.00",
    circuitLimitPct: "10.00",
    isHalted: false,
  },
  {
    symbolId: "HDFCBANK",
    companyName: "HDFC Bank Ltd",
    tickSize: "0.05",
    lotSize: 1,
    basePrice: "1600.00",
    circuitLimitPct: "10.00",
    isHalted: false,
  },
];

export const INITIAL_USERS = [
  {
    username: "apoorva",
    email: "apoorva@glassbox.internal",
    role: "STUDENT" as const,
  },
  {
    username: "sameer",
    email: "sameer@glassbox.internal",
    role: "STUDENT" as const,
  },
  {
    username: "trader_alice",
    email: "alice@glassbox.internal",
    role: "STUDENT" as const,
  },
  {
    username: "trader_bob",
    email: "bob@glassbox.internal",
    role: "STUDENT" as const,
  },
  {
    username: "instructor",
    email: "instructor@glassbox.internal",
    role: "INSTRUCTOR" as const,
  },
  {
    username: "auditor",
    email: "auditor@glassbox.internal",
    role: "AUDITOR" as const,
  },
];

export async function seedDatabase(db: Database = defaultDb): Promise<void> {
  console.log("🌱 Starting database seeding...");

  // 1. Seed Symbols
  console.log("📈 Seeding 4 Indian equity symbols (TCS, INFY, RELIANCE, HDFCBANK)...");
  for (const sym of INITIAL_SYMBOLS) {
    await db
      .insert(symbols)
      .values(sym)
      .onConflictDoUpdate({
        target: symbols.symbolId,
        set: {
          companyName: sym.companyName,
          tickSize: sym.tickSize,
          lotSize: sym.lotSize,
          basePrice: sym.basePrice,
          circuitLimitPct: sym.circuitLimitPct,
          isHalted: sym.isHalted,
        },
      });
  }

  // 2. Seed Users, Portfolios, and Securities Holdings
  console.log("👤 Seeding initial test users with ₹10,000 cash and 100 shares per symbol...");
  for (const userSpec of INITIAL_USERS) {
    // Insert user or retrieve existing
    let userId: string;
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.username, userSpec.username))
      .limit(1);

    if (existingUsers.length > 0) {
      userId = existingUsers[0].userId;
    } else {
      const inserted = await db
        .insert(users)
        .values(userSpec)
        .returning({ userId: users.userId });
      userId = inserted[0].userId;
    }

    // Seed Portfolio: ₹10,000 cash balance
    await db
      .insert(portfolios)
      .values({
        userId,
        cashBalance: "10000.00",
        lockedCash: "0.00",
      })
      .onConflictDoUpdate({
        target: portfolios.userId,
        set: {
          cashBalance: "10000.00",
          lockedCash: "0.00",
        },
      });

    // Seed Holdings: 100 shares for each of the 4 symbols
    for (const sym of INITIAL_SYMBOLS) {
      await db
        .insert(securitiesHoldings)
        .values({
          userId,
          symbolId: sym.symbolId,
          quantity: 100,
          lockedQuantity: 0,
        })
        .onConflictDoUpdate({
          target: [securitiesHoldings.userId, securitiesHoldings.symbolId],
          set: {
            quantity: 100,
            lockedQuantity: 0,
          },
        });
    }
  }

  console.log("✅ Database seeding completed successfully!");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { client, db } = createDbConnection();
  seedDatabase(db)
    .then(async () => {
      console.log("🎉 Seed CLI finished.");
      await client.end({ timeout: 5 });
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("❌ Seed CLI failed:", err);
      await client.end({ timeout: 5 });
      process.exit(1);
    });
}
