import Link from "next/link";
import Navbar from "@/components/Navbar";
import NewJobForm from "@/components/NewJobForm";

export default function NewJobPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-6"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back to Jobs
        </Link>
        <h1 className="text-lg font-semibold mb-6">New Job</h1>
        <NewJobForm />
      </main>
    </>
  );
}
