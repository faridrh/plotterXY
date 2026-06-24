## XY Plotter Simulation

A browser-based XY plotter simulator that converts images into vector paths and simulates pen-plotter drawing with real-time animation.

### Features

- **Image Upload & Tracing** — Upload any image and trace it into vector paths using ImageTracer.js
- **SVG Vector Preview** — View the traced SVG result
- **XY Plotter Simulation** — Watch the plotter draw paths in real-time with pen up/down logic
- **Speed Control** — Adjustable animation speed
- **Progress Indicator** — Live percentage showing simulation completion
- **G-code Export** — Download standard G-code (`.gcode`) compatible with GRBL and CNC controllers
- **JSON Export** — Download structured JSON commands for custom hardware integration

### File Structure

- `index.html` — Main UI layout
- `style.css` — Dark-themed styling
- `script.js` — All logic (SVG parsing, simulation, pen up/down, exports)

### How to Use

1. Open `index.html` in a browser
2. Upload an image
3. Click **Trace & Simulate**
4. Use **Play** / **Pause** to control the animation
5. Adjust **Speed** slider as needed
6. Export **G-code** or **JSON** for hardware use (Arduino/S7-1200)

### Export Formats

- **G-code** — Standard CNC format with `G0/G1`, `Z` axis for pen control, homing, and feed rates
- **JSON** — Structured array with commands: `pen_up`, `pen_down`, `move`, `line`

### Future Integration

The exported G-code/JSON can be sent to:
- Arduino + GRBL or custom firmware
- Siemens S7-1200 via Modbus TCP or data blocks

---

This project separates logic into multiple files for maintainability and prepares paths for real hardware XY plotters.
