export const escapeXml = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll("\"", "&quot;")
  .replaceAll("'", "&apos;");

export const qtiXmlSecurityDiagnostics = (xml: string): string[] => {
  const diagnostics: string[] = [];
  if (!xml.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")) diagnostics.push("missing-xml-declaration");
  if (/<!DOCTYPE|<!ENTITY|<script\b|javascript:|data:text\/html/i.test(xml)) diagnostics.push("unsafe-active-content");
  if (xml.includes("\\") || /(?:^|["'])\/(?:[A-Za-z]:|Users\/|home\/)/i.test(xml)) diagnostics.push("absolute-local-path");
  return diagnostics;
};
