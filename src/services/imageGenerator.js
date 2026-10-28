import { generateImage } from '../utils/imageGenerator';

/**
 * Generates images for each scene in the script.
 * @param {Array} scenes - Array of scenes, each containing a description.
 * @returns {Promise<Array>} - Array of image blobs.
 */
export async function generateImages(scenes) {
  const images = [];
  for (const scene of scenes) {
    // Generate 3-5 images per scene
    const numImages = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < numImages; i++) {
      const imageBlob = await generateImage(scene.description);
      images.push(imageBlob);
    }
  }
  return images;
}
