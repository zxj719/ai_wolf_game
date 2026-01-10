import React from 'react';

/**
 * ErrorBoundary - 捕获子组件渲染错误，防止整个应用崩溃
 * 生产环境必备组件
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    // 生产环境可以在这里上报错误到监控服务
    console.error('[ErrorBoundary] 捕获到错误:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full text-center">
            <div className="text-6xl mb-4">😵</div>
            <h1 className="text-2xl font-bold text-white mb-2">游戏遇到了问题</h1>
            <p className="text-gray-400 mb-6">
              别担心，这可能是临时的网络问题或游戏状态异常。
            </p>
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                重试
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                刷新页面
              </button>
            </div>
            {/* 开发环境显示错误详情 */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-gray-500 cursor-pointer hover:text-gray-400">
                  错误详情 (开发模式)
                </summary>
                <pre className="mt-2 p-3 bg-gray-900 rounded text-xs text-red-400 overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
