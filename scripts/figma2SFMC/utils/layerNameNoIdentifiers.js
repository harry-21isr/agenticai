export const getCleanLayerName = (layerName) => {
  return layerName.replace(/\(nostack_[^)]+\)/gi, "").trim();
}