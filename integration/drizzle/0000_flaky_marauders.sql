CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TYPE "public"."audit_status" AS ENUM('pending', 'approved', 'denied', 'executed', 'failed');--> statement-breakpoint
CREATE TABLE "agent_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action_description" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"agent_id" text NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"status" "audit_status" DEFAULT 'pending' NOT NULL,
	"reversible" boolean DEFAULT false NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "mcp_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"mock_mode" boolean DEFAULT true NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_connections_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "oauth_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"account_email" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
