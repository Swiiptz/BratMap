/** Configuration d'affichage partagée entre les joueurs (CDC §20), stockée dans `appConfig/main`. */
export type LabelDensity = 'low' | 'normal' | 'high';
export type UndergroundStyle = 'fine' | 'normal' | 'bold';
export type AppConfig = { fadeIntensity: number; labelDensity: LabelDensity; undergroundStyle: UndergroundStyle; territoryOpacity: number };

export const defaultAppConfig: AppConfig = { fadeIntensity: 0.6, labelDensity: 'normal', undergroundStyle: 'normal', territoryOpacity: 0.2 };
export const APP_CONFIG_ID = 'main';

/** Zoom à partir duquel les étiquettes apparaissent, selon la densité d'information choisie. */
export const labelMinZoom: Record<LabelDensity, { points: number; territories: number; accesses: number }> = {
  low: { points: 15, territories: 12.5, accesses: 16 },
  normal: { points: 13, territories: 11, accesses: 14 },
  high: { points: 11.5, territories: 9.5, accesses: 12.5 },
};
export const undergroundWidthFactor: Record<UndergroundStyle, number> = { fine: 0.7, normal: 1, bold: 1.45 };

export function readAppConfig(document: Partial<AppConfig> | undefined): AppConfig {
  return { ...defaultAppConfig, ...Object.fromEntries(Object.entries(document ?? {}).filter(([key, value]) => key in defaultAppConfig && value !== null && value !== undefined)) };
}
