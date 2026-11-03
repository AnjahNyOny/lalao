import { Component, type ReactNode } from 'react';

/** Keeps one broken part (say, a 3D scene without WebGL) from blanking the whole app. */
export class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

let webgl: boolean | undefined;

/** Whether this device can create a WebGL context at all. Checked once. */
export function hasWebGL(): boolean {
  if (webgl === undefined) {
    try {
      const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
      webgl = !!gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      webgl = false;
    }
  }
  return webgl;
}
