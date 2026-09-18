/** Cycle 05-owned spectroscopy definitions. Generated from the reviewed revision-5 migration; keep this module data-only. */
import { applyStockSupplyVolumes } from "../stockSupplyVolumes.mjs";
const definitions = new Map([
  [
    "beers-law-calibration",
    {
      "id": "beers-law-calibration",
      "title": "Beer's Law Calibration",
      "learningGoal": "Prepare a dye standard, measure transmittance, and convert it to absorbance evidence.",
      "requiredEquipment": [
        "sample-bottle",
        "graduated-cylinder",
        "test-tube",
        "wash-bottle",
        "cuvette",
        "spectrophotometer",
        "data-collection-interface"
      ],
      "initialState": {
        "equipment": [
          {
            "id": "sample-bottle-1",
            "definitionId": "sample-bottle",
            "label": "Sample bottle",
            "location": "shelf",
            "contents": {
              "kind": "solution",
              "label": "Blue dye stock",
              "solutes": [],
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
              "kind": "empty",
              "label": "empty",
              "solutes": [],
              "contamination": [],
              "wetState": "dry",
              "visualState": "empty"
            }
          },
          {
            "id": "cuvette-1",
            "definitionId": "cuvette",
            "label": "Cuvette",
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
            "id": "data-collection-interface-1",
            "definitionId": "data-collection-interface",
            "label": "Data collection interface",
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
          "id": "beers-law-calibration-place-spectrophotometer",
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
          "id": "beers-law-calibration-measure-stock-dye",
          "verb": "measureVolume",
          "label": "Measure the configured stock aliquot",
          "parameters": {
            "sourceInstanceId": "sample-bottle-1",
            "targetInstanceId": "graduated-cylinder-1",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputLabel": "Measure the configured stock aliquot (mL)",
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "mL"
          },
          "prerequisites": [],
          "stateChanges": [
            "Measure the configured stock aliquot: completed with the named sample and configuration provenance preserved."
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
            "success": "Measure the configured stock aliquot complete.",
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
            "accessibleLabel": "Measure the configured stock aliquot"
          },
          "volume": {
            "source": "action-input",
            "outputMeasurementId": "{{config.stockVolumeMeasurementId}}"
          }
        },
        {
          "id": "beers-law-calibration-transfer-stock-dye",
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
          "id": "beers-law-calibration-measure-water-volume",
          "verb": "measureVolume",
          "label": "Measure the configured dilution water volume",
          "parameters": {
            "sourceInstanceId": "wash-bottle-1",
            "targetInstanceId": "graduated-cylinder-1",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputLabel": "Measure the configured dilution water volume (mL)",
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "mL"
          },
          "prerequisites": [],
          "stateChanges": [
            "Measure the configured dilution water volume: completed with the named sample and configuration provenance preserved."
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
            "success": "Measure the configured dilution water volume complete.",
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
            "accessibleLabel": "Measure the configured dilution water volume"
          },
          "volume": {
            "source": "action-input",
            "outputMeasurementId": "{{config.finalVolumeMeasurementId}}"
          }
        },
        {
          "id": "beers-law-calibration-dilute-standard",
          "verb": "dilute",
          "label": "Dilute and mix the standard to its configured final volume",
          "parameters": {
            "sourceInstanceId": "graduated-cylinder-1",
            "targetInstanceId": "prepared-receiver-1",
            "sourceDefinitionId": "graduated-cylinder",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputLabel": "Dilute and mix the standard to its configured final volume: final volume (mL)",
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "mL"
          },
          "prerequisites": [],
          "stateChanges": [
            "Dilute and mix the standard to its configured final volume: completed with the named sample and configuration provenance preserved."
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
            "success": "Dilute and mix the standard to its configured final volume complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.dilute.to-final-volume",
          "equipmentRoleBindings": {
            "measured-solvent-source": "graduated-cylinder",
            "receiving-vessel": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "graduated-cylinder",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Dilute and mix the standard to its configured final volume"
          },
          "volume": {
            "source": "action-input"
          }
        },
        {
          "id": "beers-law-calibration-configure-photometer",
          "verb": "observe",
          "label": "Apply the configured wavelength and measurement mode",
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
            "Apply the configured wavelength and measurement mode: completed with the named sample and configuration provenance preserved."
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
            "success": "Apply the configured wavelength and measurement mode complete.",
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
            "accessibleLabel": "Apply the configured wavelength and measurement mode"
          }
        },
        {
          "id": "beers-law-calibration-fill-calibration-blank",
          "verb": "transfer",
          "label": "Fill the configured calibration blank",
          "parameters": {
            "sourceInstanceId": "blank-source-1",
            "targetInstanceId": "blank-cuvette-1"
          },
          "prerequisites": [],
          "stateChanges": [
            "Fill the configured calibration blank: completed with the named sample and configuration provenance preserved."
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
            "success": "Fill the configured calibration blank complete.",
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
            "accessibleLabel": "Fill the configured calibration blank"
          },
          "volume": {
            "source": "target-fill-fraction",
            "fraction": 0.75
          }
        },
        {
          "id": "beers-law-calibration-prepare-calibration-blank-optical-faces",
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
          "id": "beers-law-calibration-insert-calibration-blank",
          "verb": "place",
          "label": "Insert the calibration blank",
          "parameters": {
            "equipmentInstanceId": "blank-cuvette-1",
            "targetInstanceId": "spectrophotometer-1"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert the calibration blank: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert the calibration blank complete.",
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
            "accessibleLabel": "Insert the calibration blank"
          }
        },
        {
          "id": "beers-law-calibration-blank-photometer",
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
          "id": "beers-law-calibration-remove-calibration-blank",
          "verb": "place",
          "label": "Remove the calibration blank",
          "parameters": {
            "equipmentInstanceId": "blank-cuvette-1"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove the calibration blank: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove the calibration blank complete.",
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
            "accessibleLabel": "Remove the calibration blank"
          }
        },
        {
          "id": "beers-law-calibration-transfer-standard-cuvette",
          "verb": "transfer",
          "label": "Fill the cuvette from the prepared standard receiver",
          "parameters": {
            "sourceInstanceId": "prepared-receiver-1",
            "targetInstanceId": "cuvette-1"
          },
          "prerequisites": [],
          "stateChanges": [
            "Fill the cuvette from the prepared standard receiver: completed with the named sample and configuration provenance preserved."
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
            "success": "Fill the cuvette from the prepared standard receiver complete.",
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
            "accessibleLabel": "Fill the cuvette from the prepared standard receiver"
          },
          "volume": {
            "source": "target-fill-fraction",
            "fraction": 0.75
          }
        },
        {
          "id": "beers-law-calibration-prepare-standard-optical-faces",
          "verb": "observe",
          "label": "Record the configured sample optical-face rule",
          "parameters": {
            "cuvetteInstanceId": "cuvette-1",
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
          "id": "beers-law-calibration-insert-standard-cuvette",
          "verb": "place",
          "label": "Insert the standard cuvette",
          "parameters": {
            "equipmentInstanceId": "cuvette-1",
            "targetInstanceId": "spectrophotometer-1"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert the standard cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert the standard cuvette complete.",
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
            "accessibleLabel": "Insert the standard cuvette"
          }
        },
        {
          "id": "beers-law-calibration-read-percent-transmittance",
          "verb": "observe",
          "label": "Read the standard percent transmittance",
          "parameters": {
            "photometerInstanceId": "spectrophotometer-1",
            "cuvetteInstanceId": "cuvette-1",
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
            "Read the standard percent transmittance: completed with the named sample and configuration provenance preserved."
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
            "success": "Read the standard percent transmittance complete.",
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
            "accessibleLabel": "Read the standard percent transmittance"
          }
        },
        {
          "id": "beers-law-calibration-record-percent-transmittance",
          "verb": "record",
          "label": "Record the standard percent transmittance",
          "parameters": {
            "measurementId": "percent-transmittance",
            "unit": "%T"
          },
          "prerequisites": [
            {
              "id": "standard-reading-required",
              "type": "measurementRecorded",
              "label": "The standard was read",
              "measurementId": "percent-transmittance"
            }
          ],
          "stateChanges": [
            "Record the standard percent transmittance: completed with the named sample and configuration provenance preserved."
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
            "success": "Record the standard percent transmittance complete.",
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
            "accessibleLabel": "Record the standard percent transmittance"
          }
        },
        {
          "id": "beers-law-calibration-remove-standard-cuvette",
          "verb": "place",
          "label": "Remove the standard cuvette",
          "parameters": {
            "equipmentInstanceId": "cuvette-1"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove the standard cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove the standard cuvette complete.",
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
            "accessibleLabel": "Remove the standard cuvette"
          }
        },
        {
          "id": "beers-law-calibration-calculate-absorbance",
          "verb": "calculate",
          "label": "Calculate absorbance from the recorded transmittance",
          "parameters": {
            "calculationId": "absorbance",
            "template": "absorbanceFromPercentT",
            "percentTransmittanceMeasurementId": "percent-transmittance"
          },
          "prerequisites": [],
          "stateChanges": [
            "Calculate absorbance from the recorded transmittance: completed with the named sample and configuration provenance preserved."
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
            "success": "Calculate absorbance from the recorded transmittance complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "interaction": {
            "type": "submitCalculation",
            "valueParameter": "calculationId",
            "accessibleLabel": "Calculate absorbance from the recorded transmittance"
          }
        }
      ],
      "process": {
        "startNodeId": "beers-law-calibration-place-spectrophotometer-node",
        "nodes": [
          {
            "id": "beers-law-calibration-place-spectrophotometer-node",
            "type": "action",
            "title": "Place the photometer",
            "description": "Place the photometer",
            "actionId": "beers-law-calibration-place-spectrophotometer",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-place-spectrophotometer-node-done",
                "type": "actionEvidence",
                "label": "Place the photometer was completed.",
                "actionId": "beers-law-calibration-place-spectrophotometer"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Place the photometer complete.",
              "retry": "Review Place the photometer and try again."
            }
          },
          {
            "id": "beers-law-calibration-measure-stock-dye-node",
            "type": "action",
            "title": "Measure the configured stock aliquot",
            "description": "Measure the configured stock aliquot",
            "actionId": "beers-law-calibration-measure-stock-dye",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-measure-stock-dye-node-done",
                "type": "actionEvidence",
                "label": "Measure the configured stock aliquot was completed.",
                "actionId": "beers-law-calibration-measure-stock-dye"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Measure the configured stock aliquot complete.",
              "retry": "Review Measure the configured stock aliquot and try again."
            }
          },
          {
            "id": "beers-law-calibration-transfer-stock-dye-node",
            "type": "action",
            "title": "Transfer the measured stock aliquot",
            "description": "Transfer the measured stock aliquot",
            "actionId": "beers-law-calibration-transfer-stock-dye",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-transfer-stock-dye-node-done",
                "type": "actionEvidence",
                "label": "Transfer the measured stock aliquot was completed.",
                "actionId": "beers-law-calibration-transfer-stock-dye"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Transfer the measured stock aliquot complete.",
              "retry": "Review Transfer the measured stock aliquot and try again."
            }
          },
          {
            "id": "beers-law-calibration-measure-water-volume-node",
            "type": "action",
            "title": "Measure the configured dilution water volume",
            "description": "Measure the configured dilution water volume",
            "actionId": "beers-law-calibration-measure-water-volume",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-measure-water-volume-node-done",
                "type": "actionEvidence",
                "label": "Measure the configured dilution water volume was completed.",
                "actionId": "beers-law-calibration-measure-water-volume"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Measure the configured dilution water volume complete.",
              "retry": "Review Measure the configured dilution water volume and try again."
            }
          },
          {
            "id": "beers-law-calibration-dilute-standard-node",
            "type": "action",
            "title": "Dilute and mix the standard to its configured final volume",
            "description": "Dilute and mix the standard to its configured final volume",
            "actionId": "beers-law-calibration-dilute-standard",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-dilute-standard-node-done",
                "type": "actionEvidence",
                "label": "Dilute and mix the standard to its configured final volume was completed.",
                "actionId": "beers-law-calibration-dilute-standard"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Dilute and mix the standard to its configured final volume complete.",
              "retry": "Review Dilute and mix the standard to its configured final volume and try again."
            }
          },
          {
            "id": "beers-law-calibration-configure-photometer-node",
            "type": "action",
            "title": "Apply the configured wavelength and measurement mode",
            "description": "Apply the configured wavelength and measurement mode",
            "actionId": "beers-law-calibration-configure-photometer",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-configure-photometer-node-done",
                "type": "actionEvidence",
                "label": "Apply the configured wavelength and measurement mode was completed.",
                "actionId": "beers-law-calibration-configure-photometer"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Apply the configured wavelength and measurement mode complete.",
              "retry": "Review Apply the configured wavelength and measurement mode and try again."
            }
          },
          {
            "id": "beers-law-calibration-fill-calibration-blank-node",
            "type": "action",
            "title": "Fill the configured calibration blank",
            "description": "Fill the configured calibration blank",
            "actionId": "beers-law-calibration-fill-calibration-blank",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-fill-calibration-blank-node-done",
                "type": "actionEvidence",
                "label": "Fill the configured calibration blank was completed.",
                "actionId": "beers-law-calibration-fill-calibration-blank"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Fill the configured calibration blank complete.",
              "retry": "Review Fill the configured calibration blank and try again."
            }
          },
          {
            "id": "beers-law-calibration-prepare-calibration-blank-optical-faces-node",
            "type": "action",
            "title": "Record the configured blank optical-face rule",
            "description": "Record the configured blank optical-face rule",
            "actionId": "beers-law-calibration-prepare-calibration-blank-optical-faces",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-prepare-calibration-blank-optical-faces-node-done",
                "type": "actionEvidence",
                "label": "Record the configured blank optical-face rule was completed.",
                "actionId": "beers-law-calibration-prepare-calibration-blank-optical-faces"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record the configured blank optical-face rule complete.",
              "retry": "Review Record the configured blank optical-face rule and try again."
            }
          },
          {
            "id": "beers-law-calibration-insert-calibration-blank-node",
            "type": "action",
            "title": "Insert the calibration blank",
            "description": "Insert the calibration blank",
            "actionId": "beers-law-calibration-insert-calibration-blank",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-insert-calibration-blank-node-done",
                "type": "actionEvidence",
                "label": "Insert the calibration blank was completed.",
                "actionId": "beers-law-calibration-insert-calibration-blank"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert the calibration blank complete.",
              "retry": "Review Insert the calibration blank and try again."
            }
          },
          {
            "id": "beers-law-calibration-blank-photometer-node",
            "type": "action",
            "title": "Blank the photometer",
            "description": "Blank the photometer",
            "actionId": "beers-law-calibration-blank-photometer",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-blank-photometer-node-done",
                "type": "actionEvidence",
                "label": "Blank the photometer was completed.",
                "actionId": "beers-law-calibration-blank-photometer"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Blank the photometer complete.",
              "retry": "Review Blank the photometer and try again."
            }
          },
          {
            "id": "beers-law-calibration-remove-calibration-blank-node",
            "type": "action",
            "title": "Remove the calibration blank",
            "description": "Remove the calibration blank",
            "actionId": "beers-law-calibration-remove-calibration-blank",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-remove-calibration-blank-node-done",
                "type": "actionEvidence",
                "label": "Remove the calibration blank was completed.",
                "actionId": "beers-law-calibration-remove-calibration-blank"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove the calibration blank complete.",
              "retry": "Review Remove the calibration blank and try again."
            }
          },
          {
            "id": "beers-law-calibration-transfer-standard-cuvette-node",
            "type": "action",
            "title": "Fill the cuvette from the prepared standard receiver",
            "description": "Fill the cuvette from the prepared standard receiver",
            "actionId": "beers-law-calibration-transfer-standard-cuvette",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-transfer-standard-cuvette-node-done",
                "type": "actionEvidence",
                "label": "Fill the cuvette from the prepared standard receiver was completed.",
                "actionId": "beers-law-calibration-transfer-standard-cuvette"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Fill the cuvette from the prepared standard receiver complete.",
              "retry": "Review Fill the cuvette from the prepared standard receiver and try again."
            }
          },
          {
            "id": "beers-law-calibration-prepare-standard-optical-faces-node",
            "type": "action",
            "title": "Record the configured sample optical-face rule",
            "description": "Record the configured sample optical-face rule",
            "actionId": "beers-law-calibration-prepare-standard-optical-faces",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-prepare-standard-optical-faces-node-done",
                "type": "actionEvidence",
                "label": "Record the configured sample optical-face rule was completed.",
                "actionId": "beers-law-calibration-prepare-standard-optical-faces"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record the configured sample optical-face rule complete.",
              "retry": "Review Record the configured sample optical-face rule and try again."
            }
          },
          {
            "id": "beers-law-calibration-insert-standard-cuvette-node",
            "type": "action",
            "title": "Insert the standard cuvette",
            "description": "Insert the standard cuvette",
            "actionId": "beers-law-calibration-insert-standard-cuvette",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-insert-standard-cuvette-node-done",
                "type": "actionEvidence",
                "label": "Insert the standard cuvette was completed.",
                "actionId": "beers-law-calibration-insert-standard-cuvette"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert the standard cuvette complete.",
              "retry": "Review Insert the standard cuvette and try again."
            }
          },
          {
            "id": "beers-law-calibration-read-percent-transmittance-node",
            "type": "action",
            "title": "Read the standard percent transmittance",
            "description": "Read the standard percent transmittance",
            "actionId": "beers-law-calibration-read-percent-transmittance",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-read-percent-transmittance-node-done",
                "type": "actionEvidence",
                "label": "Read the standard percent transmittance was completed.",
                "actionId": "beers-law-calibration-read-percent-transmittance"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read the standard percent transmittance complete.",
              "retry": "Review Read the standard percent transmittance and try again."
            }
          },
          {
            "id": "beers-law-calibration-record-percent-transmittance-node",
            "type": "calculation",
            "title": "Record the standard percent transmittance",
            "description": "Record the standard percent transmittance",
            "actionId": "beers-law-calibration-record-percent-transmittance",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-record-percent-transmittance-node-done",
                "type": "actionEvidence",
                "label": "Record the standard percent transmittance was completed.",
                "actionId": "beers-law-calibration-record-percent-transmittance"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record the standard percent transmittance complete.",
              "retry": "Review Record the standard percent transmittance and try again."
            }
          },
          {
            "id": "beers-law-calibration-remove-standard-cuvette-node",
            "type": "action",
            "title": "Remove the standard cuvette",
            "description": "Remove the standard cuvette",
            "actionId": "beers-law-calibration-remove-standard-cuvette",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-remove-standard-cuvette-node-done",
                "type": "actionEvidence",
                "label": "Remove the standard cuvette was completed.",
                "actionId": "beers-law-calibration-remove-standard-cuvette"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove the standard cuvette complete.",
              "retry": "Review Remove the standard cuvette and try again."
            }
          },
          {
            "id": "beers-law-calibration-calculate-absorbance-node",
            "type": "calculation",
            "title": "Calculate absorbance from the recorded transmittance",
            "description": "Calculate absorbance from the recorded transmittance",
            "actionId": "beers-law-calibration-calculate-absorbance",
            "config": {},
            "validation": [
              {
                "id": "beers-law-calibration-calculate-absorbance-node-done",
                "type": "actionEvidence",
                "label": "Calculate absorbance from the recorded transmittance was completed.",
                "actionId": "beers-law-calibration-calculate-absorbance"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Calculate absorbance from the recorded transmittance complete.",
              "retry": "Review Calculate absorbance from the recorded transmittance and try again."
            }
          }
        ],
        "edges": [
          {
            "from": "beers-law-calibration-place-spectrophotometer-node",
            "to": "beers-law-calibration-measure-stock-dye-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "beers-law-calibration-measure-stock-dye-node",
            "to": "beers-law-calibration-transfer-stock-dye-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "beers-law-calibration-transfer-stock-dye-node",
            "to": "beers-law-calibration-measure-water-volume-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "beers-law-calibration-measure-water-volume-node",
            "to": "beers-law-calibration-dilute-standard-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "beers-law-calibration-dilute-standard-node",
            "to": "beers-law-calibration-configure-photometer-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "beers-law-calibration-configure-photometer-node",
            "to": "beers-law-calibration-fill-calibration-blank-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "beers-law-calibration-fill-calibration-blank-node",
            "to": "beers-law-calibration-prepare-calibration-blank-optical-faces-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "beers-law-calibration-prepare-calibration-blank-optical-faces-node",
            "to": "beers-law-calibration-insert-calibration-blank-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "beers-law-calibration-insert-calibration-blank-node",
            "to": "beers-law-calibration-blank-photometer-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "beers-law-calibration-blank-photometer-node",
            "to": "beers-law-calibration-remove-calibration-blank-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "beers-law-calibration-remove-calibration-blank-node",
            "to": "beers-law-calibration-transfer-standard-cuvette-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "beers-law-calibration-transfer-standard-cuvette-node",
            "to": "beers-law-calibration-prepare-standard-optical-faces-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "beers-law-calibration-prepare-standard-optical-faces-node",
            "to": "beers-law-calibration-insert-standard-cuvette-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "beers-law-calibration-insert-standard-cuvette-node",
            "to": "beers-law-calibration-read-percent-transmittance-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "beers-law-calibration-read-percent-transmittance-node",
            "to": "beers-law-calibration-record-percent-transmittance-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "beers-law-calibration-record-percent-transmittance-node",
            "to": "beers-law-calibration-remove-standard-cuvette-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "beers-law-calibration-remove-standard-cuvette-node",
            "to": "beers-law-calibration-calculate-absorbance-node",
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
          "chemistry",
          "spectroscopy",
          "beers-law"
        ]
      },
      "composition": {
        "schemaVersion": 1,
        "ports": [
          {
            "id": "entry-beers-law-calibration-place-spectrophotometer-node",
            "kind": "entry",
            "nodeId": "beers-law-calibration-place-spectrophotometer-node",
            "label": "Entry"
          },
          {
            "id": "exit-beers-law-calibration-calculate-absorbance-node",
            "kind": "exit",
            "nodeId": "beers-law-calibration-calculate-absorbance-node",
            "label": "Exit"
          }
        ],
        "equipmentRoles": [
          {
            "roleId": "photometer-instrument",
            "required": true,
            "allowedDefinitionIds": [
              "spectrophotometer"
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
            "roleId": "receiving-vessel",
            "required": true,
            "allowedDefinitionIds": [
              "test-tube"
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
            "id": "stockVolumeMeasurementId",
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
            "exit-beers-law-calibration-calculate-absorbance-node"
          ],
          "requiredEvidenceOutputIds": [],
          "requiredValidationRuleIds": []
        },
        "catalogDisposition": "composable",
        "legacyActionEffects": [
          {
            "actionId": "beers-law-calibration-calculate-absorbance",
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
    }
  ],
  [
    "brass-spectrophotometry",
    {
      "id": "brass-spectrophotometry",
      "title": "Perform source-grounded brass spectrophotometry",
      "learningGoal": "Prepare the brass solution and standards, use the accepted teacher-configured per-wavelength distilled-water scan as a separate scan setup, calibrate the instrument at the approved wavelength with the two source-stated transmittance stages, acquire provenance-preserving absorbance and color-depth evidence, and treat waste without embedding expected results.",
      "requiredEquipment": [
        "analytical-balance",
        "watch-glass",
        "sample-bottle",
        "volumetric-flask",
        "wash-bottle",
        "cuvette",
        "spectrophotometer",
        "data-collection-interface",
        "brass-fume-hood-digestion",
        "brass-color-depth-comparison",
        "beaker-250ml",
        "small-vial",
        "sample-rack",
        "test-tube",
        "graduated-pipette-10ml",
        "pipette-pump",
        "ph-paper",
        "reagent-bottle",
        "waste-beaker",
        "graduated-cylinder"
      ],
      "initialState": {
        "equipment": [
          {
            "id": "balance",
            "definitionId": "analytical-balance",
            "label": "Analytical balance",
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
            "id": "brass-beaker",
            "definitionId": "beaker-250ml",
            "label": "Clean, dry brass beaker",
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
            "id": "brass-sample-vial",
            "definitionId": "small-vial",
            "label": "Vial containing configured brass sample",
            "location": "shelf",
            "contents": {
              "kind": "solid",
              "label": "Configured brass sample",
              "solutes": [
                {
                  "id": "configured-brass",
                  "label": "Configured brass alloy sample"
                }
              ],
              "contamination": [],
              "wetState": "dry",
              "visualState": "brass-sample"
            }
          },
          {
            "id": "unknown-volumetric-flask",
            "definitionId": "volumetric-flask",
            "label": "100 mL brass unknown volumetric flask",
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
            "id": "standard-0p400-tube",
            "definitionId": "test-tube",
            "label": "0.400 M standard tube",
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
            "id": "standard-0p200-tube",
            "definitionId": "test-tube",
            "label": "0.200 M standard tube",
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
            "id": "standard-0p100-tube",
            "definitionId": "test-tube",
            "label": "0.100 M standard tube",
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
            "id": "standard-0p0500-tube",
            "definitionId": "test-tube",
            "label": "0.0500 M standard tube",
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
            "id": "standard-0p0250-tube",
            "definitionId": "test-tube",
            "label": "0.0250 M standard tube",
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
            "id": "unknown-sample-tube",
            "definitionId": "test-tube",
            "label": "Brass unknown sample tube",
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
            "id": "graduated-pipette",
            "definitionId": "graduated-pipette-10ml",
            "label": "10 mL graduated pipette",
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
            "id": "digest-water-cylinder",
            "definitionId": "graduated-cylinder",
            "label": "Digest-water graduated cylinder",
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
            "id": "wash-bottle",
            "definitionId": "wash-bottle",
            "label": "Distilled-water wash bottle",
            "location": "shelf",
            "contents": {
              "kind": "liquid",
              "label": "distilled water",
              "volumeMl": 500,
              "solutes": [],
              "contamination": [],
              "wetState": "wet",
              "visualState": "clear-liquid"
            }
          },
          {
            "id": "copper-standard-stock",
            "definitionId": "sample-bottle",
            "label": "0.400 M Cu2+ stock",
            "location": "shelf",
            "contents": {
              "kind": "solution",
              "label": "0.400 M Cu2+ stock",
              "volumeMl": 100,
              "solutes": [],
              "concentration": {
                "value": 0.4,
                "unit": "M"
              },
              "contamination": [],
              "wetState": "wet",
              "visualState": "copper-blue-solution"
            }
          },
          {
            "id": "spectrophotometer",
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
            "id": "measurement-cuvette",
            "definitionId": "cuvette",
            "label": "Measurement cuvette",
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
            "id": "salt-a-scan-cuvette",
            "definitionId": "cuvette",
            "label": "Assigned salt A scan cuvette",
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
            "id": "salt-b-scan-cuvette",
            "definitionId": "cuvette",
            "label": "Assigned salt B scan cuvette",
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
            "id": "assigned-salt-a-solution",
            "definitionId": "test-tube",
            "label": "Teacher-assigned salt A solution",
            "location": "shelf",
            "contents": {
              "kind": "solution",
              "label": "assigned salt A solution",
              "solutes": [],
              "contamination": [],
              "wetState": "wet",
              "visualState": "clear-liquid"
            }
          },
          {
            "id": "assigned-salt-b-solution",
            "definitionId": "test-tube",
            "label": "Teacher-assigned salt B solution",
            "location": "shelf",
            "contents": {
              "kind": "solution",
              "label": "assigned salt B solution",
              "solutes": [],
              "contamination": [],
              "wetState": "wet",
              "visualState": "clear-liquid"
            }
          },
          {
            "id": "color-depth-unknown-tube",
            "definitionId": "test-tube",
            "label": "Color-depth unknown tube",
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
            "id": "color-depth-standard-tube",
            "definitionId": "test-tube",
            "label": "Color-depth 0.400 M standard tube",
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
            "id": "color-depth-comparison",
            "definitionId": "brass-color-depth-comparison",
            "label": "Paired color-depth comparison",
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
            "id": "waste-beaker",
            "definitionId": "waste-beaker",
            "label": "Brass waste beaker",
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
            "id": "teacher-designated-disposal-receiver",
            "definitionId": "waste-beaker",
            "label": "Teacher-designated final disposal receiver",
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
            "id": "baking-soda-bottle",
            "definitionId": "reagent-bottle",
            "label": "Baking soda for neutralization",
            "location": "shelf",
            "contents": {
              "kind": "solid",
              "label": "sodium bicarbonate",
              "massG": 50,
              "solutes": [],
              "contamination": [],
              "wetState": "dry",
              "visualState": "white-powder"
            }
          },
          {
            "id": "ph-paper",
            "definitionId": "ph-paper",
            "label": "pH paper",
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
          "id": "tare-empty-beaker-action",
          "verb": "weigh",
          "label": "Tare the empty brass beaker",
          "parameters": {
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "analytical-balance",
            "instrumentDefinitionId": "analytical-balance",
            "measurementId": "empty-beaker-tare-g",
            "tolerance": 0.001,
            "sourceInstanceId": "brass-beaker",
            "targetInstanceId": "balance",
            "instrumentInstanceId": "balance"
          },
          "prerequisites": [],
          "stateChanges": [
            "Tare the empty brass beaker: Tare the empty brass beaker evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Tare the empty brass beaker evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "weigh",
            "tare",
            "empty-beaker"
          ],
          "atomId": "atom.weigh.tare-vessel",
          "equipmentRoleBindings": {
            "balance-instrument": "analytical-balance",
            "weighed-vessel": "beaker-250ml"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "analytical-balance",
            "stationId": "analytical-balance",
            "valueParameter": "expectedMassG",
            "accessibleLabel": "Tare the clean, dry empty brass beaker on the balance."
          }
        },
        {
          "id": "weigh-brass-action",
          "verb": "weigh",
          "label": "Weigh the brass sample before quantitative transfer",
          "parameters": {
            "sourceDefinitionId": "small-vial",
            "targetDefinitionId": "analytical-balance",
            "instrumentDefinitionId": "analytical-balance",
            "tolerance": 0.001,
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Net brass mass from the tared balance (g)",
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "g",
            "sourceInstanceId": "brass-sample-vial",
            "targetInstanceId": "balance",
            "instrumentInstanceId": "balance"
          },
          "prerequisites": [],
          "stateChanges": [
            "Read the brass mass: Read the brass mass evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Read the brass mass evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "weigh",
            "measurement",
            "brass-mass-g"
          ],
          "atomId": "atom.weigh.solid-portion",
          "equipmentRoleBindings": {
            "balance-instrument": "analytical-balance",
            "weighed-vessel": "beaker-250ml"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "analytical-balance",
            "stationId": "analytical-balance",
            "valueParameter": "expectedMassG",
            "accessibleLabel": "Read and record the configured brass sample mass from the tared beaker."
          },
          "mass": {
            "source": "action-input",
            "outputMeasurementId": "brass-mass-recorded-g",
            "applyToSourceInventory": true
          }
        },
        {
          "id": "place-brass-in-beaker-action",
          "verb": "transfer",
          "label": "Add brass to the tared beaker",
          "parameters": {
            "sourceDefinitionId": "small-vial",
            "targetDefinitionId": "beaker-250ml",
            "targetLabel": "Configured brass sample",
            "visualState": "brass-sample",
            "sourceInstanceId": "brass-sample-vial",
            "targetInstanceId": "brass-beaker"
          },
          "prerequisites": [],
          "stateChanges": [
            "Add brass to the tared beaker: Add brass to the tared beaker evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Add brass to the tared beaker evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "transfer",
            "solid",
            "brass-in-beaker"
          ],
          "atomId": "atom.transfer.weighed-sample-to-vessel",
          "equipmentRoleBindings": {
            "weighed-sample-source": "small-vial",
            "receiving-vessel": "beaker-250ml"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "small-vial",
            "targetDefinitionId": "beaker-250ml",
            "valueParameter": "massG",
            "accessibleLabel": "Transfer the configured brass sample into the tared beaker."
          },
          "mass": {
            "source": "measurement",
            "referenceId": "brass-mass-recorded-g"
          }
        },
        {
          "id": "record-unknown-final-volume-action",
          "verb": "observe",
          "label": "Record the source-stated unknown final-volume endpoint",
          "atomId": "atom.observe.record-teacher-configured-numeric-value",
          "parameters": {
            "measurementId": "brass-spectrophotometry--approved-unknown-final-volume",
            "configurationQuantity": "unknown final volume",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputLabel": "Teacher confirms the 100.0 mL endpoint",
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "mL",
            "configurationProvenance": "teacher-configured; the source supplies no analytical value",
            "configuredValue": 100
          },
          "prerequisites": [],
          "stateChanges": [
            "Record the source-stated unknown final-volume endpoint: completed with the named sample and configuration provenance preserved."
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
            "success": "Record the source-stated unknown final-volume endpoint complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record the source-stated unknown final-volume endpoint"
          }
        },
        {
          "id": "record-standard-final-volume-action",
          "verb": "observe",
          "label": "Record the source-stated standard final-volume endpoint",
          "atomId": "atom.observe.record-teacher-configured-numeric-value",
          "parameters": {
            "measurementId": "brass-spectrophotometry--approved-standard-final-volume",
            "configurationQuantity": "standard final volume",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputLabel": "Teacher confirms the source endpoint and stated precision",
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "mL",
            "configurationProvenance": "teacher-configured; the source supplies no analytical value",
            "configuredValue": 10
          },
          "prerequisites": [],
          "stateChanges": [
            "Record the source-stated standard final-volume endpoint: completed with the named sample and configuration provenance preserved."
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
            "success": "Record the source-stated standard final-volume endpoint complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record the source-stated standard final-volume endpoint"
          }
        },
        {
          "id": "measure-50ml-digest-water-action",
          "verb": "measureVolume",
          "label": "Measure the source-stated 50 mL digest water",
          "parameters": {
            "sourceInstanceId": "wash-bottle",
            "targetInstanceId": "digest-water-cylinder",
            "teacherControlled": true
          },
          "prerequisites": [],
          "stateChanges": [
            "Measure the source-stated 50 mL digest water: completed with the named sample and configuration provenance preserved."
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
            "success": "Measure the source-stated 50 mL digest water complete.",
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
            "accessibleLabel": "Measure the source-stated 50 mL digest water"
          },
          "volume": {
            "source": "literal",
            "valueMl": 50,
            "outputMeasurementId": "digest-added-water-ml"
          }
        },
        {
          "id": "teacher-add-50ml-water-to-digest-action",
          "verb": "transfer",
          "label": "Teacher adds the source-stated 50 mL water to the completed digest",
          "parameters": {
            "sourceInstanceId": "digest-water-cylinder",
            "targetInstanceId": "brass-beaker",
            "teacherControlled": true
          },
          "prerequisites": [],
          "stateChanges": [
            "Teacher adds the source-stated 50 mL water to the completed digest: completed with the named sample and configuration provenance preserved."
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
            "success": "Teacher adds the source-stated 50 mL water to the completed digest complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.transfer.measured-liquid",
          "equipmentRoleBindings": {
            "measured-solvent-source": "graduated-cylinder",
            "receiving-vessel": "beaker-250ml"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "graduated-cylinder",
            "targetDefinitionId": "beaker-250ml",
            "accessibleLabel": "Teacher adds the source-stated 50 mL water to the completed digest"
          },
          "volume": {
            "source": "measurement",
            "referenceId": "digest-added-water-ml"
          }
        },
        {
          "id": "confirm-diluted-digest-material-action",
          "verb": "dissolve",
          "label": "Confirm the conservative diluted-digest material transition",
          "parameters": {
            "sourceInstanceId": "digest-water-cylinder",
            "sourceDefinitionId": "graduated-cylinder",
            "targetInstanceId": "brass-beaker",
            "targetDefinitionId": "beaker-250ml",
            "teacherControlled": true
          },
          "prerequisites": [],
          "stateChanges": [
            "Confirm the conservative diluted-digest material transition: completed with the named sample and configuration provenance preserved."
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
            "success": "Confirm the conservative diluted-digest material transition complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "graduated-cylinder",
            "targetDefinitionId": "beaker-250ml",
            "accessibleLabel": "Confirm the completed digest is now the source-stated diluted solution."
          },
          "materialTransition": {
            "kind": "solution",
            "label": "Completed brass digest diluted with the source-stated water addition",
            "wetState": "wet",
            "visualState": "copper-blue-solution"
          }
        },
        {
          "id": "transfer-digest-action",
          "verb": "transfer",
          "label": "Transfer the brass digest",
          "parameters": {
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "volumetric-flask",
            "visualState": "copper-blue-solution",
            "sourceInstanceId": "brass-beaker",
            "targetInstanceId": "unknown-volumetric-flask"
          },
          "prerequisites": [],
          "stateChanges": [
            "Transfer the brass digest: Transfer the brass digest evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Transfer the brass digest evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "transfer",
            "transfer-digest"
          ],
          "atomId": "atom.transfer.brass-digest-to-volumetric-flask",
          "equipmentRoleBindings": {
            "mixture-source": "beaker-250ml",
            "receiving-vessel": "volumetric-flask"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "volumetric-flask",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Transfer the complete teacher-diluted brass digest to the 100 milliliter volumetric flask."
          },
          "volume": {
            "source": "measurement",
            "referenceId": "digest-added-water-ml"
          }
        },
        {
          "id": "rinse-beaker-1-action",
          "verb": "rinse",
          "label": "Rinse the digest beaker (1/4)",
          "parameters": {
            "repeatGroupId": "quantitative-transfer-rinses",
            "repeatIteration": 1,
            "repeatCount": 4,
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "beaker-250ml",
            "volumeMl": 5,
            "collectRinseVolume": true,
            "resultLabel": "Copper-containing rinse washings",
            "resultVisualState": "copper-blue-solution",
            "sourceInstanceId": "wash-bottle",
            "targetInstanceId": "brass-beaker"
          },
          "prerequisites": [
            {
              "id": "rinse-beaker-1-action-requires-transfer-digest-action",
              "type": "actionEvidence",
              "label": "Complete transfer-digest-action first",
              "actionId": "transfer-digest-action"
            }
          ],
          "stateChanges": [
            "Rinse the digest beaker (1/4): Rinse the digest beaker (1/4) evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Rinse the digest beaker (1/4) evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "rinse",
            "quantitative-transfer",
            "rinse-1"
          ],
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "beaker-250ml",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Rinse the brass digest beaker with the stated 5 mL portion (1 of 4)."
          },
          "atomId": "atom.rinse.measured-quantitative-transfer",
          "equipmentRoleBindings": {
            "rinse-water-source": "wash-bottle",
            "rinsed-vessel": "beaker-250ml"
          }
        },
        {
          "id": "transfer-rinse-1-action",
          "verb": "transfer",
          "label": "Transfer washings (1/4)",
          "parameters": {
            "repeatGroupId": "quantitative-transfer-rinses",
            "repeatIteration": 1,
            "repeatCount": 4,
            "repeatIterationComplete": true,
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "volumetric-flask",
            "visualState": "copper-blue-solution",
            "sourceInstanceId": "brass-beaker",
            "targetInstanceId": "unknown-volumetric-flask"
          },
          "prerequisites": [
            {
              "id": "transfer-rinse-1-action-requires-rinse-beaker-1-action",
              "type": "actionEvidence",
              "label": "Complete rinse-beaker-1-action first",
              "actionId": "rinse-beaker-1-action"
            }
          ],
          "stateChanges": [
            "Transfer washings (1/4): Transfer washings (1/4) evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Transfer washings (1/4) evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "transfer",
            "quantitative-transfer",
            "washings-1"
          ],
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "volumetric-flask",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Transfer the complete retained rinse portion into the 100 mL volumetric flask (1 of 4)."
          },
          "atomId": "atom.transfer.quantitative-washings",
          "equipmentRoleBindings": {
            "mixture-source": "beaker-250ml",
            "receiving-vessel": "volumetric-flask"
          },
          "volume": {
            "source": "literal",
            "valueMl": 5
          }
        },
        {
          "id": "rinse-beaker-2-action",
          "verb": "rinse",
          "label": "Rinse the digest beaker (2/4)",
          "parameters": {
            "repeatGroupId": "quantitative-transfer-rinses",
            "repeatIteration": 2,
            "repeatCount": 4,
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "beaker-250ml",
            "volumeMl": 5,
            "collectRinseVolume": true,
            "resultLabel": "Copper-containing rinse washings",
            "resultVisualState": "copper-blue-solution",
            "sourceInstanceId": "wash-bottle",
            "targetInstanceId": "brass-beaker"
          },
          "prerequisites": [
            {
              "id": "rinse-beaker-2-action-requires-transfer-rinse-1-action",
              "type": "actionEvidence",
              "label": "Complete transfer-rinse-1-action first",
              "actionId": "transfer-rinse-1-action"
            }
          ],
          "stateChanges": [
            "Rinse the digest beaker (2/4): Rinse the digest beaker (2/4) evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Rinse the digest beaker (2/4) evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "rinse",
            "quantitative-transfer",
            "rinse-2"
          ],
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "beaker-250ml",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Rinse the brass digest beaker with the stated 5 mL portion (2 of 4)."
          },
          "atomId": "atom.rinse.measured-quantitative-transfer",
          "equipmentRoleBindings": {
            "rinse-water-source": "wash-bottle",
            "rinsed-vessel": "beaker-250ml"
          }
        },
        {
          "id": "transfer-rinse-2-action",
          "verb": "transfer",
          "label": "Transfer washings (2/4)",
          "parameters": {
            "repeatGroupId": "quantitative-transfer-rinses",
            "repeatIteration": 2,
            "repeatCount": 4,
            "repeatIterationComplete": true,
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "volumetric-flask",
            "visualState": "copper-blue-solution",
            "sourceInstanceId": "brass-beaker",
            "targetInstanceId": "unknown-volumetric-flask"
          },
          "prerequisites": [
            {
              "id": "transfer-rinse-2-action-requires-rinse-beaker-2-action",
              "type": "actionEvidence",
              "label": "Complete rinse-beaker-2-action first",
              "actionId": "rinse-beaker-2-action"
            }
          ],
          "stateChanges": [
            "Transfer washings (2/4): Transfer washings (2/4) evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Transfer washings (2/4) evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "transfer",
            "quantitative-transfer",
            "washings-2"
          ],
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "volumetric-flask",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Transfer the complete retained rinse portion into the 100 mL volumetric flask (2 of 4)."
          },
          "atomId": "atom.transfer.quantitative-washings",
          "equipmentRoleBindings": {
            "mixture-source": "beaker-250ml",
            "receiving-vessel": "volumetric-flask"
          },
          "volume": {
            "source": "literal",
            "valueMl": 5
          }
        },
        {
          "id": "rinse-beaker-3-action",
          "verb": "rinse",
          "label": "Rinse the digest beaker (3/4)",
          "parameters": {
            "repeatGroupId": "quantitative-transfer-rinses",
            "repeatIteration": 3,
            "repeatCount": 4,
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "beaker-250ml",
            "volumeMl": 5,
            "collectRinseVolume": true,
            "resultLabel": "Copper-containing rinse washings",
            "resultVisualState": "copper-blue-solution",
            "sourceInstanceId": "wash-bottle",
            "targetInstanceId": "brass-beaker"
          },
          "prerequisites": [
            {
              "id": "rinse-beaker-3-action-requires-transfer-rinse-2-action",
              "type": "actionEvidence",
              "label": "Complete transfer-rinse-2-action first",
              "actionId": "transfer-rinse-2-action"
            }
          ],
          "stateChanges": [
            "Rinse the digest beaker (3/4): Rinse the digest beaker (3/4) evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Rinse the digest beaker (3/4) evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "rinse",
            "quantitative-transfer",
            "rinse-3"
          ],
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "beaker-250ml",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Rinse the brass digest beaker with the stated 5 mL portion (3 of 4)."
          },
          "atomId": "atom.rinse.measured-quantitative-transfer",
          "equipmentRoleBindings": {
            "rinse-water-source": "wash-bottle",
            "rinsed-vessel": "beaker-250ml"
          }
        },
        {
          "id": "transfer-rinse-3-action",
          "verb": "transfer",
          "label": "Transfer washings (3/4)",
          "parameters": {
            "repeatGroupId": "quantitative-transfer-rinses",
            "repeatIteration": 3,
            "repeatCount": 4,
            "repeatIterationComplete": true,
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "volumetric-flask",
            "visualState": "copper-blue-solution",
            "sourceInstanceId": "brass-beaker",
            "targetInstanceId": "unknown-volumetric-flask"
          },
          "prerequisites": [
            {
              "id": "transfer-rinse-3-action-requires-rinse-beaker-3-action",
              "type": "actionEvidence",
              "label": "Complete rinse-beaker-3-action first",
              "actionId": "rinse-beaker-3-action"
            }
          ],
          "stateChanges": [
            "Transfer washings (3/4): Transfer washings (3/4) evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Transfer washings (3/4) evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "transfer",
            "quantitative-transfer",
            "washings-3"
          ],
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "volumetric-flask",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Transfer the complete retained rinse portion into the 100 mL volumetric flask (3 of 4)."
          },
          "atomId": "atom.transfer.quantitative-washings",
          "equipmentRoleBindings": {
            "mixture-source": "beaker-250ml",
            "receiving-vessel": "volumetric-flask"
          },
          "volume": {
            "source": "literal",
            "valueMl": 5
          }
        },
        {
          "id": "rinse-beaker-4-action",
          "verb": "rinse",
          "label": "Rinse the digest beaker (4/4)",
          "parameters": {
            "repeatGroupId": "quantitative-transfer-rinses",
            "repeatIteration": 4,
            "repeatCount": 4,
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "beaker-250ml",
            "volumeMl": 5,
            "collectRinseVolume": true,
            "resultLabel": "Copper-containing rinse washings",
            "resultVisualState": "copper-blue-solution",
            "sourceInstanceId": "wash-bottle",
            "targetInstanceId": "brass-beaker"
          },
          "prerequisites": [
            {
              "id": "rinse-beaker-4-action-requires-transfer-rinse-3-action",
              "type": "actionEvidence",
              "label": "Complete transfer-rinse-3-action first",
              "actionId": "transfer-rinse-3-action"
            }
          ],
          "stateChanges": [
            "Rinse the digest beaker (4/4): Rinse the digest beaker (4/4) evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Rinse the digest beaker (4/4) evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "rinse",
            "quantitative-transfer",
            "rinse-4"
          ],
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "beaker-250ml",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Rinse the brass digest beaker with the stated 5 mL portion (4 of 4)."
          },
          "atomId": "atom.rinse.measured-quantitative-transfer",
          "equipmentRoleBindings": {
            "rinse-water-source": "wash-bottle",
            "rinsed-vessel": "beaker-250ml"
          }
        },
        {
          "id": "transfer-rinse-4-action",
          "verb": "transfer",
          "label": "Transfer washings (4/4)",
          "parameters": {
            "repeatGroupId": "quantitative-transfer-rinses",
            "repeatIteration": 4,
            "repeatCount": 4,
            "repeatIterationComplete": true,
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "volumetric-flask",
            "visualState": "copper-blue-solution",
            "sourceInstanceId": "brass-beaker",
            "targetInstanceId": "unknown-volumetric-flask"
          },
          "prerequisites": [
            {
              "id": "transfer-rinse-4-action-requires-rinse-beaker-4-action",
              "type": "actionEvidence",
              "label": "Complete rinse-beaker-4-action first",
              "actionId": "rinse-beaker-4-action"
            }
          ],
          "stateChanges": [
            "Transfer washings (4/4): Transfer washings (4/4) evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Transfer washings (4/4) evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "transfer",
            "quantitative-transfer",
            "washings-4"
          ],
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "volumetric-flask",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Transfer the complete retained rinse portion into the 100 mL volumetric flask (4 of 4)."
          },
          "atomId": "atom.transfer.quantitative-washings",
          "equipmentRoleBindings": {
            "mixture-source": "beaker-250ml",
            "receiving-vessel": "volumetric-flask"
          },
          "volume": {
            "source": "literal",
            "valueMl": 5
          }
        },
        {
          "id": "dilute-unknown-to-mark-action",
          "verb": "dilute",
          "label": "Dilute the brass unknown to the source-stated approved final-volume endpoint",
          "parameters": {
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "volumetric-flask",
            "visualState": "copper-blue-solution-at-mark",
            "sourceInstanceId": "wash-bottle",
            "targetInstanceId": "unknown-volumetric-flask"
          },
          "prerequisites": [],
          "stateChanges": [
            "Dilute the unknown to 100.0 mL: Dilute the unknown to 100.0 mL evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Dilute the unknown to 100.0 mL evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "dilute",
            "quantitative-transfer",
            "meniscus-at-mark"
          ],
          "atomId": "atom.dilute.brass-to-approved-final-volume",
          "equipmentRoleBindings": {
            "liquid-source": "wash-bottle",
            "final-volume-vessel": "volumetric-flask"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "volumetric-flask",
            "valueParameter": "finalVolumeMl",
            "accessibleLabel": "Add distilled water to the approved 100.0 milliliter calibration mark."
          },
          "volume": {
            "source": "measurement",
            "referenceId": "brass-spectrophotometry--approved-unknown-final-volume"
          }
        },
        {
          "id": "standard-0p200-aliquot-ml-action",
          "verb": "calculate",
          "label": "Calculate the 0.200 M aliquot",
          "parameters": {
            "calculationId": "brass-spectrophotometry--standard-0p200-aliquot-ml",
            "template": "dilutionAliquotVolume",
            "stockConcentrationM": 0.4,
            "targetConcentrationM": 0.2,
            "finalVolumeMl": 10,
            "tolerance": 0.01,
            "unit": "mL",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "0.400 M stock aliquot",
            "inputStep": 0.001,
            "requireStudentValue": true
          },
          "prerequisites": [],
          "stateChanges": [
            "Calculate the 0.200 M aliquot: Calculate the 0.200 M aliquot evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Calculate the 0.200 M aliquot evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "calculate",
            "student-submission",
            "standard-0p200-aliquot-ml"
          ]
        },
        {
          "id": "standard-0p100-aliquot-ml-action",
          "verb": "calculate",
          "label": "Calculate the 0.100 M aliquot",
          "parameters": {
            "calculationId": "brass-spectrophotometry--standard-0p100-aliquot-ml",
            "template": "dilutionAliquotVolume",
            "stockConcentrationM": 0.4,
            "targetConcentrationM": 0.1,
            "finalVolumeMl": 10,
            "tolerance": 0.01,
            "unit": "mL",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "0.400 M stock aliquot",
            "inputStep": 0.001,
            "requireStudentValue": true
          },
          "prerequisites": [],
          "stateChanges": [
            "Calculate the 0.100 M aliquot: Calculate the 0.100 M aliquot evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Calculate the 0.100 M aliquot evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "calculate",
            "student-submission",
            "standard-0p100-aliquot-ml"
          ]
        },
        {
          "id": "standard-0p0500-aliquot-ml-action",
          "verb": "calculate",
          "label": "Calculate the 0.0500 M aliquot",
          "parameters": {
            "calculationId": "brass-spectrophotometry--standard-0p0500-aliquot-ml",
            "template": "dilutionAliquotVolume",
            "stockConcentrationM": 0.4,
            "targetConcentrationM": 0.05,
            "finalVolumeMl": 10,
            "tolerance": 0.01,
            "unit": "mL",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "0.400 M stock aliquot",
            "inputStep": 0.001,
            "requireStudentValue": true
          },
          "prerequisites": [],
          "stateChanges": [
            "Calculate the 0.0500 M aliquot: Calculate the 0.0500 M aliquot evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Calculate the 0.0500 M aliquot evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "calculate",
            "student-submission",
            "standard-0p0500-aliquot-ml"
          ]
        },
        {
          "id": "standard-0p0250-aliquot-ml-action",
          "verb": "calculate",
          "label": "Calculate the 0.0250 M aliquot",
          "parameters": {
            "calculationId": "brass-spectrophotometry--standard-0p0250-aliquot-ml",
            "template": "dilutionAliquotVolume",
            "stockConcentrationM": 0.4,
            "targetConcentrationM": 0.025,
            "finalVolumeMl": 10,
            "tolerance": 0.01,
            "unit": "mL",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "0.400 M stock aliquot",
            "inputStep": 0.001,
            "requireStudentValue": true
          },
          "prerequisites": [],
          "stateChanges": [
            "Calculate the 0.0250 M aliquot: Calculate the 0.0250 M aliquot evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Calculate the 0.0250 M aliquot evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "calculate",
            "student-submission",
            "standard-0p0250-aliquot-ml"
          ]
        },
        {
          "id": "standard-0p400-stock-transfer-action",
          "verb": "transfer",
          "label": "Transfer stock for 0.400 M standard",
          "parameters": {
            "sourceDefinitionId": "sample-bottle",
            "targetDefinitionId": "test-tube",
            "visualState": "copper-blue-solution",
            "configurationChoice": true,
            "sourceInstanceId": "copper-standard-stock",
            "targetInstanceId": "standard-0p400-tube"
          },
          "prerequisites": [],
          "stateChanges": [
            "Transfer stock for 0.400 M standard: Transfer stock for 0.400 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Transfer stock for 0.400 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "transfer",
            "standard-preparation",
            "0p400"
          ],
          "atomId": "atom.transfer.brass-standard-stock-aliquot",
          "equipmentRoleBindings": {
            "liquid-source": "sample-bottle",
            "variable-volume-measuring-device": "graduated-pipette-10ml",
            "receiving-vessel": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "sample-bottle",
            "targetDefinitionId": "test-tube",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Measure with the graduated pipette and transfer the approved stock aliquot to its labelled tube."
          },
          "volume": {
            "source": "measurement",
            "referenceId": "brass-spectrophotometry--approved-standard-final-volume"
          },
          "deliveryDevice": {
            "deviceInstanceId": "graduated-pipette",
            "deviceDefinitionId": "graduated-pipette-10ml"
          }
        },
        {
          "id": "standard-0p200-stock-transfer-action",
          "verb": "transfer",
          "label": "Transfer the learner-calculated stock aliquot for the 0.200 M standard",
          "parameters": {
            "sourceDefinitionId": "sample-bottle",
            "targetDefinitionId": "test-tube",
            "visualState": "copper-blue-solution",
            "sourceInstanceId": "copper-standard-stock",
            "targetInstanceId": "standard-0p200-tube"
          },
          "prerequisites": [],
          "stateChanges": [
            "Transfer stock for 0.200 M standard: Transfer stock for 0.200 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Transfer stock for 0.200 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "transfer",
            "standard-preparation",
            "0p200"
          ],
          "atomId": "atom.transfer.brass-standard-stock-aliquot",
          "equipmentRoleBindings": {
            "liquid-source": "sample-bottle",
            "variable-volume-measuring-device": "graduated-pipette-10ml",
            "receiving-vessel": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "sample-bottle",
            "targetDefinitionId": "test-tube",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Measure with the graduated pipette and transfer the approved stock aliquot to its labelled tube."
          },
          "volume": {
            "source": "calculation",
            "referenceId": "brass-spectrophotometry--standard-0p200-aliquot-ml"
          },
          "deliveryDevice": {
            "deviceInstanceId": "graduated-pipette",
            "deviceDefinitionId": "graduated-pipette-10ml"
          }
        },
        {
          "id": "standard-0p200-dilute-action",
          "verb": "dilute",
          "label": "Dilute the 0.200 M standard to the source-stated final-volume endpoint",
          "parameters": {
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "test-tube",
            "visualState": "copper-blue-solution",
            "sourceInstanceId": "wash-bottle",
            "targetInstanceId": "standard-0p200-tube"
          },
          "prerequisites": [],
          "stateChanges": [
            "Dilute the 0.200 M standard: Dilute the 0.200 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Dilute the 0.200 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "dilute",
            "standard-preparation",
            "0p200"
          ],
          "atomId": "atom.dilute.brass-to-approved-final-volume",
          "equipmentRoleBindings": {
            "liquid-source": "wash-bottle",
            "final-volume-vessel": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "test-tube",
            "valueParameter": "finalVolumeMl",
            "accessibleLabel": "Add distilled water to the teacher-approved final standard volume."
          },
          "volume": {
            "source": "measurement",
            "referenceId": "brass-spectrophotometry--approved-standard-final-volume"
          }
        },
        {
          "id": "standard-0p100-stock-transfer-action",
          "verb": "transfer",
          "label": "Transfer the learner-calculated stock aliquot for the 0.100 M standard",
          "parameters": {
            "sourceDefinitionId": "sample-bottle",
            "targetDefinitionId": "test-tube",
            "visualState": "copper-blue-solution",
            "sourceInstanceId": "copper-standard-stock",
            "targetInstanceId": "standard-0p100-tube"
          },
          "prerequisites": [],
          "stateChanges": [
            "Transfer stock for 0.100 M standard: Transfer stock for 0.100 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Transfer stock for 0.100 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "transfer",
            "standard-preparation",
            "0p100"
          ],
          "atomId": "atom.transfer.brass-standard-stock-aliquot",
          "equipmentRoleBindings": {
            "liquid-source": "sample-bottle",
            "variable-volume-measuring-device": "graduated-pipette-10ml",
            "receiving-vessel": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "sample-bottle",
            "targetDefinitionId": "test-tube",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Measure with the graduated pipette and transfer the approved stock aliquot to its labelled tube."
          },
          "volume": {
            "source": "calculation",
            "referenceId": "brass-spectrophotometry--standard-0p100-aliquot-ml"
          },
          "deliveryDevice": {
            "deviceInstanceId": "graduated-pipette",
            "deviceDefinitionId": "graduated-pipette-10ml"
          }
        },
        {
          "id": "standard-0p100-dilute-action",
          "verb": "dilute",
          "label": "Dilute the 0.100 M standard to the source-stated final-volume endpoint",
          "parameters": {
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "test-tube",
            "visualState": "copper-blue-solution",
            "sourceInstanceId": "wash-bottle",
            "targetInstanceId": "standard-0p100-tube"
          },
          "prerequisites": [],
          "stateChanges": [
            "Dilute the 0.100 M standard: Dilute the 0.100 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Dilute the 0.100 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "dilute",
            "standard-preparation",
            "0p100"
          ],
          "atomId": "atom.dilute.brass-to-approved-final-volume",
          "equipmentRoleBindings": {
            "liquid-source": "wash-bottle",
            "final-volume-vessel": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "test-tube",
            "valueParameter": "finalVolumeMl",
            "accessibleLabel": "Add distilled water to the teacher-approved final standard volume."
          },
          "volume": {
            "source": "measurement",
            "referenceId": "brass-spectrophotometry--approved-standard-final-volume"
          }
        },
        {
          "id": "standard-0p0500-stock-transfer-action",
          "verb": "transfer",
          "label": "Transfer the learner-calculated stock aliquot for the 0.0500 M standard",
          "parameters": {
            "sourceDefinitionId": "sample-bottle",
            "targetDefinitionId": "test-tube",
            "visualState": "copper-blue-solution",
            "sourceInstanceId": "copper-standard-stock",
            "targetInstanceId": "standard-0p0500-tube"
          },
          "prerequisites": [],
          "stateChanges": [
            "Transfer stock for 0.0500 M standard: Transfer stock for 0.0500 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Transfer stock for 0.0500 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "transfer",
            "standard-preparation",
            "0p0500"
          ],
          "atomId": "atom.transfer.brass-standard-stock-aliquot",
          "equipmentRoleBindings": {
            "liquid-source": "sample-bottle",
            "variable-volume-measuring-device": "graduated-pipette-10ml",
            "receiving-vessel": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "sample-bottle",
            "targetDefinitionId": "test-tube",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Measure with the graduated pipette and transfer the approved stock aliquot to its labelled tube."
          },
          "volume": {
            "source": "calculation",
            "referenceId": "brass-spectrophotometry--standard-0p0500-aliquot-ml"
          },
          "deliveryDevice": {
            "deviceInstanceId": "graduated-pipette",
            "deviceDefinitionId": "graduated-pipette-10ml"
          }
        },
        {
          "id": "standard-0p0500-dilute-action",
          "verb": "dilute",
          "label": "Dilute the 0.0500 M standard to the source-stated final-volume endpoint",
          "parameters": {
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "test-tube",
            "visualState": "copper-blue-solution",
            "sourceInstanceId": "wash-bottle",
            "targetInstanceId": "standard-0p0500-tube"
          },
          "prerequisites": [],
          "stateChanges": [
            "Dilute the 0.0500 M standard: Dilute the 0.0500 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Dilute the 0.0500 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "dilute",
            "standard-preparation",
            "0p0500"
          ],
          "atomId": "atom.dilute.brass-to-approved-final-volume",
          "equipmentRoleBindings": {
            "liquid-source": "wash-bottle",
            "final-volume-vessel": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "test-tube",
            "valueParameter": "finalVolumeMl",
            "accessibleLabel": "Add distilled water to the teacher-approved final standard volume."
          },
          "volume": {
            "source": "measurement",
            "referenceId": "brass-spectrophotometry--approved-standard-final-volume"
          }
        },
        {
          "id": "standard-0p0250-stock-transfer-action",
          "verb": "transfer",
          "label": "Transfer the learner-calculated stock aliquot for the 0.0250 M standard",
          "parameters": {
            "sourceDefinitionId": "sample-bottle",
            "targetDefinitionId": "test-tube",
            "visualState": "copper-blue-solution",
            "sourceInstanceId": "copper-standard-stock",
            "targetInstanceId": "standard-0p0250-tube"
          },
          "prerequisites": [],
          "stateChanges": [
            "Transfer stock for 0.0250 M standard: Transfer stock for 0.0250 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Transfer stock for 0.0250 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "transfer",
            "standard-preparation",
            "0p0250"
          ],
          "atomId": "atom.transfer.brass-standard-stock-aliquot",
          "equipmentRoleBindings": {
            "liquid-source": "sample-bottle",
            "variable-volume-measuring-device": "graduated-pipette-10ml",
            "receiving-vessel": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "sample-bottle",
            "targetDefinitionId": "test-tube",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Measure with the graduated pipette and transfer the approved stock aliquot to its labelled tube."
          },
          "volume": {
            "source": "calculation",
            "referenceId": "brass-spectrophotometry--standard-0p0250-aliquot-ml"
          },
          "deliveryDevice": {
            "deviceInstanceId": "graduated-pipette",
            "deviceDefinitionId": "graduated-pipette-10ml"
          }
        },
        {
          "id": "standard-0p0250-dilute-action",
          "verb": "dilute",
          "label": "Dilute the 0.0250 M standard to the source-stated final-volume endpoint",
          "parameters": {
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "test-tube",
            "visualState": "copper-blue-solution",
            "sourceInstanceId": "wash-bottle",
            "targetInstanceId": "standard-0p0250-tube"
          },
          "prerequisites": [],
          "stateChanges": [
            "Dilute the 0.0250 M standard: Dilute the 0.0250 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Dilute the 0.0250 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "dilute",
            "standard-preparation",
            "0p0250"
          ],
          "atomId": "atom.dilute.brass-to-approved-final-volume",
          "equipmentRoleBindings": {
            "liquid-source": "wash-bottle",
            "final-volume-vessel": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "test-tube",
            "valueParameter": "finalVolumeMl",
            "accessibleLabel": "Add distilled water to the teacher-approved final standard volume."
          },
          "volume": {
            "source": "measurement",
            "referenceId": "brass-spectrophotometry--approved-standard-final-volume"
          }
        },
        {
          "id": "calibrate-zero-percent-t-action",
          "verb": "observe",
          "label": "Set 0% transmittance",
          "parameters": {
            "note": "The spectrophotometer was set to 0%T with the cuvette holder empty.",
            "tag": "spectrophotometer-dark-zero",
            "photometerOperation": "darkZero",
            "wavelengthMeasurementId": "{{config.wavelengthMeasurementId}}",
            "photometerInstanceId": "spectrophotometer"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set 0% transmittance: Set 0% transmittance evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Set 0% transmittance evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.observe.dark-zero-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Set 0% transmittance"
          }
        },
        {
          "id": "prepare-blank-action",
          "verb": "transfer",
          "label": "Prepare the distilled-water blank",
          "parameters": {
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "cuvette",
            "visualState": "clear-liquid",
            "configurationChoice": true,
            "sourceInstanceId": "wash-bottle",
            "targetInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Prepare the distilled-water blank: Prepare the distilled-water blank evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Prepare the distilled-water blank evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "transfer",
            "blank",
            "cuvette-three-quarters"
          ],
          "atomId": "atom.transfer.prepare-photometric-blank",
          "equipmentRoleBindings": {
            "liquid-source": "wash-bottle",
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Fill the clean cuvette with distilled water for the blank."
          },
          "volume": {
            "source": "target-fill-fraction",
            "fraction": 0.75
          }
        },
        {
          "id": "blank-wipe-orient-action",
          "verb": "rinse",
          "label": "Wipe and orient the blank cuvette",
          "parameters": {
            "note": "The filled blank cuvette has clean, dry optical faces and the approved orientation; instrument placement remains a separate later atom.",
            "tag": "cuvette-technique",
            "configurationChoice": true
          },
          "prerequisites": [],
          "stateChanges": [
            "Wipe and orient the blank cuvette: Wipe and orient the blank cuvette evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Wipe and orient the blank cuvette evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.rinse.prepare-cuvette-optical-faces",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "cuvette",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Wipe and orient the blank cuvette"
          }
        },
        {
          "id": "insert-blank-action",
          "verb": "place",
          "label": "Insert the blank cuvette",
          "parameters": {
            "equipmentDefinitionId": "cuvette",
            "sourceDefinitionId": "cuvette",
            "targetDefinitionId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "equipmentInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert the blank cuvette: Insert the blank cuvette evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Insert the blank cuvette evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "place",
            "blank",
            "cuvette-instrument"
          ],
          "atomId": "atom.place.insert-cuvette",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer",
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "snapIntoTarget",
            "sourceDefinitionId": "cuvette",
            "targetDefinitionId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "accessibleLabel": "Insert the distilled-water blank in the approved orientation."
          }
        },
        {
          "id": "calibrate-hundred-percent-t-action",
          "verb": "observe",
          "label": "Set 100% transmittance",
          "parameters": {
            "note": "The instrument was blanked to 100%T at the teacher-approved wavelength.",
            "tag": "spectrophotometer-blanked",
            "configurationChoice": true,
            "photometerOperation": "zero",
            "wavelengthMeasurementId": "{{config.wavelengthMeasurementId}}",
            "requiresDarkZeroNotebookTag": "spectrophotometer-dark-zero",
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set 100% transmittance: Set 100% transmittance evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Set 100% transmittance evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.observe.blank-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer",
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Set 100% transmittance"
          }
        },
        {
          "id": "remove-blank-action",
          "verb": "place",
          "label": "Remove the blank cuvette",
          "parameters": {
            "equipmentDefinitionId": "cuvette",
            "sourceDefinitionId": "cuvette",
            "location": "workbench",
            "equipmentInstanceId": "measurement-cuvette"
          },
          "prerequisites": [
            {
              "id": "remove-blank-after-calibration",
              "type": "actionEvidence",
              "label": "The instrument has been blanked at 100 percent transmittance",
              "actionId": "calibrate-hundred-percent-t-action"
            }
          ],
          "stateChanges": [
            "The blank cuvette is removed and the sample compartment is empty."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "The blank cuvette is back on the bench and the sample compartment is clear.",
            "invalid": "Complete blank calibration, then remove the named cuvette from the instrument."
          },
          "evidence": [
            "place",
            "blank",
            "cuvette-removed"
          ],
          "atomId": "atom.place.remove-cuvette",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer",
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "dragToZone",
            "sourceDefinitionId": "cuvette",
            "stationId": "workbench",
            "accessibleLabel": "Remove the distilled-water blank and place it on the bench."
          }
        },
        {
          "id": "condition-0p0250-action",
          "verb": "rinse",
          "label": "Condition the cuvette with the 0.0250 M standard",
          "parameters": {
            "note": "Condition the empty cuvette twice with approximately 1 mL of the named next sample; this atom does not fill, wipe, orient, or insert the holder.",
            "tag": "cuvette-conditioned-0p0250",
            "sampleIdentity": "0p0250",
            "conditioningCount": 2,
            "conditioningPortionMl": 1,
            "sourceInstanceId": "standard-0p0250-tube",
            "targetInstanceId": "measurement-cuvette",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Condition the cuvette with the 0.0250 M standard: Condition the cuvette with the 0.0250 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Condition the cuvette with the 0.0250 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.rinse.condition-cuvette-with-sample",
          "equipmentRoleBindings": {
            "sample-source": "test-tube",
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Condition the cuvette with the 0.0250 M standard"
          }
        },
        {
          "id": "return-0p0250-action",
          "verb": "transfer",
          "label": "Return the 0.0250 M standard",
          "parameters": {
            "note": "Cuvette contents returned to the original 0.0250 M standard container without relabeling or cross-contamination.",
            "tag": "sample-return-0p0250",
            "sampleIdentity": "0p0250",
            "sourceInstanceId": "measurement-cuvette",
            "targetInstanceId": "standard-0p0250-tube"
          },
          "prerequisites": [],
          "stateChanges": [
            "Return the 0.0250 M standard: Return the 0.0250 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Return the 0.0250 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.transfer.return-cuvette-to-origin",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette",
            "provenance-matched-sample-receiver": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Return the 0.0250 M standard"
          },
          "volume": {
            "source": "literal",
            "valueMl": 3
          }
        },
        {
          "id": "condition-0p0500-action",
          "verb": "rinse",
          "label": "Condition the cuvette with the 0.0500 M standard",
          "parameters": {
            "note": "Condition the empty cuvette twice with approximately 1 mL of the named next sample; this atom does not fill, wipe, orient, or insert the holder.",
            "tag": "cuvette-conditioned-0p0500",
            "sampleIdentity": "0p0500",
            "conditioningCount": 2,
            "conditioningPortionMl": 1,
            "sourceInstanceId": "standard-0p0500-tube",
            "targetInstanceId": "measurement-cuvette",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Condition the cuvette with the 0.0500 M standard: Condition the cuvette with the 0.0500 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Condition the cuvette with the 0.0500 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.rinse.condition-cuvette-with-sample",
          "equipmentRoleBindings": {
            "sample-source": "test-tube",
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Condition the cuvette with the 0.0500 M standard"
          }
        },
        {
          "id": "return-0p0500-action",
          "verb": "transfer",
          "label": "Return the 0.0500 M standard",
          "parameters": {
            "note": "Cuvette contents returned to the original 0.0500 M standard container without relabeling or cross-contamination.",
            "tag": "sample-return-0p0500",
            "sampleIdentity": "0p0500",
            "sourceInstanceId": "measurement-cuvette",
            "targetInstanceId": "standard-0p0500-tube"
          },
          "prerequisites": [],
          "stateChanges": [
            "Return the 0.0500 M standard: Return the 0.0500 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Return the 0.0500 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.transfer.return-cuvette-to-origin",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette",
            "provenance-matched-sample-receiver": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Return the 0.0500 M standard"
          },
          "volume": {
            "source": "literal",
            "valueMl": 3
          }
        },
        {
          "id": "condition-0p100-action",
          "verb": "rinse",
          "label": "Condition the cuvette with the 0.100 M standard",
          "parameters": {
            "note": "Condition the empty cuvette twice with approximately 1 mL of the named next sample; this atom does not fill, wipe, orient, or insert the holder.",
            "tag": "cuvette-conditioned-0p100",
            "sampleIdentity": "0p100",
            "conditioningCount": 2,
            "conditioningPortionMl": 1,
            "sourceInstanceId": "standard-0p100-tube",
            "targetInstanceId": "measurement-cuvette",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Condition the cuvette with the 0.100 M standard: Condition the cuvette with the 0.100 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Condition the cuvette with the 0.100 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.rinse.condition-cuvette-with-sample",
          "equipmentRoleBindings": {
            "sample-source": "test-tube",
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Condition the cuvette with the 0.100 M standard"
          }
        },
        {
          "id": "return-0p100-action",
          "verb": "transfer",
          "label": "Return the 0.100 M standard",
          "parameters": {
            "note": "Cuvette contents returned to the original 0.100 M standard container without relabeling or cross-contamination.",
            "tag": "sample-return-0p100",
            "sampleIdentity": "0p100",
            "sourceInstanceId": "measurement-cuvette",
            "targetInstanceId": "standard-0p100-tube"
          },
          "prerequisites": [],
          "stateChanges": [
            "Return the 0.100 M standard: Return the 0.100 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Return the 0.100 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.transfer.return-cuvette-to-origin",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette",
            "provenance-matched-sample-receiver": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Return the 0.100 M standard"
          },
          "volume": {
            "source": "literal",
            "valueMl": 3
          }
        },
        {
          "id": "condition-0p200-action",
          "verb": "rinse",
          "label": "Condition the cuvette with the 0.200 M standard",
          "parameters": {
            "note": "Condition the empty cuvette twice with approximately 1 mL of the named next sample; this atom does not fill, wipe, orient, or insert the holder.",
            "tag": "cuvette-conditioned-0p200",
            "sampleIdentity": "0p200",
            "conditioningCount": 2,
            "conditioningPortionMl": 1,
            "sourceInstanceId": "standard-0p200-tube",
            "targetInstanceId": "measurement-cuvette",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Condition the cuvette with the 0.200 M standard: Condition the cuvette with the 0.200 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Condition the cuvette with the 0.200 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.rinse.condition-cuvette-with-sample",
          "equipmentRoleBindings": {
            "sample-source": "test-tube",
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Condition the cuvette with the 0.200 M standard"
          }
        },
        {
          "id": "return-0p200-action",
          "verb": "transfer",
          "label": "Return the 0.200 M standard",
          "parameters": {
            "note": "Cuvette contents returned to the original 0.200 M standard container without relabeling or cross-contamination.",
            "tag": "sample-return-0p200",
            "sampleIdentity": "0p200",
            "sourceInstanceId": "measurement-cuvette",
            "targetInstanceId": "standard-0p200-tube"
          },
          "prerequisites": [],
          "stateChanges": [
            "Return the 0.200 M standard: Return the 0.200 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Return the 0.200 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.transfer.return-cuvette-to-origin",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette",
            "provenance-matched-sample-receiver": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Return the 0.200 M standard"
          },
          "volume": {
            "source": "literal",
            "valueMl": 3
          }
        },
        {
          "id": "condition-0p400-action",
          "verb": "rinse",
          "label": "Condition the cuvette with the 0.400 M standard",
          "parameters": {
            "note": "Condition the empty cuvette twice with approximately 1 mL of the named next sample; this atom does not fill, wipe, orient, or insert the holder.",
            "tag": "cuvette-conditioned-0p400",
            "sampleIdentity": "0p400",
            "conditioningCount": 2,
            "conditioningPortionMl": 1,
            "sourceInstanceId": "standard-0p400-tube",
            "targetInstanceId": "measurement-cuvette",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Condition the cuvette with the 0.400 M standard: Condition the cuvette with the 0.400 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Condition the cuvette with the 0.400 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.rinse.condition-cuvette-with-sample",
          "equipmentRoleBindings": {
            "sample-source": "test-tube",
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Condition the cuvette with the 0.400 M standard"
          }
        },
        {
          "id": "return-0p400-action",
          "verb": "transfer",
          "label": "Return the 0.400 M standard",
          "parameters": {
            "note": "Cuvette contents returned to the original 0.400 M standard container without relabeling or cross-contamination.",
            "tag": "sample-return-0p400",
            "sampleIdentity": "0p400",
            "sourceInstanceId": "measurement-cuvette",
            "targetInstanceId": "standard-0p400-tube"
          },
          "prerequisites": [],
          "stateChanges": [
            "Return the 0.400 M standard: Return the 0.400 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Return the 0.400 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.transfer.return-cuvette-to-origin",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette",
            "provenance-matched-sample-receiver": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Return the 0.400 M standard"
          },
          "volume": {
            "source": "literal",
            "valueMl": 3
          }
        },
        {
          "id": "condition-unknown-action",
          "verb": "rinse",
          "label": "Condition the cuvette with the brass unknown",
          "parameters": {
            "note": "Condition the empty cuvette twice with approximately 1 mL of the named next sample; this atom does not fill, wipe, orient, or insert the holder.",
            "tag": "cuvette-conditioned-unknown",
            "sampleIdentity": "unknown",
            "conditioningCount": 2,
            "conditioningPortionMl": 1,
            "sourceInstanceId": "unknown-sample-tube",
            "targetInstanceId": "measurement-cuvette",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Condition the cuvette with the brass unknown: Condition the cuvette with the brass unknown evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Condition the cuvette with the brass unknown evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.rinse.condition-cuvette-with-sample",
          "equipmentRoleBindings": {
            "sample-source": "test-tube",
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Condition the cuvette with the brass unknown"
          }
        },
        {
          "id": "read-unknown-absorbance-action",
          "verb": "observe",
          "label": "Read absorbance for the brass unknown",
          "parameters": {
            "note": "Acquire the named sample reading from the teacher-approved instrument state; do not preload a result.",
            "tag": "absorbance-read-unknown",
            "configurationChoice": true,
            "photometerOperation": "read",
            "photometricQuantity": "absorbance",
            "wavelengthMeasurementId": "{{config.wavelengthMeasurementId}}",
            "requiresZeroNotebookTag": "spectrophotometer-blanked",
            "measurementId": "unknown-absorbance-au",
            "unit": "absorbance",
            "sampleIdentity": "unknown",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Instrument absorbance for unknown",
            "inputMin": 0,
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Read absorbance for the brass unknown: Read absorbance for the brass unknown evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Read absorbance for the brass unknown evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read absorbance for the brass unknown"
          }
        },
        {
          "id": "record-unknown-absorbance-action",
          "verb": "record",
          "label": "Record absorbance for the brass unknown",
          "parameters": {
            "measurementId": "unknown-absorbance-au",
            "label": "Record absorbance for the brass unknown",
            "unit": "absorbance",
            "inputKey": "unknown-absorbance-au",
            "inputMin": 0,
            "inputMax": 1,
            "sampleIdentity": "unknown"
          },
          "prerequisites": [
            {
              "id": "record-unknown-absorbance-action-needs-read",
              "type": "measurementRecorded",
              "label": "The named photometer reading was acquired",
              "measurementId": "unknown-absorbance-au"
            }
          ],
          "stateChanges": [
            "Record absorbance for the brass unknown: Record absorbance for the brass unknown evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Record absorbance for the brass unknown evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "record",
            "measurement",
            "unknown-absorbance-au"
          ],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record absorbance for the brass unknown"
          }
        },
        {
          "id": "return-unknown-action",
          "verb": "transfer",
          "label": "Return the brass unknown",
          "parameters": {
            "note": "Cuvette contents returned to the original brass unknown container without relabeling or cross-contamination.",
            "tag": "sample-return-unknown",
            "sampleIdentity": "unknown",
            "sourceInstanceId": "measurement-cuvette",
            "targetInstanceId": "unknown-sample-tube"
          },
          "prerequisites": [],
          "stateChanges": [
            "Return the brass unknown: Return the brass unknown evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Return the brass unknown evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.transfer.return-cuvette-to-origin",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette",
            "provenance-matched-sample-receiver": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Return the brass unknown"
          },
          "volume": {
            "source": "literal",
            "valueMl": 3
          }
        },
        {
          "id": "place-color-depth-comparison-action",
          "verb": "place",
          "label": "Place the color-depth comparison",
          "parameters": {
            "equipmentDefinitionId": "brass-color-depth-comparison",
            "sourceDefinitionId": "brass-color-depth-comparison",
            "location": "workbench"
          },
          "prerequisites": [],
          "stateChanges": [
            "Place the color-depth comparison: Place the color-depth comparison evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Place the color-depth comparison evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "place",
            "visual-comparison",
            "accessible-equivalent"
          ],
          "atomId": "atom.place.brass-color-depth-comparison",
          "equipmentRoleBindings": {
            "color-depth-comparison-apparatus": "brass-color-depth-comparison"
          },
          "interaction": {
            "type": "dragToZone",
            "sourceDefinitionId": "brass-color-depth-comparison",
            "stationId": "workbench",
            "accessibleLabel": "Place the paired color-depth comparison over its white field."
          }
        },
        {
          "id": "visual-match-action",
          "verb": "transfer",
          "label": "Match apparent blue intensity",
          "parameters": {
            "note": "Apparent intensity matched by removing only 0.400 M standard; no solution was removed from the unknown.",
            "tag": "visual-color-match",
            "configurationChoice": true,
            "sampleIdentity": "0p400",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Incremental 0.400 M standard volume removed (mL)",
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "mL",
            "sourceInstanceId": "color-depth-standard-tube",
            "targetInstanceId": "waste-beaker"
          },
          "prerequisites": [],
          "stateChanges": [
            "Match apparent blue intensity: Match apparent blue intensity evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Match apparent blue intensity evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.transfer.adjust-color-depth-standard",
          "equipmentRoleBindings": {
            "color-depth-comparison-apparatus": "brass-color-depth-comparison",
            "waste-receiver": "waste-beaker"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "waste-beaker",
            "accessibleLabel": "Remove solution only from the 0.400 M comparison column into the waste beaker"
          },
          "volume": {
            "source": "action-input"
          }
        },
        {
          "id": "record-unknown-depth-action",
          "verb": "observe",
          "label": "Record unknown solution depth",
          "parameters": {
            "measurementId": "unknown-depth-mm",
            "label": "Record unknown solution depth",
            "unit": "mm",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Unknown solution depth beside the scale",
            "inputMin": 0,
            "inputMinExclusive": true,
            "configurationChoice": true,
            "sampleIdentity": "unknown"
          },
          "prerequisites": [
            {
              "id": "unknown-depth-needs-match",
              "type": "actionEvidence",
              "label": "The one-sided standard adjustment is complete",
              "actionId": "visual-match-action"
            }
          ],
          "stateChanges": [
            "Record unknown solution depth: Record unknown solution depth evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Record unknown solution depth evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "record",
            "measurement",
            "unknown-depth-mm"
          ],
          "atomId": "atom.observe.read-color-depth",
          "equipmentRoleBindings": {
            "color-depth-comparison-apparatus": "brass-color-depth-comparison"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "brass-color-depth-comparison",
            "stationId": "brass-color-depth-comparison",
            "accessibleLabel": "Record unknown solution depth"
          }
        },
        {
          "id": "record-standard-depth-action",
          "verb": "observe",
          "label": "Record 0.400 M standard depth",
          "parameters": {
            "measurementId": "standard-depth-mm",
            "label": "Record 0.400 M standard depth",
            "unit": "mm",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Matched 0.400 M standard depth beside the scale",
            "inputMin": 0,
            "inputMinExclusive": true,
            "configurationChoice": true
          },
          "prerequisites": [
            {
              "id": "standard-depth-needs-unknown-depth",
              "type": "measurementRecorded",
              "label": "The unknown depth was acquired separately",
              "measurementId": "unknown-depth-mm"
            }
          ],
          "stateChanges": [
            "Record 0.400 M standard depth: Record 0.400 M standard depth evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Record 0.400 M standard depth evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "record",
            "measurement",
            "standard-depth-mm"
          ],
          "atomId": "atom.observe.read-color-depth",
          "equipmentRoleBindings": {
            "color-depth-comparison-apparatus": "brass-color-depth-comparison"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "brass-color-depth-comparison",
            "stationId": "brass-color-depth-comparison",
            "accessibleLabel": "Record 0.400 M standard depth"
          }
        },
        {
          "id": "neutralize-waste-action",
          "verb": "transfer",
          "label": "Neutralize brass waste",
          "parameters": {
            "note": "Baking soda was added incrementally; bubbling subsided before the pH check.",
            "tag": "waste-neutralization",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Mass of this incremental sodium bicarbonate portion (g)",
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "g",
            "sourceInstanceId": "baking-soda-bottle",
            "targetInstanceId": "waste-beaker"
          },
          "prerequisites": [],
          "stateChanges": [
            "Neutralize brass waste: Neutralize brass waste evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Neutralize brass waste evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.transfer.treat-waste-with-solid-to-endpoint",
          "equipmentRoleBindings": {
            "solid-reagent-source": "reagent-bottle",
            "waste-receiver": "waste-beaker"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "reagent-bottle",
            "targetDefinitionId": "waste-beaker",
            "accessibleLabel": "Add one small sodium bicarbonate portion to the collected waste"
          }
        },
        {
          "id": "record-waste-ph-action",
          "verb": "observe",
          "label": "Record neutralized waste pH",
          "parameters": {
            "measurementId": "neutralized-waste-ph",
            "label": "Record neutralized waste pH",
            "unit": "pH",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Measured neutralized waste pH after bubbling subsides",
            "inputMin": 0,
            "inputMax": 14
          },
          "prerequisites": [
            {
              "id": "ph-needs-bubbling-observation",
              "type": "actionEvidence",
              "label": "The bubbling disposition was recorded",
              "actionId": "observe-waste-bubbling-action"
            }
          ],
          "stateChanges": [
            "Record neutralized waste pH: Record neutralized waste pH evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Record neutralized waste pH evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "record",
            "measurement",
            "neutralized-waste-ph"
          ],
          "atomId": "atom.observe.read-waste-ph-indicator",
          "equipmentRoleBindings": {
            "ph-indicator-medium": "ph-paper",
            "waste-receiver": "waste-beaker"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "ph-paper",
            "stationId": "ph-paper",
            "accessibleLabel": "Record neutralized waste pH"
          }
        },
        {
          "id": "read-0p0250-absorbance-action",
          "verb": "observe",
          "label": "Read absorbance for the 0.0250 M standard",
          "parameters": {
            "note": "Acquire the named sample reading from the teacher-approved instrument state; do not preload a result.",
            "tag": "absorbance-read-0p0250",
            "configurationChoice": true,
            "photometerOperation": "read",
            "photometricQuantity": "absorbance",
            "wavelengthMeasurementId": "{{config.wavelengthMeasurementId}}",
            "requiresZeroNotebookTag": "spectrophotometer-blanked",
            "measurementId": "0p0250-absorbance-au",
            "unit": "absorbance",
            "sampleIdentity": "0p0250",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Instrument absorbance for 0p0250",
            "inputMin": 0,
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Read absorbance for the 0.0250 M standard: Read absorbance for the 0.0250 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Read absorbance for the 0.0250 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read absorbance for the 0.0250 M standard"
          }
        },
        {
          "id": "record-0p0250-absorbance-action",
          "verb": "record",
          "label": "Record absorbance for the 0.0250 M standard",
          "parameters": {
            "measurementId": "0p0250-absorbance-au",
            "label": "Record absorbance for the 0.0250 M standard",
            "unit": "absorbance",
            "inputKey": "0p0250-absorbance-au",
            "inputMin": 0,
            "inputMax": 1,
            "sampleIdentity": "0p0250"
          },
          "prerequisites": [
            {
              "id": "record-0p0250-absorbance-action-needs-read",
              "type": "measurementRecorded",
              "label": "The named photometer reading was acquired",
              "measurementId": "0p0250-absorbance-au"
            }
          ],
          "stateChanges": [
            "Record absorbance for the 0.0250 M standard: Record absorbance for the 0.0250 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Record absorbance for the 0.0250 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "record",
            "measurement",
            "0p0250-absorbance-au"
          ],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record absorbance for the 0.0250 M standard"
          }
        },
        {
          "id": "read-0p0500-absorbance-action",
          "verb": "observe",
          "label": "Read absorbance for the 0.0500 M standard",
          "parameters": {
            "note": "Acquire the named sample reading from the teacher-approved instrument state; do not preload a result.",
            "tag": "absorbance-read-0p0500",
            "configurationChoice": true,
            "photometerOperation": "read",
            "photometricQuantity": "absorbance",
            "wavelengthMeasurementId": "{{config.wavelengthMeasurementId}}",
            "requiresZeroNotebookTag": "spectrophotometer-blanked",
            "measurementId": "0p0500-absorbance-au",
            "unit": "absorbance",
            "sampleIdentity": "0p0500",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Instrument absorbance for 0p0500",
            "inputMin": 0,
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Read absorbance for the 0.0500 M standard: Read absorbance for the 0.0500 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Read absorbance for the 0.0500 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read absorbance for the 0.0500 M standard"
          }
        },
        {
          "id": "record-0p0500-absorbance-action",
          "verb": "record",
          "label": "Record absorbance for the 0.0500 M standard",
          "parameters": {
            "measurementId": "0p0500-absorbance-au",
            "label": "Record absorbance for the 0.0500 M standard",
            "unit": "absorbance",
            "inputKey": "0p0500-absorbance-au",
            "inputMin": 0,
            "inputMax": 1,
            "sampleIdentity": "0p0500"
          },
          "prerequisites": [
            {
              "id": "record-0p0500-absorbance-action-needs-read",
              "type": "measurementRecorded",
              "label": "The named photometer reading was acquired",
              "measurementId": "0p0500-absorbance-au"
            }
          ],
          "stateChanges": [
            "Record absorbance for the 0.0500 M standard: Record absorbance for the 0.0500 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Record absorbance for the 0.0500 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "record",
            "measurement",
            "0p0500-absorbance-au"
          ],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record absorbance for the 0.0500 M standard"
          }
        },
        {
          "id": "read-0p100-absorbance-action",
          "verb": "observe",
          "label": "Read absorbance for the 0.100 M standard",
          "parameters": {
            "note": "Acquire the named sample reading from the teacher-approved instrument state; do not preload a result.",
            "tag": "absorbance-read-0p100",
            "configurationChoice": true,
            "photometerOperation": "read",
            "photometricQuantity": "absorbance",
            "wavelengthMeasurementId": "{{config.wavelengthMeasurementId}}",
            "requiresZeroNotebookTag": "spectrophotometer-blanked",
            "measurementId": "0p100-absorbance-au",
            "unit": "absorbance",
            "sampleIdentity": "0p100",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Instrument absorbance for 0p100",
            "inputMin": 0,
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Read absorbance for the 0.100 M standard: Read absorbance for the 0.100 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Read absorbance for the 0.100 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read absorbance for the 0.100 M standard"
          }
        },
        {
          "id": "record-0p100-absorbance-action",
          "verb": "record",
          "label": "Record absorbance for the 0.100 M standard",
          "parameters": {
            "measurementId": "0p100-absorbance-au",
            "label": "Record absorbance for the 0.100 M standard",
            "unit": "absorbance",
            "inputKey": "0p100-absorbance-au",
            "inputMin": 0,
            "inputMax": 1,
            "sampleIdentity": "0p100"
          },
          "prerequisites": [
            {
              "id": "record-0p100-absorbance-action-needs-read",
              "type": "measurementRecorded",
              "label": "The named photometer reading was acquired",
              "measurementId": "0p100-absorbance-au"
            }
          ],
          "stateChanges": [
            "Record absorbance for the 0.100 M standard: Record absorbance for the 0.100 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Record absorbance for the 0.100 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "record",
            "measurement",
            "0p100-absorbance-au"
          ],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record absorbance for the 0.100 M standard"
          }
        },
        {
          "id": "read-0p200-absorbance-action",
          "verb": "observe",
          "label": "Read absorbance for the 0.200 M standard",
          "parameters": {
            "note": "Acquire the named sample reading from the teacher-approved instrument state; do not preload a result.",
            "tag": "absorbance-read-0p200",
            "configurationChoice": true,
            "photometerOperation": "read",
            "photometricQuantity": "absorbance",
            "wavelengthMeasurementId": "{{config.wavelengthMeasurementId}}",
            "requiresZeroNotebookTag": "spectrophotometer-blanked",
            "measurementId": "0p200-absorbance-au",
            "unit": "absorbance",
            "sampleIdentity": "0p200",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Instrument absorbance for 0p200",
            "inputMin": 0,
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Read absorbance for the 0.200 M standard: Read absorbance for the 0.200 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Read absorbance for the 0.200 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read absorbance for the 0.200 M standard"
          }
        },
        {
          "id": "record-0p200-absorbance-action",
          "verb": "record",
          "label": "Record absorbance for the 0.200 M standard",
          "parameters": {
            "measurementId": "0p200-absorbance-au",
            "label": "Record absorbance for the 0.200 M standard",
            "unit": "absorbance",
            "inputKey": "0p200-absorbance-au",
            "inputMin": 0,
            "inputMax": 1,
            "sampleIdentity": "0p200"
          },
          "prerequisites": [
            {
              "id": "record-0p200-absorbance-action-needs-read",
              "type": "measurementRecorded",
              "label": "The named photometer reading was acquired",
              "measurementId": "0p200-absorbance-au"
            }
          ],
          "stateChanges": [
            "Record absorbance for the 0.200 M standard: Record absorbance for the 0.200 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Record absorbance for the 0.200 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "record",
            "measurement",
            "0p200-absorbance-au"
          ],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record absorbance for the 0.200 M standard"
          }
        },
        {
          "id": "read-0p400-absorbance-action",
          "verb": "observe",
          "label": "Read absorbance for the 0.400 M standard",
          "parameters": {
            "note": "Acquire the named sample reading from the teacher-approved instrument state; do not preload a result.",
            "tag": "absorbance-read-0p400",
            "configurationChoice": true,
            "photometerOperation": "read",
            "photometricQuantity": "absorbance",
            "wavelengthMeasurementId": "{{config.wavelengthMeasurementId}}",
            "requiresZeroNotebookTag": "spectrophotometer-blanked",
            "measurementId": "0p400-absorbance-au",
            "unit": "absorbance",
            "sampleIdentity": "0p400",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Instrument absorbance for 0p400",
            "inputMin": 0,
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Read absorbance for the 0.400 M standard: Read absorbance for the 0.400 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Read absorbance for the 0.400 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "observe",
            "notebook"
          ],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read absorbance for the 0.400 M standard"
          }
        },
        {
          "id": "record-0p400-absorbance-action",
          "verb": "record",
          "label": "Record absorbance for the 0.400 M standard",
          "parameters": {
            "measurementId": "0p400-absorbance-au",
            "label": "Record absorbance for the 0.400 M standard",
            "unit": "absorbance",
            "inputKey": "0p400-absorbance-au",
            "inputMin": 0,
            "inputMax": 1,
            "sampleIdentity": "0p400"
          },
          "prerequisites": [
            {
              "id": "record-0p400-absorbance-action-needs-read",
              "type": "measurementRecorded",
              "label": "The named photometer reading was acquired",
              "measurementId": "0p400-absorbance-au"
            }
          ],
          "stateChanges": [
            "Record absorbance for the 0.400 M standard: Record absorbance for the 0.400 M standard evidence accepted."
          ],
          "invalidCases": [
            {
              "id": "wrong-order",
              "when": "current node expects a different action",
              "message": "That action is out of sequence for this investigation.",
              "recovery": "Return to the highlighted step and complete its evidence before continuing."
            },
            {
              "id": "unsafe-state",
              "when": "a safety or teacher approval prerequisite is incomplete",
              "message": "This operation is locked by a safety or instructor checkpoint.",
              "recovery": "Complete the named safety check or obtain the configured teacher approval."
            },
            {
              "id": "technique-not-ready",
              "when": "the selected apparatus is not prepared for a defensible measurement",
              "message": "The apparatus is not ready for this measurement.",
              "recovery": "Check quantitative transfer, cuvette conditioning, calibration, and sample order."
            }
          ],
          "feedback": {
            "success": "Record absorbance for the 0.400 M standard evidence accepted.",
            "invalid": "Review the required technique and try again."
          },
          "evidence": [
            "record",
            "measurement",
            "0p400-absorbance-au"
          ],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record absorbance for the 0.400 M standard"
          }
        },
        {
          "id": "fill-0p0250-cuvette-action",
          "verb": "transfer",
          "label": "Fill the cuvette from standard-0p0250-tube",
          "parameters": {
            "sampleIdentity": "0p0250",
            "sourceInstanceId": "standard-0p0250-tube",
            "targetInstanceId": "measurement-cuvette",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Fill the cuvette from standard-0p0250-tube: completed with the named sample and configuration provenance preserved."
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
            "success": "Fill the cuvette from standard-0p0250-tube complete.",
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
            "accessibleLabel": "Fill the cuvette from standard-0p0250-tube"
          },
          "volume": {
            "source": "target-fill-fraction",
            "fraction": 0.75
          }
        },
        {
          "id": "prepare-0p0250-optical-faces-action",
          "verb": "rinse",
          "label": "Wipe and orient the filled 0p0250 cuvette",
          "parameters": {
            "sampleIdentity": "0p0250",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Wipe and orient the filled 0p0250 cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Wipe and orient the filled 0p0250 cuvette complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.rinse.prepare-cuvette-optical-faces",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "cuvette",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Wipe and orient the filled 0p0250 cuvette"
          }
        },
        {
          "id": "insert-0p0250-cuvette-action",
          "verb": "place",
          "label": "Insert the 0p0250 cuvette",
          "parameters": {
            "sampleIdentity": "0p0250",
            "equipmentInstanceId": "measurement-cuvette",
            "targetInstanceId": "spectrophotometer"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert the 0p0250 cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert the 0p0250 cuvette complete.",
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
            "accessibleLabel": "Insert the 0p0250 cuvette"
          }
        },
        {
          "id": "remove-0p0250-cuvette-action",
          "verb": "place",
          "label": "Remove the 0p0250 cuvette",
          "parameters": {
            "sampleIdentity": "0p0250",
            "equipmentInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove the 0p0250 cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove the 0p0250 cuvette complete.",
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
            "accessibleLabel": "Remove the 0p0250 cuvette"
          }
        },
        {
          "id": "fill-0p0500-cuvette-action",
          "verb": "transfer",
          "label": "Fill the cuvette from standard-0p0500-tube",
          "parameters": {
            "sampleIdentity": "0p0500",
            "sourceInstanceId": "standard-0p0500-tube",
            "targetInstanceId": "measurement-cuvette",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Fill the cuvette from standard-0p0500-tube: completed with the named sample and configuration provenance preserved."
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
            "success": "Fill the cuvette from standard-0p0500-tube complete.",
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
            "accessibleLabel": "Fill the cuvette from standard-0p0500-tube"
          },
          "volume": {
            "source": "target-fill-fraction",
            "fraction": 0.75
          }
        },
        {
          "id": "prepare-0p0500-optical-faces-action",
          "verb": "rinse",
          "label": "Wipe and orient the filled 0p0500 cuvette",
          "parameters": {
            "sampleIdentity": "0p0500",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Wipe and orient the filled 0p0500 cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Wipe and orient the filled 0p0500 cuvette complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.rinse.prepare-cuvette-optical-faces",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "cuvette",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Wipe and orient the filled 0p0500 cuvette"
          }
        },
        {
          "id": "insert-0p0500-cuvette-action",
          "verb": "place",
          "label": "Insert the 0p0500 cuvette",
          "parameters": {
            "sampleIdentity": "0p0500",
            "equipmentInstanceId": "measurement-cuvette",
            "targetInstanceId": "spectrophotometer"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert the 0p0500 cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert the 0p0500 cuvette complete.",
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
            "accessibleLabel": "Insert the 0p0500 cuvette"
          }
        },
        {
          "id": "remove-0p0500-cuvette-action",
          "verb": "place",
          "label": "Remove the 0p0500 cuvette",
          "parameters": {
            "sampleIdentity": "0p0500",
            "equipmentInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove the 0p0500 cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove the 0p0500 cuvette complete.",
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
            "accessibleLabel": "Remove the 0p0500 cuvette"
          }
        },
        {
          "id": "fill-0p100-cuvette-action",
          "verb": "transfer",
          "label": "Fill the cuvette from standard-0p100-tube",
          "parameters": {
            "sampleIdentity": "0p100",
            "sourceInstanceId": "standard-0p100-tube",
            "targetInstanceId": "measurement-cuvette",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Fill the cuvette from standard-0p100-tube: completed with the named sample and configuration provenance preserved."
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
            "success": "Fill the cuvette from standard-0p100-tube complete.",
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
            "accessibleLabel": "Fill the cuvette from standard-0p100-tube"
          },
          "volume": {
            "source": "target-fill-fraction",
            "fraction": 0.75
          }
        },
        {
          "id": "prepare-0p100-optical-faces-action",
          "verb": "rinse",
          "label": "Wipe and orient the filled 0p100 cuvette",
          "parameters": {
            "sampleIdentity": "0p100",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Wipe and orient the filled 0p100 cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Wipe and orient the filled 0p100 cuvette complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.rinse.prepare-cuvette-optical-faces",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "cuvette",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Wipe and orient the filled 0p100 cuvette"
          }
        },
        {
          "id": "insert-0p100-cuvette-action",
          "verb": "place",
          "label": "Insert the 0p100 cuvette",
          "parameters": {
            "sampleIdentity": "0p100",
            "equipmentInstanceId": "measurement-cuvette",
            "targetInstanceId": "spectrophotometer"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert the 0p100 cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert the 0p100 cuvette complete.",
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
            "accessibleLabel": "Insert the 0p100 cuvette"
          }
        },
        {
          "id": "remove-0p100-cuvette-action",
          "verb": "place",
          "label": "Remove the 0p100 cuvette",
          "parameters": {
            "sampleIdentity": "0p100",
            "equipmentInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove the 0p100 cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove the 0p100 cuvette complete.",
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
            "accessibleLabel": "Remove the 0p100 cuvette"
          }
        },
        {
          "id": "fill-0p200-cuvette-action",
          "verb": "transfer",
          "label": "Fill the cuvette from standard-0p200-tube",
          "parameters": {
            "sampleIdentity": "0p200",
            "sourceInstanceId": "standard-0p200-tube",
            "targetInstanceId": "measurement-cuvette",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Fill the cuvette from standard-0p200-tube: completed with the named sample and configuration provenance preserved."
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
            "success": "Fill the cuvette from standard-0p200-tube complete.",
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
            "accessibleLabel": "Fill the cuvette from standard-0p200-tube"
          },
          "volume": {
            "source": "target-fill-fraction",
            "fraction": 0.75
          }
        },
        {
          "id": "prepare-0p200-optical-faces-action",
          "verb": "rinse",
          "label": "Wipe and orient the filled 0p200 cuvette",
          "parameters": {
            "sampleIdentity": "0p200",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Wipe and orient the filled 0p200 cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Wipe and orient the filled 0p200 cuvette complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.rinse.prepare-cuvette-optical-faces",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "cuvette",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Wipe and orient the filled 0p200 cuvette"
          }
        },
        {
          "id": "insert-0p200-cuvette-action",
          "verb": "place",
          "label": "Insert the 0p200 cuvette",
          "parameters": {
            "sampleIdentity": "0p200",
            "equipmentInstanceId": "measurement-cuvette",
            "targetInstanceId": "spectrophotometer"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert the 0p200 cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert the 0p200 cuvette complete.",
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
            "accessibleLabel": "Insert the 0p200 cuvette"
          }
        },
        {
          "id": "remove-0p200-cuvette-action",
          "verb": "place",
          "label": "Remove the 0p200 cuvette",
          "parameters": {
            "sampleIdentity": "0p200",
            "equipmentInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove the 0p200 cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove the 0p200 cuvette complete.",
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
            "accessibleLabel": "Remove the 0p200 cuvette"
          }
        },
        {
          "id": "fill-0p400-cuvette-action",
          "verb": "transfer",
          "label": "Fill the cuvette from standard-0p400-tube",
          "parameters": {
            "sampleIdentity": "0p400",
            "sourceInstanceId": "standard-0p400-tube",
            "targetInstanceId": "measurement-cuvette",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Fill the cuvette from standard-0p400-tube: completed with the named sample and configuration provenance preserved."
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
            "success": "Fill the cuvette from standard-0p400-tube complete.",
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
            "accessibleLabel": "Fill the cuvette from standard-0p400-tube"
          },
          "volume": {
            "source": "target-fill-fraction",
            "fraction": 0.75
          }
        },
        {
          "id": "prepare-0p400-optical-faces-action",
          "verb": "rinse",
          "label": "Wipe and orient the filled 0p400 cuvette",
          "parameters": {
            "sampleIdentity": "0p400",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Wipe and orient the filled 0p400 cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Wipe and orient the filled 0p400 cuvette complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.rinse.prepare-cuvette-optical-faces",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "cuvette",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Wipe and orient the filled 0p400 cuvette"
          }
        },
        {
          "id": "insert-0p400-cuvette-action",
          "verb": "place",
          "label": "Insert the 0p400 cuvette",
          "parameters": {
            "sampleIdentity": "0p400",
            "equipmentInstanceId": "measurement-cuvette",
            "targetInstanceId": "spectrophotometer"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert the 0p400 cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert the 0p400 cuvette complete.",
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
            "accessibleLabel": "Insert the 0p400 cuvette"
          }
        },
        {
          "id": "remove-0p400-cuvette-action",
          "verb": "place",
          "label": "Remove the 0p400 cuvette",
          "parameters": {
            "sampleIdentity": "0p400",
            "equipmentInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove the 0p400 cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove the 0p400 cuvette complete.",
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
            "accessibleLabel": "Remove the 0p400 cuvette"
          }
        },
        {
          "id": "fill-unknown-cuvette-action",
          "verb": "transfer",
          "label": "Fill the cuvette from unknown-sample-tube",
          "parameters": {
            "sampleIdentity": "unknown",
            "sourceInstanceId": "unknown-sample-tube",
            "targetInstanceId": "measurement-cuvette",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Fill the cuvette from unknown-sample-tube: completed with the named sample and configuration provenance preserved."
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
            "success": "Fill the cuvette from unknown-sample-tube complete.",
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
            "accessibleLabel": "Fill the cuvette from unknown-sample-tube"
          },
          "volume": {
            "source": "target-fill-fraction",
            "fraction": 0.75
          }
        },
        {
          "id": "prepare-unknown-optical-faces-action",
          "verb": "rinse",
          "label": "Wipe and orient the filled unknown cuvette",
          "parameters": {
            "sampleIdentity": "unknown",
            "cuvetteInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Wipe and orient the filled unknown cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Wipe and orient the filled unknown cuvette complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.rinse.prepare-cuvette-optical-faces",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "cuvette",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Wipe and orient the filled unknown cuvette"
          }
        },
        {
          "id": "insert-unknown-cuvette-action",
          "verb": "place",
          "label": "Insert the unknown cuvette",
          "parameters": {
            "sampleIdentity": "unknown",
            "equipmentInstanceId": "measurement-cuvette",
            "targetInstanceId": "spectrophotometer"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert the unknown cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert the unknown cuvette complete.",
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
            "accessibleLabel": "Insert the unknown cuvette"
          }
        },
        {
          "id": "remove-unknown-cuvette-action",
          "verb": "place",
          "label": "Remove the unknown cuvette",
          "parameters": {
            "sampleIdentity": "unknown",
            "equipmentInstanceId": "measurement-cuvette"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove the unknown cuvette: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove the unknown cuvette complete.",
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
            "accessibleLabel": "Remove the unknown cuvette"
          }
        },
        {
          "id": "transfer-prepared-unknown-to-original-tube-action",
          "verb": "transfer",
          "label": "Transfer a measured portion of the prepared brass unknown to its original sample tube",
          "parameters": {
            "sourceInstanceId": "unknown-volumetric-flask",
            "targetInstanceId": "unknown-sample-tube",
            "volumeProvenance": "source-faithful measured portion; no aliquot volume is authored",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Measured prepared-unknown portion for the original tube (mL)",
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "mL"
          },
          "prerequisites": [],
          "stateChanges": [
            "Transfer a measured portion of the prepared brass unknown to its original sample tube: completed with the named sample and configuration provenance preserved."
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
            "success": "Transfer a measured portion of the prepared brass unknown to its original sample tube complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.transfer.measured-liquid",
          "equipmentRoleBindings": {
            "measured-solvent-source": "volumetric-flask",
            "receiving-vessel": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "volumetric-flask",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Transfer a measured portion of the prepared brass unknown to its original sample tube"
          },
          "volume": {
            "source": "action-input"
          },
          "deliveryDevice": {
            "deviceInstanceId": "graduated-pipette",
            "deviceDefinitionId": "graduated-pipette-10ml"
          }
        },
        {
          "id": "scan-configure-salt-a-inventory-action",
          "verb": "observe",
          "label": "Configure finite assigned-salt A operational inventory",
          "parameters": {
            "sourceInstanceId": "assigned-salt-a-solution",
            "sourceDefinitionId": "test-tube",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputLabel": "Assigned-salt A volume available (mL)",
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "mL"
          },
          "prerequisites": [],
          "stateChanges": [
            "Configure finite assigned-salt A operational inventory: completed with the named sample and configuration provenance preserved."
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
            "success": "Configure finite assigned-salt A operational inventory complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.configure-liquid-stock-inventory",
          "equipmentRoleBindings": {
            "sample-source": "test-tube"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "tag",
            "accessibleLabel": "Configure finite assigned-salt A operational inventory"
          },
          "sourceInventory": {
            "sourceInstanceId": "assigned-salt-a-solution",
            "sourceDefinitionId": "test-tube",
            "outputMeasurementId": "assigned-salt-a-inventory-ml"
          }
        },
        {
          "id": "scan-condition-salt-a-once-action",
          "verb": "rinse",
          "label": "Condition assigned-salt A scan cuvette once before the wavelength series",
          "parameters": {
            "sourceInstanceId": "assigned-salt-a-solution",
            "targetInstanceId": "salt-a-scan-cuvette",
            "conditioningCount": 2,
            "conditioningPortionMl": 1,
            "sampleIdentity": "assigned-salt-a",
            "decisionProvenance": "R/C operational handling; not a source analytical value"
          },
          "prerequisites": [],
          "stateChanges": [
            "Condition assigned-salt A scan cuvette once before the wavelength series: completed with the named sample and configuration provenance preserved."
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
            "success": "Condition assigned-salt A scan cuvette once before the wavelength series complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.rinse.condition-cuvette-with-sample",
          "equipmentRoleBindings": {
            "sample-source": "test-tube",
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Condition assigned-salt A scan cuvette once before the wavelength series"
          }
        },
        {
          "id": "scan-fill-salt-a-once-action",
          "verb": "transfer",
          "label": "Fill assigned-salt A scan cuvette once",
          "parameters": {
            "sourceInstanceId": "assigned-salt-a-solution",
            "targetInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Fill assigned-salt A scan cuvette once: completed with the named sample and configuration provenance preserved."
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
            "success": "Fill assigned-salt A scan cuvette once complete.",
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
            "accessibleLabel": "Fill assigned-salt A scan cuvette once"
          },
          "volume": {
            "source": "target-fill-fraction",
            "fraction": 0.75
          }
        },
        {
          "id": "scan-prepare-salt-a-once-action",
          "verb": "rinse",
          "label": "Prepare assigned-salt A optical faces once",
          "parameters": {
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Prepare assigned-salt A optical faces once: completed with the named sample and configuration provenance preserved."
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
            "success": "Prepare assigned-salt A optical faces once complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.rinse.prepare-cuvette-optical-faces",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "cuvette",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Prepare assigned-salt A optical faces once"
          }
        },
        {
          "id": "scan-configure-salt-b-inventory-action",
          "verb": "observe",
          "label": "Configure finite assigned-salt B operational inventory",
          "parameters": {
            "sourceInstanceId": "assigned-salt-b-solution",
            "sourceDefinitionId": "test-tube",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputLabel": "Assigned-salt B volume available (mL)",
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "mL"
          },
          "prerequisites": [],
          "stateChanges": [
            "Configure finite assigned-salt B operational inventory: completed with the named sample and configuration provenance preserved."
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
            "success": "Configure finite assigned-salt B operational inventory complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.configure-liquid-stock-inventory",
          "equipmentRoleBindings": {
            "sample-source": "test-tube"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "tag",
            "accessibleLabel": "Configure finite assigned-salt B operational inventory"
          },
          "sourceInventory": {
            "sourceInstanceId": "assigned-salt-b-solution",
            "sourceDefinitionId": "test-tube",
            "outputMeasurementId": "assigned-salt-b-inventory-ml"
          }
        },
        {
          "id": "scan-condition-salt-b-once-action",
          "verb": "rinse",
          "label": "Condition assigned-salt B scan cuvette once before the wavelength series",
          "parameters": {
            "sourceInstanceId": "assigned-salt-b-solution",
            "targetInstanceId": "salt-b-scan-cuvette",
            "conditioningCount": 2,
            "conditioningPortionMl": 1,
            "sampleIdentity": "assigned-salt-b",
            "decisionProvenance": "R/C operational handling; not a source analytical value"
          },
          "prerequisites": [],
          "stateChanges": [
            "Condition assigned-salt B scan cuvette once before the wavelength series: completed with the named sample and configuration provenance preserved."
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
            "success": "Condition assigned-salt B scan cuvette once before the wavelength series complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.rinse.condition-cuvette-with-sample",
          "equipmentRoleBindings": {
            "sample-source": "test-tube",
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Condition assigned-salt B scan cuvette once before the wavelength series"
          }
        },
        {
          "id": "scan-fill-salt-b-once-action",
          "verb": "transfer",
          "label": "Fill assigned-salt B scan cuvette once",
          "parameters": {
            "sourceInstanceId": "assigned-salt-b-solution",
            "targetInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Fill assigned-salt B scan cuvette once: completed with the named sample and configuration provenance preserved."
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
            "success": "Fill assigned-salt B scan cuvette once complete.",
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
            "accessibleLabel": "Fill assigned-salt B scan cuvette once"
          },
          "volume": {
            "source": "target-fill-fraction",
            "fraction": 0.75
          }
        },
        {
          "id": "scan-prepare-salt-b-once-action",
          "verb": "rinse",
          "label": "Prepare assigned-salt B optical faces once",
          "parameters": {
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Prepare assigned-salt B optical faces once: completed with the named sample and configuration provenance preserved."
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
            "success": "Prepare assigned-salt B optical faces once complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.rinse.prepare-cuvette-optical-faces",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "cuvette",
            "targetDefinitionId": "cuvette",
            "accessibleLabel": "Prepare assigned-salt B optical faces once"
          }
        },
        {
          "id": "scan-place-photometer-action",
          "verb": "place",
          "label": "Place the spectrophotometer for the assigned-salt scan",
          "parameters": {
            "equipmentDefinitionId": "spectrophotometer",
            "equipmentInstanceId": "spectrophotometer",
            "location": "workbench"
          },
          "prerequisites": [],
          "stateChanges": [
            "Place the spectrophotometer for the assigned-salt scan: completed with the named sample and configuration provenance preserved."
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
            "success": "Place the spectrophotometer for the assigned-salt scan complete.",
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
            "accessibleLabel": "Place the spectrophotometer for the assigned-salt scan"
          }
        },
        {
          "id": "scan-set-400-action",
          "verb": "observe",
          "label": "Set the source-stated scan wavelength to 400 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "measurementId": "scan-400-wavelength-nm",
            "configurationQuantity": "scan wavelength",
            "configuredValue": 400,
            "unit": "nm",
            "photometricMode": "absorbance",
            "tag": "scan-400-configured"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set the source-stated scan wavelength to 400 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Set the source-stated scan wavelength to 400 nm complete.",
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
            "accessibleLabel": "Set the source-stated scan wavelength to 400 nm"
          }
        },
        {
          "id": "scan-insert-400-salt-a-action",
          "verb": "place",
          "label": "Insert assigned salt A at 400 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt A at 400 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt A at 400 nm complete.",
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
            "accessibleLabel": "Insert assigned salt A at 400 nm"
          }
        },
        {
          "id": "scan-read-400-salt-a-action",
          "verb": "observe",
          "label": "Read assigned salt A at 400 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "wavelengthMeasurementId": "scan-400-wavelength-nm",
            "measurementId": "scan-400-salt-a-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt A absorbance at 400 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt A at 400 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt A at 400 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt A at 400 nm"
          }
        },
        {
          "id": "scan-record-400-salt-a-action",
          "verb": "record",
          "label": "Record assigned salt A at 400 nm",
          "parameters": {
            "measurementId": "scan-400-salt-a-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [
            {
              "id": "scan-400-salt-a-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-400-salt-a-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt A at 400 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt A at 400 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt A at 400 nm"
          }
        },
        {
          "id": "scan-remove-400-salt-a-action",
          "verb": "place",
          "label": "Remove assigned salt A after 400 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt A after 400 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt A after 400 nm complete.",
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
            "accessibleLabel": "Remove assigned salt A after 400 nm"
          }
        },
        {
          "id": "scan-insert-400-salt-b-action",
          "verb": "place",
          "label": "Insert assigned salt B at 400 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt B at 400 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt B at 400 nm complete.",
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
            "accessibleLabel": "Insert assigned salt B at 400 nm"
          }
        },
        {
          "id": "scan-read-400-salt-b-action",
          "verb": "observe",
          "label": "Read assigned salt B at 400 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "wavelengthMeasurementId": "scan-400-wavelength-nm",
            "measurementId": "scan-400-salt-b-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt B absorbance at 400 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt B at 400 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt B at 400 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt B at 400 nm"
          }
        },
        {
          "id": "scan-record-400-salt-b-action",
          "verb": "record",
          "label": "Record assigned salt B at 400 nm",
          "parameters": {
            "measurementId": "scan-400-salt-b-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [
            {
              "id": "scan-400-salt-b-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-400-salt-b-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt B at 400 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt B at 400 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt B at 400 nm"
          }
        },
        {
          "id": "scan-remove-400-salt-b-action",
          "verb": "place",
          "label": "Remove assigned salt B after 400 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt B after 400 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt B after 400 nm complete.",
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
            "accessibleLabel": "Remove assigned salt B after 400 nm"
          }
        },
        {
          "id": "scan-set-420-action",
          "verb": "observe",
          "label": "Set the source-stated scan wavelength to 420 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "measurementId": "scan-420-wavelength-nm",
            "configurationQuantity": "scan wavelength",
            "configuredValue": 420,
            "unit": "nm",
            "photometricMode": "absorbance",
            "tag": "scan-420-configured"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set the source-stated scan wavelength to 420 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Set the source-stated scan wavelength to 420 nm complete.",
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
            "accessibleLabel": "Set the source-stated scan wavelength to 420 nm"
          }
        },
        {
          "id": "scan-insert-420-salt-a-action",
          "verb": "place",
          "label": "Insert assigned salt A at 420 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt A at 420 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt A at 420 nm complete.",
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
            "accessibleLabel": "Insert assigned salt A at 420 nm"
          }
        },
        {
          "id": "scan-read-420-salt-a-action",
          "verb": "observe",
          "label": "Read assigned salt A at 420 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "wavelengthMeasurementId": "scan-420-wavelength-nm",
            "measurementId": "scan-420-salt-a-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt A absorbance at 420 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt A at 420 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt A at 420 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt A at 420 nm"
          }
        },
        {
          "id": "scan-record-420-salt-a-action",
          "verb": "record",
          "label": "Record assigned salt A at 420 nm",
          "parameters": {
            "measurementId": "scan-420-salt-a-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [
            {
              "id": "scan-420-salt-a-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-420-salt-a-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt A at 420 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt A at 420 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt A at 420 nm"
          }
        },
        {
          "id": "scan-remove-420-salt-a-action",
          "verb": "place",
          "label": "Remove assigned salt A after 420 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt A after 420 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt A after 420 nm complete.",
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
            "accessibleLabel": "Remove assigned salt A after 420 nm"
          }
        },
        {
          "id": "scan-insert-420-salt-b-action",
          "verb": "place",
          "label": "Insert assigned salt B at 420 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt B at 420 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt B at 420 nm complete.",
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
            "accessibleLabel": "Insert assigned salt B at 420 nm"
          }
        },
        {
          "id": "scan-read-420-salt-b-action",
          "verb": "observe",
          "label": "Read assigned salt B at 420 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "wavelengthMeasurementId": "scan-420-wavelength-nm",
            "measurementId": "scan-420-salt-b-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt B absorbance at 420 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt B at 420 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt B at 420 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt B at 420 nm"
          }
        },
        {
          "id": "scan-record-420-salt-b-action",
          "verb": "record",
          "label": "Record assigned salt B at 420 nm",
          "parameters": {
            "measurementId": "scan-420-salt-b-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [
            {
              "id": "scan-420-salt-b-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-420-salt-b-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt B at 420 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt B at 420 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt B at 420 nm"
          }
        },
        {
          "id": "scan-remove-420-salt-b-action",
          "verb": "place",
          "label": "Remove assigned salt B after 420 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt B after 420 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt B after 420 nm complete.",
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
            "accessibleLabel": "Remove assigned salt B after 420 nm"
          }
        },
        {
          "id": "scan-set-440-action",
          "verb": "observe",
          "label": "Set the source-stated scan wavelength to 440 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "measurementId": "scan-440-wavelength-nm",
            "configurationQuantity": "scan wavelength",
            "configuredValue": 440,
            "unit": "nm",
            "photometricMode": "absorbance",
            "tag": "scan-440-configured"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set the source-stated scan wavelength to 440 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Set the source-stated scan wavelength to 440 nm complete.",
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
            "accessibleLabel": "Set the source-stated scan wavelength to 440 nm"
          }
        },
        {
          "id": "scan-insert-440-salt-a-action",
          "verb": "place",
          "label": "Insert assigned salt A at 440 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt A at 440 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt A at 440 nm complete.",
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
            "accessibleLabel": "Insert assigned salt A at 440 nm"
          }
        },
        {
          "id": "scan-read-440-salt-a-action",
          "verb": "observe",
          "label": "Read assigned salt A at 440 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "wavelengthMeasurementId": "scan-440-wavelength-nm",
            "measurementId": "scan-440-salt-a-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt A absorbance at 440 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt A at 440 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt A at 440 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt A at 440 nm"
          }
        },
        {
          "id": "scan-record-440-salt-a-action",
          "verb": "record",
          "label": "Record assigned salt A at 440 nm",
          "parameters": {
            "measurementId": "scan-440-salt-a-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [
            {
              "id": "scan-440-salt-a-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-440-salt-a-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt A at 440 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt A at 440 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt A at 440 nm"
          }
        },
        {
          "id": "scan-remove-440-salt-a-action",
          "verb": "place",
          "label": "Remove assigned salt A after 440 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt A after 440 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt A after 440 nm complete.",
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
            "accessibleLabel": "Remove assigned salt A after 440 nm"
          }
        },
        {
          "id": "scan-insert-440-salt-b-action",
          "verb": "place",
          "label": "Insert assigned salt B at 440 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt B at 440 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt B at 440 nm complete.",
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
            "accessibleLabel": "Insert assigned salt B at 440 nm"
          }
        },
        {
          "id": "scan-read-440-salt-b-action",
          "verb": "observe",
          "label": "Read assigned salt B at 440 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "wavelengthMeasurementId": "scan-440-wavelength-nm",
            "measurementId": "scan-440-salt-b-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt B absorbance at 440 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt B at 440 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt B at 440 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt B at 440 nm"
          }
        },
        {
          "id": "scan-record-440-salt-b-action",
          "verb": "record",
          "label": "Record assigned salt B at 440 nm",
          "parameters": {
            "measurementId": "scan-440-salt-b-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [
            {
              "id": "scan-440-salt-b-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-440-salt-b-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt B at 440 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt B at 440 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt B at 440 nm"
          }
        },
        {
          "id": "scan-remove-440-salt-b-action",
          "verb": "place",
          "label": "Remove assigned salt B after 440 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt B after 440 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt B after 440 nm complete.",
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
            "accessibleLabel": "Remove assigned salt B after 440 nm"
          }
        },
        {
          "id": "scan-set-460-action",
          "verb": "observe",
          "label": "Set the source-stated scan wavelength to 460 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "measurementId": "scan-460-wavelength-nm",
            "configurationQuantity": "scan wavelength",
            "configuredValue": 460,
            "unit": "nm",
            "photometricMode": "absorbance",
            "tag": "scan-460-configured"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set the source-stated scan wavelength to 460 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Set the source-stated scan wavelength to 460 nm complete.",
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
            "accessibleLabel": "Set the source-stated scan wavelength to 460 nm"
          }
        },
        {
          "id": "scan-insert-460-salt-a-action",
          "verb": "place",
          "label": "Insert assigned salt A at 460 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt A at 460 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt A at 460 nm complete.",
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
            "accessibleLabel": "Insert assigned salt A at 460 nm"
          }
        },
        {
          "id": "scan-read-460-salt-a-action",
          "verb": "observe",
          "label": "Read assigned salt A at 460 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "wavelengthMeasurementId": "scan-460-wavelength-nm",
            "measurementId": "scan-460-salt-a-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt A absorbance at 460 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt A at 460 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt A at 460 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt A at 460 nm"
          }
        },
        {
          "id": "scan-record-460-salt-a-action",
          "verb": "record",
          "label": "Record assigned salt A at 460 nm",
          "parameters": {
            "measurementId": "scan-460-salt-a-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [
            {
              "id": "scan-460-salt-a-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-460-salt-a-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt A at 460 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt A at 460 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt A at 460 nm"
          }
        },
        {
          "id": "scan-remove-460-salt-a-action",
          "verb": "place",
          "label": "Remove assigned salt A after 460 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt A after 460 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt A after 460 nm complete.",
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
            "accessibleLabel": "Remove assigned salt A after 460 nm"
          }
        },
        {
          "id": "scan-insert-460-salt-b-action",
          "verb": "place",
          "label": "Insert assigned salt B at 460 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt B at 460 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt B at 460 nm complete.",
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
            "accessibleLabel": "Insert assigned salt B at 460 nm"
          }
        },
        {
          "id": "scan-read-460-salt-b-action",
          "verb": "observe",
          "label": "Read assigned salt B at 460 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "wavelengthMeasurementId": "scan-460-wavelength-nm",
            "measurementId": "scan-460-salt-b-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt B absorbance at 460 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt B at 460 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt B at 460 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt B at 460 nm"
          }
        },
        {
          "id": "scan-record-460-salt-b-action",
          "verb": "record",
          "label": "Record assigned salt B at 460 nm",
          "parameters": {
            "measurementId": "scan-460-salt-b-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [
            {
              "id": "scan-460-salt-b-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-460-salt-b-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt B at 460 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt B at 460 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt B at 460 nm"
          }
        },
        {
          "id": "scan-remove-460-salt-b-action",
          "verb": "place",
          "label": "Remove assigned salt B after 460 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt B after 460 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt B after 460 nm complete.",
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
            "accessibleLabel": "Remove assigned salt B after 460 nm"
          }
        },
        {
          "id": "scan-set-480-action",
          "verb": "observe",
          "label": "Set the source-stated scan wavelength to 480 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "measurementId": "scan-480-wavelength-nm",
            "configurationQuantity": "scan wavelength",
            "configuredValue": 480,
            "unit": "nm",
            "photometricMode": "absorbance",
            "tag": "scan-480-configured"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set the source-stated scan wavelength to 480 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Set the source-stated scan wavelength to 480 nm complete.",
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
            "accessibleLabel": "Set the source-stated scan wavelength to 480 nm"
          }
        },
        {
          "id": "scan-insert-480-salt-a-action",
          "verb": "place",
          "label": "Insert assigned salt A at 480 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt A at 480 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt A at 480 nm complete.",
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
            "accessibleLabel": "Insert assigned salt A at 480 nm"
          }
        },
        {
          "id": "scan-read-480-salt-a-action",
          "verb": "observe",
          "label": "Read assigned salt A at 480 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "wavelengthMeasurementId": "scan-480-wavelength-nm",
            "measurementId": "scan-480-salt-a-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt A absorbance at 480 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt A at 480 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt A at 480 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt A at 480 nm"
          }
        },
        {
          "id": "scan-record-480-salt-a-action",
          "verb": "record",
          "label": "Record assigned salt A at 480 nm",
          "parameters": {
            "measurementId": "scan-480-salt-a-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [
            {
              "id": "scan-480-salt-a-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-480-salt-a-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt A at 480 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt A at 480 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt A at 480 nm"
          }
        },
        {
          "id": "scan-remove-480-salt-a-action",
          "verb": "place",
          "label": "Remove assigned salt A after 480 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt A after 480 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt A after 480 nm complete.",
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
            "accessibleLabel": "Remove assigned salt A after 480 nm"
          }
        },
        {
          "id": "scan-insert-480-salt-b-action",
          "verb": "place",
          "label": "Insert assigned salt B at 480 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt B at 480 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt B at 480 nm complete.",
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
            "accessibleLabel": "Insert assigned salt B at 480 nm"
          }
        },
        {
          "id": "scan-read-480-salt-b-action",
          "verb": "observe",
          "label": "Read assigned salt B at 480 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "wavelengthMeasurementId": "scan-480-wavelength-nm",
            "measurementId": "scan-480-salt-b-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt B absorbance at 480 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt B at 480 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt B at 480 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt B at 480 nm"
          }
        },
        {
          "id": "scan-record-480-salt-b-action",
          "verb": "record",
          "label": "Record assigned salt B at 480 nm",
          "parameters": {
            "measurementId": "scan-480-salt-b-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [
            {
              "id": "scan-480-salt-b-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-480-salt-b-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt B at 480 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt B at 480 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt B at 480 nm"
          }
        },
        {
          "id": "scan-remove-480-salt-b-action",
          "verb": "place",
          "label": "Remove assigned salt B after 480 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt B after 480 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt B after 480 nm complete.",
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
            "accessibleLabel": "Remove assigned salt B after 480 nm"
          }
        },
        {
          "id": "scan-set-500-action",
          "verb": "observe",
          "label": "Set the source-stated scan wavelength to 500 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "measurementId": "scan-500-wavelength-nm",
            "configurationQuantity": "scan wavelength",
            "configuredValue": 500,
            "unit": "nm",
            "photometricMode": "absorbance",
            "tag": "scan-500-configured"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set the source-stated scan wavelength to 500 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Set the source-stated scan wavelength to 500 nm complete.",
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
            "accessibleLabel": "Set the source-stated scan wavelength to 500 nm"
          }
        },
        {
          "id": "scan-insert-500-salt-a-action",
          "verb": "place",
          "label": "Insert assigned salt A at 500 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt A at 500 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt A at 500 nm complete.",
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
            "accessibleLabel": "Insert assigned salt A at 500 nm"
          }
        },
        {
          "id": "scan-read-500-salt-a-action",
          "verb": "observe",
          "label": "Read assigned salt A at 500 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "wavelengthMeasurementId": "scan-500-wavelength-nm",
            "measurementId": "scan-500-salt-a-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt A absorbance at 500 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt A at 500 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt A at 500 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt A at 500 nm"
          }
        },
        {
          "id": "scan-record-500-salt-a-action",
          "verb": "record",
          "label": "Record assigned salt A at 500 nm",
          "parameters": {
            "measurementId": "scan-500-salt-a-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [
            {
              "id": "scan-500-salt-a-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-500-salt-a-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt A at 500 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt A at 500 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt A at 500 nm"
          }
        },
        {
          "id": "scan-remove-500-salt-a-action",
          "verb": "place",
          "label": "Remove assigned salt A after 500 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt A after 500 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt A after 500 nm complete.",
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
            "accessibleLabel": "Remove assigned salt A after 500 nm"
          }
        },
        {
          "id": "scan-insert-500-salt-b-action",
          "verb": "place",
          "label": "Insert assigned salt B at 500 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt B at 500 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt B at 500 nm complete.",
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
            "accessibleLabel": "Insert assigned salt B at 500 nm"
          }
        },
        {
          "id": "scan-read-500-salt-b-action",
          "verb": "observe",
          "label": "Read assigned salt B at 500 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "wavelengthMeasurementId": "scan-500-wavelength-nm",
            "measurementId": "scan-500-salt-b-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt B absorbance at 500 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt B at 500 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt B at 500 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt B at 500 nm"
          }
        },
        {
          "id": "scan-record-500-salt-b-action",
          "verb": "record",
          "label": "Record assigned salt B at 500 nm",
          "parameters": {
            "measurementId": "scan-500-salt-b-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [
            {
              "id": "scan-500-salt-b-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-500-salt-b-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt B at 500 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt B at 500 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt B at 500 nm"
          }
        },
        {
          "id": "scan-remove-500-salt-b-action",
          "verb": "place",
          "label": "Remove assigned salt B after 500 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt B after 500 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt B after 500 nm complete.",
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
            "accessibleLabel": "Remove assigned salt B after 500 nm"
          }
        },
        {
          "id": "scan-set-520-action",
          "verb": "observe",
          "label": "Set the source-stated scan wavelength to 520 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "measurementId": "scan-520-wavelength-nm",
            "configurationQuantity": "scan wavelength",
            "configuredValue": 520,
            "unit": "nm",
            "photometricMode": "absorbance",
            "tag": "scan-520-configured"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set the source-stated scan wavelength to 520 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Set the source-stated scan wavelength to 520 nm complete.",
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
            "accessibleLabel": "Set the source-stated scan wavelength to 520 nm"
          }
        },
        {
          "id": "scan-insert-520-salt-a-action",
          "verb": "place",
          "label": "Insert assigned salt A at 520 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt A at 520 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt A at 520 nm complete.",
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
            "accessibleLabel": "Insert assigned salt A at 520 nm"
          }
        },
        {
          "id": "scan-read-520-salt-a-action",
          "verb": "observe",
          "label": "Read assigned salt A at 520 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "wavelengthMeasurementId": "scan-520-wavelength-nm",
            "measurementId": "scan-520-salt-a-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt A absorbance at 520 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt A at 520 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt A at 520 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt A at 520 nm"
          }
        },
        {
          "id": "scan-record-520-salt-a-action",
          "verb": "record",
          "label": "Record assigned salt A at 520 nm",
          "parameters": {
            "measurementId": "scan-520-salt-a-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [
            {
              "id": "scan-520-salt-a-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-520-salt-a-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt A at 520 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt A at 520 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt A at 520 nm"
          }
        },
        {
          "id": "scan-remove-520-salt-a-action",
          "verb": "place",
          "label": "Remove assigned salt A after 520 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt A after 520 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt A after 520 nm complete.",
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
            "accessibleLabel": "Remove assigned salt A after 520 nm"
          }
        },
        {
          "id": "scan-insert-520-salt-b-action",
          "verb": "place",
          "label": "Insert assigned salt B at 520 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt B at 520 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt B at 520 nm complete.",
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
            "accessibleLabel": "Insert assigned salt B at 520 nm"
          }
        },
        {
          "id": "scan-read-520-salt-b-action",
          "verb": "observe",
          "label": "Read assigned salt B at 520 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "wavelengthMeasurementId": "scan-520-wavelength-nm",
            "measurementId": "scan-520-salt-b-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt B absorbance at 520 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt B at 520 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt B at 520 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt B at 520 nm"
          }
        },
        {
          "id": "scan-record-520-salt-b-action",
          "verb": "record",
          "label": "Record assigned salt B at 520 nm",
          "parameters": {
            "measurementId": "scan-520-salt-b-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [
            {
              "id": "scan-520-salt-b-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-520-salt-b-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt B at 520 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt B at 520 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt B at 520 nm"
          }
        },
        {
          "id": "scan-remove-520-salt-b-action",
          "verb": "place",
          "label": "Remove assigned salt B after 520 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt B after 520 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt B after 520 nm complete.",
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
            "accessibleLabel": "Remove assigned salt B after 520 nm"
          }
        },
        {
          "id": "scan-set-540-action",
          "verb": "observe",
          "label": "Set the source-stated scan wavelength to 540 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "measurementId": "scan-540-wavelength-nm",
            "configurationQuantity": "scan wavelength",
            "configuredValue": 540,
            "unit": "nm",
            "photometricMode": "absorbance",
            "tag": "scan-540-configured"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set the source-stated scan wavelength to 540 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Set the source-stated scan wavelength to 540 nm complete.",
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
            "accessibleLabel": "Set the source-stated scan wavelength to 540 nm"
          }
        },
        {
          "id": "scan-insert-540-salt-a-action",
          "verb": "place",
          "label": "Insert assigned salt A at 540 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt A at 540 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt A at 540 nm complete.",
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
            "accessibleLabel": "Insert assigned salt A at 540 nm"
          }
        },
        {
          "id": "scan-read-540-salt-a-action",
          "verb": "observe",
          "label": "Read assigned salt A at 540 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "wavelengthMeasurementId": "scan-540-wavelength-nm",
            "measurementId": "scan-540-salt-a-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt A absorbance at 540 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt A at 540 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt A at 540 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt A at 540 nm"
          }
        },
        {
          "id": "scan-record-540-salt-a-action",
          "verb": "record",
          "label": "Record assigned salt A at 540 nm",
          "parameters": {
            "measurementId": "scan-540-salt-a-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [
            {
              "id": "scan-540-salt-a-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-540-salt-a-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt A at 540 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt A at 540 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt A at 540 nm"
          }
        },
        {
          "id": "scan-remove-540-salt-a-action",
          "verb": "place",
          "label": "Remove assigned salt A after 540 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt A after 540 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt A after 540 nm complete.",
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
            "accessibleLabel": "Remove assigned salt A after 540 nm"
          }
        },
        {
          "id": "scan-insert-540-salt-b-action",
          "verb": "place",
          "label": "Insert assigned salt B at 540 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt B at 540 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt B at 540 nm complete.",
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
            "accessibleLabel": "Insert assigned salt B at 540 nm"
          }
        },
        {
          "id": "scan-read-540-salt-b-action",
          "verb": "observe",
          "label": "Read assigned salt B at 540 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "wavelengthMeasurementId": "scan-540-wavelength-nm",
            "measurementId": "scan-540-salt-b-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt B absorbance at 540 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt B at 540 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt B at 540 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt B at 540 nm"
          }
        },
        {
          "id": "scan-record-540-salt-b-action",
          "verb": "record",
          "label": "Record assigned salt B at 540 nm",
          "parameters": {
            "measurementId": "scan-540-salt-b-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [
            {
              "id": "scan-540-salt-b-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-540-salt-b-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt B at 540 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt B at 540 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt B at 540 nm"
          }
        },
        {
          "id": "scan-remove-540-salt-b-action",
          "verb": "place",
          "label": "Remove assigned salt B after 540 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt B after 540 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt B after 540 nm complete.",
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
            "accessibleLabel": "Remove assigned salt B after 540 nm"
          }
        },
        {
          "id": "scan-set-560-action",
          "verb": "observe",
          "label": "Set the source-stated scan wavelength to 560 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "measurementId": "scan-560-wavelength-nm",
            "configurationQuantity": "scan wavelength",
            "configuredValue": 560,
            "unit": "nm",
            "photometricMode": "absorbance",
            "tag": "scan-560-configured"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set the source-stated scan wavelength to 560 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Set the source-stated scan wavelength to 560 nm complete.",
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
            "accessibleLabel": "Set the source-stated scan wavelength to 560 nm"
          }
        },
        {
          "id": "scan-insert-560-salt-a-action",
          "verb": "place",
          "label": "Insert assigned salt A at 560 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt A at 560 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt A at 560 nm complete.",
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
            "accessibleLabel": "Insert assigned salt A at 560 nm"
          }
        },
        {
          "id": "scan-read-560-salt-a-action",
          "verb": "observe",
          "label": "Read assigned salt A at 560 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "wavelengthMeasurementId": "scan-560-wavelength-nm",
            "measurementId": "scan-560-salt-a-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt A absorbance at 560 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt A at 560 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt A at 560 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt A at 560 nm"
          }
        },
        {
          "id": "scan-record-560-salt-a-action",
          "verb": "record",
          "label": "Record assigned salt A at 560 nm",
          "parameters": {
            "measurementId": "scan-560-salt-a-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [
            {
              "id": "scan-560-salt-a-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-560-salt-a-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt A at 560 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt A at 560 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt A at 560 nm"
          }
        },
        {
          "id": "scan-remove-560-salt-a-action",
          "verb": "place",
          "label": "Remove assigned salt A after 560 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt A after 560 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt A after 560 nm complete.",
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
            "accessibleLabel": "Remove assigned salt A after 560 nm"
          }
        },
        {
          "id": "scan-insert-560-salt-b-action",
          "verb": "place",
          "label": "Insert assigned salt B at 560 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt B at 560 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt B at 560 nm complete.",
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
            "accessibleLabel": "Insert assigned salt B at 560 nm"
          }
        },
        {
          "id": "scan-read-560-salt-b-action",
          "verb": "observe",
          "label": "Read assigned salt B at 560 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "wavelengthMeasurementId": "scan-560-wavelength-nm",
            "measurementId": "scan-560-salt-b-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt B absorbance at 560 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt B at 560 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt B at 560 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt B at 560 nm"
          }
        },
        {
          "id": "scan-record-560-salt-b-action",
          "verb": "record",
          "label": "Record assigned salt B at 560 nm",
          "parameters": {
            "measurementId": "scan-560-salt-b-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [
            {
              "id": "scan-560-salt-b-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-560-salt-b-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt B at 560 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt B at 560 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt B at 560 nm"
          }
        },
        {
          "id": "scan-remove-560-salt-b-action",
          "verb": "place",
          "label": "Remove assigned salt B after 560 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt B after 560 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt B after 560 nm complete.",
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
            "accessibleLabel": "Remove assigned salt B after 560 nm"
          }
        },
        {
          "id": "scan-set-580-action",
          "verb": "observe",
          "label": "Set the source-stated scan wavelength to 580 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "measurementId": "scan-580-wavelength-nm",
            "configurationQuantity": "scan wavelength",
            "configuredValue": 580,
            "unit": "nm",
            "photometricMode": "absorbance",
            "tag": "scan-580-configured"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set the source-stated scan wavelength to 580 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Set the source-stated scan wavelength to 580 nm complete.",
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
            "accessibleLabel": "Set the source-stated scan wavelength to 580 nm"
          }
        },
        {
          "id": "scan-insert-580-salt-a-action",
          "verb": "place",
          "label": "Insert assigned salt A at 580 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt A at 580 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt A at 580 nm complete.",
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
            "accessibleLabel": "Insert assigned salt A at 580 nm"
          }
        },
        {
          "id": "scan-read-580-salt-a-action",
          "verb": "observe",
          "label": "Read assigned salt A at 580 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "wavelengthMeasurementId": "scan-580-wavelength-nm",
            "measurementId": "scan-580-salt-a-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt A absorbance at 580 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt A at 580 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt A at 580 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt A at 580 nm"
          }
        },
        {
          "id": "scan-record-580-salt-a-action",
          "verb": "record",
          "label": "Record assigned salt A at 580 nm",
          "parameters": {
            "measurementId": "scan-580-salt-a-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [
            {
              "id": "scan-580-salt-a-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-580-salt-a-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt A at 580 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt A at 580 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt A at 580 nm"
          }
        },
        {
          "id": "scan-remove-580-salt-a-action",
          "verb": "place",
          "label": "Remove assigned salt A after 580 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt A after 580 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt A after 580 nm complete.",
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
            "accessibleLabel": "Remove assigned salt A after 580 nm"
          }
        },
        {
          "id": "scan-insert-580-salt-b-action",
          "verb": "place",
          "label": "Insert assigned salt B at 580 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt B at 580 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt B at 580 nm complete.",
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
            "accessibleLabel": "Insert assigned salt B at 580 nm"
          }
        },
        {
          "id": "scan-read-580-salt-b-action",
          "verb": "observe",
          "label": "Read assigned salt B at 580 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "wavelengthMeasurementId": "scan-580-wavelength-nm",
            "measurementId": "scan-580-salt-b-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt B absorbance at 580 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt B at 580 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt B at 580 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt B at 580 nm"
          }
        },
        {
          "id": "scan-record-580-salt-b-action",
          "verb": "record",
          "label": "Record assigned salt B at 580 nm",
          "parameters": {
            "measurementId": "scan-580-salt-b-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [
            {
              "id": "scan-580-salt-b-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-580-salt-b-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt B at 580 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt B at 580 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt B at 580 nm"
          }
        },
        {
          "id": "scan-remove-580-salt-b-action",
          "verb": "place",
          "label": "Remove assigned salt B after 580 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt B after 580 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt B after 580 nm complete.",
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
            "accessibleLabel": "Remove assigned salt B after 580 nm"
          }
        },
        {
          "id": "scan-set-600-action",
          "verb": "observe",
          "label": "Set the source-stated scan wavelength to 600 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "measurementId": "scan-600-wavelength-nm",
            "configurationQuantity": "scan wavelength",
            "configuredValue": 600,
            "unit": "nm",
            "photometricMode": "absorbance",
            "tag": "scan-600-configured"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set the source-stated scan wavelength to 600 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Set the source-stated scan wavelength to 600 nm complete.",
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
            "accessibleLabel": "Set the source-stated scan wavelength to 600 nm"
          }
        },
        {
          "id": "scan-insert-600-salt-a-action",
          "verb": "place",
          "label": "Insert assigned salt A at 600 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt A at 600 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt A at 600 nm complete.",
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
            "accessibleLabel": "Insert assigned salt A at 600 nm"
          }
        },
        {
          "id": "scan-read-600-salt-a-action",
          "verb": "observe",
          "label": "Read assigned salt A at 600 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "wavelengthMeasurementId": "scan-600-wavelength-nm",
            "measurementId": "scan-600-salt-a-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt A absorbance at 600 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt A at 600 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt A at 600 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt A at 600 nm"
          }
        },
        {
          "id": "scan-record-600-salt-a-action",
          "verb": "record",
          "label": "Record assigned salt A at 600 nm",
          "parameters": {
            "measurementId": "scan-600-salt-a-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [
            {
              "id": "scan-600-salt-a-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-600-salt-a-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt A at 600 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt A at 600 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt A at 600 nm"
          }
        },
        {
          "id": "scan-remove-600-salt-a-action",
          "verb": "place",
          "label": "Remove assigned salt A after 600 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt A after 600 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt A after 600 nm complete.",
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
            "accessibleLabel": "Remove assigned salt A after 600 nm"
          }
        },
        {
          "id": "scan-insert-600-salt-b-action",
          "verb": "place",
          "label": "Insert assigned salt B at 600 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt B at 600 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt B at 600 nm complete.",
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
            "accessibleLabel": "Insert assigned salt B at 600 nm"
          }
        },
        {
          "id": "scan-read-600-salt-b-action",
          "verb": "observe",
          "label": "Read assigned salt B at 600 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "wavelengthMeasurementId": "scan-600-wavelength-nm",
            "measurementId": "scan-600-salt-b-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt B absorbance at 600 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt B at 600 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt B at 600 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt B at 600 nm"
          }
        },
        {
          "id": "scan-record-600-salt-b-action",
          "verb": "record",
          "label": "Record assigned salt B at 600 nm",
          "parameters": {
            "measurementId": "scan-600-salt-b-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [
            {
              "id": "scan-600-salt-b-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-600-salt-b-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt B at 600 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt B at 600 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt B at 600 nm"
          }
        },
        {
          "id": "scan-remove-600-salt-b-action",
          "verb": "place",
          "label": "Remove assigned salt B after 600 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt B after 600 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt B after 600 nm complete.",
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
            "accessibleLabel": "Remove assigned salt B after 600 nm"
          }
        },
        {
          "id": "scan-set-620-action",
          "verb": "observe",
          "label": "Set the source-stated scan wavelength to 620 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "measurementId": "scan-620-wavelength-nm",
            "configurationQuantity": "scan wavelength",
            "configuredValue": 620,
            "unit": "nm",
            "photometricMode": "absorbance",
            "tag": "scan-620-configured"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set the source-stated scan wavelength to 620 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Set the source-stated scan wavelength to 620 nm complete.",
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
            "accessibleLabel": "Set the source-stated scan wavelength to 620 nm"
          }
        },
        {
          "id": "scan-insert-620-salt-a-action",
          "verb": "place",
          "label": "Insert assigned salt A at 620 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt A at 620 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt A at 620 nm complete.",
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
            "accessibleLabel": "Insert assigned salt A at 620 nm"
          }
        },
        {
          "id": "scan-read-620-salt-a-action",
          "verb": "observe",
          "label": "Read assigned salt A at 620 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "wavelengthMeasurementId": "scan-620-wavelength-nm",
            "measurementId": "scan-620-salt-a-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt A absorbance at 620 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt A at 620 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt A at 620 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt A at 620 nm"
          }
        },
        {
          "id": "scan-record-620-salt-a-action",
          "verb": "record",
          "label": "Record assigned salt A at 620 nm",
          "parameters": {
            "measurementId": "scan-620-salt-a-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [
            {
              "id": "scan-620-salt-a-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-620-salt-a-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt A at 620 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt A at 620 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt A at 620 nm"
          }
        },
        {
          "id": "scan-remove-620-salt-a-action",
          "verb": "place",
          "label": "Remove assigned salt A after 620 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt A after 620 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt A after 620 nm complete.",
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
            "accessibleLabel": "Remove assigned salt A after 620 nm"
          }
        },
        {
          "id": "scan-insert-620-salt-b-action",
          "verb": "place",
          "label": "Insert assigned salt B at 620 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt B at 620 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt B at 620 nm complete.",
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
            "accessibleLabel": "Insert assigned salt B at 620 nm"
          }
        },
        {
          "id": "scan-read-620-salt-b-action",
          "verb": "observe",
          "label": "Read assigned salt B at 620 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "wavelengthMeasurementId": "scan-620-wavelength-nm",
            "measurementId": "scan-620-salt-b-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt B absorbance at 620 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt B at 620 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt B at 620 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt B at 620 nm"
          }
        },
        {
          "id": "scan-record-620-salt-b-action",
          "verb": "record",
          "label": "Record assigned salt B at 620 nm",
          "parameters": {
            "measurementId": "scan-620-salt-b-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [
            {
              "id": "scan-620-salt-b-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-620-salt-b-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt B at 620 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt B at 620 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt B at 620 nm"
          }
        },
        {
          "id": "scan-remove-620-salt-b-action",
          "verb": "place",
          "label": "Remove assigned salt B after 620 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt B after 620 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt B after 620 nm complete.",
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
            "accessibleLabel": "Remove assigned salt B after 620 nm"
          }
        },
        {
          "id": "scan-set-640-action",
          "verb": "observe",
          "label": "Set the source-stated scan wavelength to 640 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "measurementId": "scan-640-wavelength-nm",
            "configurationQuantity": "scan wavelength",
            "configuredValue": 640,
            "unit": "nm",
            "photometricMode": "absorbance",
            "tag": "scan-640-configured"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set the source-stated scan wavelength to 640 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Set the source-stated scan wavelength to 640 nm complete.",
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
            "accessibleLabel": "Set the source-stated scan wavelength to 640 nm"
          }
        },
        {
          "id": "scan-insert-640-salt-a-action",
          "verb": "place",
          "label": "Insert assigned salt A at 640 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt A at 640 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt A at 640 nm complete.",
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
            "accessibleLabel": "Insert assigned salt A at 640 nm"
          }
        },
        {
          "id": "scan-read-640-salt-a-action",
          "verb": "observe",
          "label": "Read assigned salt A at 640 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "wavelengthMeasurementId": "scan-640-wavelength-nm",
            "measurementId": "scan-640-salt-a-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt A absorbance at 640 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt A at 640 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt A at 640 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt A at 640 nm"
          }
        },
        {
          "id": "scan-record-640-salt-a-action",
          "verb": "record",
          "label": "Record assigned salt A at 640 nm",
          "parameters": {
            "measurementId": "scan-640-salt-a-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [
            {
              "id": "scan-640-salt-a-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-640-salt-a-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt A at 640 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt A at 640 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt A at 640 nm"
          }
        },
        {
          "id": "scan-remove-640-salt-a-action",
          "verb": "place",
          "label": "Remove assigned salt A after 640 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt A after 640 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt A after 640 nm complete.",
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
            "accessibleLabel": "Remove assigned salt A after 640 nm"
          }
        },
        {
          "id": "scan-insert-640-salt-b-action",
          "verb": "place",
          "label": "Insert assigned salt B at 640 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt B at 640 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt B at 640 nm complete.",
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
            "accessibleLabel": "Insert assigned salt B at 640 nm"
          }
        },
        {
          "id": "scan-read-640-salt-b-action",
          "verb": "observe",
          "label": "Read assigned salt B at 640 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "wavelengthMeasurementId": "scan-640-wavelength-nm",
            "measurementId": "scan-640-salt-b-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt B absorbance at 640 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt B at 640 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt B at 640 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt B at 640 nm"
          }
        },
        {
          "id": "scan-record-640-salt-b-action",
          "verb": "record",
          "label": "Record assigned salt B at 640 nm",
          "parameters": {
            "measurementId": "scan-640-salt-b-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [
            {
              "id": "scan-640-salt-b-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-640-salt-b-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt B at 640 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt B at 640 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt B at 640 nm"
          }
        },
        {
          "id": "scan-remove-640-salt-b-action",
          "verb": "place",
          "label": "Remove assigned salt B after 640 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt B after 640 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt B after 640 nm complete.",
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
            "accessibleLabel": "Remove assigned salt B after 640 nm"
          }
        },
        {
          "id": "scan-set-660-action",
          "verb": "observe",
          "label": "Set the source-stated scan wavelength to 660 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "measurementId": "scan-660-wavelength-nm",
            "configurationQuantity": "scan wavelength",
            "configuredValue": 660,
            "unit": "nm",
            "photometricMode": "absorbance",
            "tag": "scan-660-configured"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set the source-stated scan wavelength to 660 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Set the source-stated scan wavelength to 660 nm complete.",
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
            "accessibleLabel": "Set the source-stated scan wavelength to 660 nm"
          }
        },
        {
          "id": "scan-insert-660-salt-a-action",
          "verb": "place",
          "label": "Insert assigned salt A at 660 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt A at 660 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt A at 660 nm complete.",
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
            "accessibleLabel": "Insert assigned salt A at 660 nm"
          }
        },
        {
          "id": "scan-read-660-salt-a-action",
          "verb": "observe",
          "label": "Read assigned salt A at 660 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "wavelengthMeasurementId": "scan-660-wavelength-nm",
            "measurementId": "scan-660-salt-a-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt A absorbance at 660 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt A at 660 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt A at 660 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt A at 660 nm"
          }
        },
        {
          "id": "scan-record-660-salt-a-action",
          "verb": "record",
          "label": "Record assigned salt A at 660 nm",
          "parameters": {
            "measurementId": "scan-660-salt-a-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [
            {
              "id": "scan-660-salt-a-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-660-salt-a-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt A at 660 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt A at 660 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt A at 660 nm"
          }
        },
        {
          "id": "scan-remove-660-salt-a-action",
          "verb": "place",
          "label": "Remove assigned salt A after 660 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt A after 660 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt A after 660 nm complete.",
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
            "accessibleLabel": "Remove assigned salt A after 660 nm"
          }
        },
        {
          "id": "scan-insert-660-salt-b-action",
          "verb": "place",
          "label": "Insert assigned salt B at 660 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt B at 660 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt B at 660 nm complete.",
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
            "accessibleLabel": "Insert assigned salt B at 660 nm"
          }
        },
        {
          "id": "scan-read-660-salt-b-action",
          "verb": "observe",
          "label": "Read assigned salt B at 660 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "wavelengthMeasurementId": "scan-660-wavelength-nm",
            "measurementId": "scan-660-salt-b-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt B absorbance at 660 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt B at 660 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt B at 660 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt B at 660 nm"
          }
        },
        {
          "id": "scan-record-660-salt-b-action",
          "verb": "record",
          "label": "Record assigned salt B at 660 nm",
          "parameters": {
            "measurementId": "scan-660-salt-b-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [
            {
              "id": "scan-660-salt-b-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-660-salt-b-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt B at 660 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt B at 660 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt B at 660 nm"
          }
        },
        {
          "id": "scan-remove-660-salt-b-action",
          "verb": "place",
          "label": "Remove assigned salt B after 660 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt B after 660 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt B after 660 nm complete.",
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
            "accessibleLabel": "Remove assigned salt B after 660 nm"
          }
        },
        {
          "id": "scan-set-680-action",
          "verb": "observe",
          "label": "Set the source-stated scan wavelength to 680 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "measurementId": "scan-680-wavelength-nm",
            "configurationQuantity": "scan wavelength",
            "configuredValue": 680,
            "unit": "nm",
            "photometricMode": "absorbance",
            "tag": "scan-680-configured"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set the source-stated scan wavelength to 680 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Set the source-stated scan wavelength to 680 nm complete.",
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
            "accessibleLabel": "Set the source-stated scan wavelength to 680 nm"
          }
        },
        {
          "id": "scan-insert-680-salt-a-action",
          "verb": "place",
          "label": "Insert assigned salt A at 680 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt A at 680 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt A at 680 nm complete.",
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
            "accessibleLabel": "Insert assigned salt A at 680 nm"
          }
        },
        {
          "id": "scan-read-680-salt-a-action",
          "verb": "observe",
          "label": "Read assigned salt A at 680 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "wavelengthMeasurementId": "scan-680-wavelength-nm",
            "measurementId": "scan-680-salt-a-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt A absorbance at 680 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt A at 680 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt A at 680 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt A at 680 nm"
          }
        },
        {
          "id": "scan-record-680-salt-a-action",
          "verb": "record",
          "label": "Record assigned salt A at 680 nm",
          "parameters": {
            "measurementId": "scan-680-salt-a-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [
            {
              "id": "scan-680-salt-a-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-680-salt-a-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt A at 680 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt A at 680 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt A at 680 nm"
          }
        },
        {
          "id": "scan-remove-680-salt-a-action",
          "verb": "place",
          "label": "Remove assigned salt A after 680 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt A after 680 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt A after 680 nm complete.",
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
            "accessibleLabel": "Remove assigned salt A after 680 nm"
          }
        },
        {
          "id": "scan-insert-680-salt-b-action",
          "verb": "place",
          "label": "Insert assigned salt B at 680 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt B at 680 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt B at 680 nm complete.",
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
            "accessibleLabel": "Insert assigned salt B at 680 nm"
          }
        },
        {
          "id": "scan-read-680-salt-b-action",
          "verb": "observe",
          "label": "Read assigned salt B at 680 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "wavelengthMeasurementId": "scan-680-wavelength-nm",
            "measurementId": "scan-680-salt-b-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt B absorbance at 680 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt B at 680 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt B at 680 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt B at 680 nm"
          }
        },
        {
          "id": "scan-record-680-salt-b-action",
          "verb": "record",
          "label": "Record assigned salt B at 680 nm",
          "parameters": {
            "measurementId": "scan-680-salt-b-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [
            {
              "id": "scan-680-salt-b-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-680-salt-b-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt B at 680 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt B at 680 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt B at 680 nm"
          }
        },
        {
          "id": "scan-remove-680-salt-b-action",
          "verb": "place",
          "label": "Remove assigned salt B after 680 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt B after 680 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt B after 680 nm complete.",
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
            "accessibleLabel": "Remove assigned salt B after 680 nm"
          }
        },
        {
          "id": "scan-set-700-action",
          "verb": "observe",
          "label": "Set the source-stated scan wavelength to 700 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "measurementId": "scan-700-wavelength-nm",
            "configurationQuantity": "scan wavelength",
            "configuredValue": 700,
            "unit": "nm",
            "photometricMode": "absorbance",
            "tag": "scan-700-configured"
          },
          "prerequisites": [],
          "stateChanges": [
            "Set the source-stated scan wavelength to 700 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Set the source-stated scan wavelength to 700 nm complete.",
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
            "accessibleLabel": "Set the source-stated scan wavelength to 700 nm"
          }
        },
        {
          "id": "scan-insert-700-salt-a-action",
          "verb": "place",
          "label": "Insert assigned salt A at 700 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt A at 700 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt A at 700 nm complete.",
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
            "accessibleLabel": "Insert assigned salt A at 700 nm"
          }
        },
        {
          "id": "scan-read-700-salt-a-action",
          "verb": "observe",
          "label": "Read assigned salt A at 700 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-a-scan-cuvette",
            "wavelengthMeasurementId": "scan-700-wavelength-nm",
            "measurementId": "scan-700-salt-a-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt A absorbance at 700 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt A at 700 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt A at 700 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt A at 700 nm"
          }
        },
        {
          "id": "scan-record-700-salt-a-action",
          "verb": "record",
          "label": "Record assigned salt A at 700 nm",
          "parameters": {
            "measurementId": "scan-700-salt-a-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [
            {
              "id": "scan-700-salt-a-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-700-salt-a-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt A at 700 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt A at 700 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt A at 700 nm"
          }
        },
        {
          "id": "scan-remove-700-salt-a-action",
          "verb": "place",
          "label": "Remove assigned salt A after 700 nm",
          "parameters": {
            "equipmentInstanceId": "salt-a-scan-cuvette",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt A after 700 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt A after 700 nm complete.",
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
            "accessibleLabel": "Remove assigned salt A after 700 nm"
          }
        },
        {
          "id": "scan-insert-700-salt-b-action",
          "verb": "place",
          "label": "Insert assigned salt B at 700 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "spectrophotometer",
            "snapZoneId": "spectrophotometer-cuvette-slot",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Insert assigned salt B at 700 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Insert assigned salt B at 700 nm complete.",
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
            "accessibleLabel": "Insert assigned salt B at 700 nm"
          }
        },
        {
          "id": "scan-read-700-salt-b-action",
          "verb": "observe",
          "label": "Read assigned salt B at 700 nm",
          "parameters": {
            "photometerInstanceId": "spectrophotometer",
            "cuvetteInstanceId": "salt-b-scan-cuvette",
            "wavelengthMeasurementId": "scan-700-wavelength-nm",
            "measurementId": "scan-700-salt-b-absorbance",
            "photometricQuantity": "absorbance",
            "unit": "absorbance",
            "photometerOperation": "read",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Assigned-salt B absorbance at 700 nm",
            "inputMin": 0
          },
          "prerequisites": [],
          "stateChanges": [
            "Read assigned salt B at 700 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Read assigned salt B at 700 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.observe.read-photometer",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "spectrophotometer",
            "stationId": "spectrophotometer",
            "accessibleLabel": "Read assigned salt B at 700 nm"
          }
        },
        {
          "id": "scan-record-700-salt-b-action",
          "verb": "record",
          "label": "Record assigned salt B at 700 nm",
          "parameters": {
            "measurementId": "scan-700-salt-b-absorbance",
            "unit": "absorbance",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [
            {
              "id": "scan-700-salt-b-absorbance-required",
              "type": "measurementRecorded",
              "label": "The matching scan reading exists",
              "measurementId": "scan-700-salt-b-absorbance"
            }
          ],
          "stateChanges": [
            "Record assigned salt B at 700 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Record assigned salt B at 700 nm complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.record.photometer-reading",
          "equipmentRoleBindings": {
            "photometer-instrument": "spectrophotometer"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Record assigned salt B at 700 nm"
          }
        },
        {
          "id": "scan-remove-700-salt-b-action",
          "verb": "place",
          "label": "Remove assigned salt B after 700 nm",
          "parameters": {
            "equipmentInstanceId": "salt-b-scan-cuvette",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Remove assigned salt B after 700 nm: completed with the named sample and configuration provenance preserved."
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
            "success": "Remove assigned salt B after 700 nm complete.",
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
            "accessibleLabel": "Remove assigned salt B after 700 nm"
          }
        },
        {
          "id": "scan-return-salt-a-after-series-action",
          "verb": "transfer",
          "label": "Return assigned salt A after the scan series",
          "parameters": {
            "sourceInstanceId": "salt-a-scan-cuvette",
            "targetInstanceId": "assigned-salt-a-solution",
            "sampleIdentity": "assigned-salt-a"
          },
          "prerequisites": [],
          "stateChanges": [
            "Return assigned salt A after the scan series: completed with the named sample and configuration provenance preserved."
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
            "success": "Return assigned salt A after the scan series complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.transfer.return-cuvette-to-origin",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette",
            "provenance-matched-sample-receiver": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Return assigned salt A after the scan series"
          },
          "volume": {
            "source": "literal",
            "valueMl": 3
          }
        },
        {
          "id": "scan-return-salt-b-after-series-action",
          "verb": "transfer",
          "label": "Return assigned salt B after the scan series",
          "parameters": {
            "sourceInstanceId": "salt-b-scan-cuvette",
            "targetInstanceId": "assigned-salt-b-solution",
            "sampleIdentity": "assigned-salt-b"
          },
          "prerequisites": [],
          "stateChanges": [
            "Return assigned salt B after the scan series: completed with the named sample and configuration provenance preserved."
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
            "success": "Return assigned salt B after the scan series complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "atomId": "atom.transfer.return-cuvette-to-origin",
          "equipmentRoleBindings": {
            "photometer-sample-holder": "cuvette",
            "provenance-matched-sample-receiver": "test-tube"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Return assigned salt B after the scan series"
          },
          "volume": {
            "source": "literal",
            "valueMl": 3
          }
        },
        {
          "id": "fill-color-depth-unknown-action",
          "verb": "transfer",
          "label": "Fill the comparison unknown tube",
          "parameters": {
            "sourceDefinitionId": "test-tube",
            "sourceInstanceId": "unknown-sample-tube",
            "targetDefinitionId": "test-tube",
            "targetInstanceId": "color-depth-unknown-tube",
            "sampleIdentity": "unknown",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Fill the comparison unknown tube portion (mL)",
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "mL"
          },
          "prerequisites": [],
          "stateChanges": [
            "Fill the comparison unknown tube: completed with the named sample and configuration provenance preserved."
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
            "success": "Fill the comparison unknown tube complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Fill the comparison unknown tube"
          },
          "volume": {
            "source": "action-input"
          }
        },
        {
          "id": "fill-color-depth-standard-action",
          "verb": "transfer",
          "label": "Fill the comparison 0.400 M standard tube",
          "parameters": {
            "sourceDefinitionId": "test-tube",
            "sourceInstanceId": "standard-0p400-tube",
            "targetDefinitionId": "test-tube",
            "targetInstanceId": "color-depth-standard-tube",
            "sampleIdentity": "0p400",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Fill the comparison 0.400 M standard tube portion (mL)",
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "mL"
          },
          "prerequisites": [],
          "stateChanges": [
            "Fill the comparison 0.400 M standard tube: completed with the named sample and configuration provenance preserved."
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
            "success": "Fill the comparison 0.400 M standard tube complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Fill the comparison 0.400 M standard tube"
          },
          "volume": {
            "source": "action-input"
          }
        },
        {
          "id": "collect-0p0250-waste-action",
          "verb": "transfer",
          "label": "Collect remaining 0p0250 M standard solution in the treatment beaker",
          "parameters": {
            "sourceDefinitionId": "test-tube",
            "sourceInstanceId": "standard-0p0250-tube",
            "targetDefinitionId": "waste-beaker",
            "targetInstanceId": "waste-beaker",
            "sampleIdentity": "0p0250"
          },
          "prerequisites": [],
          "stateChanges": [
            "Collect remaining 0p0250 M standard solution in the treatment beaker: completed with the named sample and configuration provenance preserved."
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
            "success": "Collect remaining 0p0250 M standard solution in the treatment beaker complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "waste-beaker",
            "accessibleLabel": "Collect remaining 0p0250 M standard solution in the treatment beaker"
          }
        },
        {
          "id": "collect-0p0500-waste-action",
          "verb": "transfer",
          "label": "Collect remaining 0p0500 M standard solution in the treatment beaker",
          "parameters": {
            "sourceDefinitionId": "test-tube",
            "sourceInstanceId": "standard-0p0500-tube",
            "targetDefinitionId": "waste-beaker",
            "targetInstanceId": "waste-beaker",
            "sampleIdentity": "0p0500"
          },
          "prerequisites": [],
          "stateChanges": [
            "Collect remaining 0p0500 M standard solution in the treatment beaker: completed with the named sample and configuration provenance preserved."
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
            "success": "Collect remaining 0p0500 M standard solution in the treatment beaker complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "waste-beaker",
            "accessibleLabel": "Collect remaining 0p0500 M standard solution in the treatment beaker"
          }
        },
        {
          "id": "collect-0p100-waste-action",
          "verb": "transfer",
          "label": "Collect remaining 0p100 M standard solution in the treatment beaker",
          "parameters": {
            "sourceDefinitionId": "test-tube",
            "sourceInstanceId": "standard-0p100-tube",
            "targetDefinitionId": "waste-beaker",
            "targetInstanceId": "waste-beaker",
            "sampleIdentity": "0p100"
          },
          "prerequisites": [],
          "stateChanges": [
            "Collect remaining 0p100 M standard solution in the treatment beaker: completed with the named sample and configuration provenance preserved."
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
            "success": "Collect remaining 0p100 M standard solution in the treatment beaker complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "waste-beaker",
            "accessibleLabel": "Collect remaining 0p100 M standard solution in the treatment beaker"
          }
        },
        {
          "id": "collect-0p200-waste-action",
          "verb": "transfer",
          "label": "Collect remaining 0p200 M standard solution in the treatment beaker",
          "parameters": {
            "sourceDefinitionId": "test-tube",
            "sourceInstanceId": "standard-0p200-tube",
            "targetDefinitionId": "waste-beaker",
            "targetInstanceId": "waste-beaker",
            "sampleIdentity": "0p200"
          },
          "prerequisites": [],
          "stateChanges": [
            "Collect remaining 0p200 M standard solution in the treatment beaker: completed with the named sample and configuration provenance preserved."
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
            "success": "Collect remaining 0p200 M standard solution in the treatment beaker complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "waste-beaker",
            "accessibleLabel": "Collect remaining 0p200 M standard solution in the treatment beaker"
          }
        },
        {
          "id": "collect-0p400-waste-action",
          "verb": "transfer",
          "label": "Collect remaining 0p400 M standard solution in the treatment beaker",
          "parameters": {
            "sourceDefinitionId": "test-tube",
            "sourceInstanceId": "standard-0p400-tube",
            "targetDefinitionId": "waste-beaker",
            "targetInstanceId": "waste-beaker",
            "sampleIdentity": "0p400"
          },
          "prerequisites": [],
          "stateChanges": [
            "Collect remaining 0p400 M standard solution in the treatment beaker: completed with the named sample and configuration provenance preserved."
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
            "success": "Collect remaining 0p400 M standard solution in the treatment beaker complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "waste-beaker",
            "accessibleLabel": "Collect remaining 0p400 M standard solution in the treatment beaker"
          }
        },
        {
          "id": "collect-unknown-waste-action",
          "verb": "transfer",
          "label": "Collect remaining unknown solution in the treatment beaker",
          "parameters": {
            "sourceDefinitionId": "test-tube",
            "sourceInstanceId": "unknown-sample-tube",
            "targetDefinitionId": "waste-beaker",
            "targetInstanceId": "waste-beaker",
            "sampleIdentity": "unknown"
          },
          "prerequisites": [],
          "stateChanges": [
            "Collect remaining unknown solution in the treatment beaker: completed with the named sample and configuration provenance preserved."
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
            "success": "Collect remaining unknown solution in the treatment beaker complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "waste-beaker",
            "accessibleLabel": "Collect remaining unknown solution in the treatment beaker"
          }
        },
        {
          "id": "observe-waste-bubbling-action",
          "verb": "observe",
          "label": "Observe bubbling after this bicarbonate portion",
          "parameters": {
            "inputMode": "choice",
            "inputRole": "studentResponse",
            "inputLabel": "Observed waste response"
          },
          "prerequisites": [],
          "stateChanges": [
            "Observe bubbling after this bicarbonate portion: completed with the named sample and configuration provenance preserved."
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
            "success": "Observe bubbling after this bicarbonate portion complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "tag",
            "accessibleLabel": "Observe bubbling after this bicarbonate portion"
          },
          "choiceObservation": {
            "outputCalculationId": "waste-bubbling-disposition",
            "options": [
              {
                "label": "Active bubbling continues",
                "tag": "active-bubbling",
                "value": 0
              },
              {
                "label": "Bubbling has subsided",
                "tag": "bubbling-subsided",
                "value": 1
              }
            ]
          }
        },
        {
          "id": "classify-waste-ph-action",
          "verb": "observe",
          "label": "Classify the measured pH for treatment or teacher-directed disposal",
          "parameters": {
            "inputMode": "choice",
            "inputRole": "studentResponse",
            "inputLabel": "Disposition from the recorded pH"
          },
          "prerequisites": [
            {
              "id": "ph-disposition-needs-reading",
              "type": "measurementRecorded",
              "label": "A fresh pH-paper reading exists",
              "measurementId": "neutralized-waste-ph"
            }
          ],
          "stateChanges": [
            "Classify the measured pH for treatment or teacher-directed disposal: completed with the named sample and configuration provenance preserved."
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
            "success": "Classify the measured pH for treatment or teacher-directed disposal complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "tag",
            "accessibleLabel": "Classify the measured pH for treatment or teacher-directed disposal"
          },
          "choiceObservation": {
            "outputCalculationId": "waste-ph-disposition",
            "options": [
              {
                "label": "Recorded pH is outside 5-9; retreat and read again",
                "tag": "ph-retreat-required",
                "value": 0
              },
              {
                "label": "Recorded pH is within 5-9",
                "tag": "ph-within-source-range",
                "value": 1
              }
            ]
          }
        },
        {
          "id": "confirm-waste-ready-for-disposal-action",
          "verb": "record",
          "label": "Confirm treated waste is ready for teacher-directed disposal",
          "parameters": {
            "tag": "waste-ph-within-range",
            "note": "The recorded pH is within the source-stated 5-9 range and active bubbling has subsided."
          },
          "prerequisites": [
            {
              "id": "waste-ready-needs-ph-disposition",
              "type": "actionEvidence",
              "label": "The pH disposition was recorded",
              "actionId": "classify-waste-ph-action"
            }
          ],
          "stateChanges": [
            "Confirm treated waste is ready for teacher-directed disposal: completed with the named sample and configuration provenance preserved."
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
            "success": "Confirm treated waste is ready for teacher-directed disposal complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "tag",
            "accessibleLabel": "Confirm treated waste is ready for teacher-directed disposal"
          }
        },
        {
          "id": "transfer-treated-waste-to-destination-action",
          "verb": "transfer",
          "label": "Transfer treated waste to the teacher-designated destination",
          "parameters": {
            "sourceDefinitionId": "waste-beaker",
            "sourceInstanceId": "waste-beaker",
            "targetDefinitionId": "waste-beaker",
            "targetInstanceId": "teacher-designated-disposal-receiver",
            "requiresNotebookTag": "teacher-disposal-gate",
            "destinationProvenance": "teacher-configured"
          },
          "prerequisites": [
            {
              "id": "final-disposal-needs-teacher-destination",
              "type": "notebookEntry",
              "label": "Teacher recorded the local destination",
              "notebookTag": "teacher-disposal-gate"
            }
          ],
          "stateChanges": [
            "Transfer treated waste to the teacher-designated destination: completed with the named sample and configuration provenance preserved."
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
            "success": "Transfer treated waste to the teacher-designated destination complete.",
            "invalid": "Check the named sample, equipment binding, configuration evidence, and operation order."
          },
          "evidence": [],
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "waste-beaker",
            "targetDefinitionId": "waste-beaker",
            "accessibleLabel": "Transfer treated waste to the teacher-designated destination"
          }
        }
      ],
      "process": {
        "startNodeId": "scan-place-photometer-action-node",
        "nodes": [
          {
            "id": "tare-empty-beaker",
            "type": "action",
            "title": "Tare the empty brass beaker",
            "description": "Place the clean, dry, empty beaker on the analytical balance and tare it before adding brass.",
            "actionId": "tare-empty-beaker-action",
            "config": {},
            "validation": [
              {
                "id": "tare-empty-beaker-complete",
                "type": "actionEvidence",
                "label": "Tare the empty brass beaker was completed.",
                "actionId": "tare-empty-beaker-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Tare the empty brass beaker evidence accepted.",
              "retry": "Review Tare the empty brass beaker and try again."
            }
          },
          {
            "id": "place-brass-in-beaker",
            "type": "action",
            "title": "Add brass to the tared beaker",
            "description": "Transfer the entire configured 1-2 g brass sample from its vial into the tared beaker without losing pieces.",
            "actionId": "place-brass-in-beaker-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "place-brass-in-beaker-complete",
                "type": "actionEvidence",
                "label": "Add brass to the tared beaker was completed.",
                "actionId": "place-brass-in-beaker-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Add brass to the tared beaker evidence accepted.",
              "retry": "Review Add brass to the tared beaker and try again."
            }
          },
          {
            "id": "weigh-brass",
            "type": "action",
            "title": "Read the brass mass",
            "description": "Return the tared beaker containing 1-2 g brass to the analytical balance and read the net brass mass to +/-0.001 g.",
            "actionId": "weigh-brass-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "weigh-brass-complete",
                "type": "actionEvidence",
                "label": "Read the brass mass was completed.",
                "actionId": "weigh-brass-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read the brass mass evidence accepted.",
              "retry": "Review Read the brass mass and try again."
            }
          },
          {
            "id": "transfer-digest",
            "type": "action",
            "title": "Transfer the brass digest",
            "description": "Quantitatively pour the teacher-diluted digest from the beaker into the 100 mL volumetric flask.",
            "actionId": "transfer-digest-action",
            "config": {},
            "validation": [
              {
                "id": "transfer-digest-complete",
                "type": "actionEvidence",
                "label": "Transfer the brass digest was completed.",
                "actionId": "transfer-digest-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Transfer the brass digest evidence accepted.",
              "retry": "Review Transfer the brass digest and try again."
            }
          },
          {
            "id": "rinse-beaker-1",
            "type": "action",
            "title": "Rinse the digest beaker (1/4)",
            "description": "Use 5 mL distilled water to wash all inner surfaces so copper solution is not left behind.",
            "actionId": "rinse-beaker-1-action",
            "config": {},
            "validation": [
              {
                "id": "rinse-beaker-1-complete",
                "type": "actionEvidence",
                "label": "Rinse the digest beaker (1/4) was completed.",
                "actionId": "rinse-beaker-1-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Rinse the digest beaker (1/4) evidence accepted.",
              "retry": "Review Rinse the digest beaker (1/4) and try again."
            }
          },
          {
            "id": "transfer-rinse-1",
            "type": "action",
            "title": "Transfer washings (1/4)",
            "description": "Pour this 5 mL rinse into the same 100 mL volumetric flask.",
            "actionId": "transfer-rinse-1-action",
            "config": {},
            "validation": [
              {
                "id": "transfer-rinse-1-complete",
                "type": "actionEvidence",
                "label": "Transfer washings (1/4) was completed.",
                "actionId": "transfer-rinse-1-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Transfer washings (1/4) evidence accepted.",
              "retry": "Review Transfer washings (1/4) and try again."
            }
          },
          {
            "id": "rinse-beaker-2",
            "type": "action",
            "title": "Rinse the digest beaker (2/4)",
            "description": "Use 5 mL distilled water to wash all inner surfaces so copper solution is not left behind.",
            "actionId": "rinse-beaker-2-action",
            "config": {},
            "validation": [
              {
                "id": "rinse-beaker-2-complete",
                "type": "actionEvidence",
                "label": "Rinse the digest beaker (2/4) was completed.",
                "actionId": "rinse-beaker-2-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Rinse the digest beaker (2/4) evidence accepted.",
              "retry": "Review Rinse the digest beaker (2/4) and try again."
            }
          },
          {
            "id": "transfer-rinse-2",
            "type": "action",
            "title": "Transfer washings (2/4)",
            "description": "Pour this 5 mL rinse into the same 100 mL volumetric flask.",
            "actionId": "transfer-rinse-2-action",
            "config": {},
            "validation": [
              {
                "id": "transfer-rinse-2-complete",
                "type": "actionEvidence",
                "label": "Transfer washings (2/4) was completed.",
                "actionId": "transfer-rinse-2-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Transfer washings (2/4) evidence accepted.",
              "retry": "Review Transfer washings (2/4) and try again."
            }
          },
          {
            "id": "rinse-beaker-3",
            "type": "action",
            "title": "Rinse the digest beaker (3/4)",
            "description": "Use 5 mL distilled water to wash all inner surfaces so copper solution is not left behind.",
            "actionId": "rinse-beaker-3-action",
            "config": {},
            "validation": [
              {
                "id": "rinse-beaker-3-complete",
                "type": "actionEvidence",
                "label": "Rinse the digest beaker (3/4) was completed.",
                "actionId": "rinse-beaker-3-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Rinse the digest beaker (3/4) evidence accepted.",
              "retry": "Review Rinse the digest beaker (3/4) and try again."
            }
          },
          {
            "id": "transfer-rinse-3",
            "type": "action",
            "title": "Transfer washings (3/4)",
            "description": "Pour this 5 mL rinse into the same 100 mL volumetric flask.",
            "actionId": "transfer-rinse-3-action",
            "config": {},
            "validation": [
              {
                "id": "transfer-rinse-3-complete",
                "type": "actionEvidence",
                "label": "Transfer washings (3/4) was completed.",
                "actionId": "transfer-rinse-3-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Transfer washings (3/4) evidence accepted.",
              "retry": "Review Transfer washings (3/4) and try again."
            }
          },
          {
            "id": "rinse-beaker-4",
            "type": "action",
            "title": "Rinse the digest beaker (4/4)",
            "description": "Use 5 mL distilled water to wash all inner surfaces so copper solution is not left behind.",
            "actionId": "rinse-beaker-4-action",
            "config": {},
            "validation": [
              {
                "id": "rinse-beaker-4-complete",
                "type": "actionEvidence",
                "label": "Rinse the digest beaker (4/4) was completed.",
                "actionId": "rinse-beaker-4-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Rinse the digest beaker (4/4) evidence accepted.",
              "retry": "Review Rinse the digest beaker (4/4) and try again."
            }
          },
          {
            "id": "transfer-rinse-4",
            "type": "action",
            "title": "Transfer washings (4/4)",
            "description": "Pour this 5 mL rinse into the same 100 mL volumetric flask.",
            "actionId": "transfer-rinse-4-action",
            "config": {},
            "validation": [
              {
                "id": "transfer-rinse-4-complete",
                "type": "actionEvidence",
                "label": "Transfer washings (4/4) was completed.",
                "actionId": "transfer-rinse-4-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Transfer washings (4/4) evidence accepted.",
              "retry": "Review Transfer washings (4/4) and try again."
            }
          },
          {
            "id": "dilute-unknown-to-mark",
            "type": "action",
            "title": "Dilute the unknown to 100.0 mL",
            "description": "Add distilled water until the bottom of the meniscus is on the 100.0 mL mark; do not stop below or above the line.",
            "actionId": "dilute-unknown-to-mark-action",
            "config": {},
            "validation": [
              {
                "id": "dilute-unknown-to-mark-complete",
                "type": "actionEvidence",
                "label": "Dilute the unknown to 100.0 mL was completed.",
                "actionId": "dilute-unknown-to-mark-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Dilute the unknown to 100.0 mL evidence accepted.",
              "retry": "Review Dilute the unknown to 100.0 mL and try again."
            }
          },
          {
            "id": "standard-0p400-stock-transfer",
            "type": "action",
            "title": "Transfer stock for 0.400 M standard",
            "description": "Transfer 10.00 mL of 0.400 M stock into its clean labeled tube.",
            "actionId": "standard-0p400-stock-transfer-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "standard-0p400-stock-transfer-complete",
                "type": "actionEvidence",
                "label": "Transfer stock for 0.400 M standard was completed.",
                "actionId": "standard-0p400-stock-transfer-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Transfer stock for 0.400 M standard evidence accepted.",
              "retry": "Review Transfer stock for 0.400 M standard and try again."
            }
          },
          {
            "id": "standard-0p200-stock-transfer",
            "type": "action",
            "title": "Transfer stock for 0.200 M standard",
            "description": "Transfer 5.00 mL of 0.400 M stock into its clean labeled tube.",
            "actionId": "standard-0p200-stock-transfer-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "standard-0p200-stock-transfer-complete",
                "type": "actionEvidence",
                "label": "Transfer stock for 0.200 M standard was completed.",
                "actionId": "standard-0p200-stock-transfer-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Transfer stock for 0.200 M standard evidence accepted.",
              "retry": "Review Transfer stock for 0.200 M standard and try again."
            }
          },
          {
            "id": "standard-0p200-dilute",
            "type": "action",
            "title": "Dilute the 0.200 M standard",
            "description": "Add 5.00 mL water to the configured 10.00 mL final volume and mix.",
            "actionId": "standard-0p200-dilute-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "standard-0p200-dilute-complete",
                "type": "actionEvidence",
                "label": "Dilute the 0.200 M standard was completed.",
                "actionId": "standard-0p200-dilute-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Dilute the 0.200 M standard evidence accepted.",
              "retry": "Review Dilute the 0.200 M standard and try again."
            }
          },
          {
            "id": "standard-0p100-stock-transfer",
            "type": "action",
            "title": "Transfer stock for 0.100 M standard",
            "description": "Transfer 2.50 mL of 0.400 M stock into its clean labeled tube.",
            "actionId": "standard-0p100-stock-transfer-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "standard-0p100-stock-transfer-complete",
                "type": "actionEvidence",
                "label": "Transfer stock for 0.100 M standard was completed.",
                "actionId": "standard-0p100-stock-transfer-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Transfer stock for 0.100 M standard evidence accepted.",
              "retry": "Review Transfer stock for 0.100 M standard and try again."
            }
          },
          {
            "id": "standard-0p100-dilute",
            "type": "action",
            "title": "Dilute the 0.100 M standard",
            "description": "Add 7.500 mL water to the configured 10.00 mL final volume and mix.",
            "actionId": "standard-0p100-dilute-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "standard-0p100-dilute-complete",
                "type": "actionEvidence",
                "label": "Dilute the 0.100 M standard was completed.",
                "actionId": "standard-0p100-dilute-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Dilute the 0.100 M standard evidence accepted.",
              "retry": "Review Dilute the 0.100 M standard and try again."
            }
          },
          {
            "id": "standard-0p0500-stock-transfer",
            "type": "action",
            "title": "Transfer stock for 0.0500 M standard",
            "description": "Transfer 1.25 mL of 0.400 M stock into its clean labeled tube.",
            "actionId": "standard-0p0500-stock-transfer-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "standard-0p0500-stock-transfer-complete",
                "type": "actionEvidence",
                "label": "Transfer stock for 0.0500 M standard was completed.",
                "actionId": "standard-0p0500-stock-transfer-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Transfer stock for 0.0500 M standard evidence accepted.",
              "retry": "Review Transfer stock for 0.0500 M standard and try again."
            }
          },
          {
            "id": "standard-0p0500-dilute",
            "type": "action",
            "title": "Dilute the 0.0500 M standard",
            "description": "Add 8.750 mL water to the configured 10.00 mL final volume and mix.",
            "actionId": "standard-0p0500-dilute-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "standard-0p0500-dilute-complete",
                "type": "actionEvidence",
                "label": "Dilute the 0.0500 M standard was completed.",
                "actionId": "standard-0p0500-dilute-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Dilute the 0.0500 M standard evidence accepted.",
              "retry": "Review Dilute the 0.0500 M standard and try again."
            }
          },
          {
            "id": "standard-0p0250-stock-transfer",
            "type": "action",
            "title": "Transfer stock for 0.0250 M standard",
            "description": "Transfer 0.625 mL of 0.400 M stock into its clean labeled tube.",
            "actionId": "standard-0p0250-stock-transfer-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "standard-0p0250-stock-transfer-complete",
                "type": "actionEvidence",
                "label": "Transfer stock for 0.0250 M standard was completed.",
                "actionId": "standard-0p0250-stock-transfer-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Transfer stock for 0.0250 M standard evidence accepted.",
              "retry": "Review Transfer stock for 0.0250 M standard and try again."
            }
          },
          {
            "id": "standard-0p0250-dilute",
            "type": "action",
            "title": "Dilute the 0.0250 M standard",
            "description": "Add 9.375 mL water to the configured 10.00 mL final volume and mix.",
            "actionId": "standard-0p0250-dilute-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "standard-0p0250-dilute-complete",
                "type": "actionEvidence",
                "label": "Dilute the 0.0250 M standard was completed.",
                "actionId": "standard-0p0250-dilute-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Dilute the 0.0250 M standard evidence accepted.",
              "retry": "Review Dilute the 0.0250 M standard and try again."
            }
          },
          {
            "id": "calibrate-zero-percent-t",
            "type": "observation",
            "title": "Set 0% transmittance",
            "description": "With no cuvette in the light path, set the spectrophotometer to 0%T at the approved wavelength.",
            "actionId": "calibrate-zero-percent-t-action",
            "config": {},
            "validation": [
              {
                "id": "calibrate-zero-percent-t-complete",
                "type": "actionEvidence",
                "label": "Set 0% transmittance was completed.",
                "actionId": "calibrate-zero-percent-t-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set 0% transmittance evidence accepted.",
              "retry": "Review Set 0% transmittance and try again."
            }
          },
          {
            "id": "prepare-blank",
            "type": "action",
            "title": "Prepare the distilled-water blank",
            "description": "Fill the cuvette about three-quarters with distilled water, wipe the exterior, and keep the configured clear-face orientation.",
            "actionId": "prepare-blank-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "prepare-blank-complete",
                "type": "actionEvidence",
                "label": "Prepare the distilled-water blank was completed.",
                "actionId": "prepare-blank-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Prepare the distilled-water blank evidence accepted.",
              "retry": "Review Prepare the distilled-water blank and try again."
            }
          },
          {
            "id": "blank-wipe-orient",
            "type": "observation",
            "title": "Wipe and orient the blank cuvette",
            "description": "Use lint-free tissue on the clear optical faces, align the teacher-configured orientation mark, insert without touching the optical faces, and close the lid.",
            "actionId": "blank-wipe-orient-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "blank-wipe-orient-complete",
                "type": "actionEvidence",
                "label": "Wipe and orient the blank cuvette was completed.",
                "actionId": "blank-wipe-orient-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Wipe and orient the blank cuvette evidence accepted.",
              "retry": "Review Wipe and orient the blank cuvette and try again."
            }
          },
          {
            "id": "insert-blank",
            "type": "action",
            "title": "Insert the blank cuvette",
            "description": "Place the prepared blank into the spectrophotometer cuvette slot using the accessible snap target.",
            "actionId": "insert-blank-action",
            "config": {},
            "validation": [
              {
                "id": "insert-blank-complete",
                "type": "actionEvidence",
                "label": "Insert the blank cuvette was completed.",
                "actionId": "insert-blank-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert the blank cuvette evidence accepted.",
              "retry": "Review Insert the blank cuvette and try again."
            }
          },
          {
            "id": "calibrate-hundred-percent-t",
            "type": "observation",
            "title": "Set 100% transmittance",
            "description": "With the distilled-water blank inserted and the lid closed, set 100%T at the approved wavelength.",
            "actionId": "calibrate-hundred-percent-t-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "calibrate-hundred-percent-t-complete",
                "type": "actionEvidence",
                "label": "Set 100% transmittance was completed.",
                "actionId": "calibrate-hundred-percent-t-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set 100% transmittance evidence accepted.",
              "retry": "Review Set 100% transmittance and try again."
            }
          },
          {
            "id": "remove-blank",
            "type": "action",
            "title": "Remove the blank cuvette",
            "description": "Clear the sample compartment before conditioning the first standard.",
            "actionId": "remove-blank-action",
            "config": {},
            "validation": [
              {
                "id": "remove-blank-complete",
                "type": "actionEvidence",
                "label": "The blank cuvette was removed.",
                "actionId": "remove-blank-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "The blank cuvette is removed and the sample compartment is ready.",
              "retry": "Remove the named blank cuvette before preparing the first standard."
            }
          },
          {
            "id": "condition-0p0250",
            "type": "observation",
            "title": "Condition the cuvette with the 0.0250 M standard",
            "description": "Empty the prior contents, rinse twice with approximately 1 mL of this sample, fill about three-quarters, wipe the optical faces, preserve orientation, insert, and close the lid.",
            "actionId": "condition-0p0250-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "condition-0p0250-complete",
                "type": "actionEvidence",
                "label": "Condition the cuvette with the 0.0250 M standard was completed.",
                "actionId": "condition-0p0250-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Condition the cuvette with the 0.0250 M standard evidence accepted.",
              "retry": "Review Condition the cuvette with the 0.0250 M standard and try again."
            }
          },
          {
            "id": "return-0p0250",
            "type": "observation",
            "title": "Return the 0.0250 M standard",
            "description": "Return the cuvette contents to the original labeled tube before conditioning with the next solution.",
            "actionId": "return-0p0250-action",
            "config": {},
            "validation": [
              {
                "id": "return-0p0250-complete",
                "type": "actionEvidence",
                "label": "Return the 0.0250 M standard was completed.",
                "actionId": "return-0p0250-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Return the 0.0250 M standard evidence accepted.",
              "retry": "Review Return the 0.0250 M standard and try again."
            }
          },
          {
            "id": "condition-0p0500",
            "type": "observation",
            "title": "Condition the cuvette with the 0.0500 M standard",
            "description": "Empty the prior contents, rinse twice with approximately 1 mL of this sample, fill about three-quarters, wipe the optical faces, preserve orientation, insert, and close the lid.",
            "actionId": "condition-0p0500-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "condition-0p0500-complete",
                "type": "actionEvidence",
                "label": "Condition the cuvette with the 0.0500 M standard was completed.",
                "actionId": "condition-0p0500-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Condition the cuvette with the 0.0500 M standard evidence accepted.",
              "retry": "Review Condition the cuvette with the 0.0500 M standard and try again."
            }
          },
          {
            "id": "return-0p0500",
            "type": "observation",
            "title": "Return the 0.0500 M standard",
            "description": "Return the cuvette contents to the original labeled tube before conditioning with the next solution.",
            "actionId": "return-0p0500-action",
            "config": {},
            "validation": [
              {
                "id": "return-0p0500-complete",
                "type": "actionEvidence",
                "label": "Return the 0.0500 M standard was completed.",
                "actionId": "return-0p0500-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Return the 0.0500 M standard evidence accepted.",
              "retry": "Review Return the 0.0500 M standard and try again."
            }
          },
          {
            "id": "condition-0p100",
            "type": "observation",
            "title": "Condition the cuvette with the 0.100 M standard",
            "description": "Empty the prior contents, rinse twice with approximately 1 mL of this sample, fill about three-quarters, wipe the optical faces, preserve orientation, insert, and close the lid.",
            "actionId": "condition-0p100-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "condition-0p100-complete",
                "type": "actionEvidence",
                "label": "Condition the cuvette with the 0.100 M standard was completed.",
                "actionId": "condition-0p100-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Condition the cuvette with the 0.100 M standard evidence accepted.",
              "retry": "Review Condition the cuvette with the 0.100 M standard and try again."
            }
          },
          {
            "id": "return-0p100",
            "type": "observation",
            "title": "Return the 0.100 M standard",
            "description": "Return the cuvette contents to the original labeled tube before conditioning with the next solution.",
            "actionId": "return-0p100-action",
            "config": {},
            "validation": [
              {
                "id": "return-0p100-complete",
                "type": "actionEvidence",
                "label": "Return the 0.100 M standard was completed.",
                "actionId": "return-0p100-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Return the 0.100 M standard evidence accepted.",
              "retry": "Review Return the 0.100 M standard and try again."
            }
          },
          {
            "id": "condition-0p200",
            "type": "observation",
            "title": "Condition the cuvette with the 0.200 M standard",
            "description": "Empty the prior contents, rinse twice with approximately 1 mL of this sample, fill about three-quarters, wipe the optical faces, preserve orientation, insert, and close the lid.",
            "actionId": "condition-0p200-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "condition-0p200-complete",
                "type": "actionEvidence",
                "label": "Condition the cuvette with the 0.200 M standard was completed.",
                "actionId": "condition-0p200-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Condition the cuvette with the 0.200 M standard evidence accepted.",
              "retry": "Review Condition the cuvette with the 0.200 M standard and try again."
            }
          },
          {
            "id": "return-0p200",
            "type": "observation",
            "title": "Return the 0.200 M standard",
            "description": "Return the cuvette contents to the original labeled tube before conditioning with the next solution.",
            "actionId": "return-0p200-action",
            "config": {},
            "validation": [
              {
                "id": "return-0p200-complete",
                "type": "actionEvidence",
                "label": "Return the 0.200 M standard was completed.",
                "actionId": "return-0p200-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Return the 0.200 M standard evidence accepted.",
              "retry": "Review Return the 0.200 M standard and try again."
            }
          },
          {
            "id": "condition-0p400",
            "type": "observation",
            "title": "Condition the cuvette with the 0.400 M standard",
            "description": "Empty the prior contents, rinse twice with approximately 1 mL of this sample, fill about three-quarters, wipe the optical faces, preserve orientation, insert, and close the lid.",
            "actionId": "condition-0p400-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "condition-0p400-complete",
                "type": "actionEvidence",
                "label": "Condition the cuvette with the 0.400 M standard was completed.",
                "actionId": "condition-0p400-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Condition the cuvette with the 0.400 M standard evidence accepted.",
              "retry": "Review Condition the cuvette with the 0.400 M standard and try again."
            }
          },
          {
            "id": "return-0p400",
            "type": "observation",
            "title": "Return the 0.400 M standard",
            "description": "Return the cuvette contents to the original labeled tube before conditioning with the next solution.",
            "actionId": "return-0p400-action",
            "config": {},
            "validation": [
              {
                "id": "return-0p400-complete",
                "type": "actionEvidence",
                "label": "Return the 0.400 M standard was completed.",
                "actionId": "return-0p400-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Return the 0.400 M standard evidence accepted.",
              "retry": "Review Return the 0.400 M standard and try again."
            }
          },
          {
            "id": "condition-unknown",
            "type": "observation",
            "title": "Condition the cuvette with the brass unknown",
            "description": "Empty the prior contents, rinse twice with approximately 1 mL of this sample, fill about three-quarters, wipe the optical faces, preserve orientation, insert, and close the lid.",
            "actionId": "condition-unknown-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "condition-unknown-complete",
                "type": "actionEvidence",
                "label": "Condition the cuvette with the brass unknown was completed.",
                "actionId": "condition-unknown-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Condition the cuvette with the brass unknown evidence accepted.",
              "retry": "Review Condition the cuvette with the brass unknown and try again."
            }
          },
          {
            "id": "read-unknown-absorbance",
            "type": "observation",
            "title": "Read absorbance for the brass unknown",
            "description": "Read the instrument only after calibration and the complete cuvette-technique checkpoint.",
            "actionId": "read-unknown-absorbance-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "read-unknown-absorbance-complete",
                "type": "actionEvidence",
                "label": "Read absorbance for the brass unknown was completed.",
                "actionId": "read-unknown-absorbance-action"
              }
            ],
            "hints": [
              "The configured value is within the approved <=1.00 AU working range."
            ],
            "feedback": {
              "success": "Read absorbance for the brass unknown evidence accepted.",
              "retry": "Review Read absorbance for the brass unknown and try again."
            }
          },
          {
            "id": "record-unknown-absorbance",
            "type": "observation",
            "title": "Record absorbance for the brass unknown",
            "description": "Commit the displayed reading as a separate notebook action; never reuse a prior sample's value.",
            "actionId": "record-unknown-absorbance-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "record-unknown-absorbance-complete",
                "type": "actionEvidence",
                "label": "Record absorbance for the brass unknown was completed.",
                "actionId": "record-unknown-absorbance-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record absorbance for the brass unknown evidence accepted.",
              "retry": "Review Record absorbance for the brass unknown and try again."
            }
          },
          {
            "id": "return-unknown",
            "type": "observation",
            "title": "Return the brass unknown",
            "description": "Return the cuvette contents to the original labeled tube before conditioning with the next solution.",
            "actionId": "return-unknown-action",
            "config": {},
            "validation": [
              {
                "id": "return-unknown-complete",
                "type": "actionEvidence",
                "label": "Return the brass unknown was completed.",
                "actionId": "return-unknown-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Return the brass unknown evidence accepted.",
              "retry": "Review Return the brass unknown and try again."
            }
          },
          {
            "id": "place-color-depth-comparison",
            "type": "action",
            "title": "Place the color-depth comparison",
            "description": "Place the paired 16 x 150 mm tubes and metric depth scale over the white comparison field.",
            "actionId": "place-color-depth-comparison-action",
            "config": {},
            "validation": [
              {
                "id": "place-color-depth-comparison-complete",
                "type": "actionEvidence",
                "label": "Place the color-depth comparison was completed.",
                "actionId": "place-color-depth-comparison-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Place the color-depth comparison evidence accepted.",
              "retry": "Review Place the color-depth comparison and try again."
            }
          },
          {
            "id": "visual-match",
            "type": "observation",
            "title": "Match apparent blue intensity",
            "description": "Keep the unknown depth fixed and remove solution only from the more concentrated 0.400 M standard until the apparent intensities match. The configured overshoot rule requires restore/restart.",
            "actionId": "visual-match-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "visual-match-complete",
                "type": "actionEvidence",
                "label": "Match apparent blue intensity was completed.",
                "actionId": "visual-match-action"
              }
            ],
            "hints": [
              "The text alternative reports both depths so the visual comparison is not color-only."
            ],
            "feedback": {
              "success": "Match apparent blue intensity evidence accepted.",
              "retry": "Review Match apparent blue intensity and try again."
            }
          },
          {
            "id": "record-unknown-depth",
            "type": "observation",
            "title": "Record unknown solution depth",
            "description": "Read the unknown meniscus against the adjacent metric scale and record it separately.",
            "actionId": "record-unknown-depth-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "record-unknown-depth-complete",
                "type": "actionEvidence",
                "label": "Record unknown solution depth was completed.",
                "actionId": "record-unknown-depth-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record unknown solution depth evidence accepted.",
              "retry": "Review Record unknown solution depth and try again."
            }
          },
          {
            "id": "record-standard-depth",
            "type": "observation",
            "title": "Record 0.400 M standard depth",
            "description": "Read the adjusted standard meniscus against the same scale and record it separately.",
            "actionId": "record-standard-depth-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "record-standard-depth-complete",
                "type": "actionEvidence",
                "label": "Record 0.400 M standard depth was completed.",
                "actionId": "record-standard-depth-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record 0.400 M standard depth evidence accepted.",
              "retry": "Review Record 0.400 M standard depth and try again."
            }
          },
          {
            "id": "neutralize-waste",
            "type": "observation",
            "title": "Neutralize brass waste",
            "description": "Add baking soda in small portions, waiting between additions, until bubbling subsides. Do not unlock disposal while active bubbling continues.",
            "actionId": "neutralize-waste-action",
            "config": {},
            "validation": [
              {
                "id": "neutralize-waste-complete",
                "type": "actionEvidence",
                "label": "Neutralize brass waste was completed.",
                "actionId": "neutralize-waste-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Neutralize brass waste evidence accepted.",
              "retry": "Review Neutralize brass waste and try again."
            }
          },
          {
            "id": "record-waste-ph",
            "type": "observation",
            "title": "Record neutralized waste pH",
            "description": "Measure and record pH only after bubbling subsides; the required safe gate is pH 5-9.",
            "actionId": "record-waste-ph-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "record-waste-ph-complete",
                "type": "actionEvidence",
                "label": "Record neutralized waste pH was completed.",
                "actionId": "record-waste-ph-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record neutralized waste pH evidence accepted.",
              "retry": "Review Record neutralized waste pH and try again."
            }
          },
          {
            "id": "read-0p0250-absorbance",
            "type": "observation",
            "title": "Read absorbance for the 0.0250 M standard",
            "description": "Read the instrument only after calibration and the complete cuvette-technique checkpoint.",
            "actionId": "read-0p0250-absorbance-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "read-0p0250-absorbance-complete",
                "type": "actionEvidence",
                "label": "Read absorbance for the 0.0250 M standard was completed.",
                "actionId": "read-0p0250-absorbance-action"
              }
            ],
            "hints": [
              "The configured value is within the approved <=1.00 AU working range."
            ],
            "feedback": {
              "success": "Read absorbance for the 0.0250 M standard evidence accepted.",
              "retry": "Review Read absorbance for the 0.0250 M standard and try again."
            }
          },
          {
            "id": "record-0p0250-absorbance",
            "type": "observation",
            "title": "Record absorbance for the 0.0250 M standard",
            "description": "Commit the displayed reading as a separate notebook action; never reuse a prior sample's value.",
            "actionId": "record-0p0250-absorbance-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "record-0p0250-absorbance-complete",
                "type": "actionEvidence",
                "label": "Record absorbance for the 0.0250 M standard was completed.",
                "actionId": "record-0p0250-absorbance-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record absorbance for the 0.0250 M standard evidence accepted.",
              "retry": "Review Record absorbance for the 0.0250 M standard and try again."
            }
          },
          {
            "id": "read-0p0500-absorbance",
            "type": "observation",
            "title": "Read absorbance for the 0.0500 M standard",
            "description": "Read the instrument only after calibration and the complete cuvette-technique checkpoint.",
            "actionId": "read-0p0500-absorbance-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "read-0p0500-absorbance-complete",
                "type": "actionEvidence",
                "label": "Read absorbance for the 0.0500 M standard was completed.",
                "actionId": "read-0p0500-absorbance-action"
              }
            ],
            "hints": [
              "The configured value is within the approved <=1.00 AU working range."
            ],
            "feedback": {
              "success": "Read absorbance for the 0.0500 M standard evidence accepted.",
              "retry": "Review Read absorbance for the 0.0500 M standard and try again."
            }
          },
          {
            "id": "record-0p0500-absorbance",
            "type": "observation",
            "title": "Record absorbance for the 0.0500 M standard",
            "description": "Commit the displayed reading as a separate notebook action; never reuse a prior sample's value.",
            "actionId": "record-0p0500-absorbance-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "record-0p0500-absorbance-complete",
                "type": "actionEvidence",
                "label": "Record absorbance for the 0.0500 M standard was completed.",
                "actionId": "record-0p0500-absorbance-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record absorbance for the 0.0500 M standard evidence accepted.",
              "retry": "Review Record absorbance for the 0.0500 M standard and try again."
            }
          },
          {
            "id": "read-0p100-absorbance",
            "type": "observation",
            "title": "Read absorbance for the 0.100 M standard",
            "description": "Read the instrument only after calibration and the complete cuvette-technique checkpoint.",
            "actionId": "read-0p100-absorbance-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "read-0p100-absorbance-complete",
                "type": "actionEvidence",
                "label": "Read absorbance for the 0.100 M standard was completed.",
                "actionId": "read-0p100-absorbance-action"
              }
            ],
            "hints": [
              "The configured value is within the approved <=1.00 AU working range."
            ],
            "feedback": {
              "success": "Read absorbance for the 0.100 M standard evidence accepted.",
              "retry": "Review Read absorbance for the 0.100 M standard and try again."
            }
          },
          {
            "id": "record-0p100-absorbance",
            "type": "observation",
            "title": "Record absorbance for the 0.100 M standard",
            "description": "Commit the displayed reading as a separate notebook action; never reuse a prior sample's value.",
            "actionId": "record-0p100-absorbance-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "record-0p100-absorbance-complete",
                "type": "actionEvidence",
                "label": "Record absorbance for the 0.100 M standard was completed.",
                "actionId": "record-0p100-absorbance-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record absorbance for the 0.100 M standard evidence accepted.",
              "retry": "Review Record absorbance for the 0.100 M standard and try again."
            }
          },
          {
            "id": "read-0p200-absorbance",
            "type": "observation",
            "title": "Read absorbance for the 0.200 M standard",
            "description": "Read the instrument only after calibration and the complete cuvette-technique checkpoint.",
            "actionId": "read-0p200-absorbance-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "read-0p200-absorbance-complete",
                "type": "actionEvidence",
                "label": "Read absorbance for the 0.200 M standard was completed.",
                "actionId": "read-0p200-absorbance-action"
              }
            ],
            "hints": [
              "The configured value is within the approved <=1.00 AU working range."
            ],
            "feedback": {
              "success": "Read absorbance for the 0.200 M standard evidence accepted.",
              "retry": "Review Read absorbance for the 0.200 M standard and try again."
            }
          },
          {
            "id": "record-0p200-absorbance",
            "type": "observation",
            "title": "Record absorbance for the 0.200 M standard",
            "description": "Commit the displayed reading as a separate notebook action; never reuse a prior sample's value.",
            "actionId": "record-0p200-absorbance-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "record-0p200-absorbance-complete",
                "type": "actionEvidence",
                "label": "Record absorbance for the 0.200 M standard was completed.",
                "actionId": "record-0p200-absorbance-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record absorbance for the 0.200 M standard evidence accepted.",
              "retry": "Review Record absorbance for the 0.200 M standard and try again."
            }
          },
          {
            "id": "read-0p400-absorbance",
            "type": "observation",
            "title": "Read absorbance for the 0.400 M standard",
            "description": "Read the instrument only after calibration and the complete cuvette-technique checkpoint.",
            "actionId": "read-0p400-absorbance-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "read-0p400-absorbance-complete",
                "type": "actionEvidence",
                "label": "Read absorbance for the 0.400 M standard was completed.",
                "actionId": "read-0p400-absorbance-action"
              }
            ],
            "hints": [
              "The configured value is within the approved <=1.00 AU working range."
            ],
            "feedback": {
              "success": "Read absorbance for the 0.400 M standard evidence accepted.",
              "retry": "Review Read absorbance for the 0.400 M standard and try again."
            }
          },
          {
            "id": "record-0p400-absorbance",
            "type": "observation",
            "title": "Record absorbance for the 0.400 M standard",
            "description": "Commit the displayed reading as a separate notebook action; never reuse a prior sample's value.",
            "actionId": "record-0p400-absorbance-action",
            "config": {
              "configurationChoice": true
            },
            "validation": [
              {
                "id": "record-0p400-absorbance-complete",
                "type": "actionEvidence",
                "label": "Record absorbance for the 0.400 M standard was completed.",
                "actionId": "record-0p400-absorbance-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record absorbance for the 0.400 M standard evidence accepted.",
              "retry": "Review Record absorbance for the 0.400 M standard and try again."
            }
          },
          {
            "id": "fill-0p0250-cuvette-action-node",
            "type": "action",
            "title": "Fill the cuvette from standard-0p0250-tube",
            "description": "Fill the cuvette from standard-0p0250-tube",
            "actionId": "fill-0p0250-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "fill-0p0250-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Fill the cuvette from standard-0p0250-tube was completed.",
                "actionId": "fill-0p0250-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Fill the cuvette from standard-0p0250-tube complete.",
              "retry": "Review Fill the cuvette from standard-0p0250-tube and try again."
            }
          },
          {
            "id": "prepare-0p0250-optical-faces-action-node",
            "type": "action",
            "title": "Wipe and orient the filled 0p0250 cuvette",
            "description": "Wipe and orient the filled 0p0250 cuvette",
            "actionId": "prepare-0p0250-optical-faces-action",
            "config": {},
            "validation": [
              {
                "id": "prepare-0p0250-optical-faces-action-node-done",
                "type": "actionEvidence",
                "label": "Wipe and orient the filled 0p0250 cuvette was completed.",
                "actionId": "prepare-0p0250-optical-faces-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Wipe and orient the filled 0p0250 cuvette complete.",
              "retry": "Review Wipe and orient the filled 0p0250 cuvette and try again."
            }
          },
          {
            "id": "insert-0p0250-cuvette-action-node",
            "type": "action",
            "title": "Insert the 0p0250 cuvette",
            "description": "Insert the 0p0250 cuvette",
            "actionId": "insert-0p0250-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "insert-0p0250-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Insert the 0p0250 cuvette was completed.",
                "actionId": "insert-0p0250-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert the 0p0250 cuvette complete.",
              "retry": "Review Insert the 0p0250 cuvette and try again."
            }
          },
          {
            "id": "remove-0p0250-cuvette-action-node",
            "type": "action",
            "title": "Remove the 0p0250 cuvette",
            "description": "Remove the 0p0250 cuvette",
            "actionId": "remove-0p0250-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "remove-0p0250-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Remove the 0p0250 cuvette was completed.",
                "actionId": "remove-0p0250-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove the 0p0250 cuvette complete.",
              "retry": "Review Remove the 0p0250 cuvette and try again."
            }
          },
          {
            "id": "fill-0p0500-cuvette-action-node",
            "type": "action",
            "title": "Fill the cuvette from standard-0p0500-tube",
            "description": "Fill the cuvette from standard-0p0500-tube",
            "actionId": "fill-0p0500-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "fill-0p0500-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Fill the cuvette from standard-0p0500-tube was completed.",
                "actionId": "fill-0p0500-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Fill the cuvette from standard-0p0500-tube complete.",
              "retry": "Review Fill the cuvette from standard-0p0500-tube and try again."
            }
          },
          {
            "id": "prepare-0p0500-optical-faces-action-node",
            "type": "action",
            "title": "Wipe and orient the filled 0p0500 cuvette",
            "description": "Wipe and orient the filled 0p0500 cuvette",
            "actionId": "prepare-0p0500-optical-faces-action",
            "config": {},
            "validation": [
              {
                "id": "prepare-0p0500-optical-faces-action-node-done",
                "type": "actionEvidence",
                "label": "Wipe and orient the filled 0p0500 cuvette was completed.",
                "actionId": "prepare-0p0500-optical-faces-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Wipe and orient the filled 0p0500 cuvette complete.",
              "retry": "Review Wipe and orient the filled 0p0500 cuvette and try again."
            }
          },
          {
            "id": "insert-0p0500-cuvette-action-node",
            "type": "action",
            "title": "Insert the 0p0500 cuvette",
            "description": "Insert the 0p0500 cuvette",
            "actionId": "insert-0p0500-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "insert-0p0500-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Insert the 0p0500 cuvette was completed.",
                "actionId": "insert-0p0500-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert the 0p0500 cuvette complete.",
              "retry": "Review Insert the 0p0500 cuvette and try again."
            }
          },
          {
            "id": "remove-0p0500-cuvette-action-node",
            "type": "action",
            "title": "Remove the 0p0500 cuvette",
            "description": "Remove the 0p0500 cuvette",
            "actionId": "remove-0p0500-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "remove-0p0500-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Remove the 0p0500 cuvette was completed.",
                "actionId": "remove-0p0500-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove the 0p0500 cuvette complete.",
              "retry": "Review Remove the 0p0500 cuvette and try again."
            }
          },
          {
            "id": "fill-0p100-cuvette-action-node",
            "type": "action",
            "title": "Fill the cuvette from standard-0p100-tube",
            "description": "Fill the cuvette from standard-0p100-tube",
            "actionId": "fill-0p100-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "fill-0p100-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Fill the cuvette from standard-0p100-tube was completed.",
                "actionId": "fill-0p100-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Fill the cuvette from standard-0p100-tube complete.",
              "retry": "Review Fill the cuvette from standard-0p100-tube and try again."
            }
          },
          {
            "id": "prepare-0p100-optical-faces-action-node",
            "type": "action",
            "title": "Wipe and orient the filled 0p100 cuvette",
            "description": "Wipe and orient the filled 0p100 cuvette",
            "actionId": "prepare-0p100-optical-faces-action",
            "config": {},
            "validation": [
              {
                "id": "prepare-0p100-optical-faces-action-node-done",
                "type": "actionEvidence",
                "label": "Wipe and orient the filled 0p100 cuvette was completed.",
                "actionId": "prepare-0p100-optical-faces-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Wipe and orient the filled 0p100 cuvette complete.",
              "retry": "Review Wipe and orient the filled 0p100 cuvette and try again."
            }
          },
          {
            "id": "insert-0p100-cuvette-action-node",
            "type": "action",
            "title": "Insert the 0p100 cuvette",
            "description": "Insert the 0p100 cuvette",
            "actionId": "insert-0p100-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "insert-0p100-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Insert the 0p100 cuvette was completed.",
                "actionId": "insert-0p100-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert the 0p100 cuvette complete.",
              "retry": "Review Insert the 0p100 cuvette and try again."
            }
          },
          {
            "id": "remove-0p100-cuvette-action-node",
            "type": "action",
            "title": "Remove the 0p100 cuvette",
            "description": "Remove the 0p100 cuvette",
            "actionId": "remove-0p100-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "remove-0p100-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Remove the 0p100 cuvette was completed.",
                "actionId": "remove-0p100-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove the 0p100 cuvette complete.",
              "retry": "Review Remove the 0p100 cuvette and try again."
            }
          },
          {
            "id": "fill-0p200-cuvette-action-node",
            "type": "action",
            "title": "Fill the cuvette from standard-0p200-tube",
            "description": "Fill the cuvette from standard-0p200-tube",
            "actionId": "fill-0p200-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "fill-0p200-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Fill the cuvette from standard-0p200-tube was completed.",
                "actionId": "fill-0p200-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Fill the cuvette from standard-0p200-tube complete.",
              "retry": "Review Fill the cuvette from standard-0p200-tube and try again."
            }
          },
          {
            "id": "prepare-0p200-optical-faces-action-node",
            "type": "action",
            "title": "Wipe and orient the filled 0p200 cuvette",
            "description": "Wipe and orient the filled 0p200 cuvette",
            "actionId": "prepare-0p200-optical-faces-action",
            "config": {},
            "validation": [
              {
                "id": "prepare-0p200-optical-faces-action-node-done",
                "type": "actionEvidence",
                "label": "Wipe and orient the filled 0p200 cuvette was completed.",
                "actionId": "prepare-0p200-optical-faces-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Wipe and orient the filled 0p200 cuvette complete.",
              "retry": "Review Wipe and orient the filled 0p200 cuvette and try again."
            }
          },
          {
            "id": "insert-0p200-cuvette-action-node",
            "type": "action",
            "title": "Insert the 0p200 cuvette",
            "description": "Insert the 0p200 cuvette",
            "actionId": "insert-0p200-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "insert-0p200-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Insert the 0p200 cuvette was completed.",
                "actionId": "insert-0p200-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert the 0p200 cuvette complete.",
              "retry": "Review Insert the 0p200 cuvette and try again."
            }
          },
          {
            "id": "remove-0p200-cuvette-action-node",
            "type": "action",
            "title": "Remove the 0p200 cuvette",
            "description": "Remove the 0p200 cuvette",
            "actionId": "remove-0p200-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "remove-0p200-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Remove the 0p200 cuvette was completed.",
                "actionId": "remove-0p200-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove the 0p200 cuvette complete.",
              "retry": "Review Remove the 0p200 cuvette and try again."
            }
          },
          {
            "id": "fill-0p400-cuvette-action-node",
            "type": "action",
            "title": "Fill the cuvette from standard-0p400-tube",
            "description": "Fill the cuvette from standard-0p400-tube",
            "actionId": "fill-0p400-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "fill-0p400-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Fill the cuvette from standard-0p400-tube was completed.",
                "actionId": "fill-0p400-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Fill the cuvette from standard-0p400-tube complete.",
              "retry": "Review Fill the cuvette from standard-0p400-tube and try again."
            }
          },
          {
            "id": "prepare-0p400-optical-faces-action-node",
            "type": "action",
            "title": "Wipe and orient the filled 0p400 cuvette",
            "description": "Wipe and orient the filled 0p400 cuvette",
            "actionId": "prepare-0p400-optical-faces-action",
            "config": {},
            "validation": [
              {
                "id": "prepare-0p400-optical-faces-action-node-done",
                "type": "actionEvidence",
                "label": "Wipe and orient the filled 0p400 cuvette was completed.",
                "actionId": "prepare-0p400-optical-faces-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Wipe and orient the filled 0p400 cuvette complete.",
              "retry": "Review Wipe and orient the filled 0p400 cuvette and try again."
            }
          },
          {
            "id": "insert-0p400-cuvette-action-node",
            "type": "action",
            "title": "Insert the 0p400 cuvette",
            "description": "Insert the 0p400 cuvette",
            "actionId": "insert-0p400-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "insert-0p400-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Insert the 0p400 cuvette was completed.",
                "actionId": "insert-0p400-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert the 0p400 cuvette complete.",
              "retry": "Review Insert the 0p400 cuvette and try again."
            }
          },
          {
            "id": "remove-0p400-cuvette-action-node",
            "type": "action",
            "title": "Remove the 0p400 cuvette",
            "description": "Remove the 0p400 cuvette",
            "actionId": "remove-0p400-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "remove-0p400-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Remove the 0p400 cuvette was completed.",
                "actionId": "remove-0p400-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove the 0p400 cuvette complete.",
              "retry": "Review Remove the 0p400 cuvette and try again."
            }
          },
          {
            "id": "fill-unknown-cuvette-action-node",
            "type": "action",
            "title": "Fill the cuvette from unknown-sample-tube",
            "description": "Fill the cuvette from unknown-sample-tube",
            "actionId": "fill-unknown-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "fill-unknown-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Fill the cuvette from unknown-sample-tube was completed.",
                "actionId": "fill-unknown-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Fill the cuvette from unknown-sample-tube complete.",
              "retry": "Review Fill the cuvette from unknown-sample-tube and try again."
            }
          },
          {
            "id": "prepare-unknown-optical-faces-action-node",
            "type": "action",
            "title": "Wipe and orient the filled unknown cuvette",
            "description": "Wipe and orient the filled unknown cuvette",
            "actionId": "prepare-unknown-optical-faces-action",
            "config": {},
            "validation": [
              {
                "id": "prepare-unknown-optical-faces-action-node-done",
                "type": "actionEvidence",
                "label": "Wipe and orient the filled unknown cuvette was completed.",
                "actionId": "prepare-unknown-optical-faces-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Wipe and orient the filled unknown cuvette complete.",
              "retry": "Review Wipe and orient the filled unknown cuvette and try again."
            }
          },
          {
            "id": "insert-unknown-cuvette-action-node",
            "type": "action",
            "title": "Insert the unknown cuvette",
            "description": "Insert the unknown cuvette",
            "actionId": "insert-unknown-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "insert-unknown-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Insert the unknown cuvette was completed.",
                "actionId": "insert-unknown-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert the unknown cuvette complete.",
              "retry": "Review Insert the unknown cuvette and try again."
            }
          },
          {
            "id": "remove-unknown-cuvette-action-node",
            "type": "action",
            "title": "Remove the unknown cuvette",
            "description": "Remove the unknown cuvette",
            "actionId": "remove-unknown-cuvette-action",
            "config": {},
            "validation": [
              {
                "id": "remove-unknown-cuvette-action-node-done",
                "type": "actionEvidence",
                "label": "Remove the unknown cuvette was completed.",
                "actionId": "remove-unknown-cuvette-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove the unknown cuvette complete.",
              "retry": "Review Remove the unknown cuvette and try again."
            }
          },
          {
            "id": "transfer-prepared-unknown-to-original-tube-action-node",
            "type": "action",
            "title": "Transfer a measured portion of the prepared brass unknown to its original sample tube",
            "description": "Transfer a measured portion of the prepared brass unknown to its original sample tube",
            "actionId": "transfer-prepared-unknown-to-original-tube-action",
            "config": {},
            "validation": [
              {
                "id": "transfer-prepared-unknown-to-original-tube-action-node-done",
                "type": "actionEvidence",
                "label": "Transfer a measured portion of the prepared brass unknown to its original sample tube was completed.",
                "actionId": "transfer-prepared-unknown-to-original-tube-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Transfer a measured portion of the prepared brass unknown to its original sample tube complete.",
              "retry": "Review Transfer a measured portion of the prepared brass unknown to its original sample tube and try again."
            }
          },
          {
            "id": "scan-configure-salt-a-inventory-action-node",
            "type": "action",
            "title": "Configure finite assigned-salt A operational inventory",
            "description": "Configure finite assigned-salt A operational inventory",
            "actionId": "scan-configure-salt-a-inventory-action",
            "config": {},
            "validation": [
              {
                "id": "scan-configure-salt-a-inventory-action-node-done",
                "type": "actionEvidence",
                "label": "Configure finite assigned-salt A operational inventory was completed.",
                "actionId": "scan-configure-salt-a-inventory-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Configure finite assigned-salt A operational inventory complete.",
              "retry": "Review Configure finite assigned-salt A operational inventory and try again."
            }
          },
          {
            "id": "scan-condition-salt-a-once-action-node",
            "type": "action",
            "title": "Condition assigned-salt A scan cuvette once before the wavelength series",
            "description": "Condition assigned-salt A scan cuvette once before the wavelength series",
            "actionId": "scan-condition-salt-a-once-action",
            "config": {},
            "validation": [
              {
                "id": "scan-condition-salt-a-once-action-node-done",
                "type": "actionEvidence",
                "label": "Condition assigned-salt A scan cuvette once before the wavelength series was completed.",
                "actionId": "scan-condition-salt-a-once-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Condition assigned-salt A scan cuvette once before the wavelength series complete.",
              "retry": "Review Condition assigned-salt A scan cuvette once before the wavelength series and try again."
            }
          },
          {
            "id": "scan-fill-salt-a-once-action-node",
            "type": "action",
            "title": "Fill assigned-salt A scan cuvette once",
            "description": "Fill assigned-salt A scan cuvette once",
            "actionId": "scan-fill-salt-a-once-action",
            "config": {},
            "validation": [
              {
                "id": "scan-fill-salt-a-once-action-node-done",
                "type": "actionEvidence",
                "label": "Fill assigned-salt A scan cuvette once was completed.",
                "actionId": "scan-fill-salt-a-once-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Fill assigned-salt A scan cuvette once complete.",
              "retry": "Review Fill assigned-salt A scan cuvette once and try again."
            }
          },
          {
            "id": "scan-prepare-salt-a-once-action-node",
            "type": "action",
            "title": "Prepare assigned-salt A optical faces once",
            "description": "Prepare assigned-salt A optical faces once",
            "actionId": "scan-prepare-salt-a-once-action",
            "config": {},
            "validation": [
              {
                "id": "scan-prepare-salt-a-once-action-node-done",
                "type": "actionEvidence",
                "label": "Prepare assigned-salt A optical faces once was completed.",
                "actionId": "scan-prepare-salt-a-once-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Prepare assigned-salt A optical faces once complete.",
              "retry": "Review Prepare assigned-salt A optical faces once and try again."
            }
          },
          {
            "id": "scan-configure-salt-b-inventory-action-node",
            "type": "action",
            "title": "Configure finite assigned-salt B operational inventory",
            "description": "Configure finite assigned-salt B operational inventory",
            "actionId": "scan-configure-salt-b-inventory-action",
            "config": {},
            "validation": [
              {
                "id": "scan-configure-salt-b-inventory-action-node-done",
                "type": "actionEvidence",
                "label": "Configure finite assigned-salt B operational inventory was completed.",
                "actionId": "scan-configure-salt-b-inventory-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Configure finite assigned-salt B operational inventory complete.",
              "retry": "Review Configure finite assigned-salt B operational inventory and try again."
            }
          },
          {
            "id": "scan-condition-salt-b-once-action-node",
            "type": "action",
            "title": "Condition assigned-salt B scan cuvette once before the wavelength series",
            "description": "Condition assigned-salt B scan cuvette once before the wavelength series",
            "actionId": "scan-condition-salt-b-once-action",
            "config": {},
            "validation": [
              {
                "id": "scan-condition-salt-b-once-action-node-done",
                "type": "actionEvidence",
                "label": "Condition assigned-salt B scan cuvette once before the wavelength series was completed.",
                "actionId": "scan-condition-salt-b-once-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Condition assigned-salt B scan cuvette once before the wavelength series complete.",
              "retry": "Review Condition assigned-salt B scan cuvette once before the wavelength series and try again."
            }
          },
          {
            "id": "scan-fill-salt-b-once-action-node",
            "type": "action",
            "title": "Fill assigned-salt B scan cuvette once",
            "description": "Fill assigned-salt B scan cuvette once",
            "actionId": "scan-fill-salt-b-once-action",
            "config": {},
            "validation": [
              {
                "id": "scan-fill-salt-b-once-action-node-done",
                "type": "actionEvidence",
                "label": "Fill assigned-salt B scan cuvette once was completed.",
                "actionId": "scan-fill-salt-b-once-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Fill assigned-salt B scan cuvette once complete.",
              "retry": "Review Fill assigned-salt B scan cuvette once and try again."
            }
          },
          {
            "id": "scan-prepare-salt-b-once-action-node",
            "type": "action",
            "title": "Prepare assigned-salt B optical faces once",
            "description": "Prepare assigned-salt B optical faces once",
            "actionId": "scan-prepare-salt-b-once-action",
            "config": {},
            "validation": [
              {
                "id": "scan-prepare-salt-b-once-action-node-done",
                "type": "actionEvidence",
                "label": "Prepare assigned-salt B optical faces once was completed.",
                "actionId": "scan-prepare-salt-b-once-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Prepare assigned-salt B optical faces once complete.",
              "retry": "Review Prepare assigned-salt B optical faces once and try again."
            }
          },
          {
            "id": "scan-place-photometer-action-node",
            "type": "action",
            "title": "Place the spectrophotometer for the assigned-salt scan",
            "description": "Place the spectrophotometer for the assigned-salt scan",
            "actionId": "scan-place-photometer-action",
            "config": {},
            "validation": [
              {
                "id": "scan-place-photometer-action-node-done",
                "type": "actionEvidence",
                "label": "Place the spectrophotometer for the assigned-salt scan was completed.",
                "actionId": "scan-place-photometer-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Place the spectrophotometer for the assigned-salt scan complete.",
              "retry": "Review Place the spectrophotometer for the assigned-salt scan and try again."
            }
          },
          {
            "id": "scan-set-400-action-node",
            "type": "action",
            "title": "Set the source-stated scan wavelength to 400 nm",
            "description": "Set the source-stated scan wavelength to 400 nm",
            "actionId": "scan-set-400-action",
            "config": {},
            "validation": [
              {
                "id": "scan-set-400-action-node-done",
                "type": "actionEvidence",
                "label": "Set the source-stated scan wavelength to 400 nm was completed.",
                "actionId": "scan-set-400-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set the source-stated scan wavelength to 400 nm complete.",
              "retry": "Review Set the source-stated scan wavelength to 400 nm and try again."
            }
          },
          {
            "id": "scan-insert-400-salt-a-action-node",
            "type": "action",
            "title": "Insert assigned salt A at 400 nm",
            "description": "Insert assigned salt A at 400 nm",
            "actionId": "scan-insert-400-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-400-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt A at 400 nm was completed.",
                "actionId": "scan-insert-400-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt A at 400 nm complete.",
              "retry": "Review Insert assigned salt A at 400 nm and try again."
            }
          },
          {
            "id": "scan-read-400-salt-a-action-node",
            "type": "action",
            "title": "Read assigned salt A at 400 nm",
            "description": "Read assigned salt A at 400 nm",
            "actionId": "scan-read-400-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-400-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt A at 400 nm was completed.",
                "actionId": "scan-read-400-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt A at 400 nm complete.",
              "retry": "Review Read assigned salt A at 400 nm and try again."
            }
          },
          {
            "id": "scan-record-400-salt-a-action-node",
            "type": "action",
            "title": "Record assigned salt A at 400 nm",
            "description": "Record assigned salt A at 400 nm",
            "actionId": "scan-record-400-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-400-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt A at 400 nm was completed.",
                "actionId": "scan-record-400-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt A at 400 nm complete.",
              "retry": "Review Record assigned salt A at 400 nm and try again."
            }
          },
          {
            "id": "scan-remove-400-salt-a-action-node",
            "type": "action",
            "title": "Remove assigned salt A after 400 nm",
            "description": "Remove assigned salt A after 400 nm",
            "actionId": "scan-remove-400-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-400-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt A after 400 nm was completed.",
                "actionId": "scan-remove-400-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt A after 400 nm complete.",
              "retry": "Review Remove assigned salt A after 400 nm and try again."
            }
          },
          {
            "id": "scan-insert-400-salt-b-action-node",
            "type": "action",
            "title": "Insert assigned salt B at 400 nm",
            "description": "Insert assigned salt B at 400 nm",
            "actionId": "scan-insert-400-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-400-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt B at 400 nm was completed.",
                "actionId": "scan-insert-400-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt B at 400 nm complete.",
              "retry": "Review Insert assigned salt B at 400 nm and try again."
            }
          },
          {
            "id": "scan-read-400-salt-b-action-node",
            "type": "action",
            "title": "Read assigned salt B at 400 nm",
            "description": "Read assigned salt B at 400 nm",
            "actionId": "scan-read-400-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-400-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt B at 400 nm was completed.",
                "actionId": "scan-read-400-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt B at 400 nm complete.",
              "retry": "Review Read assigned salt B at 400 nm and try again."
            }
          },
          {
            "id": "scan-record-400-salt-b-action-node",
            "type": "action",
            "title": "Record assigned salt B at 400 nm",
            "description": "Record assigned salt B at 400 nm",
            "actionId": "scan-record-400-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-400-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt B at 400 nm was completed.",
                "actionId": "scan-record-400-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt B at 400 nm complete.",
              "retry": "Review Record assigned salt B at 400 nm and try again."
            }
          },
          {
            "id": "scan-remove-400-salt-b-action-node",
            "type": "action",
            "title": "Remove assigned salt B after 400 nm",
            "description": "Remove assigned salt B after 400 nm",
            "actionId": "scan-remove-400-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-400-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt B after 400 nm was completed.",
                "actionId": "scan-remove-400-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt B after 400 nm complete.",
              "retry": "Review Remove assigned salt B after 400 nm and try again."
            }
          },
          {
            "id": "scan-set-420-action-node",
            "type": "action",
            "title": "Set the source-stated scan wavelength to 420 nm",
            "description": "Set the source-stated scan wavelength to 420 nm",
            "actionId": "scan-set-420-action",
            "config": {},
            "validation": [
              {
                "id": "scan-set-420-action-node-done",
                "type": "actionEvidence",
                "label": "Set the source-stated scan wavelength to 420 nm was completed.",
                "actionId": "scan-set-420-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set the source-stated scan wavelength to 420 nm complete.",
              "retry": "Review Set the source-stated scan wavelength to 420 nm and try again."
            }
          },
          {
            "id": "scan-insert-420-salt-a-action-node",
            "type": "action",
            "title": "Insert assigned salt A at 420 nm",
            "description": "Insert assigned salt A at 420 nm",
            "actionId": "scan-insert-420-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-420-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt A at 420 nm was completed.",
                "actionId": "scan-insert-420-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt A at 420 nm complete.",
              "retry": "Review Insert assigned salt A at 420 nm and try again."
            }
          },
          {
            "id": "scan-read-420-salt-a-action-node",
            "type": "action",
            "title": "Read assigned salt A at 420 nm",
            "description": "Read assigned salt A at 420 nm",
            "actionId": "scan-read-420-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-420-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt A at 420 nm was completed.",
                "actionId": "scan-read-420-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt A at 420 nm complete.",
              "retry": "Review Read assigned salt A at 420 nm and try again."
            }
          },
          {
            "id": "scan-record-420-salt-a-action-node",
            "type": "action",
            "title": "Record assigned salt A at 420 nm",
            "description": "Record assigned salt A at 420 nm",
            "actionId": "scan-record-420-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-420-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt A at 420 nm was completed.",
                "actionId": "scan-record-420-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt A at 420 nm complete.",
              "retry": "Review Record assigned salt A at 420 nm and try again."
            }
          },
          {
            "id": "scan-remove-420-salt-a-action-node",
            "type": "action",
            "title": "Remove assigned salt A after 420 nm",
            "description": "Remove assigned salt A after 420 nm",
            "actionId": "scan-remove-420-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-420-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt A after 420 nm was completed.",
                "actionId": "scan-remove-420-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt A after 420 nm complete.",
              "retry": "Review Remove assigned salt A after 420 nm and try again."
            }
          },
          {
            "id": "scan-insert-420-salt-b-action-node",
            "type": "action",
            "title": "Insert assigned salt B at 420 nm",
            "description": "Insert assigned salt B at 420 nm",
            "actionId": "scan-insert-420-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-420-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt B at 420 nm was completed.",
                "actionId": "scan-insert-420-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt B at 420 nm complete.",
              "retry": "Review Insert assigned salt B at 420 nm and try again."
            }
          },
          {
            "id": "scan-read-420-salt-b-action-node",
            "type": "action",
            "title": "Read assigned salt B at 420 nm",
            "description": "Read assigned salt B at 420 nm",
            "actionId": "scan-read-420-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-420-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt B at 420 nm was completed.",
                "actionId": "scan-read-420-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt B at 420 nm complete.",
              "retry": "Review Read assigned salt B at 420 nm and try again."
            }
          },
          {
            "id": "scan-record-420-salt-b-action-node",
            "type": "action",
            "title": "Record assigned salt B at 420 nm",
            "description": "Record assigned salt B at 420 nm",
            "actionId": "scan-record-420-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-420-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt B at 420 nm was completed.",
                "actionId": "scan-record-420-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt B at 420 nm complete.",
              "retry": "Review Record assigned salt B at 420 nm and try again."
            }
          },
          {
            "id": "scan-remove-420-salt-b-action-node",
            "type": "action",
            "title": "Remove assigned salt B after 420 nm",
            "description": "Remove assigned salt B after 420 nm",
            "actionId": "scan-remove-420-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-420-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt B after 420 nm was completed.",
                "actionId": "scan-remove-420-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt B after 420 nm complete.",
              "retry": "Review Remove assigned salt B after 420 nm and try again."
            }
          },
          {
            "id": "scan-set-440-action-node",
            "type": "action",
            "title": "Set the source-stated scan wavelength to 440 nm",
            "description": "Set the source-stated scan wavelength to 440 nm",
            "actionId": "scan-set-440-action",
            "config": {},
            "validation": [
              {
                "id": "scan-set-440-action-node-done",
                "type": "actionEvidence",
                "label": "Set the source-stated scan wavelength to 440 nm was completed.",
                "actionId": "scan-set-440-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set the source-stated scan wavelength to 440 nm complete.",
              "retry": "Review Set the source-stated scan wavelength to 440 nm and try again."
            }
          },
          {
            "id": "scan-insert-440-salt-a-action-node",
            "type": "action",
            "title": "Insert assigned salt A at 440 nm",
            "description": "Insert assigned salt A at 440 nm",
            "actionId": "scan-insert-440-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-440-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt A at 440 nm was completed.",
                "actionId": "scan-insert-440-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt A at 440 nm complete.",
              "retry": "Review Insert assigned salt A at 440 nm and try again."
            }
          },
          {
            "id": "scan-read-440-salt-a-action-node",
            "type": "action",
            "title": "Read assigned salt A at 440 nm",
            "description": "Read assigned salt A at 440 nm",
            "actionId": "scan-read-440-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-440-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt A at 440 nm was completed.",
                "actionId": "scan-read-440-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt A at 440 nm complete.",
              "retry": "Review Read assigned salt A at 440 nm and try again."
            }
          },
          {
            "id": "scan-record-440-salt-a-action-node",
            "type": "action",
            "title": "Record assigned salt A at 440 nm",
            "description": "Record assigned salt A at 440 nm",
            "actionId": "scan-record-440-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-440-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt A at 440 nm was completed.",
                "actionId": "scan-record-440-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt A at 440 nm complete.",
              "retry": "Review Record assigned salt A at 440 nm and try again."
            }
          },
          {
            "id": "scan-remove-440-salt-a-action-node",
            "type": "action",
            "title": "Remove assigned salt A after 440 nm",
            "description": "Remove assigned salt A after 440 nm",
            "actionId": "scan-remove-440-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-440-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt A after 440 nm was completed.",
                "actionId": "scan-remove-440-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt A after 440 nm complete.",
              "retry": "Review Remove assigned salt A after 440 nm and try again."
            }
          },
          {
            "id": "scan-insert-440-salt-b-action-node",
            "type": "action",
            "title": "Insert assigned salt B at 440 nm",
            "description": "Insert assigned salt B at 440 nm",
            "actionId": "scan-insert-440-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-440-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt B at 440 nm was completed.",
                "actionId": "scan-insert-440-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt B at 440 nm complete.",
              "retry": "Review Insert assigned salt B at 440 nm and try again."
            }
          },
          {
            "id": "scan-read-440-salt-b-action-node",
            "type": "action",
            "title": "Read assigned salt B at 440 nm",
            "description": "Read assigned salt B at 440 nm",
            "actionId": "scan-read-440-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-440-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt B at 440 nm was completed.",
                "actionId": "scan-read-440-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt B at 440 nm complete.",
              "retry": "Review Read assigned salt B at 440 nm and try again."
            }
          },
          {
            "id": "scan-record-440-salt-b-action-node",
            "type": "action",
            "title": "Record assigned salt B at 440 nm",
            "description": "Record assigned salt B at 440 nm",
            "actionId": "scan-record-440-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-440-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt B at 440 nm was completed.",
                "actionId": "scan-record-440-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt B at 440 nm complete.",
              "retry": "Review Record assigned salt B at 440 nm and try again."
            }
          },
          {
            "id": "scan-remove-440-salt-b-action-node",
            "type": "action",
            "title": "Remove assigned salt B after 440 nm",
            "description": "Remove assigned salt B after 440 nm",
            "actionId": "scan-remove-440-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-440-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt B after 440 nm was completed.",
                "actionId": "scan-remove-440-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt B after 440 nm complete.",
              "retry": "Review Remove assigned salt B after 440 nm and try again."
            }
          },
          {
            "id": "scan-set-460-action-node",
            "type": "action",
            "title": "Set the source-stated scan wavelength to 460 nm",
            "description": "Set the source-stated scan wavelength to 460 nm",
            "actionId": "scan-set-460-action",
            "config": {},
            "validation": [
              {
                "id": "scan-set-460-action-node-done",
                "type": "actionEvidence",
                "label": "Set the source-stated scan wavelength to 460 nm was completed.",
                "actionId": "scan-set-460-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set the source-stated scan wavelength to 460 nm complete.",
              "retry": "Review Set the source-stated scan wavelength to 460 nm and try again."
            }
          },
          {
            "id": "scan-insert-460-salt-a-action-node",
            "type": "action",
            "title": "Insert assigned salt A at 460 nm",
            "description": "Insert assigned salt A at 460 nm",
            "actionId": "scan-insert-460-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-460-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt A at 460 nm was completed.",
                "actionId": "scan-insert-460-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt A at 460 nm complete.",
              "retry": "Review Insert assigned salt A at 460 nm and try again."
            }
          },
          {
            "id": "scan-read-460-salt-a-action-node",
            "type": "action",
            "title": "Read assigned salt A at 460 nm",
            "description": "Read assigned salt A at 460 nm",
            "actionId": "scan-read-460-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-460-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt A at 460 nm was completed.",
                "actionId": "scan-read-460-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt A at 460 nm complete.",
              "retry": "Review Read assigned salt A at 460 nm and try again."
            }
          },
          {
            "id": "scan-record-460-salt-a-action-node",
            "type": "action",
            "title": "Record assigned salt A at 460 nm",
            "description": "Record assigned salt A at 460 nm",
            "actionId": "scan-record-460-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-460-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt A at 460 nm was completed.",
                "actionId": "scan-record-460-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt A at 460 nm complete.",
              "retry": "Review Record assigned salt A at 460 nm and try again."
            }
          },
          {
            "id": "scan-remove-460-salt-a-action-node",
            "type": "action",
            "title": "Remove assigned salt A after 460 nm",
            "description": "Remove assigned salt A after 460 nm",
            "actionId": "scan-remove-460-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-460-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt A after 460 nm was completed.",
                "actionId": "scan-remove-460-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt A after 460 nm complete.",
              "retry": "Review Remove assigned salt A after 460 nm and try again."
            }
          },
          {
            "id": "scan-insert-460-salt-b-action-node",
            "type": "action",
            "title": "Insert assigned salt B at 460 nm",
            "description": "Insert assigned salt B at 460 nm",
            "actionId": "scan-insert-460-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-460-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt B at 460 nm was completed.",
                "actionId": "scan-insert-460-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt B at 460 nm complete.",
              "retry": "Review Insert assigned salt B at 460 nm and try again."
            }
          },
          {
            "id": "scan-read-460-salt-b-action-node",
            "type": "action",
            "title": "Read assigned salt B at 460 nm",
            "description": "Read assigned salt B at 460 nm",
            "actionId": "scan-read-460-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-460-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt B at 460 nm was completed.",
                "actionId": "scan-read-460-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt B at 460 nm complete.",
              "retry": "Review Read assigned salt B at 460 nm and try again."
            }
          },
          {
            "id": "scan-record-460-salt-b-action-node",
            "type": "action",
            "title": "Record assigned salt B at 460 nm",
            "description": "Record assigned salt B at 460 nm",
            "actionId": "scan-record-460-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-460-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt B at 460 nm was completed.",
                "actionId": "scan-record-460-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt B at 460 nm complete.",
              "retry": "Review Record assigned salt B at 460 nm and try again."
            }
          },
          {
            "id": "scan-remove-460-salt-b-action-node",
            "type": "action",
            "title": "Remove assigned salt B after 460 nm",
            "description": "Remove assigned salt B after 460 nm",
            "actionId": "scan-remove-460-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-460-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt B after 460 nm was completed.",
                "actionId": "scan-remove-460-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt B after 460 nm complete.",
              "retry": "Review Remove assigned salt B after 460 nm and try again."
            }
          },
          {
            "id": "scan-set-480-action-node",
            "type": "action",
            "title": "Set the source-stated scan wavelength to 480 nm",
            "description": "Set the source-stated scan wavelength to 480 nm",
            "actionId": "scan-set-480-action",
            "config": {},
            "validation": [
              {
                "id": "scan-set-480-action-node-done",
                "type": "actionEvidence",
                "label": "Set the source-stated scan wavelength to 480 nm was completed.",
                "actionId": "scan-set-480-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set the source-stated scan wavelength to 480 nm complete.",
              "retry": "Review Set the source-stated scan wavelength to 480 nm and try again."
            }
          },
          {
            "id": "scan-insert-480-salt-a-action-node",
            "type": "action",
            "title": "Insert assigned salt A at 480 nm",
            "description": "Insert assigned salt A at 480 nm",
            "actionId": "scan-insert-480-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-480-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt A at 480 nm was completed.",
                "actionId": "scan-insert-480-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt A at 480 nm complete.",
              "retry": "Review Insert assigned salt A at 480 nm and try again."
            }
          },
          {
            "id": "scan-read-480-salt-a-action-node",
            "type": "action",
            "title": "Read assigned salt A at 480 nm",
            "description": "Read assigned salt A at 480 nm",
            "actionId": "scan-read-480-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-480-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt A at 480 nm was completed.",
                "actionId": "scan-read-480-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt A at 480 nm complete.",
              "retry": "Review Read assigned salt A at 480 nm and try again."
            }
          },
          {
            "id": "scan-record-480-salt-a-action-node",
            "type": "action",
            "title": "Record assigned salt A at 480 nm",
            "description": "Record assigned salt A at 480 nm",
            "actionId": "scan-record-480-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-480-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt A at 480 nm was completed.",
                "actionId": "scan-record-480-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt A at 480 nm complete.",
              "retry": "Review Record assigned salt A at 480 nm and try again."
            }
          },
          {
            "id": "scan-remove-480-salt-a-action-node",
            "type": "action",
            "title": "Remove assigned salt A after 480 nm",
            "description": "Remove assigned salt A after 480 nm",
            "actionId": "scan-remove-480-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-480-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt A after 480 nm was completed.",
                "actionId": "scan-remove-480-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt A after 480 nm complete.",
              "retry": "Review Remove assigned salt A after 480 nm and try again."
            }
          },
          {
            "id": "scan-insert-480-salt-b-action-node",
            "type": "action",
            "title": "Insert assigned salt B at 480 nm",
            "description": "Insert assigned salt B at 480 nm",
            "actionId": "scan-insert-480-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-480-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt B at 480 nm was completed.",
                "actionId": "scan-insert-480-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt B at 480 nm complete.",
              "retry": "Review Insert assigned salt B at 480 nm and try again."
            }
          },
          {
            "id": "scan-read-480-salt-b-action-node",
            "type": "action",
            "title": "Read assigned salt B at 480 nm",
            "description": "Read assigned salt B at 480 nm",
            "actionId": "scan-read-480-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-480-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt B at 480 nm was completed.",
                "actionId": "scan-read-480-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt B at 480 nm complete.",
              "retry": "Review Read assigned salt B at 480 nm and try again."
            }
          },
          {
            "id": "scan-record-480-salt-b-action-node",
            "type": "action",
            "title": "Record assigned salt B at 480 nm",
            "description": "Record assigned salt B at 480 nm",
            "actionId": "scan-record-480-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-480-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt B at 480 nm was completed.",
                "actionId": "scan-record-480-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt B at 480 nm complete.",
              "retry": "Review Record assigned salt B at 480 nm and try again."
            }
          },
          {
            "id": "scan-remove-480-salt-b-action-node",
            "type": "action",
            "title": "Remove assigned salt B after 480 nm",
            "description": "Remove assigned salt B after 480 nm",
            "actionId": "scan-remove-480-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-480-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt B after 480 nm was completed.",
                "actionId": "scan-remove-480-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt B after 480 nm complete.",
              "retry": "Review Remove assigned salt B after 480 nm and try again."
            }
          },
          {
            "id": "scan-set-500-action-node",
            "type": "action",
            "title": "Set the source-stated scan wavelength to 500 nm",
            "description": "Set the source-stated scan wavelength to 500 nm",
            "actionId": "scan-set-500-action",
            "config": {},
            "validation": [
              {
                "id": "scan-set-500-action-node-done",
                "type": "actionEvidence",
                "label": "Set the source-stated scan wavelength to 500 nm was completed.",
                "actionId": "scan-set-500-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set the source-stated scan wavelength to 500 nm complete.",
              "retry": "Review Set the source-stated scan wavelength to 500 nm and try again."
            }
          },
          {
            "id": "scan-insert-500-salt-a-action-node",
            "type": "action",
            "title": "Insert assigned salt A at 500 nm",
            "description": "Insert assigned salt A at 500 nm",
            "actionId": "scan-insert-500-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-500-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt A at 500 nm was completed.",
                "actionId": "scan-insert-500-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt A at 500 nm complete.",
              "retry": "Review Insert assigned salt A at 500 nm and try again."
            }
          },
          {
            "id": "scan-read-500-salt-a-action-node",
            "type": "action",
            "title": "Read assigned salt A at 500 nm",
            "description": "Read assigned salt A at 500 nm",
            "actionId": "scan-read-500-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-500-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt A at 500 nm was completed.",
                "actionId": "scan-read-500-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt A at 500 nm complete.",
              "retry": "Review Read assigned salt A at 500 nm and try again."
            }
          },
          {
            "id": "scan-record-500-salt-a-action-node",
            "type": "action",
            "title": "Record assigned salt A at 500 nm",
            "description": "Record assigned salt A at 500 nm",
            "actionId": "scan-record-500-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-500-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt A at 500 nm was completed.",
                "actionId": "scan-record-500-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt A at 500 nm complete.",
              "retry": "Review Record assigned salt A at 500 nm and try again."
            }
          },
          {
            "id": "scan-remove-500-salt-a-action-node",
            "type": "action",
            "title": "Remove assigned salt A after 500 nm",
            "description": "Remove assigned salt A after 500 nm",
            "actionId": "scan-remove-500-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-500-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt A after 500 nm was completed.",
                "actionId": "scan-remove-500-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt A after 500 nm complete.",
              "retry": "Review Remove assigned salt A after 500 nm and try again."
            }
          },
          {
            "id": "scan-insert-500-salt-b-action-node",
            "type": "action",
            "title": "Insert assigned salt B at 500 nm",
            "description": "Insert assigned salt B at 500 nm",
            "actionId": "scan-insert-500-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-500-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt B at 500 nm was completed.",
                "actionId": "scan-insert-500-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt B at 500 nm complete.",
              "retry": "Review Insert assigned salt B at 500 nm and try again."
            }
          },
          {
            "id": "scan-read-500-salt-b-action-node",
            "type": "action",
            "title": "Read assigned salt B at 500 nm",
            "description": "Read assigned salt B at 500 nm",
            "actionId": "scan-read-500-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-500-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt B at 500 nm was completed.",
                "actionId": "scan-read-500-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt B at 500 nm complete.",
              "retry": "Review Read assigned salt B at 500 nm and try again."
            }
          },
          {
            "id": "scan-record-500-salt-b-action-node",
            "type": "action",
            "title": "Record assigned salt B at 500 nm",
            "description": "Record assigned salt B at 500 nm",
            "actionId": "scan-record-500-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-500-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt B at 500 nm was completed.",
                "actionId": "scan-record-500-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt B at 500 nm complete.",
              "retry": "Review Record assigned salt B at 500 nm and try again."
            }
          },
          {
            "id": "scan-remove-500-salt-b-action-node",
            "type": "action",
            "title": "Remove assigned salt B after 500 nm",
            "description": "Remove assigned salt B after 500 nm",
            "actionId": "scan-remove-500-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-500-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt B after 500 nm was completed.",
                "actionId": "scan-remove-500-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt B after 500 nm complete.",
              "retry": "Review Remove assigned salt B after 500 nm and try again."
            }
          },
          {
            "id": "scan-set-520-action-node",
            "type": "action",
            "title": "Set the source-stated scan wavelength to 520 nm",
            "description": "Set the source-stated scan wavelength to 520 nm",
            "actionId": "scan-set-520-action",
            "config": {},
            "validation": [
              {
                "id": "scan-set-520-action-node-done",
                "type": "actionEvidence",
                "label": "Set the source-stated scan wavelength to 520 nm was completed.",
                "actionId": "scan-set-520-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set the source-stated scan wavelength to 520 nm complete.",
              "retry": "Review Set the source-stated scan wavelength to 520 nm and try again."
            }
          },
          {
            "id": "scan-insert-520-salt-a-action-node",
            "type": "action",
            "title": "Insert assigned salt A at 520 nm",
            "description": "Insert assigned salt A at 520 nm",
            "actionId": "scan-insert-520-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-520-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt A at 520 nm was completed.",
                "actionId": "scan-insert-520-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt A at 520 nm complete.",
              "retry": "Review Insert assigned salt A at 520 nm and try again."
            }
          },
          {
            "id": "scan-read-520-salt-a-action-node",
            "type": "action",
            "title": "Read assigned salt A at 520 nm",
            "description": "Read assigned salt A at 520 nm",
            "actionId": "scan-read-520-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-520-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt A at 520 nm was completed.",
                "actionId": "scan-read-520-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt A at 520 nm complete.",
              "retry": "Review Read assigned salt A at 520 nm and try again."
            }
          },
          {
            "id": "scan-record-520-salt-a-action-node",
            "type": "action",
            "title": "Record assigned salt A at 520 nm",
            "description": "Record assigned salt A at 520 nm",
            "actionId": "scan-record-520-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-520-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt A at 520 nm was completed.",
                "actionId": "scan-record-520-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt A at 520 nm complete.",
              "retry": "Review Record assigned salt A at 520 nm and try again."
            }
          },
          {
            "id": "scan-remove-520-salt-a-action-node",
            "type": "action",
            "title": "Remove assigned salt A after 520 nm",
            "description": "Remove assigned salt A after 520 nm",
            "actionId": "scan-remove-520-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-520-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt A after 520 nm was completed.",
                "actionId": "scan-remove-520-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt A after 520 nm complete.",
              "retry": "Review Remove assigned salt A after 520 nm and try again."
            }
          },
          {
            "id": "scan-insert-520-salt-b-action-node",
            "type": "action",
            "title": "Insert assigned salt B at 520 nm",
            "description": "Insert assigned salt B at 520 nm",
            "actionId": "scan-insert-520-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-520-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt B at 520 nm was completed.",
                "actionId": "scan-insert-520-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt B at 520 nm complete.",
              "retry": "Review Insert assigned salt B at 520 nm and try again."
            }
          },
          {
            "id": "scan-read-520-salt-b-action-node",
            "type": "action",
            "title": "Read assigned salt B at 520 nm",
            "description": "Read assigned salt B at 520 nm",
            "actionId": "scan-read-520-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-520-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt B at 520 nm was completed.",
                "actionId": "scan-read-520-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt B at 520 nm complete.",
              "retry": "Review Read assigned salt B at 520 nm and try again."
            }
          },
          {
            "id": "scan-record-520-salt-b-action-node",
            "type": "action",
            "title": "Record assigned salt B at 520 nm",
            "description": "Record assigned salt B at 520 nm",
            "actionId": "scan-record-520-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-520-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt B at 520 nm was completed.",
                "actionId": "scan-record-520-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt B at 520 nm complete.",
              "retry": "Review Record assigned salt B at 520 nm and try again."
            }
          },
          {
            "id": "scan-remove-520-salt-b-action-node",
            "type": "action",
            "title": "Remove assigned salt B after 520 nm",
            "description": "Remove assigned salt B after 520 nm",
            "actionId": "scan-remove-520-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-520-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt B after 520 nm was completed.",
                "actionId": "scan-remove-520-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt B after 520 nm complete.",
              "retry": "Review Remove assigned salt B after 520 nm and try again."
            }
          },
          {
            "id": "scan-set-540-action-node",
            "type": "action",
            "title": "Set the source-stated scan wavelength to 540 nm",
            "description": "Set the source-stated scan wavelength to 540 nm",
            "actionId": "scan-set-540-action",
            "config": {},
            "validation": [
              {
                "id": "scan-set-540-action-node-done",
                "type": "actionEvidence",
                "label": "Set the source-stated scan wavelength to 540 nm was completed.",
                "actionId": "scan-set-540-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set the source-stated scan wavelength to 540 nm complete.",
              "retry": "Review Set the source-stated scan wavelength to 540 nm and try again."
            }
          },
          {
            "id": "scan-insert-540-salt-a-action-node",
            "type": "action",
            "title": "Insert assigned salt A at 540 nm",
            "description": "Insert assigned salt A at 540 nm",
            "actionId": "scan-insert-540-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-540-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt A at 540 nm was completed.",
                "actionId": "scan-insert-540-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt A at 540 nm complete.",
              "retry": "Review Insert assigned salt A at 540 nm and try again."
            }
          },
          {
            "id": "scan-read-540-salt-a-action-node",
            "type": "action",
            "title": "Read assigned salt A at 540 nm",
            "description": "Read assigned salt A at 540 nm",
            "actionId": "scan-read-540-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-540-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt A at 540 nm was completed.",
                "actionId": "scan-read-540-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt A at 540 nm complete.",
              "retry": "Review Read assigned salt A at 540 nm and try again."
            }
          },
          {
            "id": "scan-record-540-salt-a-action-node",
            "type": "action",
            "title": "Record assigned salt A at 540 nm",
            "description": "Record assigned salt A at 540 nm",
            "actionId": "scan-record-540-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-540-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt A at 540 nm was completed.",
                "actionId": "scan-record-540-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt A at 540 nm complete.",
              "retry": "Review Record assigned salt A at 540 nm and try again."
            }
          },
          {
            "id": "scan-remove-540-salt-a-action-node",
            "type": "action",
            "title": "Remove assigned salt A after 540 nm",
            "description": "Remove assigned salt A after 540 nm",
            "actionId": "scan-remove-540-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-540-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt A after 540 nm was completed.",
                "actionId": "scan-remove-540-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt A after 540 nm complete.",
              "retry": "Review Remove assigned salt A after 540 nm and try again."
            }
          },
          {
            "id": "scan-insert-540-salt-b-action-node",
            "type": "action",
            "title": "Insert assigned salt B at 540 nm",
            "description": "Insert assigned salt B at 540 nm",
            "actionId": "scan-insert-540-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-540-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt B at 540 nm was completed.",
                "actionId": "scan-insert-540-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt B at 540 nm complete.",
              "retry": "Review Insert assigned salt B at 540 nm and try again."
            }
          },
          {
            "id": "scan-read-540-salt-b-action-node",
            "type": "action",
            "title": "Read assigned salt B at 540 nm",
            "description": "Read assigned salt B at 540 nm",
            "actionId": "scan-read-540-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-540-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt B at 540 nm was completed.",
                "actionId": "scan-read-540-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt B at 540 nm complete.",
              "retry": "Review Read assigned salt B at 540 nm and try again."
            }
          },
          {
            "id": "scan-record-540-salt-b-action-node",
            "type": "action",
            "title": "Record assigned salt B at 540 nm",
            "description": "Record assigned salt B at 540 nm",
            "actionId": "scan-record-540-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-540-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt B at 540 nm was completed.",
                "actionId": "scan-record-540-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt B at 540 nm complete.",
              "retry": "Review Record assigned salt B at 540 nm and try again."
            }
          },
          {
            "id": "scan-remove-540-salt-b-action-node",
            "type": "action",
            "title": "Remove assigned salt B after 540 nm",
            "description": "Remove assigned salt B after 540 nm",
            "actionId": "scan-remove-540-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-540-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt B after 540 nm was completed.",
                "actionId": "scan-remove-540-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt B after 540 nm complete.",
              "retry": "Review Remove assigned salt B after 540 nm and try again."
            }
          },
          {
            "id": "scan-set-560-action-node",
            "type": "action",
            "title": "Set the source-stated scan wavelength to 560 nm",
            "description": "Set the source-stated scan wavelength to 560 nm",
            "actionId": "scan-set-560-action",
            "config": {},
            "validation": [
              {
                "id": "scan-set-560-action-node-done",
                "type": "actionEvidence",
                "label": "Set the source-stated scan wavelength to 560 nm was completed.",
                "actionId": "scan-set-560-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set the source-stated scan wavelength to 560 nm complete.",
              "retry": "Review Set the source-stated scan wavelength to 560 nm and try again."
            }
          },
          {
            "id": "scan-insert-560-salt-a-action-node",
            "type": "action",
            "title": "Insert assigned salt A at 560 nm",
            "description": "Insert assigned salt A at 560 nm",
            "actionId": "scan-insert-560-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-560-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt A at 560 nm was completed.",
                "actionId": "scan-insert-560-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt A at 560 nm complete.",
              "retry": "Review Insert assigned salt A at 560 nm and try again."
            }
          },
          {
            "id": "scan-read-560-salt-a-action-node",
            "type": "action",
            "title": "Read assigned salt A at 560 nm",
            "description": "Read assigned salt A at 560 nm",
            "actionId": "scan-read-560-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-560-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt A at 560 nm was completed.",
                "actionId": "scan-read-560-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt A at 560 nm complete.",
              "retry": "Review Read assigned salt A at 560 nm and try again."
            }
          },
          {
            "id": "scan-record-560-salt-a-action-node",
            "type": "action",
            "title": "Record assigned salt A at 560 nm",
            "description": "Record assigned salt A at 560 nm",
            "actionId": "scan-record-560-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-560-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt A at 560 nm was completed.",
                "actionId": "scan-record-560-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt A at 560 nm complete.",
              "retry": "Review Record assigned salt A at 560 nm and try again."
            }
          },
          {
            "id": "scan-remove-560-salt-a-action-node",
            "type": "action",
            "title": "Remove assigned salt A after 560 nm",
            "description": "Remove assigned salt A after 560 nm",
            "actionId": "scan-remove-560-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-560-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt A after 560 nm was completed.",
                "actionId": "scan-remove-560-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt A after 560 nm complete.",
              "retry": "Review Remove assigned salt A after 560 nm and try again."
            }
          },
          {
            "id": "scan-insert-560-salt-b-action-node",
            "type": "action",
            "title": "Insert assigned salt B at 560 nm",
            "description": "Insert assigned salt B at 560 nm",
            "actionId": "scan-insert-560-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-560-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt B at 560 nm was completed.",
                "actionId": "scan-insert-560-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt B at 560 nm complete.",
              "retry": "Review Insert assigned salt B at 560 nm and try again."
            }
          },
          {
            "id": "scan-read-560-salt-b-action-node",
            "type": "action",
            "title": "Read assigned salt B at 560 nm",
            "description": "Read assigned salt B at 560 nm",
            "actionId": "scan-read-560-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-560-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt B at 560 nm was completed.",
                "actionId": "scan-read-560-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt B at 560 nm complete.",
              "retry": "Review Read assigned salt B at 560 nm and try again."
            }
          },
          {
            "id": "scan-record-560-salt-b-action-node",
            "type": "action",
            "title": "Record assigned salt B at 560 nm",
            "description": "Record assigned salt B at 560 nm",
            "actionId": "scan-record-560-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-560-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt B at 560 nm was completed.",
                "actionId": "scan-record-560-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt B at 560 nm complete.",
              "retry": "Review Record assigned salt B at 560 nm and try again."
            }
          },
          {
            "id": "scan-remove-560-salt-b-action-node",
            "type": "action",
            "title": "Remove assigned salt B after 560 nm",
            "description": "Remove assigned salt B after 560 nm",
            "actionId": "scan-remove-560-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-560-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt B after 560 nm was completed.",
                "actionId": "scan-remove-560-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt B after 560 nm complete.",
              "retry": "Review Remove assigned salt B after 560 nm and try again."
            }
          },
          {
            "id": "scan-set-580-action-node",
            "type": "action",
            "title": "Set the source-stated scan wavelength to 580 nm",
            "description": "Set the source-stated scan wavelength to 580 nm",
            "actionId": "scan-set-580-action",
            "config": {},
            "validation": [
              {
                "id": "scan-set-580-action-node-done",
                "type": "actionEvidence",
                "label": "Set the source-stated scan wavelength to 580 nm was completed.",
                "actionId": "scan-set-580-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set the source-stated scan wavelength to 580 nm complete.",
              "retry": "Review Set the source-stated scan wavelength to 580 nm and try again."
            }
          },
          {
            "id": "scan-insert-580-salt-a-action-node",
            "type": "action",
            "title": "Insert assigned salt A at 580 nm",
            "description": "Insert assigned salt A at 580 nm",
            "actionId": "scan-insert-580-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-580-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt A at 580 nm was completed.",
                "actionId": "scan-insert-580-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt A at 580 nm complete.",
              "retry": "Review Insert assigned salt A at 580 nm and try again."
            }
          },
          {
            "id": "scan-read-580-salt-a-action-node",
            "type": "action",
            "title": "Read assigned salt A at 580 nm",
            "description": "Read assigned salt A at 580 nm",
            "actionId": "scan-read-580-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-580-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt A at 580 nm was completed.",
                "actionId": "scan-read-580-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt A at 580 nm complete.",
              "retry": "Review Read assigned salt A at 580 nm and try again."
            }
          },
          {
            "id": "scan-record-580-salt-a-action-node",
            "type": "action",
            "title": "Record assigned salt A at 580 nm",
            "description": "Record assigned salt A at 580 nm",
            "actionId": "scan-record-580-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-580-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt A at 580 nm was completed.",
                "actionId": "scan-record-580-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt A at 580 nm complete.",
              "retry": "Review Record assigned salt A at 580 nm and try again."
            }
          },
          {
            "id": "scan-remove-580-salt-a-action-node",
            "type": "action",
            "title": "Remove assigned salt A after 580 nm",
            "description": "Remove assigned salt A after 580 nm",
            "actionId": "scan-remove-580-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-580-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt A after 580 nm was completed.",
                "actionId": "scan-remove-580-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt A after 580 nm complete.",
              "retry": "Review Remove assigned salt A after 580 nm and try again."
            }
          },
          {
            "id": "scan-insert-580-salt-b-action-node",
            "type": "action",
            "title": "Insert assigned salt B at 580 nm",
            "description": "Insert assigned salt B at 580 nm",
            "actionId": "scan-insert-580-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-580-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt B at 580 nm was completed.",
                "actionId": "scan-insert-580-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt B at 580 nm complete.",
              "retry": "Review Insert assigned salt B at 580 nm and try again."
            }
          },
          {
            "id": "scan-read-580-salt-b-action-node",
            "type": "action",
            "title": "Read assigned salt B at 580 nm",
            "description": "Read assigned salt B at 580 nm",
            "actionId": "scan-read-580-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-580-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt B at 580 nm was completed.",
                "actionId": "scan-read-580-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt B at 580 nm complete.",
              "retry": "Review Read assigned salt B at 580 nm and try again."
            }
          },
          {
            "id": "scan-record-580-salt-b-action-node",
            "type": "action",
            "title": "Record assigned salt B at 580 nm",
            "description": "Record assigned salt B at 580 nm",
            "actionId": "scan-record-580-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-580-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt B at 580 nm was completed.",
                "actionId": "scan-record-580-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt B at 580 nm complete.",
              "retry": "Review Record assigned salt B at 580 nm and try again."
            }
          },
          {
            "id": "scan-remove-580-salt-b-action-node",
            "type": "action",
            "title": "Remove assigned salt B after 580 nm",
            "description": "Remove assigned salt B after 580 nm",
            "actionId": "scan-remove-580-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-580-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt B after 580 nm was completed.",
                "actionId": "scan-remove-580-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt B after 580 nm complete.",
              "retry": "Review Remove assigned salt B after 580 nm and try again."
            }
          },
          {
            "id": "scan-set-600-action-node",
            "type": "action",
            "title": "Set the source-stated scan wavelength to 600 nm",
            "description": "Set the source-stated scan wavelength to 600 nm",
            "actionId": "scan-set-600-action",
            "config": {},
            "validation": [
              {
                "id": "scan-set-600-action-node-done",
                "type": "actionEvidence",
                "label": "Set the source-stated scan wavelength to 600 nm was completed.",
                "actionId": "scan-set-600-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set the source-stated scan wavelength to 600 nm complete.",
              "retry": "Review Set the source-stated scan wavelength to 600 nm and try again."
            }
          },
          {
            "id": "scan-insert-600-salt-a-action-node",
            "type": "action",
            "title": "Insert assigned salt A at 600 nm",
            "description": "Insert assigned salt A at 600 nm",
            "actionId": "scan-insert-600-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-600-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt A at 600 nm was completed.",
                "actionId": "scan-insert-600-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt A at 600 nm complete.",
              "retry": "Review Insert assigned salt A at 600 nm and try again."
            }
          },
          {
            "id": "scan-read-600-salt-a-action-node",
            "type": "action",
            "title": "Read assigned salt A at 600 nm",
            "description": "Read assigned salt A at 600 nm",
            "actionId": "scan-read-600-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-600-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt A at 600 nm was completed.",
                "actionId": "scan-read-600-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt A at 600 nm complete.",
              "retry": "Review Read assigned salt A at 600 nm and try again."
            }
          },
          {
            "id": "scan-record-600-salt-a-action-node",
            "type": "action",
            "title": "Record assigned salt A at 600 nm",
            "description": "Record assigned salt A at 600 nm",
            "actionId": "scan-record-600-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-600-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt A at 600 nm was completed.",
                "actionId": "scan-record-600-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt A at 600 nm complete.",
              "retry": "Review Record assigned salt A at 600 nm and try again."
            }
          },
          {
            "id": "scan-remove-600-salt-a-action-node",
            "type": "action",
            "title": "Remove assigned salt A after 600 nm",
            "description": "Remove assigned salt A after 600 nm",
            "actionId": "scan-remove-600-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-600-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt A after 600 nm was completed.",
                "actionId": "scan-remove-600-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt A after 600 nm complete.",
              "retry": "Review Remove assigned salt A after 600 nm and try again."
            }
          },
          {
            "id": "scan-insert-600-salt-b-action-node",
            "type": "action",
            "title": "Insert assigned salt B at 600 nm",
            "description": "Insert assigned salt B at 600 nm",
            "actionId": "scan-insert-600-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-600-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt B at 600 nm was completed.",
                "actionId": "scan-insert-600-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt B at 600 nm complete.",
              "retry": "Review Insert assigned salt B at 600 nm and try again."
            }
          },
          {
            "id": "scan-read-600-salt-b-action-node",
            "type": "action",
            "title": "Read assigned salt B at 600 nm",
            "description": "Read assigned salt B at 600 nm",
            "actionId": "scan-read-600-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-600-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt B at 600 nm was completed.",
                "actionId": "scan-read-600-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt B at 600 nm complete.",
              "retry": "Review Read assigned salt B at 600 nm and try again."
            }
          },
          {
            "id": "scan-record-600-salt-b-action-node",
            "type": "action",
            "title": "Record assigned salt B at 600 nm",
            "description": "Record assigned salt B at 600 nm",
            "actionId": "scan-record-600-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-600-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt B at 600 nm was completed.",
                "actionId": "scan-record-600-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt B at 600 nm complete.",
              "retry": "Review Record assigned salt B at 600 nm and try again."
            }
          },
          {
            "id": "scan-remove-600-salt-b-action-node",
            "type": "action",
            "title": "Remove assigned salt B after 600 nm",
            "description": "Remove assigned salt B after 600 nm",
            "actionId": "scan-remove-600-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-600-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt B after 600 nm was completed.",
                "actionId": "scan-remove-600-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt B after 600 nm complete.",
              "retry": "Review Remove assigned salt B after 600 nm and try again."
            }
          },
          {
            "id": "scan-set-620-action-node",
            "type": "action",
            "title": "Set the source-stated scan wavelength to 620 nm",
            "description": "Set the source-stated scan wavelength to 620 nm",
            "actionId": "scan-set-620-action",
            "config": {},
            "validation": [
              {
                "id": "scan-set-620-action-node-done",
                "type": "actionEvidence",
                "label": "Set the source-stated scan wavelength to 620 nm was completed.",
                "actionId": "scan-set-620-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set the source-stated scan wavelength to 620 nm complete.",
              "retry": "Review Set the source-stated scan wavelength to 620 nm and try again."
            }
          },
          {
            "id": "scan-insert-620-salt-a-action-node",
            "type": "action",
            "title": "Insert assigned salt A at 620 nm",
            "description": "Insert assigned salt A at 620 nm",
            "actionId": "scan-insert-620-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-620-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt A at 620 nm was completed.",
                "actionId": "scan-insert-620-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt A at 620 nm complete.",
              "retry": "Review Insert assigned salt A at 620 nm and try again."
            }
          },
          {
            "id": "scan-read-620-salt-a-action-node",
            "type": "action",
            "title": "Read assigned salt A at 620 nm",
            "description": "Read assigned salt A at 620 nm",
            "actionId": "scan-read-620-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-620-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt A at 620 nm was completed.",
                "actionId": "scan-read-620-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt A at 620 nm complete.",
              "retry": "Review Read assigned salt A at 620 nm and try again."
            }
          },
          {
            "id": "scan-record-620-salt-a-action-node",
            "type": "action",
            "title": "Record assigned salt A at 620 nm",
            "description": "Record assigned salt A at 620 nm",
            "actionId": "scan-record-620-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-620-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt A at 620 nm was completed.",
                "actionId": "scan-record-620-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt A at 620 nm complete.",
              "retry": "Review Record assigned salt A at 620 nm and try again."
            }
          },
          {
            "id": "scan-remove-620-salt-a-action-node",
            "type": "action",
            "title": "Remove assigned salt A after 620 nm",
            "description": "Remove assigned salt A after 620 nm",
            "actionId": "scan-remove-620-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-620-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt A after 620 nm was completed.",
                "actionId": "scan-remove-620-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt A after 620 nm complete.",
              "retry": "Review Remove assigned salt A after 620 nm and try again."
            }
          },
          {
            "id": "scan-insert-620-salt-b-action-node",
            "type": "action",
            "title": "Insert assigned salt B at 620 nm",
            "description": "Insert assigned salt B at 620 nm",
            "actionId": "scan-insert-620-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-620-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt B at 620 nm was completed.",
                "actionId": "scan-insert-620-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt B at 620 nm complete.",
              "retry": "Review Insert assigned salt B at 620 nm and try again."
            }
          },
          {
            "id": "scan-read-620-salt-b-action-node",
            "type": "action",
            "title": "Read assigned salt B at 620 nm",
            "description": "Read assigned salt B at 620 nm",
            "actionId": "scan-read-620-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-620-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt B at 620 nm was completed.",
                "actionId": "scan-read-620-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt B at 620 nm complete.",
              "retry": "Review Read assigned salt B at 620 nm and try again."
            }
          },
          {
            "id": "scan-record-620-salt-b-action-node",
            "type": "action",
            "title": "Record assigned salt B at 620 nm",
            "description": "Record assigned salt B at 620 nm",
            "actionId": "scan-record-620-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-620-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt B at 620 nm was completed.",
                "actionId": "scan-record-620-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt B at 620 nm complete.",
              "retry": "Review Record assigned salt B at 620 nm and try again."
            }
          },
          {
            "id": "scan-remove-620-salt-b-action-node",
            "type": "action",
            "title": "Remove assigned salt B after 620 nm",
            "description": "Remove assigned salt B after 620 nm",
            "actionId": "scan-remove-620-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-620-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt B after 620 nm was completed.",
                "actionId": "scan-remove-620-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt B after 620 nm complete.",
              "retry": "Review Remove assigned salt B after 620 nm and try again."
            }
          },
          {
            "id": "scan-set-640-action-node",
            "type": "action",
            "title": "Set the source-stated scan wavelength to 640 nm",
            "description": "Set the source-stated scan wavelength to 640 nm",
            "actionId": "scan-set-640-action",
            "config": {},
            "validation": [
              {
                "id": "scan-set-640-action-node-done",
                "type": "actionEvidence",
                "label": "Set the source-stated scan wavelength to 640 nm was completed.",
                "actionId": "scan-set-640-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set the source-stated scan wavelength to 640 nm complete.",
              "retry": "Review Set the source-stated scan wavelength to 640 nm and try again."
            }
          },
          {
            "id": "scan-insert-640-salt-a-action-node",
            "type": "action",
            "title": "Insert assigned salt A at 640 nm",
            "description": "Insert assigned salt A at 640 nm",
            "actionId": "scan-insert-640-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-640-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt A at 640 nm was completed.",
                "actionId": "scan-insert-640-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt A at 640 nm complete.",
              "retry": "Review Insert assigned salt A at 640 nm and try again."
            }
          },
          {
            "id": "scan-read-640-salt-a-action-node",
            "type": "action",
            "title": "Read assigned salt A at 640 nm",
            "description": "Read assigned salt A at 640 nm",
            "actionId": "scan-read-640-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-640-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt A at 640 nm was completed.",
                "actionId": "scan-read-640-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt A at 640 nm complete.",
              "retry": "Review Read assigned salt A at 640 nm and try again."
            }
          },
          {
            "id": "scan-record-640-salt-a-action-node",
            "type": "action",
            "title": "Record assigned salt A at 640 nm",
            "description": "Record assigned salt A at 640 nm",
            "actionId": "scan-record-640-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-640-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt A at 640 nm was completed.",
                "actionId": "scan-record-640-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt A at 640 nm complete.",
              "retry": "Review Record assigned salt A at 640 nm and try again."
            }
          },
          {
            "id": "scan-remove-640-salt-a-action-node",
            "type": "action",
            "title": "Remove assigned salt A after 640 nm",
            "description": "Remove assigned salt A after 640 nm",
            "actionId": "scan-remove-640-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-640-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt A after 640 nm was completed.",
                "actionId": "scan-remove-640-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt A after 640 nm complete.",
              "retry": "Review Remove assigned salt A after 640 nm and try again."
            }
          },
          {
            "id": "scan-insert-640-salt-b-action-node",
            "type": "action",
            "title": "Insert assigned salt B at 640 nm",
            "description": "Insert assigned salt B at 640 nm",
            "actionId": "scan-insert-640-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-640-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt B at 640 nm was completed.",
                "actionId": "scan-insert-640-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt B at 640 nm complete.",
              "retry": "Review Insert assigned salt B at 640 nm and try again."
            }
          },
          {
            "id": "scan-read-640-salt-b-action-node",
            "type": "action",
            "title": "Read assigned salt B at 640 nm",
            "description": "Read assigned salt B at 640 nm",
            "actionId": "scan-read-640-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-640-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt B at 640 nm was completed.",
                "actionId": "scan-read-640-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt B at 640 nm complete.",
              "retry": "Review Read assigned salt B at 640 nm and try again."
            }
          },
          {
            "id": "scan-record-640-salt-b-action-node",
            "type": "action",
            "title": "Record assigned salt B at 640 nm",
            "description": "Record assigned salt B at 640 nm",
            "actionId": "scan-record-640-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-640-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt B at 640 nm was completed.",
                "actionId": "scan-record-640-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt B at 640 nm complete.",
              "retry": "Review Record assigned salt B at 640 nm and try again."
            }
          },
          {
            "id": "scan-remove-640-salt-b-action-node",
            "type": "action",
            "title": "Remove assigned salt B after 640 nm",
            "description": "Remove assigned salt B after 640 nm",
            "actionId": "scan-remove-640-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-640-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt B after 640 nm was completed.",
                "actionId": "scan-remove-640-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt B after 640 nm complete.",
              "retry": "Review Remove assigned salt B after 640 nm and try again."
            }
          },
          {
            "id": "scan-set-660-action-node",
            "type": "action",
            "title": "Set the source-stated scan wavelength to 660 nm",
            "description": "Set the source-stated scan wavelength to 660 nm",
            "actionId": "scan-set-660-action",
            "config": {},
            "validation": [
              {
                "id": "scan-set-660-action-node-done",
                "type": "actionEvidence",
                "label": "Set the source-stated scan wavelength to 660 nm was completed.",
                "actionId": "scan-set-660-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set the source-stated scan wavelength to 660 nm complete.",
              "retry": "Review Set the source-stated scan wavelength to 660 nm and try again."
            }
          },
          {
            "id": "scan-insert-660-salt-a-action-node",
            "type": "action",
            "title": "Insert assigned salt A at 660 nm",
            "description": "Insert assigned salt A at 660 nm",
            "actionId": "scan-insert-660-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-660-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt A at 660 nm was completed.",
                "actionId": "scan-insert-660-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt A at 660 nm complete.",
              "retry": "Review Insert assigned salt A at 660 nm and try again."
            }
          },
          {
            "id": "scan-read-660-salt-a-action-node",
            "type": "action",
            "title": "Read assigned salt A at 660 nm",
            "description": "Read assigned salt A at 660 nm",
            "actionId": "scan-read-660-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-660-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt A at 660 nm was completed.",
                "actionId": "scan-read-660-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt A at 660 nm complete.",
              "retry": "Review Read assigned salt A at 660 nm and try again."
            }
          },
          {
            "id": "scan-record-660-salt-a-action-node",
            "type": "action",
            "title": "Record assigned salt A at 660 nm",
            "description": "Record assigned salt A at 660 nm",
            "actionId": "scan-record-660-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-660-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt A at 660 nm was completed.",
                "actionId": "scan-record-660-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt A at 660 nm complete.",
              "retry": "Review Record assigned salt A at 660 nm and try again."
            }
          },
          {
            "id": "scan-remove-660-salt-a-action-node",
            "type": "action",
            "title": "Remove assigned salt A after 660 nm",
            "description": "Remove assigned salt A after 660 nm",
            "actionId": "scan-remove-660-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-660-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt A after 660 nm was completed.",
                "actionId": "scan-remove-660-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt A after 660 nm complete.",
              "retry": "Review Remove assigned salt A after 660 nm and try again."
            }
          },
          {
            "id": "scan-insert-660-salt-b-action-node",
            "type": "action",
            "title": "Insert assigned salt B at 660 nm",
            "description": "Insert assigned salt B at 660 nm",
            "actionId": "scan-insert-660-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-660-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt B at 660 nm was completed.",
                "actionId": "scan-insert-660-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt B at 660 nm complete.",
              "retry": "Review Insert assigned salt B at 660 nm and try again."
            }
          },
          {
            "id": "scan-read-660-salt-b-action-node",
            "type": "action",
            "title": "Read assigned salt B at 660 nm",
            "description": "Read assigned salt B at 660 nm",
            "actionId": "scan-read-660-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-660-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt B at 660 nm was completed.",
                "actionId": "scan-read-660-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt B at 660 nm complete.",
              "retry": "Review Read assigned salt B at 660 nm and try again."
            }
          },
          {
            "id": "scan-record-660-salt-b-action-node",
            "type": "action",
            "title": "Record assigned salt B at 660 nm",
            "description": "Record assigned salt B at 660 nm",
            "actionId": "scan-record-660-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-660-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt B at 660 nm was completed.",
                "actionId": "scan-record-660-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt B at 660 nm complete.",
              "retry": "Review Record assigned salt B at 660 nm and try again."
            }
          },
          {
            "id": "scan-remove-660-salt-b-action-node",
            "type": "action",
            "title": "Remove assigned salt B after 660 nm",
            "description": "Remove assigned salt B after 660 nm",
            "actionId": "scan-remove-660-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-660-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt B after 660 nm was completed.",
                "actionId": "scan-remove-660-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt B after 660 nm complete.",
              "retry": "Review Remove assigned salt B after 660 nm and try again."
            }
          },
          {
            "id": "scan-set-680-action-node",
            "type": "action",
            "title": "Set the source-stated scan wavelength to 680 nm",
            "description": "Set the source-stated scan wavelength to 680 nm",
            "actionId": "scan-set-680-action",
            "config": {},
            "validation": [
              {
                "id": "scan-set-680-action-node-done",
                "type": "actionEvidence",
                "label": "Set the source-stated scan wavelength to 680 nm was completed.",
                "actionId": "scan-set-680-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set the source-stated scan wavelength to 680 nm complete.",
              "retry": "Review Set the source-stated scan wavelength to 680 nm and try again."
            }
          },
          {
            "id": "scan-insert-680-salt-a-action-node",
            "type": "action",
            "title": "Insert assigned salt A at 680 nm",
            "description": "Insert assigned salt A at 680 nm",
            "actionId": "scan-insert-680-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-680-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt A at 680 nm was completed.",
                "actionId": "scan-insert-680-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt A at 680 nm complete.",
              "retry": "Review Insert assigned salt A at 680 nm and try again."
            }
          },
          {
            "id": "scan-read-680-salt-a-action-node",
            "type": "action",
            "title": "Read assigned salt A at 680 nm",
            "description": "Read assigned salt A at 680 nm",
            "actionId": "scan-read-680-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-680-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt A at 680 nm was completed.",
                "actionId": "scan-read-680-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt A at 680 nm complete.",
              "retry": "Review Read assigned salt A at 680 nm and try again."
            }
          },
          {
            "id": "scan-record-680-salt-a-action-node",
            "type": "action",
            "title": "Record assigned salt A at 680 nm",
            "description": "Record assigned salt A at 680 nm",
            "actionId": "scan-record-680-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-680-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt A at 680 nm was completed.",
                "actionId": "scan-record-680-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt A at 680 nm complete.",
              "retry": "Review Record assigned salt A at 680 nm and try again."
            }
          },
          {
            "id": "scan-remove-680-salt-a-action-node",
            "type": "action",
            "title": "Remove assigned salt A after 680 nm",
            "description": "Remove assigned salt A after 680 nm",
            "actionId": "scan-remove-680-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-680-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt A after 680 nm was completed.",
                "actionId": "scan-remove-680-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt A after 680 nm complete.",
              "retry": "Review Remove assigned salt A after 680 nm and try again."
            }
          },
          {
            "id": "scan-insert-680-salt-b-action-node",
            "type": "action",
            "title": "Insert assigned salt B at 680 nm",
            "description": "Insert assigned salt B at 680 nm",
            "actionId": "scan-insert-680-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-680-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt B at 680 nm was completed.",
                "actionId": "scan-insert-680-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt B at 680 nm complete.",
              "retry": "Review Insert assigned salt B at 680 nm and try again."
            }
          },
          {
            "id": "scan-read-680-salt-b-action-node",
            "type": "action",
            "title": "Read assigned salt B at 680 nm",
            "description": "Read assigned salt B at 680 nm",
            "actionId": "scan-read-680-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-680-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt B at 680 nm was completed.",
                "actionId": "scan-read-680-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt B at 680 nm complete.",
              "retry": "Review Read assigned salt B at 680 nm and try again."
            }
          },
          {
            "id": "scan-record-680-salt-b-action-node",
            "type": "action",
            "title": "Record assigned salt B at 680 nm",
            "description": "Record assigned salt B at 680 nm",
            "actionId": "scan-record-680-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-680-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt B at 680 nm was completed.",
                "actionId": "scan-record-680-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt B at 680 nm complete.",
              "retry": "Review Record assigned salt B at 680 nm and try again."
            }
          },
          {
            "id": "scan-remove-680-salt-b-action-node",
            "type": "action",
            "title": "Remove assigned salt B after 680 nm",
            "description": "Remove assigned salt B after 680 nm",
            "actionId": "scan-remove-680-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-680-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt B after 680 nm was completed.",
                "actionId": "scan-remove-680-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt B after 680 nm complete.",
              "retry": "Review Remove assigned salt B after 680 nm and try again."
            }
          },
          {
            "id": "scan-set-700-action-node",
            "type": "action",
            "title": "Set the source-stated scan wavelength to 700 nm",
            "description": "Set the source-stated scan wavelength to 700 nm",
            "actionId": "scan-set-700-action",
            "config": {},
            "validation": [
              {
                "id": "scan-set-700-action-node-done",
                "type": "actionEvidence",
                "label": "Set the source-stated scan wavelength to 700 nm was completed.",
                "actionId": "scan-set-700-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Set the source-stated scan wavelength to 700 nm complete.",
              "retry": "Review Set the source-stated scan wavelength to 700 nm and try again."
            }
          },
          {
            "id": "scan-insert-700-salt-a-action-node",
            "type": "action",
            "title": "Insert assigned salt A at 700 nm",
            "description": "Insert assigned salt A at 700 nm",
            "actionId": "scan-insert-700-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-700-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt A at 700 nm was completed.",
                "actionId": "scan-insert-700-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt A at 700 nm complete.",
              "retry": "Review Insert assigned salt A at 700 nm and try again."
            }
          },
          {
            "id": "scan-read-700-salt-a-action-node",
            "type": "action",
            "title": "Read assigned salt A at 700 nm",
            "description": "Read assigned salt A at 700 nm",
            "actionId": "scan-read-700-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-700-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt A at 700 nm was completed.",
                "actionId": "scan-read-700-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt A at 700 nm complete.",
              "retry": "Review Read assigned salt A at 700 nm and try again."
            }
          },
          {
            "id": "scan-record-700-salt-a-action-node",
            "type": "action",
            "title": "Record assigned salt A at 700 nm",
            "description": "Record assigned salt A at 700 nm",
            "actionId": "scan-record-700-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-700-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt A at 700 nm was completed.",
                "actionId": "scan-record-700-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt A at 700 nm complete.",
              "retry": "Review Record assigned salt A at 700 nm and try again."
            }
          },
          {
            "id": "scan-remove-700-salt-a-action-node",
            "type": "action",
            "title": "Remove assigned salt A after 700 nm",
            "description": "Remove assigned salt A after 700 nm",
            "actionId": "scan-remove-700-salt-a-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-700-salt-a-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt A after 700 nm was completed.",
                "actionId": "scan-remove-700-salt-a-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt A after 700 nm complete.",
              "retry": "Review Remove assigned salt A after 700 nm and try again."
            }
          },
          {
            "id": "scan-insert-700-salt-b-action-node",
            "type": "action",
            "title": "Insert assigned salt B at 700 nm",
            "description": "Insert assigned salt B at 700 nm",
            "actionId": "scan-insert-700-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-insert-700-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Insert assigned salt B at 700 nm was completed.",
                "actionId": "scan-insert-700-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Insert assigned salt B at 700 nm complete.",
              "retry": "Review Insert assigned salt B at 700 nm and try again."
            }
          },
          {
            "id": "scan-read-700-salt-b-action-node",
            "type": "action",
            "title": "Read assigned salt B at 700 nm",
            "description": "Read assigned salt B at 700 nm",
            "actionId": "scan-read-700-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-read-700-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Read assigned salt B at 700 nm was completed.",
                "actionId": "scan-read-700-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read assigned salt B at 700 nm complete.",
              "retry": "Review Read assigned salt B at 700 nm and try again."
            }
          },
          {
            "id": "scan-record-700-salt-b-action-node",
            "type": "action",
            "title": "Record assigned salt B at 700 nm",
            "description": "Record assigned salt B at 700 nm",
            "actionId": "scan-record-700-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-record-700-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Record assigned salt B at 700 nm was completed.",
                "actionId": "scan-record-700-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record assigned salt B at 700 nm complete.",
              "retry": "Review Record assigned salt B at 700 nm and try again."
            }
          },
          {
            "id": "scan-remove-700-salt-b-action-node",
            "type": "action",
            "title": "Remove assigned salt B after 700 nm",
            "description": "Remove assigned salt B after 700 nm",
            "actionId": "scan-remove-700-salt-b-action",
            "config": {},
            "validation": [
              {
                "id": "scan-remove-700-salt-b-action-node-done",
                "type": "actionEvidence",
                "label": "Remove assigned salt B after 700 nm was completed.",
                "actionId": "scan-remove-700-salt-b-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Remove assigned salt B after 700 nm complete.",
              "retry": "Review Remove assigned salt B after 700 nm and try again."
            }
          },
          {
            "id": "scan-return-salt-a-after-series-action-node",
            "type": "action",
            "title": "Return assigned salt A after the scan series",
            "description": "Return assigned salt A after the scan series",
            "actionId": "scan-return-salt-a-after-series-action",
            "config": {},
            "validation": [
              {
                "id": "scan-return-salt-a-after-series-action-node-done",
                "type": "actionEvidence",
                "label": "Return assigned salt A after the scan series was completed.",
                "actionId": "scan-return-salt-a-after-series-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Return assigned salt A after the scan series complete.",
              "retry": "Review Return assigned salt A after the scan series and try again."
            }
          },
          {
            "id": "scan-return-salt-b-after-series-action-node",
            "type": "action",
            "title": "Return assigned salt B after the scan series",
            "description": "Return assigned salt B after the scan series",
            "actionId": "scan-return-salt-b-after-series-action",
            "config": {},
            "validation": [
              {
                "id": "scan-return-salt-b-after-series-action-node-done",
                "type": "actionEvidence",
                "label": "Return assigned salt B after the scan series was completed.",
                "actionId": "scan-return-salt-b-after-series-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Return assigned salt B after the scan series complete.",
              "retry": "Review Return assigned salt B after the scan series and try again."
            }
          },
          {
            "id": "record-standard-final-volume-action-node",
            "type": "action",
            "title": "Record the source-stated standard final-volume endpoint",
            "description": "Record the source-stated standard final-volume endpoint",
            "actionId": "record-standard-final-volume-action",
            "config": {},
            "validation": [
              {
                "id": "record-standard-final-volume-action-node-done",
                "type": "actionEvidence",
                "label": "Record the source-stated standard final-volume endpoint was completed.",
                "actionId": "record-standard-final-volume-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record the source-stated standard final-volume endpoint complete.",
              "retry": "Review Record the source-stated standard final-volume endpoint and try again."
            }
          },
          {
            "id": "record-unknown-final-volume-action-node",
            "type": "action",
            "title": "Record the source-stated unknown final-volume endpoint",
            "description": "Record the source-stated unknown final-volume endpoint",
            "actionId": "record-unknown-final-volume-action",
            "config": {},
            "validation": [
              {
                "id": "record-unknown-final-volume-action-node-done",
                "type": "actionEvidence",
                "label": "Record the source-stated unknown final-volume endpoint was completed.",
                "actionId": "record-unknown-final-volume-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record the source-stated unknown final-volume endpoint complete.",
              "retry": "Review Record the source-stated unknown final-volume endpoint and try again."
            }
          },
          {
            "id": "measure-50ml-digest-water-action-node",
            "type": "action",
            "title": "Measure the source-stated 50 mL digest water",
            "description": "Measure the source-stated 50 mL digest water",
            "actionId": "measure-50ml-digest-water-action",
            "config": {},
            "validation": [
              {
                "id": "measure-50ml-digest-water-action-node-done",
                "type": "actionEvidence",
                "label": "Measure the source-stated 50 mL digest water was completed.",
                "actionId": "measure-50ml-digest-water-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Measure the source-stated 50 mL digest water complete.",
              "retry": "Review Measure the source-stated 50 mL digest water and try again."
            }
          },
          {
            "id": "teacher-add-50ml-water-to-digest-action-node",
            "type": "action",
            "title": "Teacher adds the source-stated 50 mL water to the completed digest",
            "description": "Teacher adds the source-stated 50 mL water to the completed digest",
            "actionId": "teacher-add-50ml-water-to-digest-action",
            "config": {},
            "validation": [
              {
                "id": "teacher-add-50ml-water-to-digest-action-node-done",
                "type": "actionEvidence",
                "label": "Teacher adds the source-stated 50 mL water to the completed digest was completed.",
                "actionId": "teacher-add-50ml-water-to-digest-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Teacher adds the source-stated 50 mL water to the completed digest complete.",
              "retry": "Review Teacher adds the source-stated 50 mL water to the completed digest and try again."
            }
          },
          {
            "id": "confirm-diluted-digest-material-action-node",
            "type": "action",
            "title": "Confirm the conservative diluted-digest material transition",
            "description": "Confirm the conservative diluted-digest material transition",
            "actionId": "confirm-diluted-digest-material-action",
            "config": {},
            "validation": [
              {
                "id": "confirm-diluted-digest-material-action-node-done",
                "type": "actionEvidence",
                "label": "Confirm the conservative diluted-digest material transition was completed.",
                "actionId": "confirm-diluted-digest-material-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Confirm the conservative diluted-digest material transition complete.",
              "retry": "Review Confirm the conservative diluted-digest material transition and try again."
            }
          },
          {
            "id": "standard-0p200-aliquot-ml-action-node",
            "type": "calculation",
            "title": "Calculate the 0.200 M aliquot",
            "description": "Calculate the 0.200 M aliquot",
            "actionId": "standard-0p200-aliquot-ml-action",
            "config": {},
            "validation": [
              {
                "id": "standard-0p200-aliquot-ml-action-node-done",
                "type": "actionEvidence",
                "label": "Calculate the 0.200 M aliquot was completed.",
                "actionId": "standard-0p200-aliquot-ml-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Calculate the 0.200 M aliquot complete.",
              "retry": "Review Calculate the 0.200 M aliquot and try again."
            }
          },
          {
            "id": "standard-0p100-aliquot-ml-action-node",
            "type": "calculation",
            "title": "Calculate the 0.100 M aliquot",
            "description": "Calculate the 0.100 M aliquot",
            "actionId": "standard-0p100-aliquot-ml-action",
            "config": {},
            "validation": [
              {
                "id": "standard-0p100-aliquot-ml-action-node-done",
                "type": "actionEvidence",
                "label": "Calculate the 0.100 M aliquot was completed.",
                "actionId": "standard-0p100-aliquot-ml-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Calculate the 0.100 M aliquot complete.",
              "retry": "Review Calculate the 0.100 M aliquot and try again."
            }
          },
          {
            "id": "standard-0p0500-aliquot-ml-action-node",
            "type": "calculation",
            "title": "Calculate the 0.0500 M aliquot",
            "description": "Calculate the 0.0500 M aliquot",
            "actionId": "standard-0p0500-aliquot-ml-action",
            "config": {},
            "validation": [
              {
                "id": "standard-0p0500-aliquot-ml-action-node-done",
                "type": "actionEvidence",
                "label": "Calculate the 0.0500 M aliquot was completed.",
                "actionId": "standard-0p0500-aliquot-ml-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Calculate the 0.0500 M aliquot complete.",
              "retry": "Review Calculate the 0.0500 M aliquot and try again."
            }
          },
          {
            "id": "standard-0p0250-aliquot-ml-action-node",
            "type": "calculation",
            "title": "Calculate the 0.0250 M aliquot",
            "description": "Calculate the 0.0250 M aliquot",
            "actionId": "standard-0p0250-aliquot-ml-action",
            "config": {},
            "validation": [
              {
                "id": "standard-0p0250-aliquot-ml-action-node-done",
                "type": "actionEvidence",
                "label": "Calculate the 0.0250 M aliquot was completed.",
                "actionId": "standard-0p0250-aliquot-ml-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Calculate the 0.0250 M aliquot complete.",
              "retry": "Review Calculate the 0.0250 M aliquot and try again."
            }
          },
          {
            "id": "fill-color-depth-unknown-action-node",
            "type": "action",
            "title": "Fill the comparison unknown tube",
            "description": "Fill the comparison unknown tube",
            "actionId": "fill-color-depth-unknown-action",
            "config": {},
            "validation": [
              {
                "id": "fill-color-depth-unknown-action-node-done",
                "type": "actionEvidence",
                "label": "Fill the comparison unknown tube was completed.",
                "actionId": "fill-color-depth-unknown-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Fill the comparison unknown tube complete.",
              "retry": "Review Fill the comparison unknown tube and try again."
            }
          },
          {
            "id": "fill-color-depth-standard-action-node",
            "type": "action",
            "title": "Fill the comparison 0.400 M standard tube",
            "description": "Fill the comparison 0.400 M standard tube",
            "actionId": "fill-color-depth-standard-action",
            "config": {},
            "validation": [
              {
                "id": "fill-color-depth-standard-action-node-done",
                "type": "actionEvidence",
                "label": "Fill the comparison 0.400 M standard tube was completed.",
                "actionId": "fill-color-depth-standard-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Fill the comparison 0.400 M standard tube complete.",
              "retry": "Review Fill the comparison 0.400 M standard tube and try again."
            }
          },
          {
            "id": "collect-0p0250-waste-action-node",
            "type": "action",
            "title": "Collect remaining 0p0250 M standard solution in the treatment beaker",
            "description": "Collect remaining 0p0250 M standard solution in the treatment beaker",
            "actionId": "collect-0p0250-waste-action",
            "config": {},
            "validation": [
              {
                "id": "collect-0p0250-waste-action-node-done",
                "type": "actionEvidence",
                "label": "Collect remaining 0p0250 M standard solution in the treatment beaker was completed.",
                "actionId": "collect-0p0250-waste-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Collect remaining 0p0250 M standard solution in the treatment beaker complete.",
              "retry": "Review Collect remaining 0p0250 M standard solution in the treatment beaker and try again."
            }
          },
          {
            "id": "collect-0p0500-waste-action-node",
            "type": "action",
            "title": "Collect remaining 0p0500 M standard solution in the treatment beaker",
            "description": "Collect remaining 0p0500 M standard solution in the treatment beaker",
            "actionId": "collect-0p0500-waste-action",
            "config": {},
            "validation": [
              {
                "id": "collect-0p0500-waste-action-node-done",
                "type": "actionEvidence",
                "label": "Collect remaining 0p0500 M standard solution in the treatment beaker was completed.",
                "actionId": "collect-0p0500-waste-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Collect remaining 0p0500 M standard solution in the treatment beaker complete.",
              "retry": "Review Collect remaining 0p0500 M standard solution in the treatment beaker and try again."
            }
          },
          {
            "id": "collect-0p100-waste-action-node",
            "type": "action",
            "title": "Collect remaining 0p100 M standard solution in the treatment beaker",
            "description": "Collect remaining 0p100 M standard solution in the treatment beaker",
            "actionId": "collect-0p100-waste-action",
            "config": {},
            "validation": [
              {
                "id": "collect-0p100-waste-action-node-done",
                "type": "actionEvidence",
                "label": "Collect remaining 0p100 M standard solution in the treatment beaker was completed.",
                "actionId": "collect-0p100-waste-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Collect remaining 0p100 M standard solution in the treatment beaker complete.",
              "retry": "Review Collect remaining 0p100 M standard solution in the treatment beaker and try again."
            }
          },
          {
            "id": "collect-0p200-waste-action-node",
            "type": "action",
            "title": "Collect remaining 0p200 M standard solution in the treatment beaker",
            "description": "Collect remaining 0p200 M standard solution in the treatment beaker",
            "actionId": "collect-0p200-waste-action",
            "config": {},
            "validation": [
              {
                "id": "collect-0p200-waste-action-node-done",
                "type": "actionEvidence",
                "label": "Collect remaining 0p200 M standard solution in the treatment beaker was completed.",
                "actionId": "collect-0p200-waste-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Collect remaining 0p200 M standard solution in the treatment beaker complete.",
              "retry": "Review Collect remaining 0p200 M standard solution in the treatment beaker and try again."
            }
          },
          {
            "id": "collect-0p400-waste-action-node",
            "type": "action",
            "title": "Collect remaining 0p400 M standard solution in the treatment beaker",
            "description": "Collect remaining 0p400 M standard solution in the treatment beaker",
            "actionId": "collect-0p400-waste-action",
            "config": {},
            "validation": [
              {
                "id": "collect-0p400-waste-action-node-done",
                "type": "actionEvidence",
                "label": "Collect remaining 0p400 M standard solution in the treatment beaker was completed.",
                "actionId": "collect-0p400-waste-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Collect remaining 0p400 M standard solution in the treatment beaker complete.",
              "retry": "Review Collect remaining 0p400 M standard solution in the treatment beaker and try again."
            }
          },
          {
            "id": "collect-unknown-waste-action-node",
            "type": "action",
            "title": "Collect remaining unknown solution in the treatment beaker",
            "description": "Collect remaining unknown solution in the treatment beaker",
            "actionId": "collect-unknown-waste-action",
            "config": {},
            "validation": [
              {
                "id": "collect-unknown-waste-action-node-done",
                "type": "actionEvidence",
                "label": "Collect remaining unknown solution in the treatment beaker was completed.",
                "actionId": "collect-unknown-waste-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Collect remaining unknown solution in the treatment beaker complete.",
              "retry": "Review Collect remaining unknown solution in the treatment beaker and try again."
            }
          },
          {
            "id": "observe-waste-bubbling-action-node",
            "type": "action",
            "title": "Observe bubbling after this bicarbonate portion",
            "description": "Observe bubbling after this bicarbonate portion",
            "actionId": "observe-waste-bubbling-action",
            "config": {},
            "validation": [
              {
                "id": "observe-waste-bubbling-action-node-done",
                "type": "actionEvidence",
                "label": "Observe bubbling after this bicarbonate portion was completed.",
                "actionId": "observe-waste-bubbling-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Observe bubbling after this bicarbonate portion complete.",
              "retry": "Review Observe bubbling after this bicarbonate portion and try again."
            }
          },
          {
            "id": "classify-waste-ph-action-node",
            "type": "action",
            "title": "Classify the measured pH for treatment or teacher-directed disposal",
            "description": "Classify the measured pH for treatment or teacher-directed disposal",
            "actionId": "classify-waste-ph-action",
            "config": {},
            "validation": [
              {
                "id": "classify-waste-ph-action-node-done",
                "type": "actionEvidence",
                "label": "Classify the measured pH for treatment or teacher-directed disposal was completed.",
                "actionId": "classify-waste-ph-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Classify the measured pH for treatment or teacher-directed disposal complete.",
              "retry": "Review Classify the measured pH for treatment or teacher-directed disposal and try again."
            }
          },
          {
            "id": "confirm-waste-ready-for-disposal-action-node",
            "type": "action",
            "title": "Confirm treated waste is ready for teacher-directed disposal",
            "description": "Confirm treated waste is ready for teacher-directed disposal",
            "actionId": "confirm-waste-ready-for-disposal-action",
            "config": {},
            "validation": [
              {
                "id": "confirm-waste-ready-for-disposal-action-node-done",
                "type": "actionEvidence",
                "label": "Confirm treated waste is ready for teacher-directed disposal was completed.",
                "actionId": "confirm-waste-ready-for-disposal-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Confirm treated waste is ready for teacher-directed disposal complete.",
              "retry": "Review Confirm treated waste is ready for teacher-directed disposal and try again."
            }
          },
          {
            "id": "transfer-treated-waste-to-destination-action-node",
            "type": "action",
            "title": "Transfer treated waste to the teacher-designated destination",
            "description": "Transfer treated waste to the teacher-designated destination",
            "actionId": "transfer-treated-waste-to-destination-action",
            "config": {},
            "validation": [
              {
                "id": "transfer-treated-waste-to-destination-action-node-done",
                "type": "actionEvidence",
                "label": "Transfer treated waste to the teacher-designated destination was completed.",
                "actionId": "transfer-treated-waste-to-destination-action"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Transfer treated waste to the teacher-designated destination complete.",
              "retry": "Review Transfer treated waste to the teacher-designated destination and try again."
            }
          }
        ],
        "edges": [
          {
            "from": "transfer-digest",
            "to": "rinse-beaker-1",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "rinse-beaker-1",
            "to": "transfer-rinse-1",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "transfer-rinse-1",
            "to": "rinse-beaker-2",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "rinse-beaker-2",
            "to": "transfer-rinse-2",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "transfer-rinse-2",
            "to": "rinse-beaker-3",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "rinse-beaker-3",
            "to": "transfer-rinse-3",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "transfer-rinse-3",
            "to": "rinse-beaker-4",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "rinse-beaker-4",
            "to": "transfer-rinse-4",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "transfer-rinse-4",
            "to": "dilute-unknown-to-mark",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "standard-0p200-stock-transfer",
            "to": "standard-0p200-dilute",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "standard-0p100-stock-transfer",
            "to": "standard-0p100-dilute",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "standard-0p0500-stock-transfer",
            "to": "standard-0p0500-dilute",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "standard-0p0250-stock-transfer",
            "to": "standard-0p0250-dilute",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "calibrate-zero-percent-t",
            "to": "prepare-blank",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "prepare-blank",
            "to": "blank-wipe-orient",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "blank-wipe-orient",
            "to": "insert-blank",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "insert-blank",
            "to": "calibrate-hundred-percent-t",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "calibrate-hundred-percent-t",
            "to": "remove-blank",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "remove-blank",
            "to": "condition-0p0250",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "return-0p0250",
            "to": "condition-0p0500",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "return-0p0500",
            "to": "condition-0p100",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "return-0p100",
            "to": "condition-0p200",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "return-0p200",
            "to": "condition-0p400",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "condition-0p0250",
            "to": "fill-0p0250-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "fill-0p0250-cuvette-action-node",
            "to": "prepare-0p0250-optical-faces-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "prepare-0p0250-optical-faces-action-node",
            "to": "insert-0p0250-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "insert-0p0250-cuvette-action-node",
            "to": "read-0p0250-absorbance",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "read-0p0250-absorbance",
            "to": "record-0p0250-absorbance",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-0p0250-absorbance",
            "to": "remove-0p0250-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "remove-0p0250-cuvette-action-node",
            "to": "return-0p0250",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "condition-0p0500",
            "to": "fill-0p0500-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "fill-0p0500-cuvette-action-node",
            "to": "prepare-0p0500-optical-faces-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "prepare-0p0500-optical-faces-action-node",
            "to": "insert-0p0500-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "insert-0p0500-cuvette-action-node",
            "to": "read-0p0500-absorbance",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "read-0p0500-absorbance",
            "to": "record-0p0500-absorbance",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-0p0500-absorbance",
            "to": "remove-0p0500-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "remove-0p0500-cuvette-action-node",
            "to": "return-0p0500",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "condition-0p100",
            "to": "fill-0p100-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "fill-0p100-cuvette-action-node",
            "to": "prepare-0p100-optical-faces-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "prepare-0p100-optical-faces-action-node",
            "to": "insert-0p100-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "insert-0p100-cuvette-action-node",
            "to": "read-0p100-absorbance",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "read-0p100-absorbance",
            "to": "record-0p100-absorbance",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-0p100-absorbance",
            "to": "remove-0p100-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "remove-0p100-cuvette-action-node",
            "to": "return-0p100",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "condition-0p200",
            "to": "fill-0p200-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "fill-0p200-cuvette-action-node",
            "to": "prepare-0p200-optical-faces-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "prepare-0p200-optical-faces-action-node",
            "to": "insert-0p200-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "insert-0p200-cuvette-action-node",
            "to": "read-0p200-absorbance",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "read-0p200-absorbance",
            "to": "record-0p200-absorbance",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-0p200-absorbance",
            "to": "remove-0p200-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "remove-0p200-cuvette-action-node",
            "to": "return-0p200",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "condition-0p400",
            "to": "fill-0p400-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "fill-0p400-cuvette-action-node",
            "to": "prepare-0p400-optical-faces-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "prepare-0p400-optical-faces-action-node",
            "to": "insert-0p400-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "insert-0p400-cuvette-action-node",
            "to": "read-0p400-absorbance",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "read-0p400-absorbance",
            "to": "record-0p400-absorbance",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-0p400-absorbance",
            "to": "remove-0p400-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "remove-0p400-cuvette-action-node",
            "to": "return-0p400",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "condition-unknown",
            "to": "fill-unknown-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "fill-unknown-cuvette-action-node",
            "to": "prepare-unknown-optical-faces-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "prepare-unknown-optical-faces-action-node",
            "to": "insert-unknown-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "insert-unknown-cuvette-action-node",
            "to": "read-unknown-absorbance",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "read-unknown-absorbance",
            "to": "record-unknown-absorbance",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-unknown-absorbance",
            "to": "remove-unknown-cuvette-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "remove-unknown-cuvette-action-node",
            "to": "return-unknown",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "return-0p400",
            "to": "transfer-prepared-unknown-to-original-tube-action-node",
            "label": "Prepare the original unknown tube",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "transfer-prepared-unknown-to-original-tube-action-node",
            "to": "condition-unknown",
            "label": "Condition from the prepared unknown",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "tare-empty-beaker",
            "to": "weigh-brass",
            "label": "Continue after required evidence",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "weigh-brass",
            "to": "place-brass-in-beaker",
            "label": "Transfer the measured mass",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-place-photometer-action-node",
            "to": "scan-configure-salt-a-inventory-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-configure-salt-a-inventory-action-node",
            "to": "scan-condition-salt-a-once-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-condition-salt-a-once-action-node",
            "to": "scan-fill-salt-a-once-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-fill-salt-a-once-action-node",
            "to": "scan-prepare-salt-a-once-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-prepare-salt-a-once-action-node",
            "to": "scan-configure-salt-b-inventory-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-configure-salt-b-inventory-action-node",
            "to": "scan-condition-salt-b-once-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-condition-salt-b-once-action-node",
            "to": "scan-fill-salt-b-once-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-fill-salt-b-once-action-node",
            "to": "scan-prepare-salt-b-once-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-prepare-salt-b-once-action-node",
            "to": "scan-set-400-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-set-400-action-node",
            "to": "scan-insert-400-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-400-salt-a-action-node",
            "to": "scan-read-400-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-400-salt-a-action-node",
            "to": "scan-record-400-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-400-salt-a-action-node",
            "to": "scan-remove-400-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-400-salt-a-action-node",
            "to": "scan-insert-400-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-400-salt-b-action-node",
            "to": "scan-read-400-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-400-salt-b-action-node",
            "to": "scan-record-400-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-400-salt-b-action-node",
            "to": "scan-remove-400-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-400-salt-b-action-node",
            "to": "scan-set-420-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-set-420-action-node",
            "to": "scan-insert-420-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-420-salt-a-action-node",
            "to": "scan-read-420-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-420-salt-a-action-node",
            "to": "scan-record-420-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-420-salt-a-action-node",
            "to": "scan-remove-420-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-420-salt-a-action-node",
            "to": "scan-insert-420-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-420-salt-b-action-node",
            "to": "scan-read-420-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-420-salt-b-action-node",
            "to": "scan-record-420-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-420-salt-b-action-node",
            "to": "scan-remove-420-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-420-salt-b-action-node",
            "to": "scan-set-440-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-set-440-action-node",
            "to": "scan-insert-440-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-440-salt-a-action-node",
            "to": "scan-read-440-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-440-salt-a-action-node",
            "to": "scan-record-440-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-440-salt-a-action-node",
            "to": "scan-remove-440-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-440-salt-a-action-node",
            "to": "scan-insert-440-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-440-salt-b-action-node",
            "to": "scan-read-440-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-440-salt-b-action-node",
            "to": "scan-record-440-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-440-salt-b-action-node",
            "to": "scan-remove-440-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-440-salt-b-action-node",
            "to": "scan-set-460-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-set-460-action-node",
            "to": "scan-insert-460-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-460-salt-a-action-node",
            "to": "scan-read-460-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-460-salt-a-action-node",
            "to": "scan-record-460-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-460-salt-a-action-node",
            "to": "scan-remove-460-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-460-salt-a-action-node",
            "to": "scan-insert-460-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-460-salt-b-action-node",
            "to": "scan-read-460-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-460-salt-b-action-node",
            "to": "scan-record-460-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-460-salt-b-action-node",
            "to": "scan-remove-460-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-460-salt-b-action-node",
            "to": "scan-set-480-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-set-480-action-node",
            "to": "scan-insert-480-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-480-salt-a-action-node",
            "to": "scan-read-480-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-480-salt-a-action-node",
            "to": "scan-record-480-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-480-salt-a-action-node",
            "to": "scan-remove-480-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-480-salt-a-action-node",
            "to": "scan-insert-480-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-480-salt-b-action-node",
            "to": "scan-read-480-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-480-salt-b-action-node",
            "to": "scan-record-480-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-480-salt-b-action-node",
            "to": "scan-remove-480-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-480-salt-b-action-node",
            "to": "scan-set-500-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-set-500-action-node",
            "to": "scan-insert-500-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-500-salt-a-action-node",
            "to": "scan-read-500-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-500-salt-a-action-node",
            "to": "scan-record-500-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-500-salt-a-action-node",
            "to": "scan-remove-500-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-500-salt-a-action-node",
            "to": "scan-insert-500-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-500-salt-b-action-node",
            "to": "scan-read-500-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-500-salt-b-action-node",
            "to": "scan-record-500-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-500-salt-b-action-node",
            "to": "scan-remove-500-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-500-salt-b-action-node",
            "to": "scan-set-520-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-set-520-action-node",
            "to": "scan-insert-520-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-520-salt-a-action-node",
            "to": "scan-read-520-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-520-salt-a-action-node",
            "to": "scan-record-520-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-520-salt-a-action-node",
            "to": "scan-remove-520-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-520-salt-a-action-node",
            "to": "scan-insert-520-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-520-salt-b-action-node",
            "to": "scan-read-520-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-520-salt-b-action-node",
            "to": "scan-record-520-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-520-salt-b-action-node",
            "to": "scan-remove-520-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-520-salt-b-action-node",
            "to": "scan-set-540-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-set-540-action-node",
            "to": "scan-insert-540-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-540-salt-a-action-node",
            "to": "scan-read-540-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-540-salt-a-action-node",
            "to": "scan-record-540-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-540-salt-a-action-node",
            "to": "scan-remove-540-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-540-salt-a-action-node",
            "to": "scan-insert-540-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-540-salt-b-action-node",
            "to": "scan-read-540-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-540-salt-b-action-node",
            "to": "scan-record-540-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-540-salt-b-action-node",
            "to": "scan-remove-540-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-540-salt-b-action-node",
            "to": "scan-set-560-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-set-560-action-node",
            "to": "scan-insert-560-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-560-salt-a-action-node",
            "to": "scan-read-560-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-560-salt-a-action-node",
            "to": "scan-record-560-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-560-salt-a-action-node",
            "to": "scan-remove-560-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-560-salt-a-action-node",
            "to": "scan-insert-560-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-560-salt-b-action-node",
            "to": "scan-read-560-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-560-salt-b-action-node",
            "to": "scan-record-560-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-560-salt-b-action-node",
            "to": "scan-remove-560-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-560-salt-b-action-node",
            "to": "scan-set-580-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-set-580-action-node",
            "to": "scan-insert-580-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-580-salt-a-action-node",
            "to": "scan-read-580-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-580-salt-a-action-node",
            "to": "scan-record-580-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-580-salt-a-action-node",
            "to": "scan-remove-580-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-580-salt-a-action-node",
            "to": "scan-insert-580-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-580-salt-b-action-node",
            "to": "scan-read-580-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-580-salt-b-action-node",
            "to": "scan-record-580-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-580-salt-b-action-node",
            "to": "scan-remove-580-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-580-salt-b-action-node",
            "to": "scan-set-600-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-set-600-action-node",
            "to": "scan-insert-600-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-600-salt-a-action-node",
            "to": "scan-read-600-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-600-salt-a-action-node",
            "to": "scan-record-600-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-600-salt-a-action-node",
            "to": "scan-remove-600-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-600-salt-a-action-node",
            "to": "scan-insert-600-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-600-salt-b-action-node",
            "to": "scan-read-600-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-600-salt-b-action-node",
            "to": "scan-record-600-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-600-salt-b-action-node",
            "to": "scan-remove-600-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-600-salt-b-action-node",
            "to": "scan-set-620-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-set-620-action-node",
            "to": "scan-insert-620-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-620-salt-a-action-node",
            "to": "scan-read-620-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-620-salt-a-action-node",
            "to": "scan-record-620-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-620-salt-a-action-node",
            "to": "scan-remove-620-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-620-salt-a-action-node",
            "to": "scan-insert-620-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-620-salt-b-action-node",
            "to": "scan-read-620-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-620-salt-b-action-node",
            "to": "scan-record-620-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-620-salt-b-action-node",
            "to": "scan-remove-620-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-620-salt-b-action-node",
            "to": "scan-set-640-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-set-640-action-node",
            "to": "scan-insert-640-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-640-salt-a-action-node",
            "to": "scan-read-640-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-640-salt-a-action-node",
            "to": "scan-record-640-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-640-salt-a-action-node",
            "to": "scan-remove-640-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-640-salt-a-action-node",
            "to": "scan-insert-640-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-640-salt-b-action-node",
            "to": "scan-read-640-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-640-salt-b-action-node",
            "to": "scan-record-640-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-640-salt-b-action-node",
            "to": "scan-remove-640-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-640-salt-b-action-node",
            "to": "scan-set-660-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-set-660-action-node",
            "to": "scan-insert-660-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-660-salt-a-action-node",
            "to": "scan-read-660-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-660-salt-a-action-node",
            "to": "scan-record-660-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-660-salt-a-action-node",
            "to": "scan-remove-660-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-660-salt-a-action-node",
            "to": "scan-insert-660-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-660-salt-b-action-node",
            "to": "scan-read-660-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-660-salt-b-action-node",
            "to": "scan-record-660-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-660-salt-b-action-node",
            "to": "scan-remove-660-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-660-salt-b-action-node",
            "to": "scan-set-680-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-set-680-action-node",
            "to": "scan-insert-680-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-680-salt-a-action-node",
            "to": "scan-read-680-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-680-salt-a-action-node",
            "to": "scan-record-680-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-680-salt-a-action-node",
            "to": "scan-remove-680-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-680-salt-a-action-node",
            "to": "scan-insert-680-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-680-salt-b-action-node",
            "to": "scan-read-680-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-680-salt-b-action-node",
            "to": "scan-record-680-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-680-salt-b-action-node",
            "to": "scan-remove-680-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-680-salt-b-action-node",
            "to": "scan-set-700-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-set-700-action-node",
            "to": "scan-insert-700-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-700-salt-a-action-node",
            "to": "scan-read-700-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-700-salt-a-action-node",
            "to": "scan-record-700-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-700-salt-a-action-node",
            "to": "scan-remove-700-salt-a-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-700-salt-a-action-node",
            "to": "scan-insert-700-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-insert-700-salt-b-action-node",
            "to": "scan-read-700-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-read-700-salt-b-action-node",
            "to": "scan-record-700-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-record-700-salt-b-action-node",
            "to": "scan-remove-700-salt-b-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-remove-700-salt-b-action-node",
            "to": "scan-return-salt-a-after-series-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "scan-return-salt-a-after-series-action-node",
            "to": "scan-return-salt-b-after-series-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-unknown-final-volume-action-node",
            "to": "record-standard-final-volume-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-standard-final-volume-action-node",
            "to": "measure-50ml-digest-water-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "measure-50ml-digest-water-action-node",
            "to": "teacher-add-50ml-water-to-digest-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "teacher-add-50ml-water-to-digest-action-node",
            "to": "confirm-diluted-digest-material-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "confirm-diluted-digest-material-action-node",
            "to": "transfer-digest",
            "label": "Transfer complete available digest",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "standard-0p200-aliquot-ml-action-node",
            "to": "standard-0p100-aliquot-ml-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "standard-0p100-aliquot-ml-action-node",
            "to": "standard-0p0500-aliquot-ml-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "standard-0p0500-aliquot-ml-action-node",
            "to": "standard-0p0250-aliquot-ml-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "dilute-unknown-to-mark",
            "to": "standard-0p200-aliquot-ml-action-node",
            "label": "Calculate physical standard transfers",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "standard-0p0250-aliquot-ml-action-node",
            "to": "standard-0p400-stock-transfer",
            "label": "Prepare standards",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "fill-color-depth-unknown-action-node",
            "to": "fill-color-depth-standard-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "fill-color-depth-standard-action-node",
            "to": "place-color-depth-comparison",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "place-color-depth-comparison",
            "to": "visual-match",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "visual-match",
            "to": "record-unknown-depth",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-unknown-depth",
            "to": "record-standard-depth",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "collect-0p0250-waste-action-node",
            "to": "collect-0p0500-waste-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "collect-0p0500-waste-action-node",
            "to": "collect-0p100-waste-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "collect-0p100-waste-action-node",
            "to": "collect-0p200-waste-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "collect-0p200-waste-action-node",
            "to": "collect-0p400-waste-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "collect-0p400-waste-action-node",
            "to": "collect-unknown-waste-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "collect-unknown-waste-action-node",
            "to": "neutralize-waste",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "neutralize-waste",
            "to": "observe-waste-bubbling-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "observe-waste-bubbling-action-node",
            "to": "record-waste-ph",
            "label": "Next",
            "condition": {
              "type": "calculationResult",
              "calculationId": "waste-bubbling-disposition",
              "min": 1,
              "max": 1
            }
          },
          {
            "from": "record-waste-ph",
            "to": "classify-waste-ph-action-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "classify-waste-ph-action-node",
            "to": "confirm-waste-ready-for-disposal-action-node",
            "label": "Next",
            "condition": {
              "type": "calculationResult",
              "calculationId": "waste-ph-disposition",
              "min": 1,
              "max": 1
            }
          },
          {
            "from": "observe-waste-bubbling-action-node",
            "to": "neutralize-waste",
            "label": "Add another small portion",
            "condition": {
              "type": "calculationResult",
              "calculationId": "waste-bubbling-disposition",
              "min": 0,
              "max": 0
            }
          },
          {
            "from": "classify-waste-ph-action-node",
            "to": "neutralize-waste",
            "label": "Retreat and retry pH",
            "condition": {
              "type": "calculationResult",
              "calculationId": "waste-ph-disposition",
              "min": 0,
              "max": 0
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
          "chemistry",
          "spectrophotometry",
          "brass",
          "source-grounded",
          "brass-colorimetry"
        ]
      },
      "composition": {
        "schemaVersion": 1,
        "ports": [
          {
            "id": "entry-tare-empty-beaker",
            "kind": "entry",
            "nodeId": "tare-empty-beaker",
            "label": "Entry"
          },
          {
            "id": "exit-place-brass-in-beaker",
            "kind": "exit",
            "nodeId": "place-brass-in-beaker",
            "label": "Exit"
          },
          {
            "id": "exit-standard-0p400-stock-transfer",
            "kind": "exit",
            "nodeId": "standard-0p400-stock-transfer",
            "label": "Exit"
          },
          {
            "id": "entry-standard-0p200-stock-transfer",
            "kind": "entry",
            "nodeId": "standard-0p200-stock-transfer",
            "label": "Entry"
          },
          {
            "id": "exit-standard-0p200-dilute",
            "kind": "exit",
            "nodeId": "standard-0p200-dilute",
            "label": "Exit"
          },
          {
            "id": "entry-standard-0p100-stock-transfer",
            "kind": "entry",
            "nodeId": "standard-0p100-stock-transfer",
            "label": "Entry"
          },
          {
            "id": "exit-standard-0p100-dilute",
            "kind": "exit",
            "nodeId": "standard-0p100-dilute",
            "label": "Exit"
          },
          {
            "id": "entry-standard-0p0500-stock-transfer",
            "kind": "entry",
            "nodeId": "standard-0p0500-stock-transfer",
            "label": "Entry"
          },
          {
            "id": "exit-standard-0p0500-dilute",
            "kind": "exit",
            "nodeId": "standard-0p0500-dilute",
            "label": "Exit"
          },
          {
            "id": "entry-standard-0p0250-stock-transfer",
            "kind": "entry",
            "nodeId": "standard-0p0250-stock-transfer",
            "label": "Entry"
          },
          {
            "id": "exit-standard-0p0250-dilute",
            "kind": "exit",
            "nodeId": "standard-0p0250-dilute",
            "label": "Exit"
          },
          {
            "id": "entry-calibrate-zero-percent-t",
            "kind": "entry",
            "nodeId": "calibrate-zero-percent-t",
            "label": "Entry"
          },
          {
            "id": "exit-return-unknown",
            "kind": "exit",
            "nodeId": "return-unknown",
            "label": "Exit"
          },
          {
            "id": "exit-record-standard-depth",
            "kind": "exit",
            "nodeId": "record-standard-depth",
            "label": "Exit"
          },
          {
            "id": "entry-scan-place-photometer-action-node",
            "kind": "entry",
            "nodeId": "scan-place-photometer-action-node",
            "label": "Entry"
          },
          {
            "id": "exit-scan-return-salt-b-after-series-action-node",
            "kind": "exit",
            "nodeId": "scan-return-salt-b-after-series-action-node",
            "label": "Exit"
          },
          {
            "id": "entry-record-unknown-final-volume-action-node",
            "kind": "entry",
            "nodeId": "record-unknown-final-volume-action-node",
            "label": "Entry"
          },
          {
            "id": "entry-fill-color-depth-unknown-action-node",
            "kind": "entry",
            "nodeId": "fill-color-depth-unknown-action-node",
            "label": "Entry"
          },
          {
            "id": "entry-collect-0p0250-waste-action-node",
            "kind": "entry",
            "nodeId": "collect-0p0250-waste-action-node",
            "label": "Entry"
          },
          {
            "id": "exit-confirm-waste-ready-for-disposal-action-node",
            "kind": "exit",
            "nodeId": "confirm-waste-ready-for-disposal-action-node",
            "label": "Exit"
          },
          {
            "id": "entry-transfer-treated-waste-to-destination-action-node",
            "kind": "entry",
            "nodeId": "transfer-treated-waste-to-destination-action-node",
            "label": "Entry"
          },
          {
            "id": "exit-transfer-treated-waste-to-destination-action-node",
            "kind": "exit",
            "nodeId": "transfer-treated-waste-to-destination-action-node",
            "label": "Exit"
          }
        ],
        "equipmentRoles": [
          {
            "roleId": "balance-instrument",
            "required": true,
            "allowedDefinitionIds": [
              "analytical-balance"
            ],
            "sourceInstanceIds": [
              "balance"
            ]
          },
          {
            "roleId": "weighed-vessel",
            "required": true,
            "allowedDefinitionIds": [
              "beaker-250ml"
            ],
            "sourceInstanceIds": [
              "brass-beaker"
            ]
          },
          {
            "roleId": "weighed-sample-source",
            "required": true,
            "allowedDefinitionIds": [
              "small-vial"
            ],
            "sourceInstanceIds": [
              "brass-sample-vial"
            ]
          },
          {
            "roleId": "receiving-vessel",
            "required": true,
            "allowedDefinitionIds": [
              "beaker-250ml",
              "volumetric-flask",
              "test-tube"
            ],
            "sourceInstanceIds": [
              "brass-beaker",
              "unknown-volumetric-flask",
              "standard-0p400-tube",
              "standard-0p200-tube",
              "standard-0p100-tube",
              "standard-0p0500-tube",
              "standard-0p0250-tube",
              "unknown-sample-tube"
            ]
          },
          {
            "roleId": "variable-volume-measuring-device",
            "required": true,
            "allowedDefinitionIds": [
              "graduated-cylinder",
              "graduated-pipette-10ml"
            ],
            "sourceInstanceIds": [
              "graduated-pipette",
              "digest-water-cylinder"
            ]
          },
          {
            "roleId": "liquid-source",
            "required": true,
            "allowedDefinitionIds": [
              "wash-bottle",
              "sample-bottle"
            ],
            "sourceInstanceIds": [
              "wash-bottle",
              "copper-standard-stock"
            ]
          },
          {
            "roleId": "measured-solvent-source",
            "required": true,
            "allowedDefinitionIds": [
              "graduated-cylinder",
              "volumetric-flask"
            ],
            "sourceInstanceIds": [
              "unknown-volumetric-flask",
              "digest-water-cylinder"
            ]
          },
          {
            "roleId": "mixture-source",
            "required": true,
            "allowedDefinitionIds": [
              "beaker-250ml"
            ],
            "sourceInstanceIds": [
              "brass-beaker"
            ]
          },
          {
            "roleId": "rinse-water-source",
            "required": true,
            "allowedDefinitionIds": [
              "wash-bottle"
            ],
            "sourceInstanceIds": [
              "wash-bottle"
            ]
          },
          {
            "roleId": "rinsed-vessel",
            "required": true,
            "allowedDefinitionIds": [
              "beaker-250ml"
            ],
            "sourceInstanceIds": [
              "brass-beaker"
            ]
          },
          {
            "roleId": "final-volume-vessel",
            "required": true,
            "allowedDefinitionIds": [
              "volumetric-flask",
              "test-tube"
            ],
            "sourceInstanceIds": [
              "unknown-volumetric-flask",
              "standard-0p400-tube",
              "standard-0p200-tube",
              "standard-0p100-tube",
              "standard-0p0500-tube",
              "standard-0p0250-tube"
            ]
          },
          {
            "roleId": "photometer-instrument",
            "required": true,
            "allowedDefinitionIds": [
              "spectrophotometer"
            ],
            "sourceInstanceIds": [
              "spectrophotometer"
            ]
          },
          {
            "roleId": "photometer-sample-holder",
            "required": true,
            "allowedDefinitionIds": [
              "cuvette"
            ],
            "sourceInstanceIds": [
              "measurement-cuvette",
              "salt-a-scan-cuvette",
              "salt-b-scan-cuvette"
            ]
          },
          {
            "roleId": "sample-source",
            "required": true,
            "allowedDefinitionIds": [
              "test-tube"
            ],
            "sourceInstanceIds": [
              "standard-0p400-tube",
              "standard-0p200-tube",
              "standard-0p100-tube",
              "standard-0p0500-tube",
              "standard-0p0250-tube",
              "unknown-sample-tube",
              "assigned-salt-a-solution",
              "assigned-salt-b-solution"
            ]
          },
          {
            "roleId": "provenance-matched-sample-receiver",
            "required": true,
            "allowedDefinitionIds": [
              "test-tube"
            ],
            "sourceInstanceIds": [
              "standard-0p400-tube",
              "standard-0p200-tube",
              "standard-0p100-tube",
              "standard-0p0500-tube",
              "standard-0p0250-tube",
              "unknown-sample-tube",
              "assigned-salt-a-solution",
              "assigned-salt-b-solution",
              "color-depth-unknown-tube",
              "color-depth-standard-tube"
            ]
          },
          {
            "roleId": "color-depth-comparison-apparatus",
            "required": true,
            "allowedDefinitionIds": [
              "brass-color-depth-comparison"
            ],
            "sourceInstanceIds": [
              "color-depth-comparison"
            ]
          },
          {
            "roleId": "waste-receiver",
            "required": true,
            "allowedDefinitionIds": [
              "waste-beaker"
            ],
            "sourceInstanceIds": [
              "waste-beaker",
              "teacher-designated-disposal-receiver"
            ]
          },
          {
            "roleId": "solid-reagent-source",
            "required": true,
            "allowedDefinitionIds": [
              "reagent-bottle"
            ],
            "sourceInstanceIds": [
              "baking-soda-bottle"
            ]
          },
          {
            "roleId": "ph-indicator-medium",
            "required": true,
            "allowedDefinitionIds": [
              "ph-paper"
            ],
            "sourceInstanceIds": [
              "ph-paper"
            ]
          }
        ],
        "modelSlots": [],
        "configurationSlots": [
          {
            "id": "wavelengthMeasurementId",
            "valueType": "string",
            "required": true
          },
          {
            "id": "measurementCuvetteInstanceId",
            "valueType": "string",
            "required": true
          }
        ],
        "approvalGates": [],
        "variants": [],
        "evidenceOutputs": [],
        "completion": {
          "exitPortIds": [
            "exit-place-brass-in-beaker",
            "exit-standard-0p400-stock-transfer",
            "exit-standard-0p200-dilute",
            "exit-standard-0p100-dilute",
            "exit-standard-0p0500-dilute",
            "exit-standard-0p0250-dilute",
            "exit-return-unknown",
            "exit-record-standard-depth",
            "exit-scan-return-salt-b-after-series-action-node",
            "exit-confirm-waste-ready-for-disposal-action-node",
            "exit-transfer-treated-waste-to-destination-action-node"
          ],
          "requiredEvidenceOutputIds": [],
          "requiredValidationRuleIds": []
        },
        "catalogDisposition": "composable",
        "legacyActionEffects": [
          {
            "actionId": "confirm-diluted-digest-material-action",
            "effect": {
              "classes": [
                "apparatus-material-instrument-state"
              ],
              "targets": [
                {
                  "domain": "equipment"
                },
                {
                  "domain": "material"
                }
              ]
            }
          },
          {
            "actionId": "standard-0p200-aliquot-ml-action",
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
            "actionId": "standard-0p100-aliquot-ml-action",
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
            "actionId": "standard-0p0500-aliquot-ml-action",
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
            "actionId": "standard-0p0250-aliquot-ml-action",
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
            "actionId": "scan-configure-salt-a-inventory-action",
            "effect": {
              "classes": [
                "evidence-recording"
              ],
              "targets": [
                {
                  "domain": "evidence"
                }
              ]
            }
          },
          {
            "actionId": "scan-configure-salt-b-inventory-action",
            "effect": {
              "classes": [
                "evidence-recording"
              ],
              "targets": [
                {
                  "domain": "evidence"
                }
              ]
            }
          },
          {
            "actionId": "fill-color-depth-unknown-action",
            "effect": {
              "classes": [
                "apparatus-material-instrument-state"
              ],
              "targets": [
                {
                  "domain": "equipment"
                },
                {
                  "domain": "material"
                }
              ]
            }
          },
          {
            "actionId": "fill-color-depth-standard-action",
            "effect": {
              "classes": [
                "apparatus-material-instrument-state"
              ],
              "targets": [
                {
                  "domain": "equipment"
                },
                {
                  "domain": "material"
                }
              ]
            }
          },
          {
            "actionId": "collect-0p0250-waste-action",
            "effect": {
              "classes": [
                "apparatus-material-instrument-state"
              ],
              "targets": [
                {
                  "domain": "equipment"
                },
                {
                  "domain": "material"
                }
              ]
            }
          },
          {
            "actionId": "collect-0p0500-waste-action",
            "effect": {
              "classes": [
                "apparatus-material-instrument-state"
              ],
              "targets": [
                {
                  "domain": "equipment"
                },
                {
                  "domain": "material"
                }
              ]
            }
          },
          {
            "actionId": "collect-0p100-waste-action",
            "effect": {
              "classes": [
                "apparatus-material-instrument-state"
              ],
              "targets": [
                {
                  "domain": "equipment"
                },
                {
                  "domain": "material"
                }
              ]
            }
          },
          {
            "actionId": "collect-0p200-waste-action",
            "effect": {
              "classes": [
                "apparatus-material-instrument-state"
              ],
              "targets": [
                {
                  "domain": "equipment"
                },
                {
                  "domain": "material"
                }
              ]
            }
          },
          {
            "actionId": "collect-0p400-waste-action",
            "effect": {
              "classes": [
                "apparatus-material-instrument-state"
              ],
              "targets": [
                {
                  "domain": "equipment"
                },
                {
                  "domain": "material"
                }
              ]
            }
          },
          {
            "actionId": "collect-unknown-waste-action",
            "effect": {
              "classes": [
                "apparatus-material-instrument-state"
              ],
              "targets": [
                {
                  "domain": "equipment"
                },
                {
                  "domain": "material"
                }
              ]
            }
          },
          {
            "actionId": "observe-waste-bubbling-action",
            "effect": {
              "classes": [
                "evidence-recording"
              ],
              "targets": [
                {
                  "domain": "evidence"
                }
              ]
            }
          },
          {
            "actionId": "classify-waste-ph-action",
            "effect": {
              "classes": [
                "evidence-recording"
              ],
              "targets": [
                {
                  "domain": "evidence"
                }
              ]
            }
          },
          {
            "actionId": "confirm-waste-ready-for-disposal-action",
            "effect": {
              "classes": [
                "evidence-recording"
              ],
              "targets": [
                {
                  "domain": "evidence"
                }
              ]
            }
          },
          {
            "actionId": "transfer-treated-waste-to-destination-action",
            "effect": {
              "classes": [
                "apparatus-material-instrument-state"
              ],
              "targets": [
                {
                  "domain": "equipment"
                },
                {
                  "domain": "material"
                }
              ]
            }
          }
        ]
      }
    }
  ]
]);

export const refineSpectroscopyDefinition = (definition) => {
  const next = applyStockSupplyVolumes(structuredClone(definitions.get(definition.id) ?? definition));
  if (next.id !== "brass-spectrophotometry") return next;

  // --- F05-A: brass sample/support continuity, teacher confirmation, comparison fills, waste ---
  //
  // Source basis for the sample path. Two tables in
  // how-can-color-determine-copper-in-brass_2026-07-27.md describe the weighing differently. The
  // apparatus-assembly table (BRASS-00/BRASS-01, no Basis column) puts the beaker on the balance
  // and adds brass to it. The two tables that do carry explicit ordering disagree: the procedure
  // classification says "Weigh, read, record, then place sample in beaker", and the phase table
  // separates B-01 measure, B-02 record, B-03 place brass in the small beaker. The phase/procedure
  // reading is authoritative here because it is the one that states the order and carries a Basis
  // column, and because the apparatus reading would make B-03 a duplicate of BRASS-01. Under that
  // reading the beaker cannot be the weighing support: the brass is not in it yet at read time.
  // The support itself is unstated, so choosing the watch glass is explicit operational R/C. The
  // watch glass was already in this technique's requiredEquipment and in the source component
  // list, the balance pan snap zone already accepts it, and the digestion cover the teacher places
  // at DIGEST-02 remains an external teacher action with no simulated instance, so nothing
  // competes for this support.
  //
  // Balance zeroing convention: there is no simulated zero operation anywhere in the runtime, so
  // none is asserted. The empty-support reading stays display-only evidence that cannot subtract
  // itself from anything -- it may be any finite non-negative number and nothing compares it to
  // zero -- external zeroing is performed at the instrument by the learner, and B-01 is entered as
  // a net mass. Because that convention only holds if the instrument really was zeroed, the
  // learner now states so explicitly between the reading and the load, and the load requires that
  // statement from the current attempt. The statement is a recorded assertion: the runtime neither
  // performs the zeroing nor senses it, and no authored text may call it instrument proof. B-01's
  // stated +/-0.001 g is source measurement precision; it is not used to enforce agreement between
  // the reading and the configured stock.
  const byId = new Map(next.actions.map((action) => [action.id, action]));
  const mustFind = (id) => byId.get(id) ?? (() => { throw new Error(`Expected brass action "${id}" is missing from the source definition.`); })();
  const instances = next.initialState.equipment;
  const instanceById = new Map(instances.map((instance) => [instance.id, instance]));

  const WEIGHING_SUPPORT_INSTANCE = "brass-weighing-watch-glass";
  const WEIGHING_SUPPORT_DEFINITION = "watch-glass";
  const BRASS_STOCK_INSTANCE = "brass-sample-vial";
  const BRASS_STOCK_DEFINITION = "small-vial";
  const BRASS_SOLUTE_ID = "configured-brass";
  const BRASS_MATERIAL_LABEL = "Configured brass alloy sample";
  const SCAN_BLANK_INSTANCE = "scan-blank-cuvette";

  // Reducer dispatch is determined by the resolved instrument interaction and the explicit
  // configuration mode, not by an atom id. Give every source-stated scan-setting action the
  // same atom that declares that real instrument-state branch, and make the source-stated scan
  // mode explicit so a malformed atom claim cannot silently change the derived contract.
  for (const scanAction of next.actions.filter((item) => /^scan-set-\d+-action$/.test(item.id))) {
    scanAction.atomId = "atom.observe.set-active-photometer-wavelength";
    scanAction.parameters = {
      ...scanAction.parameters,
      photometerConfigurationMode: "wavelength-scan",
    };
  }

  const emptyContents = (label = "empty", visualState = "empty") => ({
    kind: "empty",
    label,
    solutes: [],
    contamination: [],
    wetState: "dry",
    visualState,
  });

  // The wavelength scan uses a dedicated blank cuvette so the later AP calibration can continue
  // to use its authored measurement-cuvette without inheriting scan water or a scan attachment.
  if (!instanceById.has(SCAN_BLANK_INSTANCE)) {
    const measurementIndex = instances.findIndex((instance) => instance.id === "measurement-cuvette");
    const scanBlank = {
      id: SCAN_BLANK_INSTANCE,
      definitionId: "cuvette",
      label: "Prepared distilled-water scan blank cuvette",
      location: "shelf",
      contents: emptyContents(),
    };
    instances.splice(measurementIndex + 1, 0, scanBlank);
    instanceById.set(scanBlank.id, scanBlank);
  }

  // A dedicated clean, dry weighing support. Distinct from the digestion beaker and from the
  // teacher's digestion cover.
  if (!instanceById.has(WEIGHING_SUPPORT_INSTANCE)) {
    const beakerIndex = instances.findIndex((instance) => instance.id === "brass-beaker");
    const support = {
      id: WEIGHING_SUPPORT_INSTANCE,
      definitionId: WEIGHING_SUPPORT_DEFINITION,
      label: "Clean, dry brass weighing support",
      location: "shelf",
      contents: emptyContents(),
    };
    instances.splice(beakerIndex + 1, 0, support);
    instanceById.set(support.id, support);
  }

  // The vial previously declared a solid whose solute carried no numeric quantity, so it named
  // material that had no mass. Its starting inventory is a classroom configuration, so it now
  // starts genuinely empty and the teacher setup step below establishes the finite gram stock.
  const stockVial = instanceById.get(BRASS_STOCK_INSTANCE);
  stockVial.label = "Brass sample vial";
  stockVial.contents = emptyContents();

  const invalidCases = structuredClone(mustFind("place-brass-in-beaker-action").invalidCases);
  const provenanceInvalidCases = structuredClone(mustFind("fill-color-depth-unknown-action").invalidCases);

  const action = ({ id, verb, label, atomId, bindings, parameters, interaction, evidence, prerequisites, cases }) => ({
    id,
    verb,
    label,
    parameters,
    prerequisites: prerequisites ?? [],
    stateChanges: [`${label}: completed with the named sample and configuration provenance preserved.`],
    invalidCases: structuredClone(cases ?? invalidCases),
    feedback: {
      success: `${label} complete.`,
      invalid: "Check the named sample, equipment binding, configuration evidence, and operation order.",
    },
    evidence: evidence ?? [],
    atomId,
    equipmentRoleBindings: bindings,
    interaction,
  });

  const insertActionAfter = (afterId, definitionToInsert) => {
    const index = next.actions.findIndex((item) => item.id === afterId);
    if (index < 0) throw new Error(`Cannot insert after missing brass action "${afterId}".`);
    next.actions.splice(index + 1, 0, definitionToInsert);
    byId.set(definitionToInsert.id, definitionToInsert);
  };

  // ---------------------------------------------------------------- Batch 1: sample/support path

  // Teacher setup. The configured stock is a gram quantity in a named container; it is setup
  // evidence, never the B-01 balance reading, and it has its own id, role and consumers.
  const configureStock = action({
    id: "configure-brass-sample-inventory-action",
    verb: "observe",
    label: "Configure the finite brass sample stock in its vial",
    atomId: "atom.observe.configure-solid-stock-inventory",
    bindings: { "solid-reagent-source": BRASS_STOCK_DEFINITION },
    parameters: {
      sourceInstanceId: BRASS_STOCK_INSTANCE,
      sourceDefinitionId: BRASS_STOCK_DEFINITION,
      visualState: "brass-sample",
      // `inputRole: "teacherConfiguration"` on its own is only an authoring label: the reducer has
      // no gate for it, so a request that simply omits approval would still succeed. These two
      // flags are the repository's configuration acknowledgement contract for teacher-provided
      // values (`configurationLockFor`), the same one the sibling teacher steps in this lab already
      // use: a request that omits `configurationApproved` is refused.
      //
      // It is an acknowledgement, not an authorization. `ProcessSidebar` clears the lock as soon as
      // a `teacherConfiguration` field holds a valid value, so nothing here establishes who entered
      // it or that an out-of-band teacher approved it. Independently authenticated teacher
      // authorization is a product mechanism this repository does not have, and no text in this
      // file may claim otherwise.
      configurationChoice: true,
      configurationRequired: true,
      unlocked: false,
      inputMode: "numeric",
      inputRole: "teacherConfiguration",
      inputLabel: "Brass sample mass supplied in the vial (g)",
      inputMin: 0,
      inputMinExclusive: true,
      inputStep: 0.001,
      inputRequired: true,
      unit: "g",
    },
    interaction: {
      type: "recordNotebook",
      valueParameter: "tag",
      accessibleLabel: "Configure the finite brass sample stock supplied in the vial",
    },
    evidence: ["observe", "configuration", "brass-configured-stock-g"],
  });
  configureStock.sourceInventory = {
    quantityKind: "solid-mass",
    sourceInstanceId: BRASS_STOCK_INSTANCE,
    sourceDefinitionId: BRASS_STOCK_DEFINITION,
    outputMeasurementId: "brass-configured-stock-g",
    materialSoluteId: BRASS_SOLUTE_ID,
    materialLabel: BRASS_MATERIAL_LABEL,
  };
  next.actions.unshift(configureStock);
  byId.set(configureStock.id, configureStock);

  // This was already the authored lab step between teacher approval and the brass procedure. It
  // changes the actual photometer state (and clears its calibration readiness), so it belongs to
  // the reusable spectrophotometry technique rather than to the lab's evidence-only orchestration
  // layer. The action id is retained exactly through the consuming lab's preserveIds contract.
  const configureApprovedWavelength = {
    id: "configure-approved-wavelength-action",
    verb: "observe",
    label: "Configure the approved wavelength on the spectrophotometer",
    parameters: {
      configurationQuantity: "approved measurement wavelength",
      measurementId: "brass-spectrophotometry--configured-wavelength-nm",
      approvedWavelengthMeasurementId: "brass-spectrophotometry--approved-wavelength-nm",
      photometerConfigurationMode: "approved-selected-wavelength",
      photometerInstanceId: "spectrophotometer",
      photometricMode: "absorbance",
      unit: "nm",
      tag: "photometer-configured-approved-wavelength",
    },
    prerequisites: [
      {
        id: "configure-approved-wavelength-needs-proposal",
        type: "measurementRecorded",
        label: "The approved wavelength proposal exists.",
        measurementId: "brass-spectrophotometry--approved-wavelength-nm",
      },
    ],
    stateChanges: [
      "Configure the approved wavelength on the spectrophotometer: the actual instrument wavelength is set from the current teacher-approved proposal, and prior calibration readiness is cleared.",
    ],
    invalidCases: [
      {
        id: "wrong-order",
        when: "the current approved proposal or teacher approval is unavailable",
        message: "The actual instrument wavelength cannot be configured from a missing or stale approval.",
        recovery: "Record the current proposal, obtain teacher approval, then configure the spectrophotometer.",
      },
      {
        id: "unsafe-state",
        when: "the spectrophotometer is not on the workbench",
        message: "The spectrophotometer must be on the workbench before its wavelength is configured.",
        recovery: "Place the named spectrophotometer on the workbench and retry this action.",
      },
    ],
    feedback: {
      success: "The spectrophotometer is configured at the teacher-approved wavelength.",
      invalid: "Review the approved proposal, instrument placement, and calibration order.",
    },
    evidence: ["observe", "photometer-configuration", "approved-wavelength"],
    atomId: "atom.observe.set-active-photometer-wavelength",
    equipmentRoleBindings: {
      "photometer-instrument": "spectrophotometer",
    },
    interaction: {
      type: "readInstrument",
      sourceDefinitionId: "spectrophotometer",
      stationId: "spectrophotometer",
      accessibleLabel: "Configure the approved wavelength on the spectrophotometer",
    },
  };
  const configuredStockIndex = next.actions.findIndex(
    (candidate) => candidate.id === configureStock.id,
  );
  next.actions.splice(configuredStockIndex, 0, configureApprovedWavelength);
  byId.set(configureApprovedWavelength.id, configureApprovedWavelength);

  // Historical identity note: this action id, its process node id `tare-empty-beaker` and its
  // entry port `entry-tare-empty-beaker` all still say "beaker" because they are externally
  // referenced. Everything the learner and the runtime actually see now names the weighing
  // support, and the old `empty-beaker-tare-g` output is renamed because nothing consumed it.
  const tare = mustFind("tare-empty-beaker-action");
  tare.label = "Read the empty brass weighing support on the balance";
  tare.parameters = {
    sourceDefinitionId: WEIGHING_SUPPORT_DEFINITION,
    targetDefinitionId: "analytical-balance",
    instrumentDefinitionId: "analytical-balance",
    tolerance: 0.001,
    sourceInstanceId: WEIGHING_SUPPORT_INSTANCE,
    targetInstanceId: "balance",
    instrumentInstanceId: "balance",
    inputMode: "numeric",
    inputRole: "studentResponse",
    inputLabel: "Balance display for the empty weighing support (g)",
    inputMin: 0,
    inputStep: 0.001,
    inputRequired: true,
    unit: "g",
  };
  tare.stateChanges = ["Read the empty brass weighing support on the balance: display evidence accepted."];
  tare.feedback = {
    success: "Empty weighing-support balance display accepted.",
    invalid: "Review the required technique and try again.",
  };
  tare.evidence = ["weigh", "tare", "empty-weighing-support"];
  tare.equipmentRoleBindings = {
    "balance-instrument": "analytical-balance",
    "weighed-vessel": WEIGHING_SUPPORT_DEFINITION,
  };
  tare.interaction = {
    type: "readInstrument",
    sourceDefinitionId: WEIGHING_SUPPORT_DEFINITION,
    targetDefinitionId: "analytical-balance",
    stationId: "analytical-balance",
    accessibleLabel: "Place the clean, dry weighing support on the balance and read its display. The display need not be zero; the next step is where you zero the instrument.",
  };
  tare.mass = {
    source: "action-input",
    outputMeasurementId: "empty-weighing-support-tare-g",
    continuity: {
      version: 1,
      quantityKind: "balance-display",
      measuredSupportInstanceId: WEIGHING_SUPPORT_INSTANCE,
    },
  };
  delete tare.parameters.measurementId;
  delete tare.parameters.expectedMassG;

  // External zeroing, stated by the learner. R/C: B-01 supports a brass measurement on a balance;
  // the dated source states no watch-glass zeroing procedure, so choosing to make the zeroing an
  // explicit confirmation between the reading and the load is a repository operational decision.
  //
  // It carries no atom. The canonical derivation for an `observe` action whose only handler is the
  // generic notebook fallback is `evidence-recording` on the evidence domain, and the bundled
  // catalog policy requires a registry atom only for a physical or acquisitive effect class. A
  // physical tare atom would be a false claim: no handler zeroes anything, and no atom in the
  // registry truthfully names a self-reported external instrument operation. The composition
  // therefore owns its effect, exactly as the three sibling brass confirmations already do, so no
  // new atom-identity migration entry is created.
  const confirmZeroed = action({
    id: "confirm-brass-weighing-support-zeroed-action",
    verb: "observe",
    label: "Confirm the balance was zeroed with the empty weighing support on the pan",
    parameters: {
      sourceInstanceId: WEIGHING_SUPPORT_INSTANCE,
      sourceDefinitionId: WEIGHING_SUPPORT_DEFINITION,
      instrumentInstanceId: "balance",
      instrumentDefinitionId: "analytical-balance",
      tag: "brass-weighing-support-zeroed",
      // This is the reducer's notebook text and the branch ProcessSidebar enables for an `observe`
      // recordNotebook control, so the wording the learner commits to is the wording on record.
      note: "Self-reported: with the empty weighing support resting on the pan, the balance was zeroed at the instrument. The simulator neither performs nor senses this zeroing; the next reading is treated as a net brass mass on the strength of this statement.",
      externalOperationActor: "student",
    },
    interaction: {
      type: "recordNotebook",
      valueParameter: "tag",
      accessibleLabel: "Confirm that you zeroed the balance at the instrument with the empty weighing support on the pan",
    },
    evidence: ["observe", "external-instrument-operation", "weighing-support-zeroed"],
    cases: provenanceInvalidCases,
    prerequisites: [
      {
        // Exact support identity and current-attempt provenance for the reading this statement is
        // about: the record must be the balance-display reading that `tare-empty-beaker-action`
        // itself wrote, on this support, in this attempt.
        id: "zero-confirmation-needs-support-reading",
        type: "measurementRecorded",
        label: "The empty weighing support was read on the balance in this attempt",
        measurementId: "empty-weighing-support-tare-g",
        measurementContinuity: {
          version: 1,
          quantityKind: "balance-display",
          measuredSupportInstanceId: WEIGHING_SUPPORT_INSTANCE,
          producerActionId: "tare-empty-beaker-action",
        },
      },
      {
        // The reading step itself must have succeeded this attempt. This is the ordering gate; it
        // is the only thing that keeps the support empty when the reading is taken, because no
        // runtime guard senses emptiness for a balance-display measurement.
        id: "zero-confirmation-needs-current-reading-step",
        type: "actionEvidence",
        label: "The empty-support reading step was completed in this attempt",
        actionId: "tare-empty-beaker-action",
        requireCurrentEvidenceScope: true,
      },
    ],
  });
  confirmZeroed.stateChanges = [
    "Confirm the balance was zeroed with the empty weighing support on the pan: a learner statement is recorded; no material, instrument or measurement state changes.",
  ];
  confirmZeroed.feedback = {
    success: "The self-reported external zeroing with the empty support in place is recorded.",
    invalid: "Read the empty weighing support on the balance in this attempt, then confirm that you zeroed the instrument.",
  };
  insertActionAfter("tare-empty-beaker-action", confirmZeroed);

  // Whole-solid loading of the configured portion. It requires the configured stock but must not
  // require the brass weighing evidence it precedes, and it creates no material of its own.
  const loadSupport = action({
    id: "load-brass-onto-weighing-support-action",
    verb: "transfer",
    label: "Load the configured brass sample onto the weighing support",
    atomId: "atom.transfer.load-solid-onto-weighing-support",
    bindings: {
      "solid-reagent-source": BRASS_STOCK_DEFINITION,
      "weighed-vessel": WEIGHING_SUPPORT_DEFINITION,
    },
    parameters: {
      sourceDefinitionId: BRASS_STOCK_DEFINITION,
      sourceInstanceId: BRASS_STOCK_INSTANCE,
      targetDefinitionId: WEIGHING_SUPPORT_DEFINITION,
      targetInstanceId: WEIGHING_SUPPORT_INSTANCE,
      targetLabel: BRASS_MATERIAL_LABEL,
      visualState: "brass-sample",
      emptyRemainingSolid: true,
      requireNonEmptySolidSource: true,
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: BRASS_STOCK_DEFINITION,
      targetDefinitionId: WEIGHING_SUPPORT_DEFINITION,
      accessibleLabel: "Tip the whole configured brass sample from its vial onto the weighing support",
    },
    evidence: ["transfer", "brass-on-weighing-support"],
    prerequisites: [
      {
        id: "load-brass-needs-configured-stock",
        type: "measurementRecorded",
        label: "The teacher-configured brass stock mass exists",
        measurementId: "brass-configured-stock-g",
      },
      {
        id: "load-brass-needs-support-reading",
        type: "actionEvidence",
        label: "The empty weighing support was read on the balance in this attempt",
        actionId: "tare-empty-beaker-action",
        requireCurrentEvidenceScope: true,
      },
      {
        // The net-mass convention is only honest if the instrument was zeroed for this attempt, so
        // the load is gated on the statement itself and not on a notebook tag: a tag written in an
        // earlier attempt would still be in the notebook after a physical reset.
        id: "load-brass-needs-zero-confirmation",
        type: "actionEvidence",
        label: "The balance was confirmed zeroed with the empty support in place in this attempt",
        actionId: "confirm-brass-weighing-support-zeroed-action",
        requireCurrentEvidenceScope: true,
      },
    ],
  });
  insertActionAfter("confirm-brass-weighing-support-zeroed-action", loadSupport);

  // B-01. The reading is the learner's, on the named support, for the named material, in this
  // attempt. Continuity is declared, so this acquisition changes no inventory.
  const brassMass = mustFind("weigh-brass-action");
  brassMass.label = "Weigh the brass sample on the weighing support";
  brassMass.parameters = {
    sourceDefinitionId: WEIGHING_SUPPORT_DEFINITION,
    targetDefinitionId: "analytical-balance",
    instrumentDefinitionId: "analytical-balance",
    tolerance: 0.001,
    inputMode: "numeric",
    inputRole: "studentResponse",
    inputLabel: "Net brass mass on the weighing support (g)",
    inputMin: 0,
    inputMinExclusive: true,
    inputRequired: true,
    inputStep: 0.001,
    unit: "g",
    sourceInstanceId: WEIGHING_SUPPORT_INSTANCE,
    targetInstanceId: "balance",
    instrumentInstanceId: "balance",
  };
  brassMass.stateChanges = ["Weigh the brass sample on the weighing support: net mass evidence accepted."];
  brassMass.feedback = {
    success: "Net brass mass accepted.",
    invalid: "Review the required technique and try again.",
  };
  brassMass.evidence = ["weigh", "measurement", "brass-mass-g"];
  brassMass.equipmentRoleBindings = {
    "balance-instrument": "analytical-balance",
    "weighed-vessel": WEIGHING_SUPPORT_DEFINITION,
  };
  brassMass.interaction = {
    type: "readInstrument",
    sourceDefinitionId: WEIGHING_SUPPORT_DEFINITION,
    targetDefinitionId: "analytical-balance",
    stationId: "analytical-balance",
    accessibleLabel: "Read the net brass mass from the balance with the loaded weighing support in place",
  };
  brassMass.mass = {
    source: "action-input",
    outputMeasurementId: "brass-mass-recorded-g",
    continuity: {
      version: 1,
      quantityKind: "material-portion",
      measuredSupportInstanceId: WEIGHING_SUPPORT_INSTANCE,
      materialSourceInstanceId: BRASS_STOCK_INSTANCE,
    },
  };
  brassMass.prerequisites = [
    {
      id: "weigh-brass-needs-loaded-support",
      type: "actionEvidence",
      label: "The configured brass sample was loaded onto the weighing support in this attempt",
      actionId: "load-brass-onto-weighing-support-action",
      requireCurrentEvidenceScope: true,
    },
  ];
  delete brassMass.parameters.expectedMassG;

  // B-03. Whole-solid delivery of the measured portion. The delivered amount is the support's own
  // inventory, so the old measurement-driven mass contract is gone: the reducer rejects combining
  // the two, and the learner's reading must never be the thing that creates material. The reading
  // is still required, by exact producer/support/material provenance in this attempt.
  const placeBrass = mustFind("place-brass-in-beaker-action");
  placeBrass.label = "Transfer the weighed brass sample into the digestion beaker";
  placeBrass.parameters = {
    sourceDefinitionId: WEIGHING_SUPPORT_DEFINITION,
    sourceInstanceId: WEIGHING_SUPPORT_INSTANCE,
    targetDefinitionId: "beaker-250ml",
    targetInstanceId: "brass-beaker",
    targetLabel: BRASS_MATERIAL_LABEL,
    visualState: "brass-sample",
    emptyRemainingSolid: true,
    requireNonEmptySolidSource: true,
  };
  placeBrass.stateChanges = ["Transfer the weighed brass sample into the digestion beaker: completed with the measured portion conserved."];
  placeBrass.feedback = {
    success: "The weighed brass sample is in the digestion beaker.",
    invalid: "Check the named sample, equipment binding, configuration evidence, and operation order.",
  };
  placeBrass.evidence = ["transfer", "brass-in-beaker"];
  placeBrass.equipmentRoleBindings = {
    "weighed-sample-source": WEIGHING_SUPPORT_DEFINITION,
    "receiving-vessel": "beaker-250ml",
  };
  placeBrass.interaction = {
    type: "pourInto",
    sourceDefinitionId: WEIGHING_SUPPORT_DEFINITION,
    targetDefinitionId: "beaker-250ml",
    accessibleLabel: "Transfer the entire weighed brass portion from the weighing support into the digestion beaker",
  };
  delete placeBrass.mass;
  placeBrass.prerequisites = [
    {
      id: "place-brass-needs-continuous-mass",
      type: "measurementRecorded",
      label: "The brass mass was read on this support, for this material, in this attempt",
      measurementId: "brass-mass-recorded-g",
      measurementContinuity: {
        version: 1,
        quantityKind: "material-portion",
        measuredSupportInstanceId: WEIGHING_SUPPORT_INSTANCE,
        materialSourceInstanceId: BRASS_STOCK_INSTANCE,
        producerActionId: "weigh-brass-action",
      },
    },
  ];

  // ------------------------------------------------- Batch 2: teacher-completed dilution (B-07)

  // The 50 mL addition is already accounted for once, by the existing measured-then-poured pair
  // (`measure-50ml-digest-water-action` -> `teacher-add-50ml-water-to-digest-action`). This action
  // is the completion confirmation for that external teacher operation and adds no second
  // addition. It was authored as a `dissolve`/`pourInto` action naming the graduated cylinder as a
  // source, which described a learner pour that never happens; it is now the typed external
  // qualitative-transition confirmation on the beaker, gated on the addition it describes.
  const confirmDiluted = mustFind("confirm-diluted-digest-material-action");
  confirmDiluted.verb = "observe";
  confirmDiluted.label = "Confirm the teacher-completed diluted digest";
  confirmDiluted.parameters = {
    targetInstanceId: "brass-beaker",
    targetDefinitionId: "beaker-250ml",
    tag: "teacher-diluted-digest-complete",
    // ProcessSidebar enables a recordNotebook observation only for a typed notebook operation, a
    // scoped-evidence step, an action with an input field, or an observe action carrying an
    // authored note. `materialTransition` is not in its typed list and this confirmation asks the
    // learner for nothing, so without this note the step would have no reachable normal control.
    // The note is also the reducer's notebook fallback text. No UI change was needed.
    note: "The teacher has completed the source-stated 50 mL water addition; the digest in the beaker is now the diluted solution.",
    teacherControlled: true,
    externalOperationActor: "teacher",
  };
  confirmDiluted.stateChanges = [
    "Confirm the teacher-completed diluted digest: the beaker's established quantities and provenance are preserved.",
  ];
  confirmDiluted.feedback = {
    success: "The completed diluted digest is confirmed.",
    invalid: "Check the named sample, equipment binding, configuration evidence, and operation order.",
  };
  confirmDiluted.evidence = ["observe", "external-teacher-operation", "diluted-digest"];
  confirmDiluted.atomId = "atom.observe.confirm-external-material-transition";
  confirmDiluted.equipmentRoleBindings = { "receiving-vessel": "beaker-250ml" };
  confirmDiluted.interaction = {
    type: "recordNotebook",
    valueParameter: "tag",
    accessibleLabel: "Confirm the teacher has completed the source-stated water addition to the digest",
  };
  confirmDiluted.materialTransition = {
    kind: "solution",
    label: "Completed brass digest diluted with the source-stated water addition",
    wetState: "wet",
    visualState: "copper-blue-solution",
  };
  confirmDiluted.prerequisites = [
    {
      id: "confirm-diluted-needs-water-addition",
      type: "actionEvidence",
      label: "The teacher completed the source-stated 50 mL water addition in this attempt",
      actionId: "teacher-add-50ml-water-to-digest-action",
      requireCurrentEvidenceScope: true,
    },
    {
      id: "confirm-diluted-needs-teacher-authorization",
      type: "notebookEntry",
      label: "The teacher authorized the post-digestion water addition",
      notebookTag: "teacher-digest-dilution-authorized",
    },
  ];

  // The authorization the lab records before the addition is a separate gate, so the addition
  // itself is locked until it exists.
  const addWater = mustFind("teacher-add-50ml-water-to-digest-action");
  addWater.prerequisites = [
    {
      id: "teacher-water-needs-authorization",
      type: "notebookEntry",
      label: "The teacher authorized the post-digestion water addition",
      notebookTag: "teacher-digest-dilution-authorized",
    },
  ];
  const measureWater = mustFind("measure-50ml-digest-water-action");
  measureWater.prerequisites = [
    {
      id: "measure-digest-water-needs-authorization",
      type: "notebookEntry",
      label: "The teacher authorized the post-digestion water addition",
      notebookTag: "teacher-digest-dilution-authorized",
    },
  ];

  // ------------------------------------------- Batch 3: paired comparison fills (V-01, basis M)

  for (const [actionId, sampleSourceInstance, comparisonInstance] of [
    ["fill-color-depth-unknown-action", "unknown-sample-tube", "color-depth-unknown-tube"],
    ["fill-color-depth-standard-action", "standard-0p400-tube", "color-depth-standard-tube"],
  ]) {
    const fill = mustFind(actionId);
    fill.atomId = "atom.transfer.fill-color-depth-pair";
    fill.equipmentRoleBindings = {
      "sample-source": "test-tube",
      "color-depth-comparison-vessel": "test-tube",
    };
    fill.parameters = {
      ...fill.parameters,
      sourceInstanceId: sampleSourceInstance,
      sourceDefinitionId: "test-tube",
      targetInstanceId: comparisonInstance,
      targetDefinitionId: "test-tube",
    };
    fill.evidence = ["transfer", "color-depth-comparison-fill"];
  }

  // ------------------------------- Batch 4: generic wavelength-scan blank lifecycle

  // The scan is a deliberately bounded generic simulator method. One prepared distilled-water
  // cuvette is reused at each wavelength; the blank is reinserted and re-established after every
  // wavelength configuration change, then removed before the two sample cuvettes are read.
  const scanWavelengths = Array.from({ length: 16 }, (_, index) => 400 + index * 20);
  const scanBlankPreparation = structuredClone(mustFind("prepare-blank-action"));
  scanBlankPreparation.id = "scan-prepare-distilled-water-blank-action";
  scanBlankPreparation.label = "Prepare the distilled-water scan blank";
  scanBlankPreparation.parameters = {
    ...scanBlankPreparation.parameters,
    targetInstanceId: SCAN_BLANK_INSTANCE,
    targetDefinitionId: "cuvette",
    sampleIdentity: "distilled-water-blank",
  };
  scanBlankPreparation.stateChanges = [
    "Prepare the distilled-water scan blank: the dedicated scan cuvette contains clean distilled water for reuse across wavelengths.",
  ];
  scanBlankPreparation.evidence = ["transfer", "blank", "distilled-water", "scan-cuvette"];
  scanBlankPreparation.interaction = {
    ...scanBlankPreparation.interaction,
    accessibleLabel: "Fill the dedicated scan blank cuvette with distilled water.",
  };
  insertActionAfter("scan-prepare-salt-b-once-action", scanBlankPreparation);

  for (const wavelength of scanWavelengths) {
    const setAction = mustFind(`scan-set-${wavelength}-action`);
    setAction.parameters = {
      ...setAction.parameters,
      photometerConfigurationMode: "wavelength-scan",
      photometerInstanceId: "spectrophotometer",
    };

    for (const sample of ["salt-a", "salt-b"]) {
      const readAction = mustFind(`scan-read-${wavelength}-${sample}-action`);
      readAction.parameters = {
        ...readAction.parameters,
        photometerCalibrationMethod: "distilled-water-per-wavelength",
      };
    }

    const insertBlank = structuredClone(mustFind("insert-blank-action"));
    insertBlank.id = `scan-insert-${wavelength}-blank-action`;
    insertBlank.label = `Insert the distilled-water scan blank at ${wavelength} nm`;
    insertBlank.parameters = {
      ...insertBlank.parameters,
      equipmentDefinitionId: "cuvette",
      equipmentInstanceId: SCAN_BLANK_INSTANCE,
      targetInstanceId: "spectrophotometer",
      sampleIdentity: "distilled-water-blank",
    };
    insertBlank.stateChanges = [
      `${insertBlank.label}: the prepared distilled-water blank is inserted in the spectrophotometer.`,
    ];
    insertBlank.evidence = ["place", "blank", "cuvette-instrument", `wavelength:${wavelength}nm`];
    insertBlank.interaction = {
      ...insertBlank.interaction,
      accessibleLabel: `${insertBlank.label}.`,
    };

    const blank = structuredClone(mustFind("calibrate-hundred-percent-t-action"));
    blank.id = `scan-blank-${wavelength}-action`;
    blank.label = `Blank the photometer with distilled water at ${wavelength} nm`;
    const blankParameters = { ...blank.parameters };
    delete blankParameters.requiresDarkZeroNotebookTag;
    blank.parameters = {
      ...blankParameters,
      photometerInstanceId: "spectrophotometer",
      cuvetteInstanceId: SCAN_BLANK_INSTANCE,
      wavelengthMeasurementId: `scan-${wavelength}-wavelength-nm`,
      photometerOperation: "zero",
      photometerCalibrationMethod: "distilled-water-per-wavelength",
      tag: `scan-${wavelength}-distilled-water-blanked`,
      note: `Generic simulator method: blank the spectrophotometer with clean distilled water at ${wavelength} nm before either assigned-salt reading.`,
    };
    blank.stateChanges = [
      `${blank.label}: reblank after changing wavelength or resetting the activity before continuing.`,
    ];
    blank.evidence = ["observe", "photometer-zero", "distilled-water-blank", `wavelength:${wavelength}nm`];
    blank.interaction = {
      ...blank.interaction,
      accessibleLabel: `${blank.label}.`,
    };

    const removeBlank = structuredClone(mustFind("remove-blank-action"));
    removeBlank.id = `scan-remove-${wavelength}-blank-action`;
    removeBlank.label = `Remove the distilled-water scan blank after ${wavelength} nm`;
    removeBlank.parameters = {
      ...removeBlank.parameters,
      equipmentDefinitionId: "cuvette",
      equipmentInstanceId: SCAN_BLANK_INSTANCE,
    };
    removeBlank.prerequisites = [{
      id: `scan-${wavelength}-blank-removal-after-calibration`,
      type: "actionEvidence",
      label: `The distilled-water scan blank was established at ${wavelength} nm`,
      actionId: blank.id,
      requireCurrentEvidenceScope: true,
    }];
    removeBlank.stateChanges = [
      `${removeBlank.label}: the sample compartment is cleared before the assigned-salt readings.`,
    ];
    removeBlank.evidence = ["place", "blank", "cuvette-removed", `wavelength:${wavelength}nm`];
    removeBlank.interaction = {
      ...removeBlank.interaction,
      accessibleLabel: `${removeBlank.label}.`,
    };

    insertActionAfter(`scan-set-${wavelength}-action`, insertBlank);
    insertActionAfter(insertBlank.id, blank);
    insertActionAfter(blank.id, removeBlank);
  }

  // The later Brass path uses one teacher-approved wavelength rather than the scan's authored
  // wavelength series. Keep its durable notebook gates, but also record the instrument-scoped
  // dark-zero/100%T pair so a changed approved wavelength cannot reuse an older read state.
  const selectedWavelengthActions = [
    "calibrate-zero-percent-t-action",
    "calibrate-hundred-percent-t-action",
    "read-unknown-absorbance-action",
    "read-0p0250-absorbance-action",
    "read-0p0500-absorbance-action",
    "read-0p100-absorbance-action",
    "read-0p200-absorbance-action",
    "read-0p400-absorbance-action",
  ];
  for (const actionId of selectedWavelengthActions) {
    const selectedAction = mustFind(actionId);
    selectedAction.parameters = {
      ...selectedAction.parameters,
      wavelengthMeasurementId: "brass-spectrophotometry--configured-wavelength-nm",
      photometerCalibrationMethod: "selected-wavelength-pair",
    };
  }

  // ------------------------------- Batch 4: collection for treatment and teacher-directed handoff

  // Safety-list S-08 (M/C) requires treatment before disposal and defers the destination to the
  // instructor. Gathering the used solutions into one shared treatment container is the local
  // bench implementation of that, so the atom records S-08 with explicit local R/C. Procedure-table
  // S-08 (record absorbance) and S-09 (return the cuvette portion to its original tube) are
  // different rows in a different table and are not cited here.
  const collectionSources = [
    ["collect-0p0250-waste-action", "standard-0p0250-tube"],
    ["collect-0p0500-waste-action", "standard-0p0500-tube"],
    ["collect-0p100-waste-action", "standard-0p100-tube"],
    ["collect-0p200-waste-action", "standard-0p200-tube"],
    ["collect-0p400-waste-action", "standard-0p400-tube"],
    ["collect-unknown-waste-action", "unknown-sample-tube"],
  ];
  for (const [actionId, sourceInstance] of collectionSources) {
    const collect = mustFind(actionId);
    collect.atomId = "atom.transfer.collect-sample-for-treatment";
    collect.equipmentRoleBindings = { "sample-source": "test-tube", "waste-receiver": "waste-beaker" };
    collect.parameters = { ...collect.parameters, sourceInstanceId: sourceInstance, sourceDefinitionId: "test-tube" };
    collect.evidence = ["transfer", "waste-collection"];
  }

  // The two comparison aliquots created at V-01 were previously left in their tubes at the end of
  // the investigation, so cleanup claimed completeness while material remained on the bench. The
  // standard arm also still holds whatever V-02 did not remove. Both are now collected into the
  // same treatment container before neutralization. This is explicit local R/C: the source states
  // the treatment boundary, not which vessels reach it.
  const comparisonCollections = [
    ["collect-color-depth-unknown-waste-action", "color-depth-unknown-tube", "the comparison unknown tube"],
    ["collect-color-depth-standard-waste-action", "color-depth-standard-tube", "the comparison 0.400 M standard tube"],
  ];
  let insertAfter = "collect-unknown-waste-action";
  for (const [actionId, sourceInstance, description] of comparisonCollections) {
    const label = `Collect the remaining solution from ${description} in the treatment beaker`;
    const collect = action({
      id: actionId,
      verb: "transfer",
      label,
      atomId: "atom.transfer.collect-sample-for-treatment",
      bindings: { "sample-source": "test-tube", "waste-receiver": "waste-beaker" },
      parameters: {
        sourceDefinitionId: "test-tube",
        sourceInstanceId: sourceInstance,
        targetDefinitionId: "waste-beaker",
        targetInstanceId: "waste-beaker",
        sampleIdentity: sourceInstance,
        allowEmptySource: true,
      },
      interaction: {
        type: "pourInto",
        sourceDefinitionId: "test-tube",
        targetDefinitionId: "waste-beaker",
        accessibleLabel: label,
      },
      evidence: ["transfer", "waste-collection"],
      cases: provenanceInvalidCases,
    });
    insertActionAfter(insertAfter, collect);
    insertAfter = actionId;
  }

  const finalTransfer = mustFind("transfer-treated-waste-to-destination-action");
  finalTransfer.atomId = "atom.transfer.treated-waste-to-designated-destination";
  finalTransfer.equipmentRoleBindings = {
    "recovery-vessel": "waste-beaker",
    "waste-receiver": "waste-beaker",
  };
  finalTransfer.evidence = ["transfer", "teacher-directed-disposal"];
  finalTransfer.prerequisites = [
    {
      id: "final-disposal-needs-safe-endpoint",
      type: "notebookEntry",
      label: "The treatment workflow recorded the safe pH and bubbling endpoint",
      notebookTag: "waste-ph-within-range",
    },
    {
      id: "final-disposal-needs-teacher-destination",
      type: "notebookEntry",
      label: "Teacher recorded the local destination",
      notebookTag: "teacher-disposal-gate",
    },
  ];

  // The two scan-stock configuration actions use the shared typed liquid-inventory atom. Their
  // finite starting volumes remain teacher configuration evidence; the atom records the named
  // container/material state without turning that setup quantity into a learner measurement.

  // ------------------------------------------------------------------------ process graph repair

  const nodes = next.process.nodes;
  const edges = next.process.edges;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const processNode = (id, title, description, actionId, type = "action") => ({
    id,
    type,
    title,
    description,
    actionId,
    config: {},
    validation: [{
      id: `${id}-complete`,
      type: "actionEvidence",
      label: `${title} was completed.`,
      actionId,
    }],
    hints: [],
    feedback: { success: `${title} complete.`, retry: `Complete ${title} before continuing.` },
  });
  const insertNodeBefore = (beforeId, node) => {
    const index = nodes.findIndex((item) => item.id === beforeId);
    nodes.splice(index < 0 ? nodes.length : index, 0, node);
    nodeById.set(node.id, node);
  };
  const edge = (from, to) => ({ from, to, label: "Continue after required evidence", condition: { type: "validationPassed" } });
  const removeEdge = (from, to) => {
    const index = edges.findIndex((item) => item.from === from && item.to === to);
    if (index >= 0) edges.splice(index, 1);
  };

  const scanBlankPreparationNode = processNode(
    "scan-prepare-distilled-water-blank",
    "Prepare the distilled-water scan blank",
    "Fill the dedicated scan cuvette with clean distilled water once; reinsert and reblank it after each wavelength change or when the activity is reset.",
    "scan-prepare-distilled-water-blank-action",
  );
  insertNodeBefore("scan-set-400-action-node", scanBlankPreparationNode);
  removeEdge("scan-prepare-salt-b-once-action-node", "scan-set-400-action-node");
  edges.push(edge("scan-prepare-salt-b-once-action-node", "scan-prepare-distilled-water-blank"));
  edges.push(edge("scan-prepare-distilled-water-blank", "scan-set-400-action-node"));

  for (const wavelength of scanWavelengths) {
    const insertBlankNode = processNode(
      `scan-insert-${wavelength}-blank-action-node`,
      `Insert the distilled-water scan blank at ${wavelength} nm`,
      `Insert the prepared distilled-water blank before the scan read at ${wavelength} nm.`,
      `scan-insert-${wavelength}-blank-action`,
    );
    const blankNode = processNode(
      `scan-blank-${wavelength}-action-node`,
      `Blank the photometer with distilled water at ${wavelength} nm`,
      `Apply the prepared distilled-water blank at ${wavelength} nm before the assigned-salt readings. Reblank after changing wavelength or when the activity is reset.`,
      `scan-blank-${wavelength}-action`,
    );
    const removeBlankNode = processNode(
      `scan-remove-${wavelength}-blank-action-node`,
      `Remove the configured distilled-water scan blank after ${wavelength} nm`,
      `Remove the configured scan blank so the two assigned-salt cuvettes can be read at ${wavelength} nm.`,
      `scan-remove-${wavelength}-blank-action`,
    );
    const saltANodeId = `scan-insert-${wavelength}-salt-a-action-node`;
    insertNodeBefore(saltANodeId, insertBlankNode);
    insertNodeBefore(saltANodeId, blankNode);
    insertNodeBefore(saltANodeId, removeBlankNode);
    const setNodeId = `scan-set-${wavelength}-action-node`;
    removeEdge(setNodeId, saltANodeId);
    edges.push(edge(setNodeId, insertBlankNode.id));
    edges.push(edge(insertBlankNode.id, blankNode.id));
    edges.push(edge(blankNode.id, removeBlankNode.id));
    edges.push(edge(removeBlankNode.id, saltANodeId));
  }

  // The source's P-01-P-05 scan selects a wavelength and reads/records both salts, but it does not
  // state a scan-specific blank. Keep the accepted per-wavelength blank cycle visible as a
  // teacher-configured product method while keeping the source-stated S-03/S-04 calibration pair.
  const updateScanActionPresentation = (actionId, label, stateChange, success, accessibleLabel) => {
    const action = mustFind(actionId);
    action.label = label;
    action.stateChanges = [stateChange, ...(action.stateChanges ?? []).slice(1)];
    action.feedback = { ...(action.feedback ?? {}), success };
    action.interaction = { ...(action.interaction ?? {}), accessibleLabel };
  };
  updateScanActionPresentation(
    "scan-prepare-distilled-water-blank-action",
    "Prepare the distilled-water scan blank",
    "The distilled-water scan blank is prepared for the wavelength scan.",
    "The distilled-water scan blank is prepared.",
    "Fill the dedicated scan blank cuvette with distilled water.",
  );
  updateScanActionPresentation(
    "scan-place-photometer-action",
    "Place the spectrophotometer for the assigned-salt scan",
    "The spectrophotometer is placed for the assigned-salt scan.",
    "The spectrophotometer is placed for the assigned-salt scan.",
    "Place the spectrophotometer for the assigned-salt scan.",
  );
  for (const wavelength of scanWavelengths) {
    const insertId = `scan-insert-${wavelength}-blank-action`;
    const blankId = `scan-blank-${wavelength}-action`;
    const removeId = `scan-remove-${wavelength}-blank-action`;
    const insertLabel = `Insert the distilled-water scan blank at ${wavelength} nm`;
    const blankLabel = `Blank the photometer with distilled water at ${wavelength} nm`;
    const removeLabel = `Remove the distilled-water scan blank after ${wavelength} nm`;
    updateScanActionPresentation(
      insertId,
      insertLabel,
      `${insertLabel}: the prepared blank is inserted before the scan read.`,
      "The distilled-water scan blank is inserted.",
      `${insertLabel}.`,
    );
    updateScanActionPresentation(
      blankId,
      blankLabel,
      `${blankLabel}: the prepared blank is applied before the assigned-salt readings. Reblank after changing wavelength or when the activity is reset.`,
      "The photometer is blanked with distilled water.",
      `${blankLabel}.`,
    );
    updateScanActionPresentation(
      removeId,
      removeLabel,
      `${removeLabel}: the sample compartment is cleared before the assigned-salt readings.`,
      "The distilled-water scan blank is removed.",
      `${removeLabel}.`,
    );
    mustFind(blankId).parameters = {
      ...mustFind(blankId).parameters,
      note: `Teacher-approved scan setup: apply a distilled-water blank at ${wavelength} nm before the assigned-salt readings.`,
    };
  }
  const updateScanNodePresentation = (actionId, title, description) => {
    const node = nodes.find((candidate) => candidate.actionId === actionId);
    if (!node) throw new Error(`Expected scan process node for action "${actionId}" is missing.`);
    node.title = title;
    node.description = description;
    if (node.validation?.[0]) node.validation[0].label = `${title} was completed.`;
    node.feedback = { ...(node.feedback ?? {}), success: `${title} complete.`, retry: `Review ${title} and try again.` };
  };
  updateScanNodePresentation(
    "scan-prepare-distilled-water-blank-action",
    "Prepare the distilled-water scan blank",
    "Fill the dedicated scan cuvette with clean distilled water once; reinsert and reblank it after each wavelength change or when the activity is reset.",
  );
  updateScanNodePresentation(
    "scan-place-photometer-action",
    "Place the spectrophotometer for the assigned-salt scan",
    "Place the spectrophotometer for the assigned-salt scan.",
  );
  for (const wavelength of scanWavelengths) {
    updateScanNodePresentation(
      `scan-insert-${wavelength}-blank-action`,
      `Insert the distilled-water scan blank at ${wavelength} nm`,
      `Insert the prepared distilled-water blank before the scan read at ${wavelength} nm.`,
    );
    updateScanNodePresentation(
      `scan-blank-${wavelength}-action`,
      `Blank the photometer with distilled water at ${wavelength} nm`,
      `Apply the prepared distilled-water blank at ${wavelength} nm before the assigned-salt readings. Reblank after changing wavelength or when the activity is reset.`,
    );
    updateScanNodePresentation(
      `scan-remove-${wavelength}-blank-action`,
      `Remove the distilled-water scan blank after ${wavelength} nm`,
      `Remove the scan blank so the two assigned-salt cuvettes can be read at ${wavelength} nm.`,
    );
  }

  const configureApprovedWavelengthNode = processNode(
    "configure-approved-wavelength",
    "Configure the approved wavelength on the spectrophotometer",
    "Set the actual spectrophotometer wavelength from the current teacher-approved proposal. Approval alone does not change the instrument state.",
    "configure-approved-wavelength-action",
    "observation",
  );
  const configureNode = processNode(
    "configure-brass-sample-inventory",
    "Configure the brass sample stock",
    "The teacher supplies the finite brass sample mass available in the vial before any physical step uses it.",
    "configure-brass-sample-inventory-action",
  );
  const zeroConfirmationNode = processNode(
    "confirm-brass-weighing-support-zeroed",
    "Confirm the balance was zeroed",
    "With the empty weighing support on the pan, zero the balance at the instrument and record that you did so. The simulator cannot check this for you; the net-mass reading that follows depends on it.",
    "confirm-brass-weighing-support-zeroed-action",
  );
  const loadNode = processNode(
    "load-brass-onto-weighing-support",
    "Load the brass onto the weighing support",
    "Tip the whole configured brass portion from the vial onto the zeroed weighing support.",
    "load-brass-onto-weighing-support-action",
  );
  insertNodeBefore("configure-brass-sample-inventory", configureApprovedWavelengthNode);
  insertNodeBefore("tare-empty-beaker", configureNode);
  insertNodeBefore("place-brass-in-beaker", zeroConfirmationNode);
  insertNodeBefore("place-brass-in-beaker", loadNode);
  // Retitle the retained node ids so the sidebar describes the support rather than the beaker.
  nodeById.get("tare-empty-beaker").title = "Read the empty weighing support";
  nodeById.get("tare-empty-beaker").description = "Place the clean, dry weighing support on the balance and record the display. It need not read zero; the next step is where you zero the instrument.";
  nodeById.get("tare-empty-beaker").validation[0].label = "Read the empty weighing support was completed.";
  nodeById.get("weigh-brass").title = "Weigh the brass on the support";
  nodeById.get("weigh-brass").description = "Read the net brass mass from the balance with the loaded weighing support in place.";
  nodeById.get("place-brass-in-beaker").title = "Transfer the weighed brass into the beaker";
  nodeById.get("place-brass-in-beaker").description = "Move the entire weighed brass portion from the weighing support into the digestion beaker.";

  edges.push(edge("configure-approved-wavelength", "configure-brass-sample-inventory"));
  edges.push(edge("configure-brass-sample-inventory", "tare-empty-beaker"));
  removeEdge("tare-empty-beaker", "weigh-brass");
  edges.push(edge("tare-empty-beaker", "confirm-brass-weighing-support-zeroed"));
  edges.push(edge("confirm-brass-weighing-support-zeroed", "load-brass-onto-weighing-support"));
  edges.push(edge("load-brass-onto-weighing-support", "weigh-brass"));

  const comparisonNodes = [
    ["collect-color-depth-unknown-waste-action-node", "collect-color-depth-unknown-waste-action", "Collect the comparison unknown tube"],
    ["collect-color-depth-standard-waste-action-node", "collect-color-depth-standard-waste-action", "Collect the comparison standard tube"],
  ];
  removeEdge("collect-unknown-waste-action-node", "neutralize-waste");
  let previousNodeId = "collect-unknown-waste-action-node";
  for (const [nodeId, actionId, title] of comparisonNodes) {
    const node = processNode(
      nodeId,
      title,
      "Pour the remaining paired-comparison solution into the shared treatment beaker before neutralization.",
      actionId,
    );
    insertNodeBefore("neutralize-waste", node);
    edges.push(edge(previousNodeId, nodeId));
    previousNodeId = nodeId;
  }
  edges.push(edge(previousNodeId, "neutralize-waste"));

  // ------------------------------------------------------------------- composition contract repair

  const contract = next.composition;
  const roleById = new Map(contract.equipmentRoles.map((role) => [role.roleId, role]));
  const setRole = (roleId, allowedDefinitionIds, sourceInstanceIds) => {
    const existing = roleById.get(roleId);
    if (existing) {
      existing.allowedDefinitionIds = allowedDefinitionIds;
      existing.sourceInstanceIds = sourceInstanceIds;
      return;
    }
    const added = { roleId, required: true, allowedDefinitionIds, sourceInstanceIds };
    contract.equipmentRoles.push(added);
    roleById.set(roleId, added);
  };

  setRole("weighed-vessel", [WEIGHING_SUPPORT_DEFINITION], [WEIGHING_SUPPORT_INSTANCE]);
  setRole("weighed-sample-source", [WEIGHING_SUPPORT_DEFINITION], [WEIGHING_SUPPORT_INSTANCE]);
  setRole("solid-reagent-source", ["reagent-bottle", BRASS_STOCK_DEFINITION], ["baking-soda-bottle", BRASS_STOCK_INSTANCE]);
  setRole("color-depth-comparison-vessel", ["test-tube"], ["color-depth-unknown-tube", "color-depth-standard-tube"]);
  setRole("recovery-vessel", ["waste-beaker"], ["waste-beaker"]);
  setRole("photometer-sample-holder", ["cuvette"], [
    "measurement-cuvette",
    SCAN_BLANK_INSTANCE,
    "salt-a-scan-cuvette",
    "salt-b-scan-cuvette",
  ]);
  setRole("sample-source", ["test-tube"], [
    "standard-0p400-tube",
    "standard-0p200-tube",
    "standard-0p100-tube",
    "standard-0p0500-tube",
    "standard-0p0250-tube",
    "unknown-sample-tube",
    "assigned-salt-a-solution",
    "assigned-salt-b-solution",
    "color-depth-unknown-tube",
    "color-depth-standard-tube",
  ]);
  // The paired comparison tubes are filled fresh at V-01 and emptied at cleanup; they are never
  // the original labelled tube a measured cuvette portion is returned to at S-09.
  setRole("provenance-matched-sample-receiver", ["test-tube"], [
    "standard-0p400-tube",
    "standard-0p200-tube",
    "standard-0p100-tube",
    "standard-0p0500-tube",
    "standard-0p0250-tube",
    "unknown-sample-tube",
    "assigned-salt-a-solution",
    "assigned-salt-b-solution",
  ]);

  contract.ports.unshift(
    {
      id: "entry-configure-approved-wavelength",
      kind: "entry",
      nodeId: "configure-approved-wavelength",
    },
    {
      id: "entry-configure-brass-sample-inventory",
      kind: "entry",
      nodeId: "configure-brass-sample-inventory",
    },
  );

  // Every repaired action now derives its effect from a registry atom, so its composition-owned
  // legacy declaration must go. The remaining atomless brass action keeps its declaration.
  const atomBackedNow = new Set([
    "configure-approved-wavelength-action",
    "configure-brass-sample-inventory-action",
    "scan-configure-salt-a-inventory-action",
    "scan-configure-salt-b-inventory-action",
    "load-brass-onto-weighing-support-action",
    "confirm-diluted-digest-material-action",
    "fill-color-depth-unknown-action",
    "fill-color-depth-standard-action",
    "collect-0p0250-waste-action",
    "collect-0p0500-waste-action",
    "collect-0p100-waste-action",
    "collect-0p200-waste-action",
    "collect-0p400-waste-action",
    "collect-unknown-waste-action",
    "collect-color-depth-unknown-waste-action",
    "collect-color-depth-standard-waste-action",
    "transfer-treated-waste-to-destination-action",
  ]);
  contract.legacyActionEffects = contract.legacyActionEffects.filter((entry) => !atomBackedNow.has(entry.actionId));
  // The zero confirmation is atomless by design, so the composition must own its effect, and the
  // declaration has to be exactly what the canonical derivation produces for an `observe` action
  // handled by the generic notebook fallback or composition validation rejects the technique.
  contract.legacyActionEffects.push({
    actionId: "confirm-brass-weighing-support-zeroed-action",
    effect: { classes: ["evidence-recording"], targets: [{ domain: "evidence" }] },
  });

  // The composition contract gains a required equipment role and required source instances, and a
  // public action's physical meaning changed, so a lab pinned to 1.3.0 can no longer satisfy this
  // technique. That is a major increment under the repository's version strings, not a patch.
  next.metadata = { ...next.metadata, version: "2.0.0", updatedAt: "2026-09-12T00:00:00.000Z" };

  return next;
};
