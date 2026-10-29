import { PagesDevPublisher } from '../../services/pagesDevPublisher';

export async function publishSiteCommand({ siteSpec, siteName }) {
  try {
    if (!siteSpec || !siteName) {
      throw new Error('Site specification and name are required');
    }

    const url = await PagesDevPublisher.publish(siteSpec, siteName);
    return {
      success: true,
      message: `Site published successfully!`,
      url: url
    };
  } catch (error) {
    console.error('Error publishing site:', error);
    return {
      success: false,
      message: `Failed to publish site: ${error.message}`
    };
  }
}
