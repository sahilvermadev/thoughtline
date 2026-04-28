import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";
import type { Worldview } from "@thoughtline/shared";

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenId: integer("token_id").unique(),
  ownerAddress: text("owner_address").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  worldview: jsonb("worldview").$type<Worldview>().notNull(),
  parentAId: uuid("parent_a_id").references((): any => agents.id),
  parentBId: uuid("parent_b_id").references((): any => agents.id),
  generation: integer("generation").notNull().default(0),
  storageUri: text("storage_uri"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .references(() => agents.id)
    .notNull(),
  ownerAddress: text("owner_address").notNull(),
  title: text("title"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id)
    .notNull(),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const breedingJobs = pgTable("breeding_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerAddress: text("owner_address").notNull(),
  parentAId: uuid("parent_a_id")
    .references(() => agents.id)
    .notNull(),
  parentBId: uuid("parent_b_id")
    .references(() => agents.id)
    .notNull(),
  status: text("status", {
    enum: ["pending", "synthesizing", "uploading", "minting", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  childAgentId: uuid("child_agent_id").references(() => agents.id),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
