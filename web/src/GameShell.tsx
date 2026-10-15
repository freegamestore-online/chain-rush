// Tenwise GameShell: the FreeGameStore SDK shell, plus the feel and motion kit
// so screens reach it through one import.
import { GameShell as SdkGameShell } from "@freegamestore/games";
import type { ComponentProps } from "react";
import { ParticleLayer, ScorePop, useShake, prefersReducedMotion } from "./feel";

export { ParticleLayer, ScorePop, useShake, prefersReducedMotion };

export default function GameShell(props: ComponentProps<typeof SdkGameShell>) {
  return <SdkGameShell {...props} />;
}
