import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#111] border border-red-500/20 rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-5 text-red-500">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black mb-2 text-white">
              কিছু সমস্যা হয়েছে!
            </h2>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              পেজটি লোড হতে সাময়িক সমস্যা হয়েছে। নিচে ক্লিক করে পেজটি আবার রিফ্রেশ করুন।
            </p>
            {this.state.error && (
              <div className="mb-6 p-3 bg-white/5 border border-white/10 rounded-lg text-left text-xs font-mono text-red-400 max-h-24 overflow-y-auto">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all shadow-lg shadow-red-600/20 active:scale-95"
            >
              <RotateCw className="w-4 h-4" />
              পেজ রিফ্রেশ করুন
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
