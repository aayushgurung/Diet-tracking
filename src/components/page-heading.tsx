import type { ReactNode } from "react";

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 className="page-title">{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action}</header>;
}
