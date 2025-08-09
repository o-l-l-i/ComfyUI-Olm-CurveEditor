# Olm Curve Editor for ComfyUI

A single-purpose, multi-channel curve editor for ComfyUI, providing precise color control over R, G, B, and Luma channels directly within the node graph.

It’s a focused, lightweight, and standalone solution built specifically for one task: applying color curves cleanly and efficiently.

![Olm Curve Editor image](./assets/olm-curve-editor_splash2.png)

- **Author:** Olli Sorjonen
- **GitHub:** [https://github.com/o-l-l-i](https://github.com/o-l-l-i)
- **X:** [https://x.com/Olmirad](https://x.com/Olmirad)
**Version:** 1.0.1.1 (Chain original mouse event handlers to maintain subgraph header button functionality in ComfyUI frontend 1.24.4 and later.)

---

## ✨ What Is This?

This is a custom node for [ComfyUI](https://github.com/comfyanonymous/ComfyUI) that adds interactive, curve-based color adjustment. It’s designed for fast, responsive fine-tuning of image tones via an intuitive interface, much like traditional color grading tools in photo editors.

You can switch between RGB and Luma channels, edit their curves independently, and immediately preview the results in your ComfyUI workflow by evaluating the graph. The curve adjustment effects are applied to images relatively fast (within seconds) so you can use this on 4k+ images.

---

## 🔧 Features

- 🎚️ **Editable Curve Graph**
  - Realtime editing and visualization of the curves.
  - Responsive scaling curve editor area.
  - Enforces clamping of endpoints at 0 and 1.
  - Custom curve type which avoids overshoots.
- 🖱️ **Smooth UX**
  - Click to add, drag to move, shift-click to remove points.
- 🎨 **Channel Tabs**
  - R, G, B, and Luma curves with independent data.
- 🔁 **Reset Buttons**
  - Reset all channels.
  - Per-channel reset to default linear curve.
- 🖼️ **Presets**
  - Comes with 20 presets, you can also create your own.
  - loaded from **curve_presets** folder within the node's folder.

---

## Installation

1. **Clone this repository to your ComfyUI/custom_nodes folder.**

```bash
git clone https://github.com/o-l-l-i/ComfyUI-Olm-CurveEditor.git
```

Your folder structure should look like:

```
ComfyUI/
└── custom_nodes/
└──── ComfyUI-Olm-CurveEditor/
├──── __init__.py
├──── olm_curve_editor.py
└──── curve_presets
└────── <presets are here>
```

Restart ComfyUI to load the new node.

✅ No extra dependencies — works out of the box.

---

## 🧪 Basic Usage

1. Add the **Olm Curve Editor** from the node or search node menu in ComfyUI.
2. Click tabs to switch between R, G, B, and Luma channels.
3. Left-click to add a new point on the curve.
4. Drag existing points to reshape the curve.
5. **Shift-click** to remove a point (minimum of 2 points always remain).
6. Use the **Reset** button to restore the selected channel's default.
7. Evaluate graph to test the effects of curve adjustment.

---

## 🧠 How to Create Presets

- Presets are in curve_presets folder within this custom node's folder.
- You can easily create your own presets:
  - Adjust curves to your liking.
  - Enable debugging mode in the UI to get printouts to the console.
  - Copy the printed JSON data to a <filename>.json file, and put the file to curve_presets within the node's folder.
  - Refresh ComfyUI's frontend, and the new preset you created should appear to the dropdown.

---

## 📌 Known Limitations

- No built-in undo/redo support (yet, but ComfyUI's undo works quite OK).
- Max points per curve is limited (to prevent chaos).
- Curves are linear-interpolated in the backend (I will implement a matching curve later).

---

## Notes

This is a personal learning project (v1), created to explore custom node development in ComfyUI. While I took care to ensure it functions properly and it has functioned fine in my own use, there may still be bugs, rough edges, or unexpected behavior - so use with caution.

Feedback is welcome! Feel free to open an issue if you encounter a problem or have suggestions or ideas to improve the node.

---

## Version history

- **1.0.1.1** Chain original mouse event handlers to maintain subgraph header button functionality in ComfyUI frontend 1.24.4 and later.
- **1.0.1**
  - Reset all feature added
  - Responsive, scalable curve editor
  - Better curve rendering
  - Code refactoring
- **1.0.0** Initial release

---

## License & Usage Terms

Copyright (c) 2025 Olli Sorjonen

This project is source-available, but not open-source under a standard open-source license, and not freeware.
You may use and experiment with it freely, and any results you create with it are yours to use however you like.

However:

Redistribution, resale, rebranding, or claiming authorship of this code or extension is strictly prohibited without explicit written permission.

Use at your own risk. No warranties or guarantees are provided.

The only official repository for this project is: 👉 https://github.com/o-l-l-i/ComfyUI-Olm-CurveEditor

---

## Author

Created by [@o-l-l-i](https://github.com/o-l-l-i)