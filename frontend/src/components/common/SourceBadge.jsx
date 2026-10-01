import Badge from "./Badge.jsx";

export default function SourceBadge({ source }) {
  if (source === "DEMO") {
    return <Badge variant="info">DEMO DATA</Badge>;
  }
  return <Badge variant="green">LIVE</Badge>;
}
