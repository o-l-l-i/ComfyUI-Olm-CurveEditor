import { app } from "../../scripts/app.js";
import { ButtonWidget } from "./button_widget.js";
import { CurveEditorWidget } from "./curve_editor_widget.js";
import { drawCurveBackground, drawCurve } from "./draw_utils.js";
import { getSmoothMonotonicCurveHermite } from "./curve_math.js";

const CHANNEL_COLORS = {
  r: "#e55",
  g: "#5e5",
  b: "#55e",
  luma: "#ccc",
};

const LINEAR_CURVE = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

const MIN_WIDTH = 360;
const MIN_HEIGHT = 240;
const PADDING = 20;

const CHANNELS = ["r", "g", "b", "luma"];
const LABELS = ["R", "G", "B", "Y"];

const CURVE_EDITOR_CONFIG = {
  resolution: 100,
  activeWidth: 3,
  pointRadius: 5,
  maxPoints: 18,
  grid_x: 5,
  grid_y: 5,
};

app.registerExtension({
  name: "olm.ModernCurveEditor",
  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name !== "OlmCurveEditor") return;

    nodeType.prototype.getWidget = function (name) {
      return this.widgets.find((w) => w.name === name);
    };

    nodeType.prototype.getWidgetValue = function (name, fallback = null) {
      return this.widgets.find((w) => w.name === name)?.value || fallback;
    };

    nodeType.prototype.setWidgetValue = function (widgetName, val) {
      const widget = this.getWidget(widgetName);
      if (widget && val !== null && val !== undefined) {
        widget.value = val;
      }
    };

    function removeInputs(node, filter) {
      if (
        !node ||
        node.type !== "OlmCurveEditor" ||
        node.id === -1 ||
        !Array.isArray(node.inputs)
      ) {
        return;
      }
      for (let i = node.inputs.length - 1; i >= 0; i--) {
        if (filter(node.inputs[i])) {
          try {
            node.removeInput(i);
          } catch (error) {
            console.warn(
              `[OlmCurveEditor] Node ${node.id}: skipping input removal (graph not ready):`,
              node.inputs[i].name
            );
          }
        }
      }
    }

    function cloneCurve(points) {
      return JSON.stringify(points);
    }

    function parseCurve(pointsJSON) {
      return JSON.parse(pointsJSON);
    }

    nodeType.prototype.onNodeCreated = function () {
      this.serialize_widgets = true;
      this.min_size = [MIN_WIDTH, MIN_HEIGHT];
      this.resizable = true;
      this.size = this.computeSize();

      this.activeChannel = "luma";

      this.channelCurves = {
        r: [...LINEAR_CURVE],
        g: [...LINEAR_CURVE],
        b: [...LINEAR_CURVE],
        luma: [...LINEAR_CURVE],
      };

      this.refresh = () => {
        this.setDirtyCanvas(true, true);
      };

      this.presetWidget = this.addWidget(
        "combo",
        "Preset",
        "None",
        (v) => this.onPresetSelected(v),
        { values: ["Loading..."] }
      );

      this.channelButtons = new ButtonWidget(
        this,
        CHANNELS,
        LABELS,
        this.activeChannel,
        (id) => {
          this.activeChannel = id;

          this.channelButtons.setValue(id);
          this.curveEditor.setCurveData(this.channelCurves[id]);
          this.refresh();
        },
        { width: 200, height: 30, marginTop: 100 }
      );

      this.resetBar = new ButtonWidget(
        this,
        ["reset", "resetAll"],
        ["↻ Reset", "Reset All"],
        null,
        (id) => {
          if (id === "reset") {
            this.channelCurves[this.activeChannel] = [...LINEAR_CURVE];
          } else if (id === "resetAll") {
            const confirmed = window.confirm(
              "⚠️ Are you sure you want to reset ALL curves?"
            );
            if (!confirmed) return;

            for (const ch of CHANNELS) {
              this.channelCurves[ch] = [...LINEAR_CURVE];
            }

            this.activeChannel = "luma";
            this.channelButtons.setValue("luma");
            this.setWidgetValue("debug_logging", false);
            this.setWidgetValue("strength", 1.0);
          }

          this.curveEditor.setCurveData(this.channelCurves[this.activeChannel]);
          this.sendCurveToBackend();
          this.refresh();
        },
        {
          width: 220,
          height: 30,
          marginTop: 135,
          stateless: ["reset", "resetAll"],
        }
      );

      this.curveEditor = new CurveEditorWidget(
        this,
        CURVE_EDITOR_CONFIG,
        (pts) => {
          this.channelCurves[this.activeChannel] = [...pts];
          this.scheduleCurveUpdate();
          this.refresh();
        }
      );
      this.curveEditor.setCurveData(this.channelCurves[this.activeChannel]);

      const initJSON = cloneCurve(this.channelCurves);
      this.jsonWidget = this.addWidget(
        "text",
        "curve_json",
        initJSON,
        () => {}
      );
      this.jsonWidget.hidden = true;
      this.properties.curve_json = initJSON;

      this.refresh();
    };

    nodeType.prototype.computeSize = () => [MIN_WIDTH, MIN_HEIGHT];

    const originalOnConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (o) {
      if (originalOnConfigure) originalOnConfigure.call(this, o);
      removeInputs(this, (inp) =>
        ["FLOAT", "STRING", "BOOLEAN"].includes(inp.type)
      );
      if (this.properties.curve_json) {
        try {
          this.channelCurves = parseCurve(this.properties.curve_json);
          this.curveEditor.setCurveData(this.channelCurves[this.activeChannel]);
        } catch (e) {
          console.warn("Failed to parse curve_json:", e);
        }
      }
    };

    nodeType.prototype.loadCurvePresets = async function () {
      try {
        const response = await fetch("/olm/api/curve_presets/list");
        const json = await response.json();
        const values = ["None", ...(json.presets || [])];
        this.presetWidget.options.values = values;
        this.presetWidget.value = "None";
        this.refresh();
      } catch (e) {
        console.error("Failed to load curve presets:", e);
        this.presetWidget.options.values = ["Error loading presets"];
        this.presetWidget.value = "Error loading presets";
      }
    };

    nodeType.prototype.onPresetSelected = async function (filename) {
      if (!filename || filename === "None" || filename.startsWith("Error"))
        return;
      try {
        const response = await fetch(
          `/olm/api/curve_presets/load?filename=${encodeURIComponent(filename)}`
        );
        const json = await response.json();
        if (json.data) {
          this.channelCurves = JSON.parse(json.data);
          this.curveEditor.setCurveData(this.channelCurves[this.activeChannel]);
          this.sendCurveToBackend();
          this.refresh();
        }
      } catch (e) {
        console.error("Failed to load preset data:", e);
      }
    };

    nodeType.prototype.onAdded = function () {
      const node = this;

      const originalOnMouseDown = node.onMouseDown;
      const originalOnMouseMove = node.onMouseMove;
      const originalOnMouseUp = node.onMouseUp;
      const originalOnMouseLeave = node.onMouseLeave;

      node.onMouseDown = function (e, pos, canvas) {
        const wasHandled = originalOnMouseDown?.call(this, e, pos, canvas);
        if (wasHandled) return true;

        if (this.channelButtons?.onMouseDown?.(e, pos)) return true;
        if (this.resetBar?.onMouseDown?.(e, pos)) return true;
        if (this.curveEditor?.onMouseDown?.(e, [pos[0], pos[1]])) return true;

        return false;
      };

      node.onMouseMove = function (e, pos, canvas) {
        const wasHandled = originalOnMouseMove?.call(this, e, pos, canvas);
        let handled = wasHandled ?? false;

        if (this.channelButtons?.onMouseMove?.(e, pos)) handled = true;
        if (this.resetBar?.onMouseMove?.(e, pos)) handled = true;
        if (this.curveEditor?.onMouseMove?.(e, [pos[0], pos[1]]))
          handled = true;

        return handled;
      };

      node.onMouseUp = function (e, pos, canvas) {
        const wasHandled = originalOnMouseUp?.call(this, e, pos, canvas);
        if (wasHandled) return true;

        this.channelButtons?.onMouseUp?.(e, pos);
        this.resetBar?.onMouseUp?.(e, pos);
        this.curveEditor?.onMouseUp?.(e, [pos[0], pos[1]]);

        this.sendCurveToBackend?.();

        return false;
      };

      node.onMouseLeave = function (e, pos, canvas) {
        const wasHandled = originalOnMouseLeave?.call(this, e, pos, canvas);
        if (wasHandled) return true;

        const fallbackPos = pos ?? [
          Number.NEGATIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
        ];

        this.channelButtons?.onMouseUp?.(e, fallbackPos);
        this.resetBar?.onMouseUp?.(e, fallbackPos);
        this.curveEditor?.onMouseUp?.(e, fallbackPos);

        return false;
      };

      removeInputs(this, (inp) =>
        ["FLOAT", "STRING", "BOOLEAN"].includes(inp.type)
      );
      setTimeout(() => this.loadCurvePresets(), 50);
    };

    nodeType.prototype.drawTabs = function (ctx) {
      this.channelButtons.draw(ctx);
      this.resetBar.draw(ctx);
    };

    nodeType.prototype.drawCurveArea = function (ctx) {
      const x = PADDING;
      const y = PADDING + 150;
      const width = this.size[0] - 2 * PADDING;
      const height = this.size[1] - y - PADDING;
      const area = { x, y, width, height, grid_x: 5, grid_y: 5 };

      drawCurveBackground(ctx, area, {});

      for (let ch of CHANNELS) {
        if (ch === this.activeChannel) continue;
        const pts = this.channelCurves[ch] || [];
        const smooth = getSmoothMonotonicCurveHermite(
          pts,
          this.curveEditor.spec.resolution
        );
        ctx.save();
        ctx.setLineDash([5, 3]);
        ctx.globalAlpha = 0.3;
        drawCurve(ctx, smooth, area, {
          curveColor: CHANNEL_COLORS[ch],
          curveWidth: this.curveEditor.spec.activeWidth,
        });
        ctx.restore();
      }

      this.curveEditor.updateLayout(area);

      const col = CHANNEL_COLORS[this.activeChannel];
      this.curveEditor.spec.curveColor = col;
      this.curveEditor.spec.pointColor = col;
      this.curveEditor.spec.highlightColor = "#fff";

      this.curveEditor.draw(ctx);
    };

    nodeType.prototype.onDrawForeground = function (ctx) {
      if (this.collapsed) return;
      ctx.save();
      this.drawTabs(ctx);
      this.drawCurveArea(ctx);
      ctx.restore();
    };

    nodeType.prototype._curvePostDebounce = null;

    nodeType.prototype.scheduleCurveUpdate = function () {
      if (this._curvePostDebounce !== null) return;

      this._curvePostDebounce = setTimeout(() => {
        this.sendCurveToBackend();
        this._curvePostDebounce = null;
      }, 100);
    };

    nodeType.prototype.sendCurveToBackend = async function () {
      const json = cloneCurve(this.channelCurves);
      this.jsonWidget.value = json;
      this.properties.curve_json = json;
      const debugLogging = this.getWidget("debug_logging").value;
      try {
        await fetch("/olm/api/curve/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            node_id: this.id,
            curve_data: json,
            debug_logging: debugLogging,
          }),
        });
      } catch (e) {
        console.error(e);
      }
    };
  },
});
