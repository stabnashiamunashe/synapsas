"use client";

import { Skeleton } from "antd";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/client";
import { TemplateBuilder, type TemplateModel } from "@/components/TemplateBuilder";

export default function TemplateEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const { data, isLoading } = useApi<TemplateModel>(isNew ? null : `/api/templates/${id}`);
  if (!isNew && (isLoading || !data)) return <Skeleton active />;
  return <TemplateBuilder initial={isNew ? null : data!} />;
}
