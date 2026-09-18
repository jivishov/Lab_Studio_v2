/** Cycle 05-owned transmittance-dilution definition. Generated from the reviewed revision-5 migration; keep this module data-only. */
import { applyStockSupplyVolumes } from "../stockSupplyVolumes.mjs";
const definition = {
  "id": "transmittance-dilution",
  "title": "Analyze Transmittance of a Dilution",
  "learningGoal": "Prepare one assigned dye dilution, blank and read a spectrophotometer, then relate transmittance, absorbance, and concentration evidence.",
  "requiredEquipment": [
    "sample-bottle",
    "graduated-cylinder",
    "test-tube",
    "wash-bottle",
    "rubber-stopper-set",
    "cuvette",
    "spectrophotometer"
  ],
  "initialState": {
    "equipment": [
      {
        "id": "sample-bottle-1",
        "definitionId": "sample-bottle",
        "label": "Blue dye stock",
        "location": "shelf",
        "contents": {
          "kind": "solution",
          "label": "Blue dye stock",
          "solutes": [
            {
              "id": "blue-dye-1",
              "label": "Blue dye #1"
            }
          ],
          "contamination": [],
          "wetState": "wet",
          "visualState": "blue-dye-solution"
        }
      },
      {
        "id": "graduated-cylinder-1",
        "definitionId": "graduated-cylinder",
        "label": "Graduated cylinder",
        "location": "shelf",
        "contents": {
          "kind": "empty",
          "label": "empty",
          "solutes": [],
          "contamination": [],
          "wetState": "dry",
          "visualState": "empty"
        }
      },
      {
        "id": "prepared-receiver-1",
        "definitionId": "test-tube",
        "label": "Clean labelled prepared-sample receiver",
        "location": "shelf",
        "contents": {
          "kind": "empty",
          "label": "empty",
          "solutes": [],
          "contamination": [],
          "wetState": "dry",
          "visualState": "empty"
        }
      },
      {
        "id": "wash-bottle-1",
        "definitionId": "wash-bottle",
        "label": "Wash bottle",
        "location": "shelf",
        "contents": {
          "kind": "liquid",
          "label": "Deionized water",
          "volumeMl": 500,
          "solutes": [],
          "contamination": [],
          "wetState": "wet",
          "visualState": "clear-liquid"
        }
      },
      {
        "id": "rubber-stopper-set-1",
        "definitionId": "rubber-stopper-set",
        "label": "Rubber stopper",
        "location": "shelf",
        "contents": {
          "kind": "empty",
          "label": "empty",
          "solutes": [],
          "contamination": [],
          "wetState": "dry",
          "visualState": "empty"
        }
      },
      {
        "id": "sample-cuvette-1",
        "definitionId": "cuvette",
        "label": "Sample cuvette",
        "location": "shelf",
        "contents": {
          "kind": "empty",
          "label": "empty",
          "solutes": [],
          "contamination": [],
          "wetState": "dry",
          "visualState": "empty"
        }
      },
      {
        "id": "spectrophotometer-1",
        "definitionId": "spectrophotometer",
        "label": "Spectrophotometer",
        "location": "shelf",
        "contents": {
          "kind": "empty",
          "label": "empty",
          "solutes": [],
          "contamination": [],
          "wetState": "dry",
          "visualState": "empty"
        }
      },
      {
        "id": "blank-source-1",
        "definitionId": "sample-bottle",
        "label": "Teacher-approved blank source",
        "location": "shelf",
        "contents": {
          "kind": "solution",
          "label": "configured blank",
          "solutes": [],
          "contamination": [],
          "wetState": "wet",
          "visualState": "clear-liquid"
        }
      },
      {
        "id": "blank-cuvette-1",
        "definitionId": "cuvette",
        "label": "Blank cuvette",
        "location": "shelf",
        "contents": {
          "kind": "empty",
          "label": "empty",
          "solutes": [],
          "contamination": [],
          "wetState": "dry",
          "visualState": "empty"
        }
      }
    ]
  },
  "actions": [
    {
      "id": "transmittance-dilution-record-stock-concentration",
      "verb": "observe",
      "label": "Record the instructor-approved stock concentration",
      "atomId": "atom.observe.record-teacher-configured-numeric-value",
      "parameters": {
        "measurementId": "{{config.stockConcentrationMeasurementId}}",
        "configurationQuantity": "stock solution concentration",
        "inputMode": "numeric",
        "inputRole": "teacherConfiguration",
        "inputRequired": false,
        "inputLabel": "Instructor-approved stock solution concentration (M)",
        "inputMin": 0,
        "inputMinExclusive": true,
        "unit": "M",
        "configurationProvenance": "teacher-approved; the stock concentration is supplied by the instructor",
        "configuredValue": "{{config.stockConcentrationM}}"
      },
      "prerequisites": [],
      "stateChanges": [
        "Record the instructor-approved stock concentration: the named concentration is available as measurement evidence for the dilution calculation."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the approved stock concentration is missing or invalid",
          "message": "The dilution cannot proceed without an instructor-approved stock concentration.",
          "recovery": "Enter a positive instructor-approved stock concentration in mol/L."
        }
      ],
      "feedback": {
        "success": "Instructor-approved stock concentration recorded.",
        "invalid": "Enter the positive instructor-approved stock concentration before measuring the aliquot."
      },
      "evidence": [],
      "interaction": {
        "type": "recordNotebook",
        "valueParameter": "measurementId",
        "accessibleLabel": "Record the instructor-approved stock concentration"
      }
    },
    {
      "id": "transmittance-dilution-place-volumetric-flask",
      "verb": "place",
      "label": "Select the clean labelled dilution receiver",
      "parameters": {
        "equipmentDefinitionId": "test-tube",
        "equipmentInstanceId": "prepared-receiver-1"
      },
      "prerequisites": [],
      "stateChanges": [
        "Select the clean labelled dilution receiver: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Select the clean labelled dilution receiver complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.place.select-clean-dry-receiving-vessel",
      "equipmentRoleBindings": {
        "receiving-vessel": "test-tube"
      },
      "interaction": {
        "type": "dragToZone",
        "sourceDefinitionId": "test-tube",
        "stationId": "workbench",
        "accessibleLabel": "Select the clean labelled dilution receiver"
      }
    },
    {
      "id": "transmittance-dilution-place-graduated-cylinder",
      "verb": "place",
      "label": "Place the approved variable-volume device",
      "parameters": {
        "equipmentDefinitionId": "graduated-cylinder",
        "equipmentInstanceId": "graduated-cylinder-1"
      },
      "prerequisites": [],
      "stateChanges": [
        "Place the approved variable-volume device: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Place the approved variable-volume device complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.place.variable-volume-device",
      "equipmentRoleBindings": {
        "variable-volume-measuring-device": "graduated-cylinder"
      },
      "interaction": {
        "type": "dragToZone",
        "sourceDefinitionId": "graduated-cylinder",
        "stationId": "workbench",
        "accessibleLabel": "Place the approved variable-volume device"
      }
    },
    {
      "id": "transmittance-dilution-measure-stock-dye",
      "verb": "measureVolume",
      "label": "Measure the configured stock-dye aliquot",
      "parameters": {
        "sourceInstanceId": "sample-bottle-1",
        "targetInstanceId": "graduated-cylinder-1",
        "concentrationMeasurementId": "{{config.stockConcentrationMeasurementId}}",
        "inputMode": "numeric",
        "inputRole": "teacherConfiguration",
        "inputLabel": "Measure the configured stock-dye aliquot (mL)",
        "inputMin": 0,
        "inputMinExclusive": true,
        "unit": "mL"
      },
      "prerequisites": [],
      "stateChanges": [
        "Measure the configured stock-dye aliquot: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Measure the configured stock-dye aliquot complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.measure.variable-volume",
      "equipmentRoleBindings": {
        "variable-volume-measuring-device": "graduated-cylinder",
        "liquid-source": "sample-bottle"
      },
      "interaction": {
        "type": "pourInto",
        "sourceDefinitionId": "sample-bottle",
        "targetDefinitionId": "graduated-cylinder",
        "accessibleLabel": "Measure the configured stock-dye aliquot"
      },
      "volume": {
        "source": "action-input",
        "outputMeasurementId": "{{config.stockVolumeMeasurementId}}"
      }
    },
    {
      "id": "transmittance-dilution-transfer-dye-aliquot",
      "verb": "transfer",
      "label": "Transfer the measured stock aliquot",
      "parameters": {
        "sourceInstanceId": "graduated-cylinder-1",
        "targetInstanceId": "prepared-receiver-1"
      },
      "prerequisites": [],
      "stateChanges": [
        "Transfer the measured stock aliquot: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Transfer the measured stock aliquot complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.transfer.measured-liquid",
      "equipmentRoleBindings": {
        "measured-solvent-source": "graduated-cylinder",
        "receiving-vessel": "test-tube"
      },
      "interaction": {
        "type": "pourInto",
        "sourceDefinitionId": "graduated-cylinder",
        "targetDefinitionId": "test-tube",
        "accessibleLabel": "Transfer the measured stock aliquot"
      },
      "volume": {
        "source": "measurement",
        "referenceId": "{{config.stockVolumeMeasurementId}}"
      }
    },
    {
      "id": "transmittance-dilution-measure-water-volume",
      "verb": "measureVolume",
      "label": "Measure the configured water addition",
      "parameters": {
        "sourceInstanceId": "wash-bottle-1",
        "targetInstanceId": "graduated-cylinder-1",
        "inputMode": "numeric",
        "inputRole": "teacherConfiguration",
        "inputLabel": "Measure the configured water volume (mL)",
        "inputMin": 0,
        "inputMinExclusive": true,
        "unit": "mL"
      },
      "prerequisites": [],
      "stateChanges": [
        "Measure the configured water addition: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Measure the configured water addition complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.measure.variable-volume",
      "equipmentRoleBindings": {
        "variable-volume-measuring-device": "graduated-cylinder",
        "liquid-source": "wash-bottle"
      },
      "interaction": {
        "type": "pourInto",
        "sourceDefinitionId": "wash-bottle",
        "targetDefinitionId": "graduated-cylinder",
        "accessibleLabel": "Measure the configured water addition"
      },
      "volume": {
        "source": "action-input",
        "outputMeasurementId": "{{config.waterVolumeMeasurementId}}"
      }
    },
    {
      "id": "transmittance-dilution-add-water-below-mark",
      "verb": "dilute",
      "label": "Add the measured water and mix to the configured final volume",
      "parameters": {
        "sourceInstanceId": "graduated-cylinder-1",
        "targetInstanceId": "prepared-receiver-1",
        "sourceDefinitionId": "graduated-cylinder",
        "inputMode": "numeric",
        "inputRole": "teacherConfiguration",
        "inputLabel": "Dilute and mix to the configured final volume: final volume (mL)",
        "inputMin": 0,
        "inputMinExclusive": true,
        "unit": "mL"
      },
      "prerequisites": [],
      "stateChanges": [
        "Dilute and mix to the configured final volume: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Dilute and mix to the configured final volume complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.dilute.record-resulting-final-volume",
      "equipmentRoleBindings": {
        "measured-solvent-source": "graduated-cylinder",
        "receiving-vessel": "test-tube"
      },
      "interaction": {
        "type": "pourInto",
        "sourceDefinitionId": "graduated-cylinder",
        "targetDefinitionId": "test-tube",
        "accessibleLabel": "Dilute and mix to the configured final volume"
      },
      "volume": {
        "source": "action-input",
        "outputMeasurementId": "{{config.finalVolumeMeasurementId}}"
      }
    },
    {
      "id": "transmittance-dilution-place-spectrophotometer",
      "verb": "place",
      "label": "Place the photometer",
      "parameters": {
        "equipmentInstanceId": "spectrophotometer-1"
      },
      "prerequisites": [],
      "stateChanges": [
        "Place the photometer: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Place the photometer complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.place.photometer",
      "equipmentRoleBindings": {
        "photometer-instrument": "spectrophotometer"
      },
      "interaction": {
        "type": "dragToZone",
        "sourceDefinitionId": "spectrophotometer",
        "stationId": "workbench",
        "accessibleLabel": "Place the photometer"
      }
    },
    {
      "id": "transmittance-dilution-configure-photometer",
      "verb": "observe",
      "label": "Apply the configured wavelength and percent-transmittance mode",
      "parameters": {
        "photometerInstanceId": "spectrophotometer-1",
        "measurementId": "{{config.wavelengthMeasurementId}}",
        "configurationQuantity": "measurement wavelength",
        "inputMode": "numeric",
        "inputRole": "teacherConfiguration",
        "inputRequired": false,
        "inputLabel": "Approved measurement wavelength (nm)",
        "inputMin": 0,
        "inputMinExclusive": true,
        "configuredValue": "{{config.wavelengthNm}}",
        "unit": "nm",
        "photometricMode": "percentTransmittance",
        "tag": "generic-photometer-configured"
      },
      "prerequisites": [],
      "stateChanges": [
        "Apply the configured wavelength and percent-transmittance mode: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Apply the configured wavelength and percent-transmittance mode complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.observe.configure-photometer",
      "equipmentRoleBindings": {
        "photometer-instrument": "spectrophotometer"
      },
      "interaction": {
        "type": "readInstrument",
        "sourceDefinitionId": "spectrophotometer",
        "stationId": "spectrophotometer",
        "accessibleLabel": "Apply the configured wavelength and percent-transmittance mode"
      }
    },
    {
      "id": "transmittance-dilution-fill-blank-cuvette",
      "verb": "transfer",
      "label": "Fill the teacher-approved blank cuvette",
      "parameters": {
        "sourceInstanceId": "blank-source-1",
        "targetInstanceId": "blank-cuvette-1"
      },
      "prerequisites": [],
      "stateChanges": [
        "Fill the teacher-approved blank cuvette: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Fill the teacher-approved blank cuvette complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.transfer.fill-cuvette",
      "equipmentRoleBindings": {
        "sample-source": "sample-bottle",
        "photometer-sample-holder": "cuvette"
      },
      "interaction": {
        "type": "pourInto",
        "sourceDefinitionId": "sample-bottle",
        "targetDefinitionId": "cuvette",
        "accessibleLabel": "Fill the teacher-approved blank cuvette"
      },
      "volume": {
        "source": "target-fill-fraction",
        "fraction": 0.75
      }
    },
    {
      "id": "transmittance-dilution-wipe-blank-cuvette",
      "verb": "observe",
      "label": "Record the configured blank optical-face rule",
      "parameters": {
        "cuvetteInstanceId": "blank-cuvette-1",
        "requiresStudentNote": true,
        "inputMode": "text",
        "inputRole": "studentResponse",
        "inputRequired": true,
        "inputLabel": "Describe the optical-face rule used for the blank cuvette",
        "tag": "{{config.blankRuleNotebookTag}}"
      },
      "prerequisites": [],
      "stateChanges": [
        "Record the configured blank optical-face rule: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Record the configured blank optical-face rule complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.observe.prepare-cuvette-optical-faces",
      "equipmentRoleBindings": {
        "photometer-sample-holder": "cuvette"
      },
      "interaction": {
        "type": "recordNotebook",
        "valueParameter": "tag",
        "accessibleLabel": "Record the configured blank optical-face rule"
      }
    },
    {
      "id": "transmittance-dilution-insert-blank-cuvette",
      "verb": "place",
      "label": "Insert the blank cuvette",
      "parameters": {
        "equipmentInstanceId": "blank-cuvette-1",
        "targetInstanceId": "spectrophotometer-1"
      },
      "prerequisites": [],
      "stateChanges": [
        "Insert the blank cuvette: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Insert the blank cuvette complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.place.insert-cuvette",
      "equipmentRoleBindings": {
        "photometer-instrument": "spectrophotometer",
        "photometer-sample-holder": "cuvette"
      },
      "interaction": {
        "type": "snapIntoTarget",
        "sourceDefinitionId": "cuvette",
        "targetDefinitionId": "spectrophotometer",
        "accessibleLabel": "Insert the blank cuvette"
      }
    },
    {
      "id": "transmittance-dilution-zero-with-blank",
      "verb": "observe",
      "label": "Blank the photometer",
      "parameters": {
        "photometerInstanceId": "spectrophotometer-1",
        "cuvetteInstanceId": "blank-cuvette-1",
        "wavelengthMeasurementId": "{{config.wavelengthMeasurementId}}",
        "photometerOperation": "zero",
        "tag": "generic-photometer-blanked"
      },
      "prerequisites": [],
      "stateChanges": [
        "Blank the photometer: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Blank the photometer complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.observe.blank-photometer",
      "equipmentRoleBindings": {
        "photometer-instrument": "spectrophotometer",
        "photometer-sample-holder": "cuvette"
      },
      "interaction": {
        "type": "readInstrument",
        "sourceDefinitionId": "spectrophotometer",
        "stationId": "spectrophotometer",
        "accessibleLabel": "Blank the photometer"
      }
    },
    {
      "id": "transmittance-dilution-remove-blank-cuvette",
      "verb": "place",
      "label": "Remove the blank cuvette",
      "parameters": {
        "equipmentInstanceId": "blank-cuvette-1"
      },
      "prerequisites": [],
      "stateChanges": [
        "Remove the blank cuvette: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Remove the blank cuvette complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.place.remove-cuvette",
      "equipmentRoleBindings": {
        "photometer-instrument": "spectrophotometer",
        "photometer-sample-holder": "cuvette"
      },
      "interaction": {
        "type": "dragToZone",
        "sourceDefinitionId": "spectrophotometer",
        "stationId": "workbench",
        "accessibleLabel": "Remove the blank cuvette"
      }
    },
    {
      "id": "transmittance-dilution-fill-sample-cuvette",
      "verb": "transfer",
      "label": "Fill the sample cuvette from the labelled dilution receiver",
      "parameters": {
        "sourceInstanceId": "prepared-receiver-1",
        "targetInstanceId": "sample-cuvette-1"
      },
      "prerequisites": [],
      "stateChanges": [
        "Fill the sample cuvette from the labelled dilution receiver: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Fill the sample cuvette from the labelled dilution receiver complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.transfer.fill-cuvette",
      "equipmentRoleBindings": {
        "sample-source": "test-tube",
        "photometer-sample-holder": "cuvette"
      },
      "interaction": {
        "type": "pourInto",
        "sourceDefinitionId": "test-tube",
        "targetDefinitionId": "cuvette",
        "accessibleLabel": "Fill the sample cuvette from the labelled dilution receiver"
      },
      "volume": {
        "source": "target-fill-fraction",
        "fraction": 0.75
      }
    },
    {
      "id": "transmittance-dilution-wipe-orient-sample-cuvette",
      "verb": "observe",
      "label": "Record the configured sample optical-face rule",
      "parameters": {
        "cuvetteInstanceId": "sample-cuvette-1",
        "requiresStudentNote": true,
        "inputMode": "text",
        "inputRole": "studentResponse",
        "inputRequired": true,
        "inputLabel": "Describe the optical-face rule used for the sample cuvette",
        "tag": "{{config.blankRuleNotebookTag}}"
      },
      "prerequisites": [],
      "stateChanges": [
        "Record the configured sample optical-face rule: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Record the configured sample optical-face rule complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.observe.prepare-cuvette-optical-faces",
      "equipmentRoleBindings": {
        "photometer-sample-holder": "cuvette"
      },
      "interaction": {
        "type": "recordNotebook",
        "valueParameter": "tag",
        "accessibleLabel": "Record the configured sample optical-face rule"
      }
    },
    {
      "id": "transmittance-dilution-insert-sample-cuvette",
      "verb": "place",
      "label": "Insert the sample cuvette",
      "parameters": {
        "equipmentInstanceId": "sample-cuvette-1",
        "targetInstanceId": "spectrophotometer-1"
      },
      "prerequisites": [],
      "stateChanges": [
        "Insert the sample cuvette: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Insert the sample cuvette complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.place.insert-cuvette",
      "equipmentRoleBindings": {
        "photometer-instrument": "spectrophotometer",
        "photometer-sample-holder": "cuvette"
      },
      "interaction": {
        "type": "snapIntoTarget",
        "sourceDefinitionId": "cuvette",
        "targetDefinitionId": "spectrophotometer",
        "accessibleLabel": "Insert the sample cuvette"
      }
    },
    {
      "id": "transmittance-dilution-read-percent-transmittance",
      "verb": "observe",
      "label": "Read percent transmittance",
      "parameters": {
        "photometerInstanceId": "spectrophotometer-1",
        "cuvetteInstanceId": "sample-cuvette-1",
        "wavelengthMeasurementId": "{{config.wavelengthMeasurementId}}",
        "requiresZeroNotebookTag": "generic-photometer-blanked",
        "photometerOperation": "read",
        "measurementId": "percent-transmittance",
        "photometricQuantity": "percentTransmittance",
        "inputMode": "numeric",
        "inputRole": "studentResponse",
        "inputRequired": true,
        "inputLabel": "Percent transmittance shown by the photometer (%T)",
        "inputMin": 0,
        "inputMinExclusive": true,
        "inputMax": 100,
        "unit": "%T"
      },
      "prerequisites": [],
      "stateChanges": [
        "Read percent transmittance: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Read percent transmittance complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.observe.read-photometer",
      "equipmentRoleBindings": {
        "photometer-instrument": "spectrophotometer",
        "photometer-sample-holder": "cuvette"
      },
      "interaction": {
        "type": "readInstrument",
        "sourceDefinitionId": "spectrophotometer",
        "stationId": "spectrophotometer",
        "accessibleLabel": "Read percent transmittance"
      }
    },
    {
      "id": "transmittance-dilution-record-percent-transmittance",
      "verb": "record",
      "label": "Record percent transmittance",
      "parameters": {
        "measurementId": "percent-transmittance",
        "unit": "%T"
      },
      "prerequisites": [
        {
          "id": "percent-transmittance-read",
          "type": "measurementRecorded",
          "label": "Percent transmittance was read",
          "measurementId": "percent-transmittance"
        }
      ],
      "stateChanges": [
        "Record percent transmittance: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Record percent transmittance complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.record.photometer-reading",
      "equipmentRoleBindings": {
        "photometer-instrument": "spectrophotometer",
        "photometer-sample-holder": "cuvette"
      },
      "interaction": {
        "type": "recordNotebook",
        "valueParameter": "measurementId",
        "accessibleLabel": "Record percent transmittance"
      }
    },
    {
      "id": "transmittance-dilution-remove-sample-cuvette",
      "verb": "place",
      "label": "Remove the sample cuvette",
      "parameters": {
        "equipmentInstanceId": "sample-cuvette-1"
      },
      "prerequisites": [],
      "stateChanges": [
        "Remove the sample cuvette: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Remove the sample cuvette complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "atomId": "atom.place.remove-cuvette",
      "equipmentRoleBindings": {
        "photometer-instrument": "spectrophotometer",
        "photometer-sample-holder": "cuvette"
      },
      "interaction": {
        "type": "dragToZone",
        "sourceDefinitionId": "spectrophotometer",
        "stationId": "workbench",
        "accessibleLabel": "Remove the sample cuvette"
      }
    },
    {
      "id": "transmittance-dilution-calculate-decimal-transmittance",
      "verb": "calculate",
      "label": "Calculate decimal transmittance",
      "parameters": {
        "calculationId": "decimal-transmittance",
        "template": "decimalTransmittance",
        "percentTransmittanceMeasurementId": "percent-transmittance"
      },
      "prerequisites": [],
      "stateChanges": [
        "Calculate decimal transmittance: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Calculate decimal transmittance complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "interaction": {
        "type": "submitCalculation",
        "valueParameter": "calculationId",
        "accessibleLabel": "Calculate decimal transmittance"
      }
    },
    {
      "id": "transmittance-dilution-calculate-absorbance",
      "verb": "calculate",
      "label": "Calculate absorbance",
      "parameters": {
        "calculationId": "absorbance",
        "template": "absorbanceFromPercentT",
        "percentTransmittanceMeasurementId": "percent-transmittance"
      },
      "prerequisites": [],
      "stateChanges": [
        "Calculate absorbance: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Calculate absorbance complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "interaction": {
        "type": "submitCalculation",
        "valueParameter": "calculationId",
        "accessibleLabel": "Calculate absorbance"
      }
    },
    {
      "id": "transmittance-dilution-calculate-diluted-concentration",
      "verb": "calculate",
      "label": "Calculate the diluted concentration",
      "parameters": {
        "calculationId": "diluted-concentration",
        "template": "dilutedConcentration",
        "unit": "M",
        "stockConcentrationMeasurementId": "{{config.stockConcentrationMeasurementId}}",
        "stockVolumeMeasurementId": "{{config.stockVolumeMeasurementId}}",
        "finalVolumeMeasurementId": "{{config.finalVolumeMeasurementId}}"
      },
      "prerequisites": [],
      "stateChanges": [
        "Calculate the diluted concentration: completed with the named sample and configuration provenance preserved."
      ],
      "invalidCases": [
        {
          "id": "wrong-order",
          "when": "the required predecessor evidence or named equipment is unavailable",
          "message": "This operation is not ready or the selected sample does not match the authored provenance.",
          "recovery": "Restore the named sample and equipment state, then complete the immediately preceding operation."
        }
      ],
      "feedback": {
        "success": "Calculate the diluted concentration complete.",
        "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
      },
      "evidence": [],
      "interaction": {
        "type": "submitCalculation",
        "valueParameter": "calculationId",
        "accessibleLabel": "Calculate the diluted concentration"
      }
    }
  ],
  "process": {
    "startNodeId": "transmittance-dilution-record-stock-concentration-node",
    "nodes": [
      {
        "id": "transmittance-dilution-record-stock-concentration-node",
        "type": "action",
        "title": "Record the instructor-approved stock concentration",
        "description": "Record the instructor-approved stock concentration",
        "actionId": "transmittance-dilution-record-stock-concentration",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-record-stock-concentration-node-done",
            "type": "actionEvidence",
            "label": "Record the instructor-approved stock concentration was completed.",
            "actionId": "transmittance-dilution-record-stock-concentration"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Instructor-approved stock concentration recorded.",
          "retry": "Review the approved stock concentration and try again."
        }
      },
      {
        "id": "transmittance-dilution-place-volumetric-flask-node",
        "type": "action",
        "title": "Select the clean labelled dilution receiver",
        "description": "Select the clean labelled dilution receiver",
        "actionId": "transmittance-dilution-place-volumetric-flask",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-place-volumetric-flask-node-done",
            "type": "actionEvidence",
            "label": "Select the clean labelled dilution receiver was completed.",
            "actionId": "transmittance-dilution-place-volumetric-flask"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Select the clean labelled dilution receiver complete.",
          "retry": "Review Select the clean labelled dilution receiver and try again."
        }
      },
      {
        "id": "transmittance-dilution-place-graduated-cylinder-node",
        "type": "action",
        "title": "Place the approved variable-volume device",
        "description": "Place the approved variable-volume device",
        "actionId": "transmittance-dilution-place-graduated-cylinder",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-place-graduated-cylinder-node-done",
            "type": "actionEvidence",
            "label": "Place the approved variable-volume device was completed.",
            "actionId": "transmittance-dilution-place-graduated-cylinder"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Place the approved variable-volume device complete.",
          "retry": "Review Place the approved variable-volume device and try again."
        }
      },
      {
        "id": "transmittance-dilution-measure-stock-dye-node",
        "type": "action",
        "title": "Measure the configured stock-dye aliquot",
        "description": "Measure the configured stock-dye aliquot",
        "actionId": "transmittance-dilution-measure-stock-dye",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-measure-stock-dye-node-done",
            "type": "actionEvidence",
            "label": "Measure the configured stock-dye aliquot was completed.",
            "actionId": "transmittance-dilution-measure-stock-dye"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Measure the configured stock-dye aliquot complete.",
          "retry": "Review Measure the configured stock-dye aliquot and try again."
        }
      },
      {
        "id": "transmittance-dilution-transfer-dye-aliquot-node",
        "type": "action",
        "title": "Transfer the measured stock aliquot",
        "description": "Transfer the measured stock aliquot",
        "actionId": "transmittance-dilution-transfer-dye-aliquot",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-transfer-dye-aliquot-node-done",
            "type": "actionEvidence",
            "label": "Transfer the measured stock aliquot was completed.",
            "actionId": "transmittance-dilution-transfer-dye-aliquot"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Transfer the measured stock aliquot complete.",
          "retry": "Review Transfer the measured stock aliquot and try again."
        }
      },
      {
        "id": "transmittance-dilution-measure-water-volume-node",
        "type": "action",
        "title": "Measure the configured water volume",
        "description": "Measure the configured water volume",
        "actionId": "transmittance-dilution-measure-water-volume",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-measure-water-volume-node-done",
            "type": "actionEvidence",
            "label": "Measure the configured water volume was completed.",
            "actionId": "transmittance-dilution-measure-water-volume"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Measure the configured water volume complete.",
          "retry": "Review Measure the configured water volume and try again."
        }
      },
      {
        "id": "transmittance-dilution-add-water-below-mark-node",
        "type": "action",
        "title": "Dilute and mix to the configured final volume",
        "description": "Dilute and mix to the configured final volume",
        "actionId": "transmittance-dilution-add-water-below-mark",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-add-water-below-mark-node-done",
            "type": "actionEvidence",
            "label": "Dilute and mix to the configured final volume was completed.",
            "actionId": "transmittance-dilution-add-water-below-mark"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Dilute and mix to the configured final volume complete.",
          "retry": "Review Dilute and mix to the configured final volume and try again."
        }
      },
      {
        "id": "transmittance-dilution-place-spectrophotometer-node",
        "type": "action",
        "title": "Place the photometer",
        "description": "Place the photometer",
        "actionId": "transmittance-dilution-place-spectrophotometer",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-place-spectrophotometer-node-done",
            "type": "actionEvidence",
            "label": "Place the photometer was completed.",
            "actionId": "transmittance-dilution-place-spectrophotometer"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Place the photometer complete.",
          "retry": "Review Place the photometer and try again."
        }
      },
      {
        "id": "transmittance-dilution-configure-photometer-node",
        "type": "action",
        "title": "Apply the configured wavelength and percent-transmittance mode",
        "description": "Apply the configured wavelength and percent-transmittance mode",
        "actionId": "transmittance-dilution-configure-photometer",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-configure-photometer-node-done",
            "type": "actionEvidence",
            "label": "Apply the configured wavelength and percent-transmittance mode was completed.",
            "actionId": "transmittance-dilution-configure-photometer"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Apply the configured wavelength and percent-transmittance mode complete.",
          "retry": "Review Apply the configured wavelength and percent-transmittance mode and try again."
        }
      },
      {
        "id": "transmittance-dilution-fill-blank-cuvette-node",
        "type": "action",
        "title": "Fill the teacher-approved blank cuvette",
        "description": "Fill the teacher-approved blank cuvette",
        "actionId": "transmittance-dilution-fill-blank-cuvette",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-fill-blank-cuvette-node-done",
            "type": "actionEvidence",
            "label": "Fill the teacher-approved blank cuvette was completed.",
            "actionId": "transmittance-dilution-fill-blank-cuvette"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Fill the teacher-approved blank cuvette complete.",
          "retry": "Review Fill the teacher-approved blank cuvette and try again."
        }
      },
      {
        "id": "transmittance-dilution-wipe-blank-cuvette-node",
        "type": "action",
        "title": "Record the configured blank optical-face rule",
        "description": "Record the configured blank optical-face rule",
        "actionId": "transmittance-dilution-wipe-blank-cuvette",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-wipe-blank-cuvette-node-done",
            "type": "actionEvidence",
            "label": "Record the configured blank optical-face rule was completed.",
            "actionId": "transmittance-dilution-wipe-blank-cuvette"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Record the configured blank optical-face rule complete.",
          "retry": "Review Record the configured blank optical-face rule and try again."
        }
      },
      {
        "id": "transmittance-dilution-insert-blank-cuvette-node",
        "type": "action",
        "title": "Insert the blank cuvette",
        "description": "Insert the blank cuvette",
        "actionId": "transmittance-dilution-insert-blank-cuvette",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-insert-blank-cuvette-node-done",
            "type": "actionEvidence",
            "label": "Insert the blank cuvette was completed.",
            "actionId": "transmittance-dilution-insert-blank-cuvette"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Insert the blank cuvette complete.",
          "retry": "Review Insert the blank cuvette and try again."
        }
      },
      {
        "id": "transmittance-dilution-zero-with-blank-node",
        "type": "action",
        "title": "Blank the photometer",
        "description": "Blank the photometer",
        "actionId": "transmittance-dilution-zero-with-blank",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-zero-with-blank-node-done",
            "type": "actionEvidence",
            "label": "Blank the photometer was completed.",
            "actionId": "transmittance-dilution-zero-with-blank"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Blank the photometer complete.",
          "retry": "Review Blank the photometer and try again."
        }
      },
      {
        "id": "transmittance-dilution-remove-blank-cuvette-node",
        "type": "action",
        "title": "Remove the blank cuvette",
        "description": "Remove the blank cuvette",
        "actionId": "transmittance-dilution-remove-blank-cuvette",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-remove-blank-cuvette-node-done",
            "type": "actionEvidence",
            "label": "Remove the blank cuvette was completed.",
            "actionId": "transmittance-dilution-remove-blank-cuvette"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Remove the blank cuvette complete.",
          "retry": "Review Remove the blank cuvette and try again."
        }
      },
      {
        "id": "transmittance-dilution-fill-sample-cuvette-node",
        "type": "action",
        "title": "Fill the sample cuvette from the labelled dilution receiver",
        "description": "Fill the sample cuvette from the labelled dilution receiver",
        "actionId": "transmittance-dilution-fill-sample-cuvette",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-fill-sample-cuvette-node-done",
            "type": "actionEvidence",
            "label": "Fill the sample cuvette from the labelled dilution receiver was completed.",
            "actionId": "transmittance-dilution-fill-sample-cuvette"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Fill the sample cuvette from the labelled dilution receiver complete.",
          "retry": "Review Fill the sample cuvette from the labelled dilution receiver and try again."
        }
      },
      {
        "id": "transmittance-dilution-wipe-orient-sample-cuvette-node",
        "type": "action",
        "title": "Record the configured sample optical-face rule",
        "description": "Record the configured sample optical-face rule",
        "actionId": "transmittance-dilution-wipe-orient-sample-cuvette",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-wipe-orient-sample-cuvette-node-done",
            "type": "actionEvidence",
            "label": "Record the configured sample optical-face rule was completed.",
            "actionId": "transmittance-dilution-wipe-orient-sample-cuvette"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Record the configured sample optical-face rule complete.",
          "retry": "Review Record the configured sample optical-face rule and try again."
        }
      },
      {
        "id": "transmittance-dilution-insert-sample-cuvette-node",
        "type": "action",
        "title": "Insert the sample cuvette",
        "description": "Insert the sample cuvette",
        "actionId": "transmittance-dilution-insert-sample-cuvette",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-insert-sample-cuvette-node-done",
            "type": "actionEvidence",
            "label": "Insert the sample cuvette was completed.",
            "actionId": "transmittance-dilution-insert-sample-cuvette"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Insert the sample cuvette complete.",
          "retry": "Review Insert the sample cuvette and try again."
        }
      },
      {
        "id": "transmittance-dilution-read-percent-transmittance-node",
        "type": "action",
        "title": "Read percent transmittance",
        "description": "Read percent transmittance",
        "actionId": "transmittance-dilution-read-percent-transmittance",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-read-percent-transmittance-node-done",
            "type": "actionEvidence",
            "label": "Read percent transmittance was completed.",
            "actionId": "transmittance-dilution-read-percent-transmittance"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Read percent transmittance complete.",
          "retry": "Review Read percent transmittance and try again."
        }
      },
      {
        "id": "transmittance-dilution-record-percent-transmittance-node",
        "type": "calculation",
        "title": "Record percent transmittance",
        "description": "Record percent transmittance",
        "actionId": "transmittance-dilution-record-percent-transmittance",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-record-percent-transmittance-node-done",
            "type": "actionEvidence",
            "label": "Record percent transmittance was completed.",
            "actionId": "transmittance-dilution-record-percent-transmittance"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Record percent transmittance complete.",
          "retry": "Review Record percent transmittance and try again."
        }
      },
      {
        "id": "transmittance-dilution-remove-sample-cuvette-node",
        "type": "action",
        "title": "Remove the sample cuvette",
        "description": "Remove the sample cuvette",
        "actionId": "transmittance-dilution-remove-sample-cuvette",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-remove-sample-cuvette-node-done",
            "type": "actionEvidence",
            "label": "Remove the sample cuvette was completed.",
            "actionId": "transmittance-dilution-remove-sample-cuvette"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Remove the sample cuvette complete.",
          "retry": "Review Remove the sample cuvette and try again."
        }
      },
      {
        "id": "transmittance-dilution-calculate-decimal-transmittance-node",
        "type": "calculation",
        "title": "Calculate decimal transmittance",
        "description": "Calculate decimal transmittance",
        "actionId": "transmittance-dilution-calculate-decimal-transmittance",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-calculate-decimal-transmittance-node-done",
            "type": "actionEvidence",
            "label": "Calculate decimal transmittance was completed.",
            "actionId": "transmittance-dilution-calculate-decimal-transmittance"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Calculate decimal transmittance complete.",
          "retry": "Review Calculate decimal transmittance and try again."
        }
      },
      {
        "id": "transmittance-dilution-calculate-absorbance-node",
        "type": "calculation",
        "title": "Calculate absorbance",
        "description": "Calculate absorbance",
        "actionId": "transmittance-dilution-calculate-absorbance",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-calculate-absorbance-node-done",
            "type": "actionEvidence",
            "label": "Calculate absorbance was completed.",
            "actionId": "transmittance-dilution-calculate-absorbance"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Calculate absorbance complete.",
          "retry": "Review Calculate absorbance and try again."
        }
      },
      {
        "id": "transmittance-dilution-calculate-diluted-concentration-node",
        "type": "calculation",
        "title": "Calculate the diluted concentration",
        "description": "Calculate the diluted concentration",
        "actionId": "transmittance-dilution-calculate-diluted-concentration",
        "config": {},
        "validation": [
          {
            "id": "transmittance-dilution-calculate-diluted-concentration-node-done",
            "type": "actionEvidence",
            "label": "Calculate the diluted concentration was completed.",
            "actionId": "transmittance-dilution-calculate-diluted-concentration"
          }
        ],
        "hints": [],
        "feedback": {
          "success": "Calculate the diluted concentration complete.",
          "retry": "Review Calculate the diluted concentration and try again."
        }
      }
    ],
    "edges": [
      {
        "from": "transmittance-dilution-record-stock-concentration-node",
        "to": "transmittance-dilution-place-volumetric-flask-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-place-volumetric-flask-node",
        "to": "transmittance-dilution-place-graduated-cylinder-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-place-graduated-cylinder-node",
        "to": "transmittance-dilution-measure-stock-dye-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-measure-stock-dye-node",
        "to": "transmittance-dilution-transfer-dye-aliquot-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-transfer-dye-aliquot-node",
        "to": "transmittance-dilution-measure-water-volume-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-measure-water-volume-node",
        "to": "transmittance-dilution-add-water-below-mark-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-add-water-below-mark-node",
        "to": "transmittance-dilution-place-spectrophotometer-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-place-spectrophotometer-node",
        "to": "transmittance-dilution-configure-photometer-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-configure-photometer-node",
        "to": "transmittance-dilution-fill-blank-cuvette-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-fill-blank-cuvette-node",
        "to": "transmittance-dilution-wipe-blank-cuvette-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-wipe-blank-cuvette-node",
        "to": "transmittance-dilution-insert-blank-cuvette-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-insert-blank-cuvette-node",
        "to": "transmittance-dilution-zero-with-blank-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-zero-with-blank-node",
        "to": "transmittance-dilution-remove-blank-cuvette-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-remove-blank-cuvette-node",
        "to": "transmittance-dilution-fill-sample-cuvette-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-fill-sample-cuvette-node",
        "to": "transmittance-dilution-wipe-orient-sample-cuvette-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-wipe-orient-sample-cuvette-node",
        "to": "transmittance-dilution-insert-sample-cuvette-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-insert-sample-cuvette-node",
        "to": "transmittance-dilution-read-percent-transmittance-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-read-percent-transmittance-node",
        "to": "transmittance-dilution-record-percent-transmittance-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-record-percent-transmittance-node",
        "to": "transmittance-dilution-remove-sample-cuvette-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-remove-sample-cuvette-node",
        "to": "transmittance-dilution-calculate-decimal-transmittance-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-calculate-decimal-transmittance-node",
        "to": "transmittance-dilution-calculate-absorbance-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      },
      {
        "from": "transmittance-dilution-calculate-absorbance-node",
        "to": "transmittance-dilution-calculate-diluted-concentration-node",
        "label": "Next",
        "condition": {
          "type": "validationPassed"
        }
      }
    ]
  },
  "successCriteria": [],
  "commonMistakes": [
    {
      "id": "wrong-order",
      "when": "current node expects a different action",
      "message": "That action is out of sequence for the current technique step.",
      "recovery": "Check the process map and perform the highlighted step first."
    },
    {
      "id": "missing-source",
      "when": "source equipment or contents are missing",
      "message": "The selected source does not contain the material required for this action.",
      "recovery": "Select equipment that contains the required liquid, solid, solution, or precipitate."
    },
    {
      "id": "overflow",
      "when": "target capacity would be exceeded",
      "message": "The target equipment cannot hold the requested volume.",
      "recovery": "Use a larger container or transfer a smaller measured amount."
    }
  ],
  "resetBehavior": "resetTechnique",
  "metadata": {
    "version": "1.3.0",
    "author": "Lab Studio",
    "updatedAt": "2026-09-04T00:00:00.000Z",
    "tags": [
      "technique",
      "spectroscopy",
      "dilution",
      "transmittance"
    ]
  },
  "composition": {
    "schemaVersion": 1,
    "ports": [
      {
        "id": "entry-transmittance-dilution-record-stock-concentration-node",
        "kind": "entry",
        "nodeId": "transmittance-dilution-record-stock-concentration-node",
        "label": "Entry"
      },
      {
        "id": "exit-transmittance-dilution-calculate-diluted-concentration-node",
        "kind": "exit",
        "nodeId": "transmittance-dilution-calculate-diluted-concentration-node",
        "label": "Exit"
      }
    ],
    "equipmentRoles": [
      {
        "roleId": "receiving-vessel",
        "required": true,
        "allowedDefinitionIds": [
          "test-tube"
        ],
        "sourceInstanceIds": []
      },
      {
        "roleId": "variable-volume-measuring-device",
        "required": true,
        "allowedDefinitionIds": [
          "graduated-cylinder"
        ],
        "sourceInstanceIds": []
      },
      {
        "roleId": "liquid-source",
        "required": true,
        "allowedDefinitionIds": [
          "sample-bottle",
          "wash-bottle"
        ],
        "sourceInstanceIds": []
      },
      {
        "roleId": "measured-solvent-source",
        "required": true,
        "allowedDefinitionIds": [
          "graduated-cylinder"
        ],
        "sourceInstanceIds": []
      },
      {
        "roleId": "photometer-instrument",
        "required": true,
        "allowedDefinitionIds": [
          "spectrophotometer"
        ],
        "sourceInstanceIds": []
      },
      {
        "roleId": "sample-source",
        "required": true,
        "allowedDefinitionIds": [
          "sample-bottle",
          "test-tube"
        ],
        "sourceInstanceIds": []
      },
      {
        "roleId": "photometer-sample-holder",
        "required": true,
        "allowedDefinitionIds": [
          "cuvette"
        ],
        "sourceInstanceIds": []
      }
    ],
    "modelSlots": [],
    "configurationSlots": [
      {
        "id": "stockConcentrationM",
        "valueType": "number",
        "required": true
      },
      {
        "id": "stockConcentrationMeasurementId",
        "valueType": "string",
        "required": true
      },
      {
        "id": "stockVolumeMeasurementId",
        "valueType": "string",
        "required": true
      },
      {
        "id": "waterVolumeMeasurementId",
        "valueType": "string",
        "required": true
      },
      {
        "id": "finalVolumeMeasurementId",
        "valueType": "string",
        "required": true
      },
      {
        "id": "wavelengthMeasurementId",
        "valueType": "string",
        "required": true
      },
      {
        "id": "wavelengthNm",
        "valueType": "number",
        "required": true
      },
      {
        "id": "blankRuleNotebookTag",
        "valueType": "string",
        "required": true
      }
    ],
    "approvalGates": [],
    "variants": [],
    "evidenceOutputs": [],
    "completion": {
      "exitPortIds": [
        "exit-transmittance-dilution-calculate-diluted-concentration-node"
      ],
      "requiredEvidenceOutputIds": [],
      "requiredValidationRuleIds": []
    },
    "catalogDisposition": "composable",
    "legacyActionEffects": [
      {
        "actionId": "transmittance-dilution-calculate-decimal-transmittance",
        "effect": {
          "classes": [
            "calculation-analysis"
          ],
          "targets": [
            {
              "domain": "analysis"
            },
            {
              "domain": "evidence"
            }
          ]
        }
      },
      {
        "actionId": "transmittance-dilution-calculate-absorbance",
        "effect": {
          "classes": [
            "calculation-analysis"
          ],
          "targets": [
            {
              "domain": "analysis"
            },
            {
              "domain": "evidence"
            }
          ]
        }
      },
      {
        "actionId": "transmittance-dilution-calculate-diluted-concentration",
        "effect": {
          "classes": [
            "calculation-analysis"
          ],
          "targets": [
            {
              "domain": "analysis"
            },
            {
              "domain": "evidence"
            }
          ]
        }
      }
    ]
  }
};

export const refineTransmittanceDilutionDefinition = (candidate) => candidate.id === definition.id ? applyStockSupplyVolumes(structuredClone(definition)) : candidate;
