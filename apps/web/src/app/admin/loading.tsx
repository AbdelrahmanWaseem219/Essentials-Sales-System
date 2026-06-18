/** Shown during admin route navigation/loading — instant feedback instead of a
 *  blank panel while the next screen (and its data) come up. */
export default function AdminLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand dark:border-white/20 dark:border-t-white" />
    </div>
  );
}
