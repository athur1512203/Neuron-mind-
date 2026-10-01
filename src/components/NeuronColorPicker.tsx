import { NEURON_COLOR_PALETTE } from "../utils/neuron";

type NeuronColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
};

export function NeuronColorPicker({ value, onChange, disabled }: NeuronColorPickerProps) {
  const normalized = value.toUpperCase();
  const inPalette = NEURON_COLOR_PALETTE.some((preset) => preset.value.toUpperCase() === normalized);

  return (
    <div className="nm-swatches">
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
      {!inPalette && value ? (
        <button
          type="button"
          disabled={disabled}
          className="nm-swatch is-on"
          style={{ backgroundColor: value }}
          aria-label="Màu hiện tại"
          title="Màu hiện tại"
        />
      ) : null}
    </div>
  );
}
