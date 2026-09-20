import React from 'react';
import { MiniAppState } from './MiniAppState';

function reportClientError(error, info) {
  const payload = {
    event: 'route_render_error',
    message: String(error?.message || 'route render failed').slice(0, 500),
    stack: String(error?.stack || info?.componentStack || '').slice(0, 2000),
    route: typeof window === 'undefined' ? '' : window.location.pathname,
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent
  };
  void fetch('/api/client-telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch((telemetryError) => {
    if (import.meta.env.DEV) {
      console.warn('Client telemetry unavailable', telemetryError);
    }
  });
}

export class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      resetKey: props.resetKey
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return {
        error: null,
        resetKey: props.resetKey
      };
    }

    return null;
  }

  componentDidCatch(error, info) {
    reportClientError(error, info);
    if (import.meta.env.DEV) {
      console.error('Route render failed', error, info);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <MiniAppState
          tone="error"
          title="This view needs a refresh"
          description="The page hit an unexpected state. Reloading the route usually restores it."
          actionLabel="Reload view"
          onAction={() => this.setState({ error: null })}
        />
      );
    }

    return this.props.children;
  }
}
