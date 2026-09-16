import {
  addDecimal,
  formatDecimal,
  parseDecimal,
  subtractDecimal,
} from "../../platform/planning/decimal";
import type { QtiCompanionItem, QtiCompanionModel, QtiStaticAsset } from "./types";
import { escapeXml } from "./xml";

const qtiNamespace = "http://www.imsglobal.org/xsd/imsqti_v2p2";
const responseIdentifier = "RESPONSE";
const scoreIdentifier = "SCORE";

const outcomeDeclaration = `  <outcomeDeclaration identifier="${scoreIdentifier}" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>`;

const choiceBody = (
  item: Extract<QtiCompanionItem, { type: "single-choice" | "multiple-response" }>,
) => {
  const maximum = item.type === "single-choice" ? 1 : item.maximumChoices;
  const minimum = item.type === "single-choice" ? 1 : item.minimumChoices;
  return [
    `    <choiceInteraction responseIdentifier="${responseIdentifier}" shuffle="false" maxChoices="${maximum}" minChoices="${minimum}">`,
    `      <prompt>${escapeXml(item.prompt)}</prompt>`,
    ...item.choices.map(({ id, label }) => `      <simpleChoice identifier="${escapeXml(id)}">${escapeXml(label)}</simpleChoice>`),
    "    </choiceInteraction>",
  ];
};

const responseProcessingMatch = `  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>`;

const numericResponseProcessing = (correctResponse: string, tolerance: string): string[] => {
  const correct = parseDecimal(correctResponse);
  const amount = parseDecimal(tolerance);
  const lower = formatDecimal(subtractDecimal(correct, amount));
  const upper = formatDecimal(addDecimal(correct, amount));
  return [
    "  <responseProcessing>",
    "    <responseCondition>",
    "      <responseIf>",
    "        <and>",
    `          <gte><variable identifier="${responseIdentifier}"/><baseValue baseType="float">${escapeXml(lower)}</baseValue></gte>`,
    `          <lte><variable identifier="${responseIdentifier}"/><baseValue baseType="float">${escapeXml(upper)}</baseValue></lte>`,
    "        </and>",
    `        <setOutcomeValue identifier="${scoreIdentifier}"><baseValue baseType="float">1</baseValue></setOutcomeValue>`,
    "      </responseIf>",
    "      <responseElse>",
    `        <setOutcomeValue identifier="${scoreIdentifier}"><baseValue baseType="float">0</baseValue></setOutcomeValue>`,
    "      </responseElse>",
    "    </responseCondition>",
    "  </responseProcessing>",
  ];
};

export const serializeQti22Item = (
  item: QtiCompanionItem,
  assets: readonly QtiStaticAsset[] = [],
  activity?: QtiCompanionModel["associatedActivity"] & { instructions: string },
): string => {
  const assetMarkup = item.staticAssetRefs.map((assetId) => {
    const asset = assets.find(({ id }) => id === assetId);
    if (!asset) throw new Error(`Missing validated QTI asset ${assetId}.`);
    return `    <p><img src="../assets/${escapeXml(asset.fileName)}" alt="${escapeXml(asset.alternativeText)}"/></p>`;
  });
  const lines = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    `<assessmentItem xmlns="${qtiNamespace}" identifier="${escapeXml(item.id)}" title="${escapeXml(item.title)}" adaptive="false" timeDependent="false">`,
  ];
  const activityMarkup = activity ? [
    `    <p>${escapeXml(activity.instructions)}</p>`,
    activity.href
      ? `    <p><a href="${escapeXml(activity.href)}">${escapeXml(activity.label)}</a></p>`
      : `    <p>${escapeXml(activity.label)}</p>`,
  ] : [];
  if (item.type === "single-choice" || item.type === "multiple-response") {
    const values = item.type === "single-choice" ? [item.correctChoiceId] : item.correctChoiceIds;
    lines.push(
      `  <responseDeclaration identifier="${responseIdentifier}" cardinality="${item.type === "single-choice" ? "single" : "multiple"}" baseType="identifier">`,
      "    <correctResponse>",
      ...values.map((value) => `      <value>${escapeXml(value)}</value>`),
      "    </correctResponse>",
      "  </responseDeclaration>",
      outcomeDeclaration,
      "  <itemBody>",
      ...activityMarkup,
      ...assetMarkup,
      ...choiceBody(item),
      "  </itemBody>",
      responseProcessingMatch,
    );
  } else if (item.type === "numeric-response") {
    lines.push(
      `  <responseDeclaration identifier="${responseIdentifier}" cardinality="single" baseType="float">`,
      `    <correctResponse><value>${escapeXml(item.correctResponse)}</value></correctResponse>`,
      "  </responseDeclaration>",
      outcomeDeclaration,
      "  <itemBody>",
      ...activityMarkup,
      ...assetMarkup,
      `    <p>${escapeXml(item.prompt)}${item.unitLabel ? ` (${escapeXml(item.unitLabel)})` : ""}</p>`,
      `    <textEntryInteraction responseIdentifier="${responseIdentifier}" expectedLength="16"/>`,
      "  </itemBody>",
      ...numericResponseProcessing(item.correctResponse, item.tolerance),
    );
  } else {
    lines.push(
      `  <responseDeclaration identifier="${responseIdentifier}" cardinality="single" baseType="string"/>`,
      "  <itemBody>",
      ...activityMarkup,
      ...assetMarkup,
      `    <extendedTextInteraction responseIdentifier="${responseIdentifier}" expectedLines="${item.expectedLines}">`,
      `      <prompt>${escapeXml(item.prompt)}</prompt>`,
      "    </extendedTextInteraction>",
      "  </itemBody>",
    );
  }
  lines.push("</assessmentItem>");
  return `${lines.join("\n")}\n`;
};

