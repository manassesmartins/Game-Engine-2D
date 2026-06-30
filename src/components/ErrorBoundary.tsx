import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    (this as Component<Props, State>).setState({ hasError: false, error: null });
  };

  render() {
    const self = this as Component<Props, State>;

    if (self.state.hasError) {
      if (self.props.fallback) {
        return self.props.fallback;
      }

      return (
        <div className="flex items-center justify-center h-full w-full bg-[#1E1F26] p-8">
          <div className="bg-[#2B2C33] border border-[#3A3B44] rounded-xl p-6 max-w-md text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider">
              Erro Inesperado
            </h2>
            <p className="text-xs text-[#888] leading-relaxed">
              Ocorreu um erro ao processar esta seção. Tente recarregar ou reiniciar o projeto.
            </p>
            {self.state.error && (
              <details className="text-left">
                <summary className="text-[10px] text-[#666] cursor-pointer hover:text-[#888]">
                  Detalhes do erro
                </summary>
                <pre className="text-[9px] text-red-300 mt-2 p-2 bg-[#1E1F26] rounded overflow-auto max-h-32">
                  {self.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleRetry}
              className="bg-[#FFA000] hover:bg-[#FFB300] text-white rounded py-2 px-6 text-xs font-bold transition-all active:scale-95 flex items-center gap-2 mx-auto cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tentar Novamente
            </button>
          </div>
        </div>
      );
    }

    return self.props.children;
  }
}
