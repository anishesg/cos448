/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "clientops",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: { aws: { region: "us-east-1" } },
    };
  },
  async run() {
    // ─── Secrets ──────────────────────────────────────────────
    const googleClientId = new sst.Secret("GoogleClientId");
    const googleClientSecret = new sst.Secret("GoogleClientSecret");
    const sessionSecret = new sst.Secret("SessionSecret");
    const databaseUrl = new sst.Secret("DatabaseUrl");
    const tavilyApiKey = new sst.Secret("TavilyApiKey");

    // ─── S3 Buckets ───────────────────────────────────────────
    const artifactsBucket = new sst.aws.Bucket("Artifacts", {
      access: "private",
    });

    // ─── SQS Queues ──────────────────────────────────────────
    const emailQueue = new sst.aws.Queue("EmailQueue", {
      fifo: false,
    });

    const browserTaskQueue = new sst.aws.Queue("BrowserTaskQueue", {
      fifo: false,
    });

    // ─── AI Auto-Responder (Customer Simulator) ───────────────
    // Queue for simulation turns. Each message: { threadId, userId }.
    // Messages are delayed by the producer (up to 900 s) to space out turns.
    const simulatorQueue = new sst.aws.Queue("SimulatorQueue", {
      visibilityTimeout: "5 minutes",
    });

    // Lambda that processes one simulation turn per SQS message
    simulatorQueue.subscribe({
      handler: "src/jobs/simulator-worker.handler",
      timeout: "5 minutes",
      memory: "512 MB",
      environment: {
        DATABASE_URL: databaseUrl.value,
        AWS_REGION: "us-east-1",
        SIMULATOR_QUEUE_URL: simulatorQueue.url,
        // Google token refresh needs these at runtime (tokens are stored in DB)
        GOOGLE_CLIENT_ID: googleClientId.value,
        GOOGLE_CLIENT_SECRET: googleClientSecret.value,
      },
    });

    // Cron watchdog — runs every 5 minutes as a safety net for dropped SQS messages
    new sst.aws.Cron("SimulatorWatchdog", {
      schedule: "rate(5 minutes)",
      job: {
        handler: "src/jobs/simulator-watchdog.handler",
        timeout: "2 minutes",
        memory: "256 MB",
        environment: {
          DATABASE_URL: databaseUrl.value,
          AWS_REGION: "us-east-1",
          SIMULATOR_QUEUE_URL: simulatorQueue.url,
        },
      },
    });

    // ─── Next.js App ─────────────────────────────────────────
    const domain = {
      name: "app.fridayworkshop.com",
      dns: sst.aws.dns({ zone: "Z0675756DDRM5794BZZ1" }),
    };

    const web = new sst.aws.Nextjs("Web", {
      path: ".",
      domain,
      environment: {
        GOOGLE_CLIENT_ID: googleClientId.value,
        GOOGLE_CLIENT_SECRET: googleClientSecret.value,
        GOOGLE_REDIRECT_URI: "https://app.fridayworkshop.com/api/auth/callback",
        SESSION_SECRET: sessionSecret.value,
        DATABASE_URL: databaseUrl.value,
        TAVILY_API_KEY: tavilyApiKey.value,
        AWS_REGION: "us-east-1",
        NEXT_PUBLIC_APP_URL: "https://app.fridayworkshop.com",
        ARTIFACTS_BUCKET: artifactsBucket.name,
        EMAIL_QUEUE_URL: emailQueue.url,
        BROWSER_QUEUE_URL: browserTaskQueue.url,
        SIMULATOR_QUEUE_URL: simulatorQueue.url,
      },
    });

    return {
      url: web.url,
      domain: "https://app.fridayworkshop.com",
      simulatorQueueUrl: simulatorQueue.url,
    };
  },
});
