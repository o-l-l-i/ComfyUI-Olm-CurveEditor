import { drawCurve, drawVerticalLine } from "./draw_utils.js";
import { getSmoothMonotonicCurveHermite } from "./curve_math.js";

const DEFAULT_HOVER_LINE = {
  strokeStyle: "rgba(255,255,255,0.3)",
  lineWidth: 1,
  dash: [2, 2],
};

const HIT_RADIUS_SCALE = 2.5;

export class CurveEditorWidget {
  constructor(node, curveSpec, onCurveChange) {
    this.node = node;
    this.spec = curveSpec;
    this.onCurveChange = onCurveChange;

    this.points = [];
    this.dragIndex = null;
    this.isMouseDown = false;
    this.hoveredPointIndex = null;

    this.layout = { x: 0, y: 0, width: 0, height: 0 };
  }

  updateLayout(layout) {
    this.layout = layout;
  }

  draw(ctx, ghostPoints = []) {
    if (this.layout.width <= 0 || this.layout.height <= 0) return;

    if (ghostPoints.length > 0) {
      drawCurve(ctx, ghostPoints, this.layout, {
        curveColor: "rgba(0, 200, 255, 0.3)",
        curveWidth: 2,
      });
    }

    this._drawCurve(ctx);
    this._drawHoverIndicators(ctx);
  }

  _drawCurve(ctx) {
    const curvePathPoints = getSmoothMonotonicCurveHermite(
      this.points,
      this.spec.resolution
    );

    drawCurve(
      ctx,
      curvePathPoints,
      this.layout,
      {
        curveColor: this.spec.curveColor || "white",
        curveWidth: this.spec.activeWidth || 1,
      },
      this.points,
      {
        pointRadius: this.spec.pointRadius,
        pointColor: this.spec.pointColor || "white",
        highlightIndex: this.hoveredPointIndex,
        highlightColor: this.spec.highlightColor || "yellow",
      }
    );
  }

  _drawHoverIndicators(ctx) {
    if (
      this.hoveredPointIndex !== null &&
      this.points[this.hoveredPointIndex]
    ) {
      const point = this.points[this.hoveredPointIndex];
      const xPixel = this.layout.x + point.x * this.layout.width;
      drawVerticalLine(
        ctx,
        xPixel,
        this.layout.y,
        this.layout.y + this.layout.height,
        DEFAULT_HOVER_LINE
      );
    }
  }

  _isInBounds(mx, my) {
    const { x, y, width, height } = this.layout;
    return mx >= x && mx <= x + width && my >= y && my <= y + height;
  }

  _pointUnderCursor(cursorX, cursorY) {
    const hitRadiusSq = (this.spec.pointRadius * HIT_RADIUS_SCALE) ** 2;

    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const px = this.layout.x + p.x * this.layout.width;
      const py = this.layout.y + (1 - p.y) * this.layout.height;
      const dx = cursorX - px;
      const dy = cursorY - py;

      if (dx * dx + dy * dy <= hitRadiusSq) {
        return i;
      }
    }
    return -1;
  }

  onMouseDown(e, localPos) {
    const [mx, my] = localPos;
    if (!this._isInBounds(mx, my)) return false;

    this.isMouseDown = true;
    this.dragIndex = this._pointUnderCursor(mx, my);

    if (e.shiftKey && this.dragIndex !== -1) {
      const point = this.points[this.dragIndex];

      if (point.x > 0.001 && point.x < 0.999 && this.points.length > 2) {
        this.points.splice(this.dragIndex, 1);
        this.onCurveChange(this.points);
      }
      this.dragIndex = null;
      this.isMouseDown = false;
      return true;
    }

    if (this.dragIndex === -1 && this.points.length < this.spec.maxPoints) {
      const xNorm = Math.max(
        0,
        Math.min(1, (mx - this.layout.x) / this.layout.width)
      );
      const yNorm = Math.max(
        0,
        Math.min(1, 1 - (my - this.layout.y) / this.layout.height)
      );

      const newPoint = { x: xNorm, y: yNorm };
      this.points.push(newPoint);
      this.points.sort((a, b) => a.x - b.x);
      this.dragIndex = this.points.indexOf(newPoint);
      this.onCurveChange(this.points);
    }

    this.node.setDirtyCanvas(true, true);
    return true;
  }

  onMouseMove(e, localPos) {
    const [mx, my] = localPos;
    let redrawNeeded = false;

    const oldHoverIndex = this.hoveredPointIndex;
    if (this._isInBounds(mx, my)) {
      this.hoveredPointIndex = this._pointUnderCursor(mx, my);
    } else {
      this.hoveredPointIndex = null;
    }

    if (oldHoverIndex !== this.hoveredPointIndex) {
      redrawNeeded = true;
    }

    if (this.isMouseDown && this.dragIndex !== null) {
      if (e.buttons !== 1) {
        return this.onMouseUp(e, localPos);
      }
      this._dragCurvePoint(mx, my);
      redrawNeeded = true;
    }

    if (redrawNeeded) this.node.setDirtyCanvas(true, true);

    return this._isInBounds(mx, my);
  }

  onMouseUp(e, localPos) {
    if (this.isMouseDown) {
      this.isMouseDown = false;
      this.dragIndex = null;
      this.onCurveChange(this.points);
      return true;
    }
    return false;
  }

  onMouseLeave(e, localPos) {
    this.hoveredPointIndex = null;
    if (this.isMouseDown) {
      this.onMouseUp(e, localPos);
    }
    this.node.setDirtyCanvas(true, true);
    return true;
  }

  _dragCurvePoint(mx, my) {
    if (this.dragIndex === null || !this.points[this.dragIndex]) return;

    const { x, y, width, height } = this.layout;
    const point = this.points[this.dragIndex];

    point.y = Math.max(0, Math.min(1, 1 - (my - y) / height));

    const isEndpoint =
      this.dragIndex === 0 || this.dragIndex === this.points.length - 1;
    if (!isEndpoint) {
      const xNorm = (mx - x) / width;
      const prevPointX = this.points[this.dragIndex - 1]?.x ?? 0;
      const nextPointX = this.points[this.dragIndex + 1]?.x ?? 1;
      point.x = Math.max(prevPointX, Math.min(nextPointX, xNorm));
    }

    this.onCurveChange(this.points);
  }

  setCurveData(newPoints) {
    this.points = JSON.parse(JSON.stringify(newPoints || []));
    this.node.setDirtyCanvas(true, true);
  }

  getCurveData() {
    return JSON.parse(JSON.stringify(this.points));
  }
}
