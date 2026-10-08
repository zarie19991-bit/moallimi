import jpeg from "jpeg-js";

export type Mark = {
  row: number; option: number; color?: [number, number, number];
  radius?: number; dx?: number; dy?: number;
};
export type FixtureOptions = {
  marks?: Mark[]; rotation?: 0 | 90 | 180 | 270; markers?: boolean;
  originY?:number; bubbleDx?:number; bubbleDy?:number;
  tilt?:number;
};
// Synthetic geometry from the existing reader, NOT a replacement OMR engine.
// No student data or production image is used. All units below are template units.
export function syntheticSheet(options: FixtureOptions = {}) {
  let width = 900, height = 1280;
  let data = new Uint8Array(width * height * 4).fill(255);
  const scale = 4, ox = 70, oy = options.originY??738;
  function pixel(x: number, y: number, color: number[]) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = (y * width + x) * 4;
    data[p] = color[0]; data[p + 1] = color[1]; data[p + 2] = color[2];
  }
  function disk(x: number, y: number, r: number, color: number[], outline = false) {
    const cx = ox + x * scale, cy = oy + y * scale, radius = r * scale;
    for (let py = Math.floor(cy - radius - 1); py <= cy + radius + 1; py++) {
      for (let px = Math.floor(cx - radius - 1); px <= cx + radius + 1; px++) {
        const d = Math.hypot(px - cx, py - cy);
        if (outline ? Math.abs(d - radius) <= .5 : d <= radius) pixel(px, py, color);
      }
    }
  }
  if (options.markers !== false) {
    for (const [x, y] of [[4, 4], [176, 4], [4, 108], [176, 108]]) {
      const cx = ox + x * scale, cy = oy + y * scale;
      for (let py = cy - 4; py < cy + 4; py++)
        for (let px = cx - 4; px < cx + 4; px++) pixel(px, py, [0, 0, 0]);
    }
  }
  const rights = [171, 128, 85, 42], offsets = [7.5, 15.5, 23.5, 31.5];
  for (let row = 0; row < 60; row++) {
    const right = rights[Math.floor(row / 15)], y = 20 + (row % 15) * 5.45;
    for (const off of offsets) disk(right - off+(options.bubbleDx||0), y+(options.bubbleDy||0), 2.08, [0, 0, 0], true);
  }
  for (const mark of options.marks || []) {
    const x = rights[Math.floor(mark.row / 15)] - offsets[mark.option] + (mark.dx || 0)+(options.bubbleDx||0);
    const y = 20 + (mark.row % 15) * 5.45 + (mark.dy || 0)+(options.bubbleDy||0);
    disk(x, y, mark.radius ?? 1.8, mark.color || [25, 25, 25]);
  }
  if(options.tilt){
    const angle=options.tilt*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),out=new Uint8Array(data.length).fill(255);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const dx=x-width/2,dy=y-height/2,sx=Math.round(c*dx+s*dy+width/2),sy=Math.round(-s*dx+c*dy+height/2);
      if(sx<0||sy<0||sx>=width||sy>=height)continue;
      out.set(data.subarray((sy*width+sx)*4,(sy*width+sx)*4+4),(y*width+x)*4);
    }
    data=out;
  }
  const turns = (options.rotation || 0) / 90;
  for (let turn = 0; turn < turns; turn++) {
    const nw = height, nh = width, out = new Uint8Array(data.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4, dst = (x * nw + height - 1 - y) * 4;
      out.set(data.subarray(src, src + 4), dst);
    }
    data = out; width = nw; height = nh;
  }
  return `data:image/jpeg;base64,${Buffer.from(jpeg.encode({ width, height, data }, 90).data).toString("base64")}`;
}
export const blue: [number, number, number] = [20, 40, 165];
