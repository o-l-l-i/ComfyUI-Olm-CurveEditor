from server import PromptServer
from aiohttp import web
import json, os, torch
import numpy as np
from scipy.interpolate import interp1d


@PromptServer.instance.routes.get("/api/curve_presets/list")
async def list_curve_presets(request):
    folder = os.path.join(os.path.dirname(__file__), "curve_presets")
    try:
        if not os.path.exists(folder):
            print(f"Curve presets folder does not exist: {folder}")
            return web.json_response({"presets": []})

        files = [f for f in os.listdir(folder) if f.lower().endswith(".json")]

        def sort_key(filename):
            if filename.lower() == "default_curve.json":
                return (0, filename)
            else:
                return (1, filename.lower())

        files.sort(key=sort_key)

        return web.json_response({"presets": files})

    except Exception as e:
        print(f"Error listing curve presets: {e}")
        return web.json_response({"presets": []})


@PromptServer.instance.routes.get("/api/curve_presets/load")
async def load_curve_preset(request):
    filename = request.query.get("filename", "")
    folder = os.path.join(os.path.dirname(__file__), "curve_presets")
    filepath = os.path.join(folder, filename)
    if not os.path.exists(filepath):
        return web.json_response({"error": "Preset file not found"}, status=404)

    try:
        with open(filepath, "r") as f:
            data = f.read()
        return web.json_response({"data": data})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@PromptServer.instance.routes.post("/api/curve/save")
async def save_curve(request):
    try:
        data = await request.json()
        curve_data = data.get('curve_data', '')
        node_id = data.get('node_id', 'default')
        debug_logging = data.get('debug_logging', False)
        if debug_logging:
            print('=== API: save_curve called ===')

        try:
            curves = json.loads(curve_data)
            if not isinstance(curves, dict):
                raise ValueError("Curve data must be a dictionary with keys 'r','g','b','luma'")

            required_channels = ['r', 'g', 'b', 'luma']
            for ch in required_channels:
                if ch not in curves:
                    raise ValueError(f"Missing curve for channel '{ch}'")
                if not (isinstance(curves[ch], list) and all(isinstance(p, dict) and "x" in p and "y" in p for p in curves[ch])):
                    raise ValueError(f"Invalid curve format for channel '{ch}'")

            if debug_logging:
                print(f"=== DEBUG: Curve preset JSON for node {node_id} ===")
                print(json.dumps(curves, indent=2))
                print("=== End of curve preset JSON ===")
                print("Copy this to a <filename>.json, and put into the curve_presets within the node's folder if you want a new preset!")

        except json.JSONDecodeError:
            return web.json_response({"error": "Invalid curve JSON"}, status=400)
        except ValueError as e:
            return web.json_response({"error": str(e)}, status=400)

        if debug_logging:
            print(f"✅ Curve data validated successfully for node_id: {node_id}")
        return web.json_response({"status": "success"})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500)


