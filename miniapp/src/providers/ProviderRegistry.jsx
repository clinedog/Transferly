import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Frontend Provider Registry — UI-level registry for provider modules
const ProviderContext = createContext({ providers: new Map(), register: () => {} });

function normalizeProviderKey(value) {
  return String(value || '').trim().toLowerCase();
}

function mergeRuntimeCapabilities(initialProviders, runtimeCapabilities, runtimeCapabilitiesLoaded) {
  if (!runtimeCapabilitiesLoaded) {
    return initialProviders;
  }

  const capabilitiesByKey = new Map(
    runtimeCapabilities.map((provider) => [
      normalizeProviderKey(provider?.slug || provider?.key || provider?.id),
      provider
    ])
  );

  return initialProviders.map((provider) => {
    const capability = capabilitiesByKey.get(normalizeProviderKey(provider.id));
    return {
      ...provider,
      enabled: Boolean(capability),
      serverCapability: capability || null
    };
  });
}

export function ProviderRegistryProvider({
  children,
  initialProviders = [],
  runtimeCapabilities = [],
  runtimeCapabilitiesLoaded = false
}) {
  const [registeredProviders, setRegisteredProviders] = useState([]);
  const providers = useMemo(
    () => [
      ...mergeRuntimeCapabilities(initialProviders, runtimeCapabilities, runtimeCapabilitiesLoaded),
      ...registeredProviders
    ],
    [initialProviders, registeredProviders, runtimeCapabilities, runtimeCapabilitiesLoaded]
  );
  const map = useMemo(() => new Map(providers.map((provider) => [provider.id, provider])), [providers]);
  const register = useCallback((provider) => {
    setRegisteredProviders((current) => [...current.filter((entry) => entry.id !== provider.id), provider]);
  }, []);
  const value = useMemo(() => ({ providers: map, register }), [map, register]);
  return <ProviderContext.Provider value={value}>{children}</ProviderContext.Provider>;
}

export function useProviderRegistry() {
  return useContext(ProviderContext);
}

export function useProvider(id) {
  const registry = useProviderRegistry();
  return registry.providers.get(id);
}

export default ProviderRegistryProvider;
