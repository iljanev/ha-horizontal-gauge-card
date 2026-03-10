# Horizontal Gauge Card

A highly customizable horizontal gauge card with a needle indicator for Home Assistant.
Inspired by Home Assistant Tile card.

![Horizontal Gauge Card Examples](image.png)

## Features
- With minimalistic settings occupies only 1 row 
- Fully visual editor support (no YAML required!)
- Custom segments with color coding
- Needle indicator with customizable width, color, and shadow
- Toggleable segment names and value labels
- Extensive appearance overrides (font sizes, gauge thickness, custom units)

## Installation

### HACS (Recommended)
1. Open HACS in your Home Assistant instance.
2. Click the 3 dots in the top right corner and select **Custom repositories**.
3. Add your repository URL (`https://github.com/YOUR_USERNAME/YOUR_REPO_NAME`).
4. Select **Dashboard** as the category and click **Add**.
5. Close the modal, search for "Horizontal Gauge Card", and click **Download**.
6. Refresh your browser cache.

### Manual
1. Download `horizontal-gauge-card.js` from this repository.
2. Copy it into your `<config>/www/` directory.
3. Go to **Settings > Dashboards > 3 dots (top right) > Resources**.
4. Add a new resource with the URL `/local/horizontal-gauge-card.js` and set the Resource Type to `JavaScript Module`.

## Defining Segments

You can define segments directly via the visual editor under the "Segments" expandable section. Because it uses Home Assistant's native object editor, you format your segments as a YAML list.

**Example YAML snippet to paste into the Segments box:**
```yaml
- value: 33
  color: var(--info-color)
  label: Low
- value: 66
  color: var(--warning-color)
  label: Med
- value: 100
  color: var(--error-color)
  label: High
```

* **`value`**: The upper limit of the segment (the segment spans from the previous value up to this value).
* **`color`**: The color of the segment (can be HEX like `#FF0000` or a CSS variable like `var(--error-color)`).
* **`label`** *(Optional)*: The name of the segment to display if "Show Segment Labels" is enabled.

## Usage
Simply add a new card to your dashboard and select **Horizontal Gauge Card** from the visual picker. You can configure all colors, limits, fonts, and labels directly in the UI.
