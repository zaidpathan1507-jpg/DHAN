import { useI18n } from "../../lib/i18n.jsx";
import Badge from "./Badge.jsx";

export default function SourceBadge({ source }) {
  const { t } = useI18n();
  if (source === "DEMO") return <Badge variant="info">{t("common.demo")}</Badge>;
  return <Badge variant="green">{t("common.live")}</Badge>;
}
