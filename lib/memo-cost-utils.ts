/**
 * Utility functions for estimating memo generation costs
 * Safe for client-side import (no Node.js built-ins)
 */

export function estimateMemoGenerationCost(
  clientCount: number = 0
): { baseCost: number; clientCost: number; total: number } {
  // Rough estimates based on typical usage
  // Base memo (Opus): ~50K input, ~1.5K output = ~$0.22
  const baseCost = 0.22;

  // Client customization (Haiku): ~4K input (memo), ~1.5K output = ~$0.02
  const clientCost = clientCount * 0.02;

  return {
    baseCost,
    clientCost,
    total: baseCost + clientCost,
  };
}
