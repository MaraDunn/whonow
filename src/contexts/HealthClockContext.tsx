import React, { createContext, useContext, useEffect, useState } from "react";

/** Ticks every minute so health scores can recompute with current time. */
const HEALTH_CLOCK_INTERVAL_MS = 60 * 1000;

const HealthClockContext = createContext<number>(0);

export function HealthClockProvider({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), HEALTH_CLOCK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
  return (
    <HealthClockContext.Provider value={tick}>
      {children}
    </HealthClockContext.Provider>
  );
}

export function useHealthClock(): number {
  return useContext(HealthClockContext) ?? 0;
}
