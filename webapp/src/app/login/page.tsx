import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-stone-50">
      {/* Left: hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 items-center justify-center p-12">
        <div className="max-w-md space-y-8">
          <div className="space-y-4">
            <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <span className="text-2xl font-bold text-white">C</span>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Your AI Chief of Staff
            </h1>
            <p className="text-indigo-200 text-lg leading-relaxed">
              ClientOps watches your inbox, classifies every thread, drafts
              perfect replies, and never lets a lead go cold. It&apos;s like
              hiring an operations team overnight.
            </p>
          </div>

          <div className="space-y-3">
            {[
              "Automatic lead detection & follow-up",
              "AI-drafted replies in your exact tone",
              "Never-miss-a-lead watchtower alerts",
              "One-click meeting scheduling",
              "Web research on every contact",
              "Daily founder briefings",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-sm text-indigo-100">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: sign-in */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <div className="lg:hidden mx-auto h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center">
              <span className="text-lg font-bold text-white">C</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              Welcome to ClientOps
            </h1>
            <p className="text-sm text-stone-500">
              Connect your Google account to get started
            </p>
          </div>

          <div className="space-y-4">
            <Link
              href="/api/auth/google"
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 shadow-sm transition-all hover:bg-stone-50 hover:shadow-md"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </Link>

            <p className="text-center text-[11px] text-stone-400 leading-relaxed">
              We&apos;ll request read access to Gmail and Calendar to power
              your business intelligence. Your data stays private and encrypted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
