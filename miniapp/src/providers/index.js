/**
 * Provider registry barrel for the Transferly Mini App.
 *
 * ALL_PROVIDERS is the ordered list of registered provider modules.
 * To add a new provider: create miniapp/src/providers/<key>/index.js
 * and append an import + entry here — no other file needs editing.
 */

import paypalProvider from './paypal';
import stripeProvider from './stripe';
import wiseProvider from './wise';
import paystackProvider from './paystack';
import flutterwaveProvider from './flutterwave';
import cryptoProvider from './crypto';

/** All registered provider modules in display order. */
export const ALL_PROVIDERS = Object.freeze([
  paypalProvider,
  stripeProvider,
  wiseProvider,
  paystackProvider,
  flutterwaveProvider,
  cryptoProvider
]);

/**
 * Look up a provider module by its id.
 * @param {string} id - e.g. 'paypal', 'stripe'
 * @returns {object|undefined}
 */
export function getProvider(id) {
  return ALL_PROVIDERS.find((p) => p.id === id);
}

// Re-export registry context
export { default as ProviderRegistryProvider, useProvider, useProviderRegistry } from './ProviderRegistry';
