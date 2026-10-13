import { DEFAULT_NEURON_COLOR, NEURON_COLOR_PALETTE } from "../utils/neuron";

type NeuronColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  includeDefault?: boolean;
  includeCustom?: boolean;
};

export function NeuronColorPicker({ value, onChange, disabled, includeDefault = false, includeCustom = false }: NeuronColorPickerProps) {
  const normalized = value.toUpperCase();
  const inPalette = NEURON_COLOR_PALETTE.some((preset) => preset.value.toUpperCase() === normalized);
  const isDefault = normalized === DEFAULT_NEURON_COLOR.toUpperCase();

  return (
    <div className="nm-swatches">
      {includeDefault ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(DEFAULT_NEURON_COLOR)}
          className={`nm-swatch-default ${isDefault ? "is-on" : ""}`}
          aria-label="Màu mặc định"
        >
          <span className="nm-swatch" style={{ backgroundColor: DEFAULT_NEURON_COLOR }} aria-hidden="true" />
          Màu mặc định
        </button>
      ) : null}
      {NEURON_COLOR_PALETTE.map((preset) => (
        <button
          key={preset.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(preset.value)}
          className={`nm-swatch ${normalized === preset.value.toUpperCase() ? "is-on" : ""}`}
          style={{ backgroundColor: preset.value }}
          aria-label={preset.label}
          title={preset.label}
        />
      ))}
      {!inPalette && !isDefault && value ? (
        <button
          type="button"
          disabled={disabled}
          className="nm-swatch is-on"
          style={{ backgroundColor: value }}
          aria-label="Màu hiện tại"
          title="Màu hiện tại"
        />
      ) : null}
      {includeCustom ? (
        <label className="nm-custom-color">
          <span>Màu tùy chỉnh</span>
          <input type="color" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value.toUpperCase())} />
        </label>
      ) : null}
    </div>
  );
}
