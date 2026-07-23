function parseInline(text: string) {
  const parts = text.split(/(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);

    if (linkMatch) {
      return (
        <a href={linkMatch[2]} key={index} rel="noreferrer" target="_blank">
          {linkMatch[1]}
        </a>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return <span key={index}>{part}</span>;
  });
}

function isTableBlock(lines: string[]) {
  return (
    lines.length >= 2 &&
    lines[0].includes("|") &&
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[1])
  );
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(lines: string[], key: string) {
  const headers = splitTableRow(lines[0]);
  const rows = lines.slice(2).map(splitTableRow);

  return (
    <div className="table-wrap" key={key}>
      <table>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index}>{parseInline(header)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{parseInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderList(lines: string[], key: string) {
  const ordered = /^\d+\.\s+/.test(lines[0]);
  const items = lines.map((line) => line.replace(/^(\d+\.|-)\s+/, ""));
  const ListTag = ordered ? "ol" : "ul";

  return (
    <ListTag key={key}>
      {items.map((item, index) => (
        <li key={index}>{parseInline(item)}</li>
      ))}
    </ListTag>
  );
}

export function MarkdownView({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(<h3 key={index}>{parseInline(line.slice(4))}</h3>);
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(<h2 key={index}>{parseInline(line.slice(3))}</h2>);
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(<h2 key={index}>{parseInline(line.slice(2))}</h2>);
      index += 1;
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length) {
      const tableLines: string[] = [];

      while (index < lines.length && lines[index].includes("|")) {
        tableLines.push(lines[index]);
        index += 1;
      }

      if (isTableBlock(tableLines)) {
        blocks.push(renderTable(tableLines, `table-${index}`));
        continue;
      }

      blocks.push(
        <p key={`plain-table-${index}`}>{parseInline(tableLines.join("\n"))}</p>,
      );
      continue;
    }

    if (/^(\d+\.|-)\s+/.test(line)) {
      const listLines: string[] = [];
      const ordered = /^\d+\.\s+/.test(line);
      const pattern = ordered ? /^\d+\.\s+/ : /^-\s+/;

      while (index < lines.length && pattern.test(lines[index])) {
        listLines.push(lines[index]);
        index += 1;
      }

      blocks.push(renderList(listLines, `list-${index}`));
      continue;
    }

    const paragraphLines = [line];
    index += 1;

    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith("#") &&
      !/^(\d+\.|-)\s+/.test(lines[index]) &&
      !lines[index].includes("|")
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push(
      <p key={`p-${index}`}>{parseInline(paragraphLines.join("\n"))}</p>,
    );
  }

  return (
    <div className="markdown-view">
      {blocks}
      <style jsx>{`
        .markdown-view {
          display: grid;
          gap: 12px;
        }

        .markdown-view :global(h2),
        .markdown-view :global(h3),
        .markdown-view :global(p),
        .markdown-view :global(ol),
        .markdown-view :global(ul) {
          margin: 0;
        }

        .markdown-view :global(ol),
        .markdown-view :global(ul) {
          padding-left: 22px;
        }

        .markdown-view :global(li) {
          margin: 7px 0;
        }

        .markdown-view :global(a) {
          color: #9fb2ff;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .table-wrap {
          overflow-x: auto;
        }

        .markdown-view :global(table) {
          width: 100%;
          min-width: 560px;
          border-collapse: collapse;
          font-size: 0.94rem;
        }

        .markdown-view :global(th),
        .markdown-view :global(td) {
          border: 1px solid #3a4056;
          padding: 9px 10px;
          text-align: left;
          vertical-align: top;
        }

        .markdown-view :global(th) {
          background: #242b3d;
          color: #ffffff;
        }

        .markdown-view :global(td) {
          background: #161b28;
        }
      `}</style>
    </div>
  );
}
