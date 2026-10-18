// Pinned to real meshes in brain.glb (matched on ORIGINAL glTF names; GLTFLoader strips '.' and spaces from mesh.name).
// No amygdala mesh exists, so that anchor is DERIVED from the anterior tip (+z) of the hippocampus mesh and marked approximate (≈).
export type Label = { text: string; role: string; tag: string; lost: string; re: RegExp; side: 'l' | 'r'; ang: number; from: number; to: number; facing: boolean; derive?: number; approx?: boolean }
export const LABELS: Label[] = [
  { text: 'Amygdala', role: 'threat response', tag: 'Threat pathway · elevated', lost: 'Target lost', re: /^Hippocampus/, derive: 0.006, approx: true, side: 'r', ang: -14, from: 0.02, to: 0.38, facing: false },
  { text: 'Temporal lobe', role: 'memory / auditory processing', tag: 'Auditory index', lost: 'Target drift', re: /^Temporal pole/, side: 'r', ang: 22, from: 0.04, to: 0.34, facing: true },
  { text: 'Frontal lobe', role: 'planning / decision', tag: 'Planning loop', lost: 'Signal degraded', re: /^Middle frontal gyrus/, side: 'r', ang: -24, from: 0.06, to: 0.34, facing: true },
  { text: 'Hippocampus', role: 'memory / context', tag: 'Context recall', lost: 'Signal degraded', re: /^Hippocampus/, side: 'l', ang: -12, from: 0.08, to: 0.4, facing: false },
  { text: 'Prefrontal cortex', role: 'executive control', tag: 'Inhibition gate', lost: 'Signal degraded', re: /^Superior frontal gyrus/, derive: -0.006, side: 'l', ang: -28, from: 0.1, to: 0.4, facing: true },
  { text: 'Parietal lobe', role: 'sensory integration', tag: 'Spatial map', lost: 'Target drift', re: /^Superior parietal lobule/, side: 'l', ang: 14, from: 0.12, to: 0.34, facing: true },
  { text: 'Cerebellum', role: 'motor coordination', tag: 'Motor sync', lost: 'Signal degraded', re: /^Tonsil of cerebellum/, side: 'l', ang: 32, from: 0.18, to: 0.44, facing: false },
  { text: 'Brainstem', role: 'autonomic function', tag: 'Vital loop', lost: 'No data', re: /^Pons/, side: 'r', ang: 30, from: 0.2, to: 0.44, facing: false },
]
