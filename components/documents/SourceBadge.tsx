'use client';

interface SourceBadgeProps {
  source: string;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  if (source === 'federal_register') {
    return (
      <span className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded">
        Federal Register
      </span>
    );
  }

  if (source === 'newsroom_rss') {
    return (
      <span className="px-2 py-1 text-xs font-medium bg-orange-50 text-orange-700 rounded">
        Newsroom
      </span>
    );
  }

  return (
    <span className="px-2 py-1 text-xs font-medium bg-gray-50 text-gray-700 rounded">
      {source}
    </span>
  );
}
