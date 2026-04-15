/**
 * GET  /api/linq/setup  — returns current Linq config status
 * POST /api/linq/setup  — registers webhook and saves owner phone
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { registerWebhook } from "@/lib/linq/linq-client";

export interface LinqSetupStatus {
  tokenSet: boolean;
  fromNumberSet: boolean;
  ownerPhoneSet: boolean;
  configured: boolean;
}

export async function GET(): Promise<NextResponse> {
  try {
    await requireApiUser();

    const tokenSet = Boolean(process.env.LINQ_API_TOKEN);
    const fromNumberSet = Boolean(process.env.LINQ_FROM_NUMBER);
    const ownerPhoneSet = Boolean(process.env.LINQ_OWNER_PHONE);
    const configured = tokenSet && fromNumberSet && ownerPhoneSet;

    const status: LinqSetupStatus = {
      tokenSet,
      fromNumberSet,
      ownerPhoneSet,
      configured,
    };

    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[linq/setup] GET error:", error);
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireApiUser();

    const body = (await request.json()) as { ownerPhone?: string };
    const ownerPhone = body.ownerPhone?.trim();

    if (!ownerPhone) {
      return NextResponse.json(
        { error: "ownerPhone is required" },
        { status: 400 }
      );
    }

    // Validate E.164-ish format
    if (!/^\+\d{7,15}$/.test(ownerPhone)) {
      return NextResponse.json(
        { error: "ownerPhone must be in E.164 format, e.g. +12223334444" },
        { status: 400 }
      );
    }

    // Register the webhook with Linq
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    const webhookUrl = `${appUrl}/api/linq/webhook`;

    try {
      await registerWebhook(webhookUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Failed to register webhook: ${message}` },
        { status: 502 }
      );
    }

    // In a production app you'd persist ownerPhone to the DB here.
    // For now we acknowledge the value and advise setting the env var.
    return NextResponse.json({
      success: true,
      webhookUrl,
      ownerPhone,
      note: "Set LINQ_OWNER_PHONE env var to persist across restarts.",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[linq/setup] POST error:", error);
    return NextResponse.json({ error: "Setup failed" }, { status: 500 });
  }
}
