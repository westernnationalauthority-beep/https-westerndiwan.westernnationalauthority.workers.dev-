import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[S-BUTTO] UI error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-white p-6 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">!</div>
          <h1 className="text-lg font-bold text-slate-900">حدث خطأ غير متوقع</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            لم يتم فقدان البيانات. يمكنك إعادة تحميل الصفحة والمحاولة مرة أخرى.
          </p>
          {this.state.message && (
            <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-500" dir="ltr">
              {this.state.message}
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-5 w-full rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-800"
          >
            إعادة تحميل المنظومة
          </button>
        </div>
      </div>
    );
  }
}