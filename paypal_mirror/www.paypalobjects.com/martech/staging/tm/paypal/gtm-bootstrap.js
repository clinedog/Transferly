// GTM marketing bootstrap - hosted on CDN, loaded directly by each component
// in its own <script src="..."> tag. Owns two things only: (1) the
// gtmMktgDataLayer, (2) loading the GTM container with a Consent Mode default.
// The marketing script (pa.js/mktconf's gtm vendor) owns the
// 'consent update: granted', sent post-consent before the first event.
// Do NOT add a 'consent update' here, and this is the ONLY loader of the
// container - the marketing script never loads it.
//
// The two scripts are LINKED via window._gtmMktgConsent so the order they run in
// never matters (see src/marketing/paypal/common/vendors/gtm.js):
//   - Bootstrap first -> flag unset -> default: DENIED, load container; the
//     marketing script grants later.
//   - Marketing script first -> it sets window._gtmMktgConsent = 'granted' and
//     pushes update + events -> this bootstrap reads the flag and emits
//     default: GRANTED, so a denied default can never land after a grant.
// Coordination is via that explicit flag, NOT dataLayer contents (both sides
// create the array, so its emptiness is ambiguous).
//
// Container ID: staging = GTM-WK8NP76B, production = GTM-T562K64Q
// (change only the last argument of the loader below per environment).

// Initialize gtmMktgDataLayer
window.gtmMktgDataLayer = window.gtmMktgDataLayer || [];

// gtag-style helper - consent commands MUST be pushed as the `arguments` form
// for GTM to recognize them (a plain array push is ignored).
function gtmMktgGtag() {
  window.gtmMktgDataLayer.push(arguments);
}

// Consent Mode default - MUST fire before the GTM container loads. If the
// marketing script already granted (it ran before this bootstrap), reflect
// GRANTED so a denied default can never override an existing grant; otherwise
// default to DENIED until the marketing script sends the granted update.
if (window._gtmMktgConsent === 'granted') {
  gtmMktgGtag('consent', 'default', {
    'ad_storage': 'granted',
    'ad_user_data': 'granted',
    'ad_personalization': 'granted',
    'analytics_storage': 'granted'
  });
} else {
  gtmMktgGtag('consent', 'default', {
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'analytics_storage': 'denied'
  });
}

// GTM container load
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','gtmMktgDataLayer','GTM-WK8NP76B');
