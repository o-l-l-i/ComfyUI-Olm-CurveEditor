const DEFAULT_STYLE = {
  width: 240,
  height: 25,
  marginTop: 170,
  highlightColor: "#666",
  normalColor: "#444",
  selectedColor: "#888",
  hoveredColor: "#555",
  strokeColor: "#555",
  textColor: "#fff",
  font: "10px Arial",
};

export class ButtonWidget {
  constructor(node, ids, labels, current, onChange, options = {}) {
    this.node = node;
    this.ids = ids;
    this.labels = labels;
    this.current = current;
    this.onChange = onChange;

    this.width = options.width || DEFAULT_STYLE.width;
    this.height = options.height || DEFAULT_STYLE.height;
    this.marginTop = options.marginTop || 170;
    this.highlightColor =
      options.highlightColor || DEFAULT_STYLE.highlightColor;
    this.normalColor = options.normalColor || DEFAULT_STYLE.normalColor;
    this.selectedColor = options.selectedColor || DEFAULT_STYLE.selectedColor;
    this.hoveredColor = options.hoveredColor || DEFAULT_STYLE.hoveredColor;
    this.strokeColor = options.strokeColor || DEFAULT_STYLE.strokeColor;
    this.textColor = options.textColor || DEFAULT_STYLE.textColor;
    this.font = options.font || DEFAULT_STYLE.font;

    this.isMouseDown = false;
    this.activeButton = null;
    this.hoveredButton = null;

    this.stateless = options.stateless || [];

    this.x = 0;
    this.y = 0;
  }

  draw(ctx) {
    const btnWidth = this.width / this.labels.length;
    this.x = (this.node.size[0] - this.width) / 2;
    this.y = this.marginTop;

    this.labels.forEach((label, i) => {
      const x = this.x + i * btnWidth;
      const y = this.y;
      const id = this.ids[i];

      const isSelected = this.current === id && !this.stateless.includes(id);
      const isHighlighted = this.isMouseDown && this.activeButton === i;
      const isHovered = this.hoveredButton === i;

      ctx.fillStyle = isHighlighted
        ? this.highlightColor
        : isSelected
        ? this.selectedColor
        : isHovered
        ? this.hoveredColor
        : this.normalColor;

      ctx.fillRect(x, y, btnWidth - 2, this.height - 2);
      ctx.strokeStyle = this.strokeColor;
      ctx.strokeRect(x, y, btnWidth - 2, this.height - 2);

      ctx.fillStyle = this.textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = this.font;
      ctx.fillText(label, x + btnWidth / 2 - 1, y + this.height / 2);
    });
  }

  onMouseDown(e, localPos) {
    if (this.isMouseDown) return false;

    const [mx, my] = localPos;
    this.x = (this.node.size[0] - this.width) / 2;
    this.y = this.marginTop;

    if (
      mx < this.x ||
      mx > this.x + this.width ||
      my < this.y ||
      my > this.y + this.height
    ) {
      return false;
    }

    const btnWidth = this.width / this.labels.length;
    const index = Math.floor((mx - this.x) / btnWidth);
    const selectedId = this.ids[index];
    const selectedLabel = this.labels[index];

    if (selectedId === undefined) return false;

    const isStateless = this.stateless.includes(selectedId);
    const shouldTrigger = isStateless || selectedId !== this.current;

    this.isMouseDown = true;
    this.activeButton = index;

    if (shouldTrigger) {
      this.current = selectedId;
      this.onChange?.(selectedId, selectedLabel);
    }

    this.node.setDirtyCanvas(true, true);
    return true;
  }

  onMouseMove(e, localPos) {
    const [mx, my] = localPos;
    this.x = (this.node.size[0] - this.width) / 2;
    this.y = this.marginTop;

    const isInBounds =
      mx >= this.x &&
      mx <= this.x + this.width &&
      my >= this.y &&
      my <= this.y + this.height;

    if (isInBounds) {
      const btnWidth = this.width / this.labels.length;
      const index = Math.floor((mx - this.x) / btnWidth);
      if (index !== this.hoveredButton) {
        this.hoveredButton = index;
        this.node.setDirtyCanvas(true, true);
      }
    } else {
      if (this.hoveredButton !== null) {
        this.hoveredButton = null;
        this.node.setDirtyCanvas(true, true);
      }
    }

    if (this.isMouseDown && e.buttons !== 1) {
      this.onMouseUp();
    }

    return true;
  }

  onMouseUp() {
    this.isMouseDown = false;
    this.node.setDirtyCanvas(true, true);
    return true;
  }

  onMouseLeave() {
    this.hoveredButton = null;
    this.onMouseUp();
    return false;
  }

  setValue(newValue) {
    this.current = newValue;
    this.node.setDirtyCanvas(true, true);
  }
}
