import { app } from '../../scripts/app.js';
import { getSmoothMonotonicCurveHermite } from './curve_math.js';

app.registerExtension({
    name: "olm.OlmCurveEditor",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "OlmCurveEditor") return;

        const MIN_WIDTH = 360;
        const MIN_HEIGHT = 200;

        const PADDING = 20;

        const BUTTON = {
            width: 30,
            height: 30,
            x: PADDING,
            y: LiteGraph.NODE_TITLE_HEIGHT + PADDING + 85
        };

        const DEFAULT_CURVE =  Object.freeze([
            { x: 0, y: 0 },
            { x: 1, y: 1 },
        ]);

        const CURVE = {
            width: 300,
            height: 100,
            grid_x: 5,
            grid_y: 5,
            x: PADDING,
            y: BUTTON.y + BUTTON.height + 10,
            activeWidth: 3,
            nonActiveWidth: 2,
            resolution: 100,
            pointRadius: 6,
            maxPoints: 18,
        };

        const TAB_WIDTH = 40;

        const CHANNELS = ["r", "g", "b", "luma"];

        const curveColors = {
            r: { active: "rgba(255,0,0,1)", inactive: "rgba(255,0,0,0.3)" },
            g: { active: "rgba(0,255,0,1)", inactive: "rgba(0,255,0,0.3)" },
            b: { active: "rgba(0,0,255,1)", inactive: "rgba(0,0,255,0.3)" },
            luma: { active: "rgba(255,255,255,1)", inactive: "rgba(128,128,128,0.3)" },
        };


        nodeType.prototype.initEventListeners = function () {
            this.boundMouseUp = this.globalMouseUpHandler.bind(this);
            document.addEventListener("mouseup", this.boundMouseUp, { capture: true });
            document.addEventListener("pointerup", this.boundMouseUp, { capture: true });
            document.addEventListener("pointercancel", this.boundMouseUp, { capture: true });
        };


        nodeType.prototype.loadCurvePresets = async function() {
            try {
                const response = await fetch("/api/curve_presets/list");
                const json = await response.json();

                const preset_widget = this.getWidget("Preset");
                if (!preset_widget) {
                    console.warn("Preset widget not found!");
                    return;
                }

                if (json.presets && json.presets.length > 0) {
                    const presetOptions = ["None", ...json.presets];
                    preset_widget.options.values = presetOptions;
                    preset_widget.value = "None";

                    const originalCallback = preset_widget.callback;
                    preset_widget.callback = null;

                    setTimeout(() => {
                        preset_widget.callback = originalCallback;
                    }, 100);

                    this.setDirtyCanvas(true, true);
                } else {
                    console.log("Could not find presets");
                    preset_widget.options.values = ["No presets found"];
                    preset_widget.value = "No presets found";
                    this.setDirtyCanvas(true, true);
                }
            } catch (error) {
                console.error("Failed to load presets:", error);
                const preset_widget = this.getWidget("Preset");
                if (preset_widget) {
                    preset_widget.options.values = ["Error loading presets"];
                    preset_widget.value = "Error loading presets";
                }
            }
        };


        nodeType.prototype.onPresetSelected = async function(filename) {
            if (!filename || filename === "None" || filename === "No presets found" || filename === "Error loading presets") {
                return;
            }

            try {
                const response = await fetch(`/api/curve_presets/load?filename=${encodeURIComponent(filename)}`);
                const json = await response.json();
                if (json.data) {
                    this.channelCurves = JSON.parse(json.data);
                    this.curveWidget.value = json.data;
                    this.properties.curve_json = json.data;
                    this.sendCurveToBackend();
                    this.setDirtyCanvas(true, true);
                } else {
                    console.error("Failed to load preset data:", json.error);
                }
            } catch (error) {
                console.error("Error loading preset:", error);
            }
        };


        nodeType.prototype.getWidget = function (name) {
            return this.widgets.find(w => w.name === name);
        };


        nodeType.prototype.cacheWidgets = function () {
            if (!this.widgets) return;
            this.curveWidget = this.widgets.find((w) => w.name === "curve_json");
        };


        nodeType.prototype.sendCurveToBackend = async function () {
            try {
                const debugLogging = this.getWidget("debug_logging").value;
                const response = await fetch("/api/curve/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        node_id: this.id,
                        curve_data: JSON.stringify(this.channelCurves),
                        debug_logging: debugLogging,
                    }),
                });
                const json = await response.json();
                if (json.status === "success") {
                    this.properties.curve_json = JSON.stringify(this.channelCurves);
                } else {
                    console.error("❌ Backend save failed:", json.error || "Unknown error");
                }
            } catch (err) {
                console.error("Error sending curve to backend:", err);
            }
        };


        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        const originalOnDrawForeground = nodeType.prototype.onDrawForeground;
        const originalOnWidgetChanged = nodeType.prototype.onWidgetChanged;
        const originalOnConfigure = nodeType.prototype.onConfigure;
        const originalOnMouseDown = nodeType.prototype.onMouseDown;
        const originalOnMouseMove = nodeType.prototype.onMouseMove;
        const originalOnMouseUp = nodeType.prototype.onMouseUp;


        nodeType.prototype.onNodeCreated = function () {
            if (originalOnNodeCreated) originalOnNodeCreated.call(this);

            this.serialize_widgets = true;
            this.min_size = [MIN_WIDTH, MIN_HEIGHT];
            this.resizable = true;

            this.channelCurves = {
                r: [...DEFAULT_CURVE],
                g: [...DEFAULT_CURVE],
                b: [...DEFAULT_CURVE],
                luma: [...DEFAULT_CURVE],
            };
            this.activeChannel = "r";

            this.cacheWidgets();

            this.addWidget("combo", "Preset", "None", (v) => {
                this.onPresetSelected(v);
            }, {
                values: ["None"]
            });

            if (!this.curveWidget) {
                const defaultJSON = JSON.stringify(this.channelCurves);
                this.curveWidget = this.addWidget("text", "curve_json", defaultJSON, () => {});
                this.curveWidget.hidden = true;
                this.properties = this.properties || {};
                this.properties.curve_json = defaultJSON;
            }

            setTimeout(() => {
                this.loadCurvePresets();
            }, 50);

            this.dragIndex = null;
            this.isMouseDown = false;

            this.setSize(this.computeSize());

            this.setDirtyCanvas(true, true);

            this.initEventListeners();
        };


        nodeType.prototype.computeSize = function () {
            let width = MIN_WIDTH;
            let height = Math.max(MIN_HEIGHT, LiteGraph.NODE_TITLE_HEIGHT + PADDING + BUTTON.height + 10 + CURVE.height + PADDING);
            if (this.widgets) {
                height += this.widgets.filter(w => !w.options.hidden).length * 25;
            }
            return [width, height];
        };


        nodeType.prototype.onConfigure = function (o) {
            if (originalOnConfigure) originalOnConfigure.call(this, o);

            this.cacheWidgets();

            if (this.properties && this.properties.curve_json) {
                try {
                    const parsed = JSON.parse(this.properties.curve_json);
                    if (parsed && typeof parsed === "object") {
                        ["r", "g", "b", "luma"].forEach(channel => {
                            if (Array.isArray(parsed[channel]) && parsed[channel].every(p => typeof p.x === "number" && typeof p.y === "number")) {
                                this.channelCurves[channel] = parsed[channel].sort((a, b) => a.x - b.x);
                            } else {
                                this.channelCurves[channel] = [...DEFAULT_CURVE];
                            }
                        });
                    }

                    this.curveWidget.value = this.properties.curve_json;

                    this.sendCurveToBackend();
                } catch (e) {
                    console.warn("Failed to restore curve_json:", e);
                    this.channelCurves = {
                        r: [...DEFAULT_CURVE],
                        g: [...DEFAULT_CURVE],
                        b: [...DEFAULT_CURVE],
                        luma: [...DEFAULT_CURVE],
                    };
                    const fullCurvesJSON = JSON.stringify(this.channelCurves);
                    this.curveWidget.value = fullCurvesJSON;
                }
            }
        };


        nodeType.prototype.onDrawForeground = function (ctx) {
            if (originalOnDrawForeground) originalOnDrawForeground.call(this, ctx);
            this.drawCurveEditor(ctx);
        };


        nodeType.prototype.drawTabs = function(ctx, offsetX) {
            CHANNELS.forEach((ch, i) => {
                const tabX = offsetX + i * (TAB_WIDTH + 5);
                const tabY = BUTTON.y - 35;

                ctx.fillStyle = this.activeChannel === ch ? "#888" : "#444";
                ctx.fillRect(tabX, tabY, TAB_WIDTH, 25);
                ctx.strokeStyle = "#000";
                ctx.strokeRect(tabX, tabY, TAB_WIDTH, 25);

                ctx.fillStyle = "#fff";
                ctx.font = "14px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(ch, tabX + TAB_WIDTH / 2, tabY + 12);
            });
        };


        nodeType.prototype.drawResetButton = function(ctx, buttonX) {
            ctx.fillStyle = "#333";
            ctx.fillRect(buttonX, BUTTON.y, BUTTON.width, BUTTON.height);
            ctx.strokeStyle = "#666";
            ctx.lineWidth = 1;
            ctx.strokeRect(buttonX, BUTTON.y, BUTTON.width, BUTTON.height);
            ctx.fillStyle = "#bbb";
            ctx.font = "20px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("↻", buttonX + BUTTON.width / 2, BUTTON.y + BUTTON.height / 2);
        };


        nodeType.prototype.drawCurveBackground = function(ctx, curveX) {
            ctx.fillStyle = "#444";
            ctx.fillRect(curveX, CURVE.y, CURVE.width, CURVE.height);
            ctx.strokeStyle = "#666";
            ctx.strokeRect(curveX, CURVE.y, CURVE.width, CURVE.height);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.lineWidth = 0.5;
            for (let i = 0; i <= CURVE.grid_y; i++) {
                const y = CURVE.y + i * (CURVE.height / CURVE.grid_y);
                ctx.beginPath();
                ctx.moveTo(curveX, y);
                ctx.lineTo(curveX + CURVE.width, y);
                ctx.stroke();
            }
            for (let i = 0; i <= CURVE.grid_x; i++) {
                const x = curveX + i * (CURVE.width / CURVE.grid_x);
                ctx.beginPath();
                ctx.moveTo(x, CURVE.y);
                ctx.lineTo(x, CURVE.y + CURVE.height);
                ctx.stroke();
            }
        };


        nodeType.prototype.drawInactiveCurves = function(ctx, curveX) {
            const activeKey = this.activeChannel.toLowerCase();

            const curveChannels = {
                "r": curveColors.r.inactive,
                "g": curveColors.g.inactive,
                "b": curveColors.b.inactive,
                "luma": curveColors.luma.inactive,
            };

            for (const ch in curveChannels) {
                if (ch === activeKey) continue;
                const curve = this.channelCurves[ch];
                if (!curve) continue;

                const smooth = getSmoothMonotonicCurveHermite(curve, CURVE.resolution);
                ctx.strokeStyle = curveChannels[ch];
                ctx.lineWidth = CURVE.nonActiveWidth;
                ctx.beginPath();
                if (smooth.length > 0) {
                    ctx.moveTo(
                        curveX + smooth[0].x * CURVE.width,
                        CURVE.y + (1 - smooth[0].y) * CURVE.height
                    );
                    for (let i = 1; i < smooth.length; i++) {
                        ctx.lineTo(
                            curveX + smooth[i].x * CURVE.width,
                            CURVE.y + (1 - smooth[i].y) * CURVE.height
                        );
                    }
                }
                ctx.stroke();
            }
        };


        nodeType.prototype.drawActiveCurve = function (ctx, curveX) {
            const activeKey = this.activeChannel.toLowerCase();

            const activeCurve = this.channelCurves[activeKey];
            if (activeKey) {
                const smooth = getSmoothMonotonicCurveHermite(activeCurve, CURVE.resolution);
                let style = "";
                if (activeKey === "r") style = curveColors.r.active;
                else if (activeKey === "g") style = curveColors.g.active;
                else if (activeKey === "b") style = curveColors.b.active;
                else if (activeKey === "luma") style = curveColors.luma.active;
                ctx.strokeStyle = style;
                ctx.lineWidth = CURVE.activeWidth;
                ctx.beginPath();
                if (smooth.length > 0) {
                    ctx.moveTo(
                        curveX + smooth[0].x * CURVE.width,
                        CURVE.y + (1 - smooth[0].y) * CURVE.height
                    );
                    for (let i = 1; i < smooth.length; i++) {
                        ctx.lineTo(
                            curveX + smooth[i].x * CURVE.width,
                            CURVE.y + (1 - smooth[i].y) * CURVE.height
                        );
                    }
                }
                ctx.stroke();

                for (const p of activeCurve) {
                    const x = curveX + p.x * CURVE.width;
                    const y = CURVE.y + (1 - p.y) * CURVE.height;

                    ctx.beginPath();
                    ctx.arc(x, y, CURVE.pointRadius, 0, Math.PI * 2);
                    ctx.fillStyle = "white";
                    ctx.fill();

                    ctx.strokeStyle = "#000";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        };


        nodeType.prototype.drawCurveEditor = function (ctx) {
            ctx.save();

            const offsetX = (this.size[0] - (CURVE.width + 2 * PADDING)) / 2;
            const buttonX = offsetX + BUTTON.x;
            const curveX = offsetX + CURVE.x;

            this.drawTabs(ctx, offsetX);
            this.drawResetButton(ctx, buttonX);
            this.drawCurveBackground(ctx, curveX);
            this.drawInactiveCurves(ctx, curveX);
            this.drawActiveCurve(ctx, curveX);

            ctx.restore();
        };


        nodeType.prototype.updateCurveState = function () {
            const json = JSON.stringify(this.channelCurves);
            this.curveWidget.value = json;
            this.properties.curve_json = json;
            this.sendCurveToBackend();
            this.setDirtyCanvas(true, true);
        }


        nodeType.prototype._handleTabClick = function(x, y) {
            const offsetX = (this.size[0] - (CURVE.width + 2 * PADDING)) / 2;
            for (let i = 0; i < CHANNELS.length; i++) {
                const tabX = offsetX + i * (TAB_WIDTH + 5);
                const tabY = BUTTON.y - 35;
                const tabH = 25;

                if (x >= tabX && x <= tabX + TAB_WIDTH && y >= tabY && y <= tabY + tabH) {
                    this.activeChannel = CHANNELS[i];
                    this.setDirtyCanvas(true, true);
                    return true;
                }
            }
            return false;
        };


        nodeType.prototype._handleResetClick = function(x, y) {
            const offsetX = (this.size[0] - (CURVE.width + 2 * PADDING)) / 2;
            const buttonX = offsetX + BUTTON.x;
            const resetHit = (
                x >= buttonX && x <= buttonX + BUTTON.width &&
                y >= BUTTON.y && y <= BUTTON.y + BUTTON.height
            );
            if (resetHit) {
                this.channelCurves[this.activeChannel] = [...DEFAULT_CURVE];
                const json = JSON.stringify(this.channelCurves);
                this.curveWidget.value = json;
                this.properties.curve_json = json;
                this.sendCurveToBackend();
                this.setDirtyCanvas(true, true);
                return true;
            }
            return false;
        };


        nodeType.prototype._handleCurveAreaClick = function(event, x, y) {
            const offsetX = (this.size[0] - (CURVE.width + 2 * PADDING)) / 2;
            const curveX = offsetX + CURVE.x;
            const curves = this.channelCurves[this.activeChannel];

            const inCurveBounds = (
                x >= curveX && x <= curveX + CURVE.width &&
                y >= CURVE.y && y <= CURVE.y + CURVE.height
            );
            if (!inCurveBounds) return false;

            this.isMouseDown = true;

            const xNorm = Math.max(0, Math.min(1, (x - curveX) / CURVE.width));
            const yNorm = Math.max(0, Math.min(1, 1 - (y - CURVE.y) / CURVE.height));

            let dragIndex = -1;
            for (let i = 0; i < curves.length; i++) {
                const px = curveX + curves[i].x * CURVE.width;
                const py = CURVE.y + (1 - curves[i].y) * CURVE.height;
                const dx = x - px;
                const dy = y - py;

                if (dx * dx + dy * dy < CURVE.pointRadius * CURVE.pointRadius) {
                    dragIndex = i;
                    break;
                }
            }

            if ((event.shiftKey) && dragIndex !== -1) {
                if (curves.length > 2) {
                    this.channelCurves[this.activeChannel] = curves.filter((_, i) => i !== dragIndex);
                    this.updateCurveState();
                }
                this.dragIndex = null;
                return true;
            }

            if (dragIndex === -1 && curves.length < CURVE.maxPoints) {
                const newPoint = { x: xNorm, y: yNorm };
                const updated = [...curves, newPoint].sort((a, b) => a.x - b.x);

                if (updated[0].x !== 0) updated[0].x = 0;
                if (updated[updated.length - 1].x !== 1) updated[updated.length - 1].x = 1;

                this.channelCurves[this.activeChannel] = updated;
                this.updateCurveState();
            } else {
                this.dragIndex = dragIndex;
            }
            return true;
        }


        nodeType.prototype.onMouseDown = function (event, pos, graphCanvas) {
            if (originalOnMouseDown) originalOnMouseDown.call(this, event, pos, graphCanvas);

            const [x, y] = pos;

            if (this._handleTabClick(x, y)) return true;
            if (this._handleResetClick(x, y)) return true;
            if (this._handleCurveAreaClick(event, x, y)) return true;

            return false;
        };


        nodeType.prototype._isInCurveBounds = function (x, y) {
            const offsetX = (this.size[0] - (CURVE.width + 2 * PADDING)) / 2;
            const curveX = offsetX + CURVE.x;

            return (
                x >= curveX && x <= curveX + CURVE.width &&
                y >= CURVE.y && y <= CURVE.y + CURVE.height
            );
        };


        nodeType.prototype._dragCurvePoint = function (x, y) {
            const offsetX = (this.size[0] - (CURVE.width + 2 * PADDING)) / 2;
            const curveX = offsetX + CURVE.x;
            const xNorm = Math.max(0, Math.min(1, (x - curveX) / CURVE.width));
            const yNorm = Math.max(0, Math.min(1, 1 - (y - CURVE.y) / CURVE.height));

            const curves = this.channelCurves[this.activeChannel];
            const i = this.dragIndex;

            const newX = (i === 0) ? 0 : (i === curves.length - 1) ? 1 : xNorm;
            let newPoint = { x: newX, y: yNorm };

            if (i > 0 && newPoint.x < curves[i - 1].x) {
                newPoint.x = curves[i - 1].x;
            }
            if (i < curves.length - 1 && newPoint.x > curves[i + 1].x) {
                newPoint.x = curves[i + 1].x;
            }

            curves[i] = newPoint;
            this.setDirtyCanvas(true, true);
        };


        nodeType.prototype.onMouseMove = function (event, pos, graphCanvas) {
            if (originalOnMouseMove) originalOnMouseMove.call(this, event, pos, graphCanvas);
            if (this.dragIndex === null || !this.isMouseDown) return false;

            const [x, y] = pos;

            if (!this._isInCurveBounds(x, y)) return false;

            this._dragCurvePoint(x, y);

            return true;
        };


        nodeType.prototype.globalMouseUpHandler = function (e) {
            if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") {
                return;
            }

            const canvas = app.canvas;
            let currentNode = canvas.current_node;

            if (!currentNode || currentNode.type !== "OlmCurveEditor") {
                return;
            }

            if (this.isMouseDown && this.dragIndex !== null) {
                this.isMouseDown = false;
                this.dragIndex = null;
                this.updateCurveState();
            }

            return false;
        };


        nodeType.prototype.onWidgetChanged = function (widget, value, old_value, app) {
            if (originalOnWidgetChanged) originalOnWidgetChanged.call(this, widget, value, old_value, app);

            if (widget.name === "curve_json") {
                try {
                    const newPoints = JSON.parse(value);
                    if (Array.isArray(newPoints) && newPoints.every((p) => typeof p.x === "number" && typeof p.y === "number")) {
                        this.channelCurves[this.activeChannel] = newPoints.sort((a, b) => a.x - b.x);
                        this.properties.curve_json = value;
                        this.sendCurveToBackend();
                        this.setDirtyCanvas(true, true);
                    }
                } catch (e) {
                    console.error("Error parsing curve_json:", e);
                }
            }
        };


        nodeType.prototype.onRemoved = function () {
            if (this.boundMouseUp) {
                document.removeEventListener("mouseup", this.boundMouseUp, { capture: true });
                document.removeEventListener("pointerup", this.boundMouseUp, { capture: true });
                document.removeEventListener("pointercancel", this.boundMouseUp, { capture: true });
            }
        };

    },
});