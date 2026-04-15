import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

let _sqsClient: SQSClient | null = null;

function getSqsClient(): SQSClient {
  if (!_sqsClient) {
    _sqsClient = new SQSClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  }
  return _sqsClient;
}

/**
 * Enqueue a simulation turn to SQS with an optional delay.
 * Returns true if the message was enqueued, false if SQS is not configured (local dev).
 */
export async function enqueueTurn(
  threadId: string,
  userId: string,
  delaySeconds = 25
): Promise<boolean> {
  const queueUrl = process.env.SIMULATOR_QUEUE_URL;
  if (!queueUrl) return false;

  const sqs = getSqsClient();
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ threadId, userId }),
      DelaySeconds: Math.min(Math.max(0, Math.round(delaySeconds)), 900),
    })
  );
  return true;
}
