import Markdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownComponents: Components = {
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="neuron-md-table-wrap">
        <table>{children}</table>
      </div>
    );
  },
  pre({ children }) {
    return <pre className="neuron-md-codeblock">{children}</pre>;
  },
  code({ className, children, ...props }) {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="neuron-md-inline-code" {...props}>
        {children}
      </code>
    );
  },
  input({ type, checked, ...props }) {
    if (type === "checkbox") {
      return <input type="checkbox" checked={Boolean(checked)} disabled readOnly />;
    }
    return <input type={type} {...props} disabled />;
  },
};

type NeuronMarkdownPreviewProps = {
  value: string;
};

export function NeuronMarkdownPreview({ value }: NeuronMarkdownPreviewProps) {
  if (!value.trim()) {
    return <p className="neuron-md-empty">Chưa có nội dung để xem trước.</p>;
  }

  return (
    <Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={defaultUrlTransform} components={markdownComponents}>
      {value}
    </Markdown>
  );
}
