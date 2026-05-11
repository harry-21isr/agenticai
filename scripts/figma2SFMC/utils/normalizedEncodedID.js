export const normalizedEncodedID = (id) => {
  if (!id) return id;

  let normalizedEncodedID = id

  // If already correct format, return as-is
  if (normalizedEncodedID.includes(":")) return;

  // Convert URL format - API format
  if (normalizedEncodedID.includes("-")) {
    return normalizedEncodedID.replace("-", ":");
  }

  const encodedId = encodeURIComponent(normalizedEncodedID);
  return encodedId;
}