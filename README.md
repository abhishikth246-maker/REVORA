# AutoForge — 3D Car Customization Studio

An animated, responsive car configurator built with HTML, CSS, JavaScript, Three.js and GSAP.

## Features

- Procedurally modelled 3D concept car (no separate 3D model download needed)
- Drag the car to rotate it and use camera presets for front, side and rear views
- Change paint, wheels, aero package, lighting and interior finish
- Toggle headlights and neon underglow
- Estimated build-price calculator in Indian rupees
- Drive mode, fullscreen preview, animated interface and responsive layout
- Save the configuration in browser local storage
- Copy build details to the clipboard

## Run locally

Because the 3D scene uses JavaScript modules, run the folder through a local web server instead of opening `index.html` directly.

### Option 1: VS Code

1. Open this folder in Visual Studio Code.
2. Install the **Live Server** extension.
3. Right-click `index.html` and choose **Open with Live Server**.

### Option 2: Python

Open a terminal in this folder and run:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000> in your browser.

## Publish on GitHub Pages

1. Create a **public** GitHub repository named `AutoForge`.
2. Upload `index.html`, `style.css`, `script.js` and `README.md` to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then click **Save**.
6. After GitHub finishes deploying, the site will be available at:

   `https://YOUR-USERNAME.github.io/AutoForge/`

## Dependencies

Three.js and GSAP are loaded from jsDelivr CDN. Google Fonts are loaded from Google Fonts. An internet connection is needed for those resources.

## Notes

- The car is a stylized procedural concept model, not a manufacturer's exact vehicle or a photorealistic scan.
- Prices are illustrative demo values, not real quotations.
- The build is saved only in the current browser using local storage. It is not uploaded to a server.
