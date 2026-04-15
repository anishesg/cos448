import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { getAuthedGmailClient } from "@/lib/google";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { to, subject, body: emailBody } = body;

    if (!to || !emailBody) {
      return NextResponse.json(
        { error: "Recipient (to) and body are required" },
        { status: 400 }
      );
    }

    const gmail = await getAuthedGmailClient(user.userId);

    const rawMessage = [
      `To: ${to}`,
      `Subject: ${subject || "(no subject)"}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      emailBody,
    ].join("\r\n");

    const encodedMessage = Buffer.from(rawMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const { data } = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    return NextResponse.json({ messageId: data.id, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Compose send error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
