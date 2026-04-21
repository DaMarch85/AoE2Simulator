import Link from "next/link";

export default function NotFound() {
  return (
    <main className="panel p-8">
      <p className="text-xs uppercase tracking-[0.32em] text-slate-400">404</p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-50">Scenario not found</h1>
      <p className="mt-4 text-sm text-slate-300">
        The scaffold only ships with the starter scenario at the moment.
      </p>
      <div className="mt-6">
        <Link
          href="/"
          className="rounded-full border border-violet-400/40 bg-violet-500/20 px-5 py-3 text-sm font-medium text-violet-100"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
