export interface FeatureFlags {
  enableAnimatedEdges: boolean;
  enablePerEdgeAnimationOverride: boolean;
  defaultDetailsSurface: "panel" | "modal";
}

export const defaultFeatureFlags: FeatureFlags = {
  enableAnimatedEdges: true,
  enablePerEdgeAnimationOverride: true,
  defaultDetailsSurface: "panel",
};