class OlmCurveEditor:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "strength": ("FLOAT", {"default": 1.0, "min": 0, "max": 1, "step": 0.01}),
                "debug_logging": ("BOOLEAN", {"default": False}),
            },
            "hidden": {
                "curve_json": ("STRING", {"default": ""}),
                "node_id": "UNIQUE_ID",
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "apply_curve"
    CATEGORY = "Image Processing/Curve Editor"


    def apply_curve(self, image, strength, debug_logging, curve_json, node_id):
        default_curve = [{"x": 0, "y": 0}, {"x": 1, "y": 1}]
        curves = {"r": default_curve, "g": default_curve, "b": default_curve, "luma": default_curve}

        if curve_json:
            try:
                if isinstance(curve_json, str):
                    curves = json.loads(curve_json)
                elif isinstance(curve_json, dict):
                    curves = curve_json
                else:
                    raise ValueError("Unsupported curve_json type.")

                if debug_logging:
                    print(f"✅ Loaded curve from memory for node {node_id}")

            except Exception as e:
                print(f"❌ Error parsing curve JSON: {e}")
                curves = {"r": default_curve, "g": default_curve, "b": default_curve, "luma": default_curve}

        if isinstance(curves, list):
            curves = {"r": curves, "g": curves, "b": curves, "luma": curves}
        elif not isinstance(curves, dict):
            curves = {"r": default_curve, "g": default_curve, "b": default_curve, "luma": default_curve}

        for ch in ["r", "g", "b", "luma"]:
            if ch not in curves or not isinstance(curves[ch], list) or not all("x" in p and "y" in p for p in curves[ch]):
                curves[ch] = default_curve

        def create_interpolator(points):
            points = sorted(points, key=lambda p: p["x"])
            x = [p["x"] for p in points]
            y = [p["y"] for p in points]
            return interp1d(x, y, kind="linear", bounds_error=False, fill_value=(float(y[0]), float(y[-1]))) # type: ignore

        r_interp = create_interpolator(curves["r"])
        g_interp = create_interpolator(curves["g"])
        b_interp = create_interpolator(curves["b"])
        luma_interp = create_interpolator(curves["luma"])

        B, H, W, C = image.shape

        if C != 3:
            raise ValueError("Expected RGB image with 3 channels.")

        def is_curve_active(curve):
            return not (len(curve) == 2 and curve[0]["x"] == 0 and curve[0]["y"] == 0 and
                    curve[1]["x"] == 1 and curve[1]["y"] == 1)

        luma_active = is_curve_active(curves["luma"])
        rgb_active = any(is_curve_active(curves[ch]) for ch in ["r", "g", "b"])

        if debug_logging:
            print(f"\n📊 === Sequential Curve Data for Node {node_id} ===")
            print(f"🔸 Luma curve active: {luma_active}")
            print(f"🔸 RGB curves active: {rgb_active}")
            for ch, points in curves.items():
                if is_curve_active(points):
                    print(f"• Active Channel: {ch}")
                    for p in points:
                        print(f"   ↳ (x={p['x']:.3f}, y={p['y']:.3f})")
            print("🧪 Strength:", strength)
            print(f"🖼️ Image shape: {image.shape}")
            print("=================================================\n")

        output_images = []
        for b in range(B):
            img_np = image[b].cpu().numpy().astype(np.float32)

            current_img = img_np.copy()

            if luma_active:
                luma = 0.2126 * current_img[:, :, 0] + 0.7152 * current_img[:, :, 1] + 0.0722 * current_img[:, :, 2]

                mapped_luma = np.clip(luma_interp(luma), 0, 1)

                luma_ratio = np.divide(mapped_luma, luma, out=np.ones_like(luma), where=luma > 1e-6)

                current_img[:, :, 0] *= luma_ratio
                current_img[:, :, 1] *= luma_ratio
                current_img[:, :, 2] *= luma_ratio

                current_img = np.clip(current_img, 0, 1)

                if debug_logging:
                    print(f"   ✅ Applied luma curve (range: {mapped_luma.min():.3f} - {mapped_luma.max():.3f})")

            if rgb_active:
                if is_curve_active(curves["r"]):
                    current_img[:, :, 0] = np.clip(r_interp(current_img[:, :, 0]), 0, 1)
                else:
                    if debug_logging:
                        print("R curve not active, at default values, skipping.")
                if is_curve_active(curves["g"]):
                    current_img[:, :, 1] = np.clip(g_interp(current_img[:, :, 1]), 0, 1)
                else:
                    if debug_logging:
                        print("G curve not active, at default values, skipping.")
                if is_curve_active(curves["b"]):
                    current_img[:, :, 2] = np.clip(b_interp(current_img[:, :, 2]), 0, 1)
                else:
                    if debug_logging:
                        print("B curve not active, at default values, skipping.")

                if debug_logging:
                    active_channels = [ch for ch in ["r", "g", "b"] if is_curve_active(curves[ch])]
                    print(f"   ✅ Applied RGB curves: {', '.join(active_channels)}")

            if strength < 1.0:
                final_img = (1 - strength) * img_np + strength * current_img
            else:
                final_img = current_img

            output_images.append(np.clip(final_img, 0, 1).astype(np.float32))

        return (torch.from_numpy(np.stack(output_images)),)


WEB_DIRECTORY = "./web/"


NODE_CLASS_MAPPINGS = {
    "OlmCurveEditor": OlmCurveEditor
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "OlmCurveEditor": "Olm Curve Editor"
}
