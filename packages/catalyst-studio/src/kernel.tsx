import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import type { StudioClient } from "./client.js";
import { compareVersions } from "./Overview.js";

/** The kernel from which a writing verb takes `--forewarned` (catalyst's design 31, `fw-STRUCTURE-000019`). */
export const FOREWARNING_KERNEL = "0.112.0";

const KernelContext = createContext<string | null>(null);

/** Provides a kernel directly (a view's tests). */
export const KernelProvider = KernelContext.Provider;

/** The deployment's kernel, from `/v1/head`; null until it is known, or when the server has none. */
export function useKernel(): string | null {
  return useContext(KernelContext);
}

/** Whether `kernel` records a forewarned change (studio-SHELL-000029). */
export function forewarns(kernel: string | null): boolean {
  return kernel !== null && compareVersions(kernel, FOREWARNING_KERNEL) >= 0;
}

/** Gives every view the deployment's kernel, read once. */
export function WithKernel({ client, children }: { client: StudioClient | null; children: ReactNode }) {
  const [kernel, setKernel] = useState<string | null>(null);
  useEffect(() => {
    if (!client) return;
    client.head().then(
      (h) => {
        setKernel(h.kernel ?? null);
      },
      () => undefined, // a shared server has no head of this kind: no forewarning offered
    );
  }, [client]);
  return <KernelContext.Provider value={kernel}>{children}</KernelContext.Provider>;
}
