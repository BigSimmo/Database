export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[color:var(--background)]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--accent)] border-t-transparent" />
    </div>
  );
}
