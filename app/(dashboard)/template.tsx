import { ViewTransition } from "react";

export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ViewTransition>{children}</ViewTransition>;
}
