// Phone photos are 4-12 MB; bills stay perfectly readable at 1600px. Shrinking makes the upload fast and keeps
// it under the AI's size limit. Falls back to the original file if the browser can't decode it.
export async function shrinkImage(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? new File([blob], "bill.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}
