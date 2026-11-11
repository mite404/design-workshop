import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { PanelRegistryProvider, type PanelRegistry } from "../components/panel-registry";
import { env } from "../env";
import { ProvidedRuntime, useStartedRuntime } from "../runtime";
import { wantedFrom } from "../source";
import { composeRuntime } from "./compose";
import { DEMO_WORLD } from "./demo";
import { createWorld, type World } from "./world";

const WorldContext = createContext<World | null>(null);

// The Demo's world, made in an effect with a cleanup, never in a state initializer, so
// StrictMode's second mount stops the first world's shows before the second plays.
function useWorld(panels: PanelRegistry): World | null {
  const [world, setWorld] = useState<World | null>(null);
  useEffect(() => {
    const made = createWorld(DEMO_WORLD, { panels });
    // oxlint-disable-next-line react/set-state-in-effect -- the world is the external system this effect starts; render needs its handle
    setWorld(made);
    return () => {
      made.dispose();
      setWorld(null);
    };
  }, [panels]);
  return world;
}

// The Demo over the worker: one runtime for the shell and the panel registry.
function Overlaid({ children }: { children: ReactNode }) {
  const [panels] = useState<PanelRegistry>(() => new Map());
  const world = useWorld(panels);
  const worker = useStartedRuntime();
  const composed = useMemo(
    () => (worker === null || world === null ? null : composeRuntime(worker, world)),
    [worker, world],
  );
  return (
    <WorldContext value={world}>
      <ProvidedRuntime runtime={composed}>
        <PanelRegistryProvider registry={panels}>{children}</PanelRegistryProvider>
      </ProvidedRuntime>
    </WorldContext>
  );
}

/**
 * Opens the Demo's finished conversations beside the device's threads for as long as it is
 * mounted, composed with the worker into the one runtime the shell reads. Only over the
 * device's data when `VITE_DEMO` is on, so a `?scenario=` fixture remains independent.
 */
export function DemoOverlay({ children }: { children: ReactNode }) {
  const onDevice = wantedFrom(useLocation().search).kind === "device"; // → no ?scenario=
  if (!env.demo || !onDevice) return children;
  return <Overlaid>{children}</Overlaid>;
}

/** Whether the Demo holds the thread `id`: a show, one of its children, or one made in it. */
export function useScripted(id: string): boolean {
  return useContext(WorldContext)?.owns(id) === true;
}
