(() => {
  // Shared Clipboard Stats property, matching Corbin's Triples.
  const measurementId = 'G-S9QST2PH1W';
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };

  // Never read SMS inputs or send signup payloads. Exclude URL queries and
  // fragments, which may contain visitor-provided data.
  const page = new URL(window.location.href);
  let referrer = '';
  try { referrer = new URL(document.referrer).origin + '/'; } catch { /* No referrer. */ }
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    page_location: page.origin + page.pathname,
    page_referrer: referrer,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  const tag = document.createElement('script');
  tag.async = true;
  tag.referrerPolicy = 'origin';
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(tag);
})();
