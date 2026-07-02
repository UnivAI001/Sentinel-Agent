export async function startScan(email) {
  console.log('Starting Playwright sandbox scan for URLs...');
  if (!email.urls || email.urls.length === 0) {
    return { status: 'no_urls' };
  }
  
  // Pipeline scaffold: returns mock setup
  return {
    status: 'scanned',
    screenshots: ['base64_img_1'],
    domText: 'Sign in to Apple ID',
    networkRequests: 5
  };
}
