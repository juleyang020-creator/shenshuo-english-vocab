import React from 'react';
import { STORAGE_KEY } from '../lib/storage.js';

// Top-level error boundary. Without this, any render-time throw in App or
// its children leaves the whole root blank — the user sees an empty page
// with no way to recover. We catch, log, and offer a reset button that
// clears study state if the error looks storage-related.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('应用崩溃：', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleResetProgress = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const message = String(this.state.error?.message || '未知错误');
    return (
      <div
        style={{
          padding: 24,
          maxWidth: 480,
          margin: '80px auto',
          textAlign: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
          color: '#14202b',
        }}
      >
        <h2 style={{ marginBottom: 8 }}>应用出错了</h2>
        <p style={{ color: '#526170', lineHeight: 1.6, wordBreak: 'break-word' }}>{message}</p>
        <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              padding: '8px 18px',
              borderRadius: 6,
              border: '1px solid #078b8a',
              background: '#078b8a',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            重试
          </button>
          <button
            type="button"
            onClick={this.handleResetProgress}
            style={{
              padding: '8px 18px',
              borderRadius: 6,
              border: '1px solid #dce5e8',
              background: '#fff',
              color: '#526170',
              cursor: 'pointer',
            }}
          >
            清除进度并刷新
          </button>
        </div>
      </div>
    );
  }
}
