import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";

/**
 * Keep a commit glitch inside the Times desk. React 19 otherwise unmounts
 * #root on removeChild / NotFoundError and leaves a dark blank page.
 */
export class TimesCommitBoundary extends Component<{ children: ReactNode }, { gen: number; failed: boolean }> {
  state = { gen: 0, failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    if (typeof console !== "undefined") {
      console.warn("Times desk recovered from commit error", error.message);
    }
    queueMicrotask(() => {
      this.setState((prev) => ({ failed: false, gen: prev.gen + 1 }));
    });
  }

  render() {
    if (this.state.failed) return null;
    return <Fragment key={this.state.gen}>{this.props.children}</Fragment>;
  }
}