export const serializeQti22Test = (model: QtiCompanionModel): string => [
  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
  `<assessmentTest xmlns="${qtiNamespace}" identifier="${escapeXml(`${model.id}.test`)}" title="${escapeXml(model.title)}">`,
  `  <testPart identifier="${escapeXml(`${model.id}.part`)}" navigationMode="linear" submissionMode="individual">`,
  `    <assessmentSection identifier="${escapeXml(`${model.id}.section`)}" title="${escapeXml(model.title)}" visible="true">`,
  ...model.items.map(({ id }) => `      <assessmentItemRef identifier="${escapeXml(`${id}.ref`)}" href="items/${escapeXml(id)}.xml"/>`),
  "    </assessmentSection>",
  "  </testPart>",
  "</assessmentTest>",
  "",
].join("\n");

export const serializeQti22Manifest = (model: QtiCompanionModel): string => {
  const assetFiles = model.assets.map(({ fileName }) => `        <file href="assets/${escapeXml(fileName)}"/>`);
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    `<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" xmlns:imsqti="${qtiNamespace}" identifier="${escapeXml(`${model.id}.manifest`)}">`,
    "  <metadata>",
    "    <schema>QTI Package</schema>",
    "    <schemaversion>2.2</schemaversion>",
    "  </metadata>",
    "  <organizations/>",
    "  <resources>",
    `    <resource identifier="${escapeXml(`${model.id}.test.resource`)}" type="imsqti_test_xmlv2p2" href="assessment.xml">`,
    "      <file href=\"assessment.xml\"/>",
    ...model.items.map(({ id }) => `      <dependency identifierref="${escapeXml(`${id}.resource`)}"/>`),
    "    </resource>",
    ...model.items.flatMap((item) => [
      `    <resource identifier="${escapeXml(`${item.id}.resource`)}" type="imsqti_item_xmlv2p2" href="items/${escapeXml(item.id)}.xml">`,
      `      <file href="items/${escapeXml(item.id)}.xml"/>`,
      ...item.staticAssetRefs.map((assetId) => `      <dependency identifierref="${escapeXml(`${assetId}.resource`)}"/>`),
      "    </resource>",
    ]),
    ...model.assets.flatMap((asset) => [
      `    <resource identifier="${escapeXml(`${asset.id}.resource`)}" type="webcontent" href="assets/${escapeXml(asset.fileName)}">`,
      ...assetFiles.filter((line) => line.includes(`assets/${escapeXml(asset.fileName)}`)),
      "    </resource>",
    ]),
    "  </resources>",
    "</manifest>",
    "",
  ].join("\n");
};
