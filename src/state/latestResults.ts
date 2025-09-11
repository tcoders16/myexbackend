// src/state/latestResults.ts
type Latest = { at: number; payload: any };
export const latestByIp = new Map<string, Latest>();