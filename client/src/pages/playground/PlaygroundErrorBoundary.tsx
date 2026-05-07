import React from 'react';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * ErrorBoundary вокруг контента playground-а. Без него любой throw в render
 * (например, в validateSegmentSemantics после setSegment, или в
 * computeAnchorLayout на свежесгенерированном/закэшированном сегменте) уносит
 * всё React-дерево, и пользователь видит пустую страницу до перезагрузки —
 * а данные при этом целы в localStorage.
 *
 * Здесь ловим, показываем стек и кнопку "сбросить" (обнуляет error → дерево
 * рендерится заново; обычно достаточно, чтобы "оживить" интерфейс без F5).
 */
export class PlaygroundErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[playground] render error:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const err = this.state.error;
    if (!err) return this.props.children;
    return (
      <div
        style={{
          margin: 24,
          padding: 16,
          border: '1px solid #fca5a5',
          background: '#fef2f2',
          borderRadius: 8,
          color: '#7f1d1d',
          fontFamily: '-apple-system, BlinkMacSystemFont, monospace',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Что-то сломалось в рендере playground-а</div>
        <div style={{ fontSize: 12, marginBottom: 8 }}>
          Данные в localStorage целы — обычно достаточно нажать кнопку ниже, перезагружать страницу не обязательно. Если
          ошибка повторяется, скинь мне стек из консоли.
        </div>
        <pre
          style={{
            fontSize: 11,
            background: '#fff',
            padding: 8,
            borderRadius: 4,
            overflowX: 'auto',
            maxHeight: 200,
            whiteSpace: 'pre-wrap',
          }}
        >
          {err.message}
          {err.stack ? `\n\n${err.stack}` : ''}
        </pre>
        <button
          type="button"
          onClick={this.reset}
          style={{
            marginTop: 8,
            padding: '6px 12px',
            background: '#dc2626',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Попробовать снова без перезагрузки
        </button>
      </div>
    );
  }
}
