import {
  SESClient,
  SendEmailCommand,
  GetSendQuotaCommand,
} from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.AWS_REGION ?? "us-east-1" });

const SIMULATOR_DOMAIN = "easyprincetoncourses.com";

export function getSimulatorEmail(name: string): string {
  return `${name.toLowerCase().replace(/\s+/g, ".")}@${SIMULATOR_DOMAIN}`;
}

export async function getSesQuota(): Promise<{
  max24h: number;
  sent24h: number;
  remaining: number;
}> {
  const result = await ses.send(new GetSendQuotaCommand({}));
  return {
    max24h: result.Max24HourSend ?? 200,
    sent24h: result.SentLast24Hours ?? 0,
    remaining: (result.Max24HourSend ?? 200) - (result.SentLast24Hours ?? 0),
  };
}

export async function sendSesEmail(opts: {
  from: string;
  to: string;
  subject: string;
  body: string;
  replyToMessageId?: string;
  references?: string;
}): Promise<string | undefined> {
  const cmd = new SendEmailCommand({
    Source: opts.from,
    Destination: { ToAddresses: [opts.to] },
    Message: {
      Subject: { Data: opts.subject, Charset: "UTF-8" },
      Body: { Text: { Data: opts.body, Charset: "UTF-8" } },
    },
  });

  try {
    const result = await ses.send(cmd);
    return result.MessageId;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "Throttling") {
      console.error("SES quota exceeded. Message not sent:", opts.subject);
      throw new Error("SES_QUOTA_EXCEEDED");
    }
    throw err;
  }
}
