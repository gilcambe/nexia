import React, { useState } from "react";

interface MarkdownRendererProps {
  markdown: string;
}

export default function MarkdownRenderer({ markdown }: MarkdownRendererProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const renderContent = (text: string) => {
    if (!text) return null;

    // Split by code blocks first
    const codeBlockRegex = /```([a-z]*)\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let codeIndex = 0;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Render text before code block
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {renderFormattedText(text.substring(lastIndex, match.index))}
          </span>
        );
      }

      const lang = match[1] || "";
      const code = match[2];
      const curIndex = codeIndex++;

      parts.push(
        <div key={`code-${match.index}`} className="my-4 rounded-xl overflow-hidden border border-[var(--cx-line)] bg-[#0d1117] text-[#c9d1d9] text-xs">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-[var(--cx-line)] text-[var(--cx-mut)]">
            <span className="font-mono uppercase">{lang || "código"}</span>
            <button
              type="button"
              onClick={() => handleCopy(code, curIndex)}
              className="px-2 py-1 rounded bg-[var(--cx-line)] hover:bg-[var(--cx-hover)] text-[var(--cx-txt)] transition-colors flex items-center gap-1 font-sans text-xs"
            >
              {copiedIndex === curIndex ? "✓ Copiado!" : "Copiar"}
            </button>
          </div>
          <pre className="p-4 overflow-x-auto font-mono leading-relaxed">
            <code>{code}</code>
          </pre>
        </div>
      );

      lastIndex = codeBlockRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {renderFormattedText(text.substring(lastIndex))}
        </span>
      );
    }

    return parts;
  };

  const renderFormattedText = (plainText: string) => {
    // Process block elements: Tables, Headers, Lists, Paragraphs
    const lines = plainText.split("\n");
    const elements: React.ReactNode[] = [];
    let tableRows: string[][] = [];

    const flushTable = (key: string) => {
      if (tableRows.length > 0) {
        const header = tableRows[0];
        const body = tableRows.slice(2); // skip separator row like |---|---|
        elements.push(
          <div key={key} className="my-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--cx-line)] bg-[var(--cx-card)]">
                  {header.map((cell, idx) => (
                    <th key={idx} className="p-2 font-semibold">
                      {formatInline(cell.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, rIdx) => (
                  <tr key={rIdx} className="border-b border-[var(--cx-line)]/50 hover:bg-[var(--cx-hover)]/30">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-2">
                        {formatInline(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Table row check
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        const cells = trimmed.slice(1, -1).split("|");
        tableRows.push(cells);
        return;
      } else {
        flushTable(`table-${index}`);
      }

      // Headers
      if (trimmed.startsWith("### ")) {
        elements.push(
          <h3 key={index} className="text-base font-bold mt-4 mb-2">
            {formatInline(trimmed.replace(/^###\s+/, ""))}
          </h3>
        );
        return;
      }
      if (trimmed.startsWith("## ")) {
        elements.push(
          <h2 key={index} className="text-lg font-bold mt-5 mb-2">
            {formatInline(trimmed.replace(/^##\s+/, ""))}
          </h2>
        );
        return;
      }
      if (trimmed.startsWith("# ")) {
        elements.push(
          <h1 key={index} className="text-xl font-bold mt-6 mb-3">
            {formatInline(trimmed.replace(/^#\s+/, ""))}
          </h1>
        );
        return;
      }

      // Lists
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        elements.push(
          <li key={index} className="ml-5 list-disc my-1">
            {formatInline(trimmed.replace(/^[-*]\s+/, ""))}
          </li>
        );
        return;
      }

      // Regular paragraph or empty line
      if (trimmed === "") {
        elements.push(<div key={index} className="h-2" />);
        return;
      }

      elements.push(
        <p key={index} className="my-1 leading-6">
          {formatInline(line)}
        </p>
      );
    });

    flushTable("table-end");

    return <>{elements}</>;
  };

  const formatInline = (text: string): React.ReactNode => {
    if (!text) return null;

    // Split and parse bold (**text**), italic (*text*), inline code (`code`), and links ([text](url))
    // We can use a regex tokenizer or simple replacement logic returning React elements.
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyIdx = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={keyIdx++}>{text.substring(lastIndex, match.index)}</span>);
      }

      const item = match[0];
      if (item.startsWith("**") && item.endsWith("**")) {
        parts.push(
          <strong key={keyIdx++} className="font-bold">
            {item.slice(2, -2)}
          </strong>
        );
      } else if (item.startsWith("*") && item.endsWith("*")) {
        parts.push(
          <em key={keyIdx++} className="italic">
            {item.slice(1, -1)}
          </em>
        );
      } else if (item.startsWith("`") && item.endsWith("`")) {
        parts.push(
          <code key={keyIdx++} className="px-1.5 py-0.5 rounded bg-[var(--cx-line)]/50 font-mono text-xs">
            {item.slice(1, -1)}
          </code>
        );
      } else if (item.startsWith("[") && item.includes("](") && item.endsWith(")")) {
        const linkMatch = /^\[(.*?)\]\((.*?)\)$/.exec(item);
        if (linkMatch) {
          parts.push(
            <a
              key={keyIdx++}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--cx-ac)] underline hover:opacity-80"
            >
              {linkMatch[1]}
            </a>
          );
        } else {
          parts.push(<span key={keyIdx++}>{item}</span>);
        }
      } else {
        parts.push(<span key={keyIdx++}>{item}</span>);
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={keyIdx++}>{text.substring(lastIndex)}</span>);
    }

    return <>{parts}</>;
  };

  return <div className="markdown-body">{renderContent(markdown)}</div>;
}
