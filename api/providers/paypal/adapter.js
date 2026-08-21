const { paypalProviderAdapter } = require('../../adapters/paymentProviders/paypalProviderAdapter');
const { PAYPAL_RESOURCE_DEFINITIONS, listPayPalResourceReadiness } = require('./readiness');

module.exports = {
  PAYPAL_RESOURCE_DEFINITIONS,
  listPayPalResourceReadiness,
  paypalProviderAdapter
};
