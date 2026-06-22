import type { Business } from "../types";
import BusinessCard from "./BusinessCard";
import { EmptyState } from "./ui";

export default function BusinessList({ businesses }: { businesses: Business[] }) {
  if (businesses.length === 0) {
    return <EmptyState title="לא נמצאו עסקים" hint="נסו לשנות את הסינון או החיפוש" />;
  }
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4">
      {businesses.map((b) => (
        <BusinessCard key={b.id} business={b} />
      ))}
    </div>
  );
}
