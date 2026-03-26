export interface EarlighterWhisperRuntimePlugin {
  isReady(): Promise<{ available: boolean }>;
}
export const EarlighterWhisperRuntime: EarlighterWhisperRuntimePlugin;
export default EarlighterWhisperRuntime;
