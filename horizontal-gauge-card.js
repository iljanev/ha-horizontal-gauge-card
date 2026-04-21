// horizontal-gauge-card.js
// Home Assistant Custom Card - Horizontal Gauge with Needle

class HorizontalGaugeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = null;
    this._hass = null;
    this._rendered = false;

    // Cache for DOM elements to update during state changes
    this._elements = {
      value: null,
      needle: null,
      needleValue: null,
      stateIcon: null,
      unavailable: null,
      card: null
    };

    this._handleAction = this._handleAction.bind(this);
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error('Entity is required');
    }

    this._config = Object.assign(
      {
        min: 0,
        max: 100,
        show_icon: true,
        show_name: true,
        show_value: true,
        show_segment_labels: false,
        show_value_labels: false,
        needle: true,
        needle_width: 2,
        needle_color: '#ffffff',
        needle_shadow: true,
        show_needle_label: false,
        decimals: 1,
        segment_value_decimals: 0,
        segment_trim_zeros: false,
        unit: null,
        gauge_thickness: null,
        needle_label_position: 'above',
        segment_label_position: 'below',
        value_label_position: 'below',
        name_font_size: null,
        value_font_size: null,
        label_font_size: null,
        tap_action: { action: "more-info" },
        hold_action: { action: "none" },
        double_tap_action: { action: "none" }
      },
      config
    );

    // Provide a fallback if user had the old config
    if (config.segment_label_position && !config.value_label_position) {
        this._config.value_label_position = config.segment_label_position;
    }

    // Needle label does NOT push it to additional rows now.
    // We only check if segment labels or value labels are visible.
    let hasLabels = false;
    if (this._config.show_segment_labels) hasLabels = true;
    if (this._config.show_value_labels) hasLabels = true;

    const hasHeader = this._config.show_name || this._config.show_value;

    // Strict 2 rows max, ignoring needle_label visibility for row scaling
    if (!hasHeader) {
      this._display_rows = 1; 
    } else {
      this._display_rows = hasLabels ? 2 : 1;
    }

    this._rendered = false;

    if (this._hass) {
      this._initialRender();
      this._updateState();
    }
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;

    if (!this._rendered && this._config) {
      this._initialRender();
    }

    if (this._rendered && this._config) {
      const entityId = this._config.entity;
      if (!oldHass || oldHass.states[entityId] !== hass.states[entityId]) {
        this._updateState();
      }
    }
  }

  // Tell HA layout engine how many grid units to allocate
  getCardSize() {
    return this._display_rows;
  }

  _getEntityState() {
    if (!this._hass || !this._config) return null;
    return this._hass.states[this._config.entity] || null;
  }

  _valueToNumber(val) {
    if (val === null || val === undefined) return NaN;
    const num = Number(val);
    return isNaN(num) ? NaN : num;
  }

  _valueToPercent(value, min, max) {
    if (isNaN(value) || isNaN(min) || isNaN(max) || max === min) return 0;
    const v = Math.min(Math.max(value, min), max);
    return ((v - min) / (max - min)) * 100;
  }

  _formatValue(value, decimals, trimZeros) {
    if (isNaN(value)) return '—';
    const str = value.toFixed(decimals);
    return trimZeros ? Number(str).toString() : str;
  }

  _parseThickness(t) {
    if (!t) return null;
    if (typeof t === 'number') return t;
    if (typeof t === 'string') {
      const m = t.match(/([0-9]+(?:\.[0-9]+)?)/);
      if (m) return Number(m[1]);
    }
    return null;
  }

  _resolveSegmentsAndMax(min, configMax) {
    const segmentsCfg = this._config.segments || [];

    if (!segmentsCfg.length) {
      return {
        max: configMax,
        segments: [{
          from: min,
          to: configMax,
          color: 'var(--primary-color)',
          label: '',
        }]
      };
    }

    const segments = [];
    let currentFrom = min;

    for (let i = 0; i < segmentsCfg.length; i++) {
      const seg = segmentsCfg[i];
      const endVal = this._valueToNumber(seg.value);

      segments.push({
        from: currentFrom,
        to: endVal,
        color: seg.color || 'var(--primary-color)',
        label: seg.label || '',
      });
      currentFrom = endVal;
    }

    const computedMax = segments[segments.length - 1].to;
    return { max: computedMax, segments };
  }

  _handleAction(ev) {
    const action = ev.type === 'click' ? this._config.tap_action : this._config.hold_action;

    if (!action || action.action === 'none') return;

    const actionEvent = new Event('hass-action', {
      bubbles: true,
      composed: true,
    });

    actionEvent.detail = {
      config: {
        entity: this._config.entity,
        tap_action: this._config.tap_action,
        hold_action: this._config.hold_action,
        double_tap_action: this._config.double_tap_action
      },
      action: ev.type === 'click' ? 'tap' : 'hold'
    };

    this.dispatchEvent(actionEvent);
  }

  _initialRender() {
    if (!this._config) return;

    const entity = this._getEntityState();
    const min = this._valueToNumber(this._config.min);
    const configMax = this._valueToNumber(this._config.max);
    const { max, segments } = this._resolveSegmentsAndMax(min, configMax);

    this._cachedMin = min;
    this._cachedMax = max;

    const name = this._config.name || (entity && entity.attributes.friendly_name) || this._config.entity;

    const thicknessNum = this._parseThickness(this._config.gauge_thickness);
    const autoThickness = this._display_rows === 2 ? 18 : 12;
    const barThickness = thicknessNum || autoThickness;
    const barRadius = barThickness / 2;

    const nameSize = this._config.name_font_size ? `${this._config.name_font_size}px` : 'var(--tile-info-primary-font, 14px)'; 
    const valueSize = this._config.value_font_size ? `${this._config.value_font_size}px` : 'var(--tile-info-primary-font, 14px)'; 
    const labelSize = this._config.label_font_size ? `${this._config.label_font_size}px` : 'var(--ha-font-size-sm, 10px)';

    // Enforce 2 rows max (56px or 120px)
    const minHeight = this._display_rows === 1 ? '56px' : '120px';

    const cardStyle = `
      :host {
        display: block;
        --mdc-icon-size: 24px;
        outline: none;
      }
      ha-card {
        box-sizing: border-box;
        padding: 0px 8px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        background-color: var(--ha-card-background, var(--card-background-color, white));
        border-radius: var(--ha-card-border-radius, 12px);
        box-shadow: var(--ha-card-box-shadow, none);
        border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color, #e0e0e0));
        transition: background-color 0.3s ease-out;
        cursor: pointer;
        height: 100%;
        min-height: ${minHeight};
      }
      ha-card:hover {
        background-color: var(--ha-card-hover-background, rgba(var(--rgb-primary-text-color), 0.04));
      }
      ha-card:focus {
        background-color: var(--ha-card-hover-background, rgba(var(--rgb-primary-text-color), 0.08));
      }
      .card-content {
        display: flex;
        flex-direction: row;
        align-items: center;
        width: 100%;
        height: 100%;
        padding: 0;
      }
      .icon-container {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 12px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: var(--state-icon-active-color, rgba(68, 115, 158, 0.2));
        flex-shrink: 0;
      }
      .icon {
        color: var(--state-icon-color, var(--paper-item-icon-color, #44739e));
      }
      .main {
        display: flex;
        flex-direction: column;
        justify-content: center;
        flex: 1;
        min-width: 0;
        height: 100%;
        #margin-top:-8px;
      }
      .header {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        margin-bottom: ${this._display_rows === 2 ? '20px' : '4px'};
        line-height: var(--ha-line-height-normal, 1.2);
        margin-top:-8px;
      }
      .name {
        font-size: ${nameSize};
        font-weight: var(--tile-info-primary-font-weight);
        line-height: var(--tile-info-primary-line-height);
        letter-spacing: var(--tile-info-primary-letter-spacing);
        color: var(--primary-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        min-width: 0;
      }
      .value {
        font-size: ${valueSize};
        font-weight: var(--tile-info-secondary-font-weight);
        line-height: var(--tile-info-secondary-line-height);
        letter-spacing: var(--tile-info-secondary-letter-spacing);
        color: var(--tile-info-secondary-color);
        white-space: nowrap;
        margin-left: ${this._config.show_name ? '8px' : 'auto'};
      }
      .gauge-wrapper {
        position: relative;
      }
      .gauge-container {
        position: relative;
        width: 100%;
        order: 2; /* Ensures it stays in middle between top/bottom labels */
      }
      .gauge-bar {
        position: relative;
        width: 100%;
        height: ${barThickness}px;
        border-radius: ${barRadius}px;
        overflow: hidden;
        background: rgba(127, 127, 127, 0.2);
        display: flex;
        flex-direction: row;
      }
      .segment {
        height: 100%;
        flex-shrink: 0;
      }
      .needle {
        position: absolute;
        top: -3px;
        bottom: -3px;
        width: ${this._config.needle_width || 3}px;
        border-radius: 2px;
        background: ${this._config.needle_color || '#ffffff'};
        transform: translateX(-50%);
        z-index: 2;
        pointer-events: none;
        transition: left 0.4s ease-out;
        ${this._config.needle_shadow !== false ? 'box-shadow: 2px 2px 3px rgba(0, 0, 0, 0.7);' : ''}
      }
      .needle-value {
        position: absolute;
        ${this._config.needle_label_position === 'above' ? 'bottom: 100%; margin-bottom: 1px;' : 'top: 100%; margin-top: 2px;'}
        transform: translateX(-50%);
        font-size: ${labelSize};
        color: var(--secondary-text-color);
        white-space: nowrap;
        padding: 0 2px;
        z-index: 2;
        transition: left 0.4s ease-out;
      }

      /* Shared styles for both label containers */
      .labels-container-top, .labels-container-bottom {
        position: absolute;
        width: 100%;
        height: 14px;
      }

      .labels-container-top {
        order: 1;
        margin-top: -14px;
      }

      .labels-container-bottom {
        order: 3;
        margin-top: 2px;        
      }

      .label-item {
        position: absolute;
        transform: translateX(-50%);
        white-space: nowrap;
        font-size: ${labelSize};
        color: var(--secondary-text-color);
        line-height: 14px;
      }
      .label-item.edge-min {
        transform: translateX(0);
      }
      .label-item.edge-max {
        transform: translateX(-100%);
      }
      .unavailable {
        font-size: var(--ha-font-size-sm, 12px);
        color: var(--secondary-text-color);
        margin-top: 2px;
        display: none;
      }
    `;

    const icon = this._config.icon || (entity && entity.attributes && entity.attributes.icon);
    let iconTemplate = '';

    if (this._config.show_icon) {
      if (icon) {
        iconTemplate = `<div class="icon-container"><ha-icon class="icon" icon="${icon}"></ha-icon></div>`;
      } else {
        iconTemplate = `<div class="icon-container"><ha-state-icon class="icon" id="state-icon"></ha-state-icon></div>`;
      }
    }

    let labelsTopHTML = '';
    let labelsBottomHTML = '';

    const showValues = this._config.show_value_labels;
    const segmentValueDecimals = this._config.segment_value_decimals !== undefined ? this._config.segment_value_decimals : 0;
    const showNames = this._config.show_segment_labels;

    if (showValues || showNames) {
      let topContent = '';
      let bottomContent = '';

      if (showValues) {
        let valStr = `<span class="label-item label-value edge-min" style="left: 0%;">${this._formatValue(min, segmentValueDecimals, this._config.segment_trim_zeros)}</span>`;
        segments.forEach((seg, idx) => {
          if (idx < segments.length - 1) {
            valStr += `<span class="label-item label-value" style="left: ${this._valueToPercent(seg.to, min, max)}%;">${this._formatValue(seg.to, segmentValueDecimals, this._config.segment_trim_zeros)}</span>`;
          }
        });
        valStr += `<span class="label-item label-value edge-max" style="left: 100%;">${this._formatValue(max, segmentValueDecimals, this._config.segment_trim_zeros)}</span>`;

        if (this._config.value_label_position === 'above') topContent += valStr;
        else bottomContent += valStr;
      }

      if (showNames) {
        let nameStr = '';
        segments.forEach((seg) => {
          if (seg.label) {
            const midPct = this._valueToPercent((seg.from + seg.to) / 2, min, max);
            nameStr += `<span class="label-item label-name" style="left: ${midPct}%;">${seg.label}</span>`;
          }
        });

        if (this._config.segment_label_position === 'above') topContent += nameStr;
        else bottomContent += nameStr;
      }

      if (topContent) labelsTopHTML = `<div class="labels-container-top">${topContent}</div>`;
      if (bottomContent) labelsBottomHTML = `<div class="labels-container-bottom">${bottomContent}</div>`;
    }

    const totalSpan = max - min || 1;
    const segmentElements = segments.map((seg) => {
      const span = seg.to - seg.from;
      const flexValue = span / totalSpan;
      return `<div class="segment" style="flex: ${flexValue}; background: ${seg.color};"></div>`;
    }).join('');

    const gaugeAndNeedleHTML = `
      <div class="gauge-container">
        <div class="gauge-bar">
          ${segmentElements}
        </div>
        ${this._config.needle ? `<div class="needle" id="needle" style="display: none;"></div>` : ''}
        ${this._config.show_needle_label && this._config.needle 
          ? `<div class="needle-value" id="needle-value" style="display: none;"></div>` 
          : ''}
      </div>
    `;

    const mainContent = `<div class="gauge-wrapper">${labelsTopHTML}${gaugeAndNeedleHTML}${labelsBottomHTML}</div>`;

    const showHeader = this._config.show_name || this._config.show_value;
    let headerHTML = '';
    if (showHeader) {
      headerHTML = `
        <div class="header">
          ${this._config.show_name ? `<div class="name">${name}</div>` : ''}
          ${this._config.show_value ? `<div class="value" id="value-text"></div>` : ''}
        </div>
      `;
    }

    const content = `
      <style>${cardStyle}</style>
      <ha-card id="card" role="button" tabindex="0">
        <div class="card-content">
          ${iconTemplate}
          <div class="main">
            ${headerHTML}
            ${mainContent}
            <div class="unavailable" id="unavailable-text">Unavailable</div>
          </div>
        </div>
      </ha-card>
    `;

    this.shadowRoot.innerHTML = content;

    this._elements.value = this.shadowRoot.getElementById('value-text');
    this._elements.needle = this.shadowRoot.getElementById('needle');
    this._elements.needleValue = this.shadowRoot.getElementById('needle-value');
    this._elements.stateIcon = this.shadowRoot.getElementById('state-icon');
    this._elements.unavailable = this.shadowRoot.getElementById('unavailable-text');
    this._elements.card = this.shadowRoot.getElementById('card');

    if (this._elements.card) {
      this._elements.card.addEventListener('click', this._handleAction);

      let holdTimer;
      this._elements.card.addEventListener('mousedown', () => {
        holdTimer = setTimeout(() => {
          this._handleAction({ type: 'hold' });
        }, 500);
      });
      this._elements.card.addEventListener('mouseup', () => clearTimeout(holdTimer));
      this._elements.card.addEventListener('mouseleave', () => clearTimeout(holdTimer));

      this._elements.card.addEventListener('touchstart', () => {
        holdTimer = setTimeout(() => {
          this._handleAction({ type: 'hold' });
        }, 500);
      });
      this._elements.card.addEventListener('touchend', () => clearTimeout(holdTimer));
    }

    this._rendered = true;
  }

  _updateState() {
    if (!this._rendered || !this._config || !this._hass) return;

    const entity = this._getEntityState();
    const unavailable = !entity || entity.state === 'unavailable' || entity.state === 'unknown';

    if (this._elements.stateIcon && entity) {
      this._elements.stateIcon.stateObj = entity;
      this._elements.stateIcon.hass = this._hass;
    }

    if (unavailable) {
      if (this._elements.value) this._elements.value.style.display = 'none';
      if (this._elements.needle) this._elements.needle.style.display = 'none';
      if (this._elements.needleValue) this._elements.needleValue.style.display = 'none';
      if (this._elements.unavailable) this._elements.unavailable.style.display = 'block';
      return;
    }

    if (this._elements.value) this._elements.value.style.display = 'block';
    if (this._elements.unavailable) this._elements.unavailable.style.display = 'none';

    const rawValue = this._valueToNumber(entity.state);
    const value = isNaN(rawValue) ? NaN : rawValue;

    // Check if user provided an override unit, otherwise use entity attribute, otherwise nothing
    const unit = (this._config.unit !== undefined && this._config.unit !== null)
      ? this._config.unit 
      : (entity && entity.attributes.unit_of_measurement) || '';

    const decimals = typeof this._config.decimals === 'number' ? this._config.decimals : 1;
    const valueText = this._formatValue(value, decimals, false);
    const displayString = `${valueText} ${unit}`.trim(); // Trim in case unit is empty so we don't have trailing space

    if (this._elements.value) {
      this._elements.value.textContent = displayString;
    }

    const showNeedle = this._config.needle && !isNaN(value);

    if (showNeedle) {
      const pct = this._valueToPercent(value, this._cachedMin, this._cachedMax);
      const pctClamped = Math.min(99, Math.max(1, pct));

      if (this._elements.needle) {
        this._elements.needle.style.display = 'block';
        this._elements.needle.style.left = `${pctClamped}%`;
      }

      if (this._elements.needleValue) {
        this._elements.needleValue.style.display = 'block';
        this._elements.needleValue.style.left = `${pctClamped}%`;
        this._elements.needleValue.textContent = displayString;
      }
    } else {
      if (this._elements.needle) this._elements.needle.style.display = 'none';
      if (this._elements.needleValue) this._elements.needleValue.style.display = 'none';
    }
  }
}

