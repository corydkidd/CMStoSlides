interface Source {
  document_title: string;
  section: string | null;
  section_title: string | null;
}

interface Props {
  source: Source;
}

export function SourceChip({ source }: Props) {
  const label = source.section
    ? `${source.document_title} §${source.section}`
    : source.document_title;

  const tooltip = source.section_title
    ? `${label} — ${source.section_title}`
    : label;

  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-400/30 max-w-xs truncate"
    >
      {label}
    </span>
  );
}
