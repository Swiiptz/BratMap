import type maplibregl from 'maplibre-gl';
import { iconPath } from '../../domain/icons';

const PIXEL_RATIO = 2;
const SIZE = 30;

/** Identifiant d'image : `ping|<forme>|<icône>|<couleur>` (forme « round » pour les lieux, « square » pour les havres). */
export const pingImageId = (shape: 'round' | 'square' | 'diamond', icon: string, color: string) => `ping|${shape}|${icon}|${color}`;

function drawPing(shape: string, icon: string, color: string): ImageData {
  const px = SIZE * PIXEL_RATIO;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO);
  const pad = 2.5;
  ctx.beginPath();
  if (shape === 'square') ctx.roundRect(pad, pad, SIZE - pad * 2, SIZE - pad * 2, 6);
  else if (shape === 'diamond') {
    ctx.moveTo(SIZE / 2, 1.5);
    ctx.lineTo(SIZE - 1.5, SIZE / 2);
    ctx.lineTo(SIZE / 2, SIZE - 1.5);
    ctx.lineTo(1.5, SIZE / 2);
    ctx.closePath();
  } else ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - pad, 0, Math.PI * 2);
  ctx.fillStyle = '#0c1318';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  // Pictogramme centré (grille 24 → 15 px), même couleur que le contour.
  ctx.save();
  const glyph = shape === 'diamond' ? 12 : 15;
  ctx.translate(SIZE / 2 - glyph / 2, SIZE / 2 - glyph / 2);
  ctx.scale(glyph / 24, glyph / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(iconPath(icon)));
  ctx.restore();
  return ctx.getImageData(0, 0, px, px);
}

/** Génère à la demande les images de pings utilisées par la carte (évite d'en précharger des centaines). */
export function registerPingImages(map: maplibregl.Map) {
  map.on('styleimagemissing', (event: { id: string }) => {
    if (!event.id.startsWith('ping|') || map.hasImage(event.id)) return;
    const [, shape, icon, color] = event.id.split('|');
    map.addImage(event.id, drawPing(shape, icon, color), { pixelRatio: PIXEL_RATIO });
  });
}
