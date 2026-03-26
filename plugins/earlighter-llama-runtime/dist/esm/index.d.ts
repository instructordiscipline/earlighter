export interface EarlighterLlamaRuntimePlugin {
  isReady(): Promise<{ available: boolean }>;
}
export const EarlighterLlamaRuntime: EarlighterLlamaRuntimePlugin;
export default EarlighterLlamaRuntime;