customElements.define('horizontal-gauge-card', HorizontalGaugeCard);

// -------------------------------------------------------------
// Editor Code Below
// -------------------------------------------------------------

const fireEvent = (node, type, detail, options) => {
  options = options || {};
  detail = detail === null || detail === undefined ? {} : detail;
  const event = new Event(type, {
    bubbles: options.bubbles === undefined ? true : options.bubbles,
    cancelable: Boolean(options.cancelable),
    composed: options.composed === undefined ? true : options.composed,
  });
  event.detail = detail;
  node.dispatchEvent(event);
  return event;
};

const SCHEMA = [
  {
    name: "entity",
    selector: { entity: {} }
  },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "name", selector: { text: {} } },
      { name: "icon", selector: { icon: {} } },
      { name: "min", selector: { number: { mode: "box", step: 1 } } },
      { name: "max", selector: { number: { mode: "box", step: 1 } } },
    ]
  },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "show_name", selector: { boolean: {} } },
      { name: "show_icon", selector: { boolean: {} } },
      { name: "show_value", selector: { boolean: {} } },
      { name: "decimals", selector: { number: { mode: "box", min: 0, max: 5, step: 1 } } },
    ]
  },
  {
    name: "unit",
    selector: { text: {} }
  },
  {
    title: "Appearance Overrides",
    name: "",
    type: "expandable",
    schema: [
      {
        type: "grid",
        name: "",
        schema: [
          { name: "name_font_size", selector: { number: { mode: "box", min: 8, max: 40, step: 1 } } },
          { name: "value_font_size", selector: { number: { mode: "box", min: 8, max: 40, step: 1 } } },
          { name: "label_font_size", selector: { number: { mode: "box", min: 8, max: 40, step: 1 } } },
          { name: "gauge_thickness", selector: { number: { mode: "box", min: 2, max: 40, step: 1 } } }
        ]
      }
    ]
  },
  {
    title: "Needle Settings",
    name: "", 
    type: "expandable",
    schema: [
      {
        type: "grid",
        name: "",
        schema: [
          { name: "needle", selector: { boolean: {} } },
          { name: "needle_shadow", selector: { boolean: {} } },
          { name: "needle_width", selector: { number: { mode: "box", min: 1, max: 20, step: 1 } } },
          { name: "needle_color", selector: { text: {} } }, // Added color text input
          { name: "show_needle_label", selector: { boolean: {} } },
          { 
            name: "needle_label_position", 
            selector: { 
              select: { 
                options: [
                  {value: "above", label: "Above"}, 
                  {value: "below", label: "Below"}
                ] 
              } 
            } 
          },
        ]
      }
    ]
  },
  {
    title: "Labels Settings",
    name: "", 
    type: "expandable",
    schema: [
      {
        type: "grid",
        name: "",
        schema: [
          { name: "show_segment_labels", selector: { boolean: {} } },
          { name: "show_value_labels", selector: { boolean: {} } },
          { name: "segment_value_decimals", selector: { number: { mode: "box", min: 0, max: 5, step: 1 } } },
          { name: "segment_trim_zeros", selector: { boolean: {} } },
          { 
            name: "segment_label_position", 
            selector: { 
              select: { 
                options: [
                  {value: "above", label: "Above"}, 
                  {value: "below", label: "Below"}
                ] 
              } 
            } 
          },
          { 
            name: "value_label_position", 
            selector: { 
              select: { 
                options: [
                  {value: "above", label: "Above"}, 
                  {value: "below", label: "Below"}
                ] 
              } 
            } 
          },
        ]
      }
    ]
  },
  {
    title: "Segments",
    name: "", 
    type: "expandable",
    schema: [
      {
        name: "segments",
        selector: {
          object: {}
        }
      }
    ]
  },
  {
    title: "Actions",
    name: "", 
    type: "expandable",
    schema: [
      { name: "tap_action", selector: { ui_action: {} } },
      { name: "hold_action", selector: { ui_action: {} } },
      { name: "double_tap_action", selector: { ui_action: {} } },
    ]
  }
];

class HorizontalGaugeCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = { ...config };

    if (!this._form) {
      this._renderForm();
    } else {
      this._form.data = this._config;
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) {
      this._form.hass = hass;
    }
  }

  _valueChanged(ev) {
    if (!this._config || !this._hass) {
      return;
    }
    const newConfig = ev.detail.value;

    fireEvent(this, "config-changed", { config: newConfig });
  }

  _renderForm() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = '';

    this._form = document.createElement("ha-form");
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = SCHEMA;

    this._form.computeLabel = this._computeLabel;

    this._form.addEventListener("value-changed", this._valueChanged.bind(this));

    this.shadowRoot.appendChild(this._form);
  }

  _computeLabel(schema) {
    const customLabels = {
      entity: "Entity",
      name: "Name",
      icon: "Icon",
      min: "Minimum Value",
      max: "Maximum Value",
      show_name: "Show Name",
      show_icon: "Show Icon",
      show_value: "Show Value",
      decimals: "Decimals",
      unit: "Unit Override",
      name_font_size: "Name Font Size (px)",
      value_font_size: "Value Font Size (px)",
      label_font_size: "Label Font Size (px)",
      gauge_thickness: "Gauge Bar Height (px)",
      needle: "Show Needle",
      needle_width: "Needle Width (px)",
      needle_color: "Needle Color (HEX or Var)",
      show_needle_label: "Show Needle Label",
      needle_shadow: "Needle Shadow",
      needle_label_position: "Needle Label Position",
      show_segment_labels: "Show Segment Labels (Names)",
      show_value_labels: "Show Value Labels (Numbers)",
      segment_value_decimals: "Segment Value Decimals",
      segment_trim_zeros: "Trim Unnecessary Zeros (Segments)",
      segment_label_position: "Segment Name Position",
      value_label_position: "Value Number Position",
      segments: "Segments (YAML/JSON Array)",
      tap_action: "Tap Action",
      hold_action: "Hold Action",
      double_tap_action: "Double Tap Action"
    };

    if (customLabels[schema.name]) {
      return customLabels[schema.name];
    }
    return schema.name;
  }
}

customElements.define("horizontal-gauge-editor", HorizontalGaugeCardEditor);

window.customCards = window.customCards || [];
const cardIndex = window.customCards.findIndex(c => c.type === "horizontal-gauge-card");
if (cardIndex === -1) {
  window.customCards.push({
    type: 'horizontal-gauge-card',
    name: 'Horizontal Gauge Card',
    description: 'A horizontal gauge bar with needle indicator',
    preview: false,
  });
}

customElements.whenDefined('horizontal-gauge-card').then(() => {
    const cardConstructor = customElements.get('horizontal-gauge-card');

    cardConstructor.getConfigElement = function() {
        return document.createElement("horizontal-gauge-editor");
    };

    cardConstructor.getStubConfig = function() {
        return {
            entity: "",
            min: 0,
            max: 100,
            needle: true,
            show_segment_labels: false,
            segment_label_position: 'below',
            value_label_position: 'above',
            segments: [
                { value: 33, color: "var(--info-color)", label: "Low" },
                { value: 66, color: "var(--warning-color)", label: "Med" },
                { value: 100, color: "var(--error-color)", label: "High" }
            ]
        };
    };
});
