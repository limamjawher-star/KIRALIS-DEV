import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-mono text-xs font-medium text-slate-500 dark:text-slate-400">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
        Page introuvable
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
        La route demandée ne correspond à aucun module de l’application KIRALIS.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-blue-700 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}
