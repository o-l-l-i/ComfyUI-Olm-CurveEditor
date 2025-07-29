const DEFAULT_GRID_STYLE = {
  fillStyle: "#444",
  strokeStyle: "#666",
  gridLineStyle: "rgba(255,255,255,0.1)",
  gridLineWidth: 0.5,
};

export function drawCurveBackground(ctx, area, style) {
  ctx.save();
  ctx.fillStyle = style?.fillStyle || DEFAULT_GRID_STYLE.fillStyle;
  ctx.fillRect(area.x, area.y, area.width, area.height);
  ctx.strokeStyle = style?.strokeStyle || DEFAULT_GRID_STYLE.strokeStyle;
  ctx.lineWidth = style?.lineWidth || 1;
  ctx.strokeRect(area.x, area.y, area.width, area.height);
  ctx.strokeStyle = style?.gridLineStyle || DEFAULT_GRID_STYLE.gridLineStyle;
  ctx.lineWidth = style?.gridLineWidth || DEFAULT_GRID_STYLE.gridLineWidth;
  for (let i = 0; i <= area.grid_y; i++) {
    const y = area.y + i * (area.height / area.grid_y);
    ctx.beginPath();
    ctx.moveTo(area.x, y);
    ctx.lineTo(area.x + area.width, y);
    ctx.stroke();
  }
  for (let i = 0; i <= area.grid_x; i++) {
    const x = area.x + i * (area.width / area.grid_x);
    ctx.beginPath();
    ctx.moveTo(x, area.y);
    ctx.lineTo(x, area.y + area.height);
    ctx.stroke();
  }
  ctx.restore();
}

const DEFAULT_CURVE_STYLE = {
  curveColor: "white",
  curveWidth: 1,
  radius: 2,
};

const DEFAULT_POINT_STYLE = {
  highlightColor: "yellow",
  pointColor: "white",
  strokeStyle: "#000",
  lineWidth: 1,
  lineWidthHighlighted: 2,
};

export function drawCurve(
  ctx,
  curvePoints,
  area,
  style,
  controlPoints = [],
  pointStyle = {}
) {
  ctx.save();

  ctx.strokeStyle = style.curveColor || DEFAULT_CURVE_STYLE.curveColor;
  ctx.lineWidth = style.curveWidth || DEFAULT_CURVE_STYLE.curveWidth;
  ctx.beginPath();
  if (curvePoints.length > 0) {
    ctx.moveTo(
      area.x + curvePoints[0].x * area.width,
      area.y + (1 - curvePoints[0].y) * area.height
    );
    for (let i = 1; i < curvePoints.length; i++) {
      ctx.lineTo(
        area.x + curvePoints[i].x * area.width,
        area.y + (1 - curvePoints[i].y) * area.height
      );
    }
  }
  ctx.stroke();

  for (let i = 0; i < controlPoints.length; i++) {
    const p = controlPoints[i];
    const x = area.x + p.x * area.width;
    const y = area.y + (1 - p.y) * area.height;
    ctx.beginPath();
    const isHighlight = pointStyle.highlightIndex === i;
    ctx.arc(
      x,
      y,
      (isHighlight ? pointStyle.pointRadius * 1.5 : pointStyle.pointRadius) ||
        DEFAULT_CURVE_STYLE.radius,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = isHighlight
      ? pointStyle.highlightColor || DEFAULT_POINT_STYLE.highlightColor
      : pointStyle.pointColor || DEFAULT_POINT_STYLE.pointColor;
    ctx.fill();
    ctx.strokeStyle = DEFAULT_POINT_STYLE.strokeStyle;
    ctx.lineWidth = isHighlight
      ? DEFAULT_POINT_STYLE.lineWidthHighlighted
      : DEFAULT_POINT_STYLE.lineWidth;
    ctx.stroke();
  }

  ctx.restore();
}

const DEFAULT_LINE_STYLE = {
  strokeStyle: "rgba(255,255,255,0.3)",
  lineWidth: 1,
  lineDash: [2, 2],
};

export function drawVerticalLine(ctx, x, y1, y2, style = {}) {
  ctx.save();
  ctx.strokeStyle = style.strokeStyle || DEFAULT_LINE_STYLE.strokeStyle;
  ctx.lineWidth = style.lineWidth || DEFAULT_LINE_STYLE.lineWidth;
  ctx.setLineDash(style.dash || DEFAULT_LINE_STYLE.lineDash);
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
