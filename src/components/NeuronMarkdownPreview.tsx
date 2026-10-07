import Markdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DocumentMeta } from "../api/documents";
import type { Neuron } from "../types";
import { DocumentNoteImage } from "./DocumentNoteImage";
import { highlightColors } from "../markdown/documentEditor";

const TOKEN_PATTERN = /\[\[(relation|document):([^\]\s]+)\]\]/g;

type PreviewContext = {
  neurons?: Neuron[];
  documents?: DocumentMeta[];
  onSelectNeuron?: (neuronId: string) => void;
  onOpenDocument?: (document: DocumentMeta) => void;
};

function encodeTokenLink(type: "relation" | "document", id: string) {
  return `${type}://${encodeURIComponent(id)}`;
}

function decodeTokenId(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function preprocessCustomTokens(value: string, neurons: Neuron[] = [], documents: DocumentMeta[] = []) {
  const replaceTokens = (chunk: string) => chunk.replace(TOKEN_PATTERN, (_match, type: "relation" | "document", id: string) => {
    if (type === "relation") {
      const neuron = neurons.find((item) => item.id === id);
      return `[${neuron?.name ?? "Neuron không tồn tại"}](${encodeTokenLink(type, id)})`;
    }

    const document = documents.find((item) => item.id === id);
    return `[${document?.originalName ?? "Tài liệu không tồn tại"}](${encodeTokenLink(type, id)})`;
  });

  let rendered = "";
  let index = 0;

  while (index < value.length) {
    if (value.startsWith("```", index)) {
      const end = value.indexOf("```", index + 3);
      const next = end === -1 ? value.length : end + 3;
      rendered += value.slice(index, next);
      index = next;
      continue;
    }

    if (value[index] === "`") {
      const end = value.indexOf("`", index + 1);
      const next = end === -1 ? value.length : end + 1;
      rendered += value.slice(index, next);
      index = next;
      continue;
    }

    const nextCode = value.indexOf("`", index);
    const next = nextCode === -1 ? value.length : nextCode;
    rendered += replaceTokens(value.slice(index, next));
    index = next;
  }

  return rendered;
}

function markdownUrlTransform(url: string) {
  if (url === "nm-underline:" || /^nm-highlight:(yellow|pink|blue|green)$/.test(url)) return url;
  if (url.startsWith("relation://") || url.startsWith("document://")) return url;
  return defaultUrlTransform(url);
}

function createMarkdownComponents({
  neurons = [],
  documents = [],
  onSelectNeuron,
  onOpenDocument,
}: PreviewContext): Components {
  return {
  a({ href, children }) {
    if (href === "nm-underline:") return <u>{children}</u>;
    const color = href?.match(/^nm-highlight:(yellow|pink|blue|green)$/)?.[1] as keyof typeof highlightColors | undefined;
    if (color) return <mark style={{ backgroundColor: highlightColors[color] }}>{children}</mark>;
    if (href?.startsWith("relation://")) {
      const neuronId = decodeTokenId(href.slice("relation://".length));
      const neuron = neurons.find((item) => item.id === neuronId);
      return (
        <button
          type="button"
          className={`neuron-md-ref-chip is-relation${neuron ? "" : " is-missing"}`}
          disabled={!neuron}
          onClick={() => {
            if (neuron) onSelectNeuron?.(neuron.id);
          }}
        >
          <span aria-hidden="true">🧠</span>
          <span>{neuron?.name ?? children}</span>
        </button>
      );
    }

    if (href?.startsWith("document://")) {
      const documentId = decodeTokenId(href.slice("document://".length));
      const document = documents.find((item) => item.id === documentId);
      return (
        <button
          type="button"
          className={`neuron-md-ref-chip is-document${document ? "" : " is-missing"}`}
          disabled={!document}
          onClick={() => {
            if (document) onOpenDocument?.(document);
          }}
        >
          <span aria-hidden="true">📄</span>
          <span>{document?.originalName ?? children}</span>
          {document ? <span aria-hidden="true">↗</span> : null}
        </button>
      );
    }

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
  img({ src, alt }) {
    if (src?.startsWith("document://")) return <DocumentNoteImage id={decodeTokenId(src.slice("document://".length))} alt={alt ?? "Ảnh"} />;
    return <img src={src} alt={alt ?? ""} loading="lazy" referrerPolicy="no-referrer" />;
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
}

type NeuronMarkdownPreviewProps = {
  value: string;
  emptyLabel?: string;
  neurons?: Neuron[];
  documents?: DocumentMeta[];
  onSelectNeuron?: (neuronId: string) => void;
  onOpenDocument?: (document: DocumentMeta) => void;
};

export function NeuronMarkdownPreview({
  value,
  emptyLabel = "Chưa có nội dung để xem trước.",
  neurons,
  documents,
  onSelectNeuron,
  onOpenDocument,
}: NeuronMarkdownPreviewProps) {
  if (!value.trim()) {
    return <p className="neuron-md-empty">{emptyLabel}</p>;
  }

  const renderedValue = preprocessCustomTokens(value, neurons, documents);
  const markdownComponents = createMarkdownComponents({ neurons, documents, onSelectNeuron, onOpenDocument });

  return (
    <Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={markdownUrlTransform} components={markdownComponents}>
      {renderedValue}
    </Markdown>
  );
}
