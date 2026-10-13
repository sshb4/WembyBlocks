// Set this to Wemby Blocks' own GA4 measurement ID (G-XXXXXXXXXX).
// Left blank so this site's traffic never lands in another site's property.
const GA_MEASUREMENT_ID = '';

if (GA_MEASUREMENT_ID) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(){ dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID);
  const tag = document.createElement('script');
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.append(tag);
}
