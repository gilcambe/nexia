import { db } from '../../lib/firebase-lite';

export async function siteSpecUpdater(siteId, adjustments) {
  const siteRef = db.collection('sites').doc(siteId);
  const siteDoc = await siteRef.get();

  if (!siteDoc.exists) {
    return null;
  }

  const currentSpec = siteDoc.data().spec;
  const updatedSpec = { ...currentSpec, ...adjustments };

  await siteRef.update({ spec: updatedSpec });

  return updatedSpec;
}
