import { redirect } from "next/navigation";
import { format } from "date-fns";

export default function ResumoIndex() {
  const currentMonth = format(new Date(), "yyyy-MM");
  redirect(`/resumo/${currentMonth}`);
}
