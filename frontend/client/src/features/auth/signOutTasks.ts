type SignOutTask = () => Promise<void>;

const tasks = new Set<SignOutTask>();
const TASK_TIMEOUT_MS = 3_000;

/**
 * Work that must run while the session is still valid, right before signing out
 * (e.g. unregistering this phone from push notifications). Returns an unregister function.
 */
export function registerSignOutTask(task: SignOutTask) {
  tasks.add(task);
  return () => {
    tasks.delete(task);
  };
}

/** Runs every task; failures and slow tasks never block signing out. */
export async function runSignOutTasks() {
  await Promise.all(
    [...tasks].map((task) =>
      Promise.race([
        task().catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, TASK_TIMEOUT_MS)),
      ]),
    ),
  );
}
