/**
 * Types matching the cooldown.yaml bundle structure (same as viewer).
 * This is the single-file resolved format returned by /api/.../bundle.
 */

export type CooldownBundle = {
  metadata: {
    cooldown_id: string;
    date: string;
    cryo: string;
    operator?: string;
    purpose?: string;
    notes?: string;
  };
  chip?: {
    name: string;
    num_qubits: number;
    qubits_per_readout_line?: number;
  } | null;
  control: WiringSection;
  readout_send: WiringSection;
  readout_return: WiringSection;
  summary: {
    sections: BundleSummarySection[];
  };
};

export type WiringSection = {
  lines: ResolvedLine[];
};

export type ResolvedLine = {
  line_id: string;
  qubit?: string;
  qubits?: string[];
  representative?: boolean;
  stages: Record<string, ResolvedComponent[]>;
};

export type ResolvedComponent = {
  type: string;
  manufacturer: string;
  model: string;
  serial?: string;
  summary_label?: string;
  value_dB?: number;
  gain_dB?: number;
  filter_type?: string;
  amplifier_type?: string;
};

export type BundleSummarySection = {
  label: string;
  lines: BundleSummaryLine[];
};

export type BundleSummaryLine = {
  line_id: string;
  qubits: string;
  total_atten: number;
  total_gain: number;
  stage_components: Record<string, string[]>;
};
