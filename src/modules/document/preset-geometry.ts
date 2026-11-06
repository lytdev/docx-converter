const clamp = (value: number) => Math.max(0, Math.min(1, value));

function polygon(width: number, height: number, points: [number, number][]): string {
  return `M${points.map(([x, y]) => `${x * width} ${y * height}`).join('L')}Z`;
}

/** Common DrawingML presets used by Word groups and cached SmartArt drawings. */
export function presetGeometry(geometry: string, width: number, height: number, paint: string): string {
  const shape = (tag: string, attributes = '') => `<${tag} ${attributes} ${paint}/>`;
  const path = (d: string) => `<path d="${d}" ${paint}/>`;
  switch (geometry) {
    case 'rect':
    case 'flowChartProcess':
      return shape('rect', `width="${width}" height="${height}"`);
    case 'roundRect':
    case 'flowChartTerminator':
      return shape('rect', `width="${width}" height="${height}" rx="${Math.min(width, height) / 6}"`);
    case 'ellipse':
    case 'flowChartConnector':
      return shape('ellipse', `cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}"`);
    case 'triangle':
      return path(polygon(width, height, [[.5, 0], [1, 1], [0, 1]]));
    case 'rtTriangle':
      return path(polygon(width, height, [[0, 0], [0, 1], [1, 1]]));
    case 'diamond':
    case 'flowChartDecision':
      return path(polygon(width, height, [[.5, 0], [1, .5], [.5, 1], [0, .5]]));
    case 'parallelogram':
    case 'flowChartInputOutput':
      return path(polygon(width, height, [[.22, 0], [1, 0], [.78, 1], [0, 1]]));
    case 'trapezoid':
      return path(polygon(width, height, [[.2, 0], [.8, 0], [1, 1], [0, 1]]));
    case 'pentagon':
      return path(polygon(width, height, [[.5, 0], [1, .38], [.82, 1], [.18, 1], [0, .38]]));
    case 'hexagon':
      return path(polygon(width, height, [[.22, 0], [.78, 0], [1, .5], [.78, 1], [.22, 1], [0, .5]]));
    case 'octagon':
      return path(polygon(width, height, [[.29, 0], [.71, 0], [1, .29], [1, .71], [.71, 1], [.29, 1], [0, .71], [0, .29]]));
    case 'rightArrow':
      return path(polygon(width, height, [[0, .28], [.68, .28], [.68, 0], [1, .5], [.68, 1], [.68, .72], [0, .72]]));
    case 'leftArrow':
      return path(polygon(width, height, [[1, .28], [.32, .28], [.32, 0], [0, .5], [.32, 1], [.32, .72], [1, .72]]));
    case 'upArrow':
      return path(polygon(width, height, [[.28, 1], [.28, .32], [0, .32], [.5, 0], [1, .32], [.72, .32], [.72, 1]]));
    case 'downArrow':
      return path(polygon(width, height, [[.28, 0], [.72, 0], [.72, .58], [1, .58], [.5, 1], [0, .58], [.28, .58]]));
    case 'leftRightArrow':
      return path(polygon(width, height, [[0, .5], [.24, 0], [.24, .28], [.76, .28], [.76, 0], [1, .5], [.76, 1], [.76, .72], [.24, .72], [.24, 1]]));
    case 'upDownArrow':
      return path(polygon(width, height, [[.5, 0], [1, .24], [.72, .24], [.72, .76], [1, .76], [.5, 1], [0, .76], [.28, .76], [.28, .24], [0, .24]]));
    case 'chevron':
      return path(polygon(width, height, [[0, 0], [.78, 0], [1, .5], [.78, 1], [0, 1], [.22, .5]]));
    case 'homePlate':
      return path(polygon(width, height, [[0, 0], [.78, 0], [1, .5], [.78, 1], [0, 1]]));
    case 'star4':
      return path(polygon(width, height, [[.5, 0], [.64, .36], [1, .5], [.64, .64], [.5, 1], [.36, .64], [0, .5], [.36, .36]]));
    case 'star5': {
      const points: [number, number][] = [];
      for (let index = 0; index < 10; index++) {
        const angle = -Math.PI / 2 + index * Math.PI / 5;
        const radius = index % 2 ? .23 : .5;
        points.push([clamp(.5 + Math.cos(angle) * radius), clamp(.5 + Math.sin(angle) * radius)]);
      }
      return path(polygon(width, height, points));
    }
    case 'pieWedge':
      return path(`M${width} ${height}L0 ${height}A${width} ${height} 0 0 1 ${width} 0Z`);
    default:
      return shape('rect', `width="${width}" height="${height}" rx="${Math.min(width, height) / 12}"`);
  }
}
