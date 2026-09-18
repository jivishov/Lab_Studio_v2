/** Cycle 06-owned gravimetry/separation definitions from the revision-8 checkpoint plus accepted coordinator amendments 04-06 and 10. Keep this module data-only. */
import { applyStockSupplyVolumes } from "../stockSupplyVolumes.mjs";
const definitions = new Map([
  [
    "hard-water-gravimetry",
    {
      "id": "hard-water-gravimetry",
      "title": "Hard Water Gravimetry",
      "learningGoal": "Precipitate, filter, dry, and weigh calcium carbonate to calculate water hardness.",
      "requiredEquipment": [
        "sample-bottle",
        "graduated-cylinder",
        "beaker-250ml",
        "reagent-bottle",
        "stirring-rod",
        "buchner-funnel",
        "side-arm-filter-flask",
        "vacuum-source",
        "filter-paper",
        "wash-bottle",
        "drying-oven",
        "watch-glass",
        "analytical-balance",
        "crucible-tongs",
        "permanent-marker"
      ],
      "initialState": {
        "equipment": [
          {
            "id": "sample-bottle-1",
            "definitionId": "sample-bottle",
            "label": "Sample bottle",
            "location": "shelf",
            "contents": {
              "kind": "liquid",
              "label": "Teacher-configured 20 mL hard-water sample",
              "volumeMl": 20,
              "solutes": [
                {
                  "id": "hard-water-calcium-carbonate-equivalent",
                  "label": "Calcium carbonate equivalent",
                  "amount": 0.0075,
                  "unit": "g"
                }
              ],
              "contamination": [],
              "wetState": "wet",
              "visualState": "clear-liquid"
            }
          },
          {
            "id": "reagent-bottle-1",
            "definitionId": "reagent-bottle",
            "label": "Reagent bottle",
            "location": "shelf",
            "contents": {
              "kind": "solution",
              "label": "Sodium carbonate reagent",
              "volumeMl": 50,
              "solutes": [],
              "concentration": {
                "value": 0.5,
                "unit": "M"
              },
              "contamination": [],
              "wetState": "wet",
              "visualState": "clear-liquid"
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
            "id": "beaker-250ml-1",
            "definitionId": "beaker-250ml",
            "label": "250 mL beaker",
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
            "id": "stirring-rod-1",
            "definitionId": "stirring-rod",
            "label": "Stirring rod",
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
            "id": "buchner-funnel-1",
            "definitionId": "buchner-funnel",
            "label": "Buchner funnel",
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
            "id": "side-arm-filter-flask-1",
            "definitionId": "side-arm-filter-flask",
            "label": "Side-arm filter flask",
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
            "id": "vacuum-source-1",
            "definitionId": "vacuum-source",
            "label": "Vacuum source",
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
            "id": "filter-paper-1",
            "definitionId": "filter-paper",
            "label": "Filter paper",
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
            "id": "drying-oven-1",
            "definitionId": "drying-oven",
            "label": "Drying oven",
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
            "id": "watch-glass-1",
            "definitionId": "watch-glass",
            "label": "Watch glass",
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
            "id": "analytical-balance-1",
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
            "id": "crucible-tongs-1",
            "definitionId": "crucible-tongs",
            "label": "Crucible tongs",
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
            "id": "permanent-marker-1",
            "definitionId": "permanent-marker",
            "label": "Permanent marker",
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
          "id": "measure-water-sample",
          "verb": "measureVolume",
          "label": "Measure water sample",
          "parameters": {
            "sourceDefinitionId": "sample-bottle",
            "targetDefinitionId": "graduated-cylinder",
            "measurementId": "sample-volume",
            "volumeMl": 20,
            "tolerance": 0.2
          },
          "prerequisites": [],
          "stateChanges": [
            "Measure water sample: A 20 mL water sample is measured."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "A 20 mL water sample is measured.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "measureVolume",
            "measurement"
          ],
          "atomId": "atom.measure.variable-volume",
          "equipmentRoleBindings": {
            "variable-volume-measuring-device": "graduated-cylinder",
            "liquid-source": "sample-bottle"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "sample-bottle",
            "targetDefinitionId": "graduated-cylinder",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Measure the 20 mL hard-water aliquot in the graduated cylinder."
          }
        },
        {
          "id": "transfer-water-sample",
          "verb": "transfer",
          "label": "Transfer water sample",
          "parameters": {
            "sourceDefinitionId": "graduated-cylinder",
            "targetDefinitionId": "beaker-250ml",
            "volumeMl": 20
          },
          "prerequisites": [
            {
              "id": "transfer-water-sample--sample-volume-required",
              "type": "measurementRecorded",
              "label": "The 20 mL sample aliquot is measured.",
              "measurementId": "sample-volume"
            }
          ],
          "stateChanges": [
            "Transfer water sample: The water sample is in the reaction beaker."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The water sample is in the reaction beaker.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "transfer"
          ],
          "atomId": "atom.transfer.measured-liquid",
          "equipmentRoleBindings": {
            "measured-solvent-source": "graduated-cylinder",
            "receiving-vessel": "beaker-250ml"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "graduated-cylinder",
            "targetDefinitionId": "beaker-250ml",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Transfer the measured aliquot to the reaction beaker."
          }
        },
        {
          "id": "add-carbonate-reagent",
          "verb": "transfer",
          "label": "Add carbonate reagent",
          "parameters": {
            "sourceDefinitionId": "reagent-bottle",
            "targetDefinitionId": "beaker-250ml",
            "volumeMl": 15,
            "visualState": "cloudy-precipitate",
            "configurationProvenance": "teacher-approved aliquot for complete precipitation"
          },
          "prerequisites": [
            {
              "id": "add-carbonate-reagent--transfer-water-sample-required",
              "type": "actionEvidence",
              "label": "The measured sample is in the reaction beaker.",
              "actionId": "transfer-water-sample"
            }
          ],
          "stateChanges": [
            "Add carbonate reagent: Carbonate reagent is mixed into the water sample."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "Carbonate reagent is mixed into the water sample.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "transfer"
          ],
          "atomId": "atom.transfer.precipitating-reagent",
          "equipmentRoleBindings": {
            "precipitating-reagent-source": "reagent-bottle",
            "precipitation-vessel": "beaker-250ml",
            "stirring-device": "stirring-rod"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "reagent-bottle",
            "targetDefinitionId": "beaker-250ml",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Add the teacher-approved carbonate portion while stirring."
          }
        },
        {
          "id": "establish-hard-water-precipitate",
          "verb": "precipitate",
          "label": "Establish wet precipitate state",
          "parameters": {
            "sourceDefinitionId": "reagent-bottle",
            "targetDefinitionId": "beaker-250ml",
            "finalVolumeMl": 35,
            "precipitateSoluteSourceId": "hard-water-calcium-carbonate-equivalent",
            "precipitateSubstance": "Calcium carbonate",
            "precipitateSoluteId": "calcium-carbonate",
            "evidenceProvenance": "mass derives from the teacher-configured simulated sample profile; not student measurement evidence"
          },
          "prerequisites": [
            {
              "id": "establish-hard-water-precipitate--add-carbonate-reagent-required",
              "type": "actionEvidence",
              "label": "The approved carbonate portion has been added.",
              "actionId": "add-carbonate-reagent"
            }
          ],
          "stateChanges": [
            "Establish wet precipitate state: A wet calcium carbonate suspension is available for filtration."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "A wet calcium carbonate suspension is available for filtration.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "precipitate",
            "simulated-state"
          ],
          "atomId": "atom.precipitate.form-gravimetric-solid",
          "equipmentRoleBindings": {
            "precipitation-vessel": "beaker-250ml",
            "precipitating-reagent-source": "reagent-bottle"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "reagent-bottle",
            "targetDefinitionId": "beaker-250ml",
            "accessibleLabel": "Represent the wet precipitate suspension after the approved carbonate addition."
          }
        },
        {
          "id": "observe-precipitate",
          "verb": "observe",
          "label": "Record precipitate observation",
          "parameters": {
            "tag": "hard-water-precipitate",
            "note": "Describe the observed suspension; do not claim precipitation is complete from appearance alone.",
            "inputMode": "text",
            "inputRole": "studentResponse",
            "inputLabel": "Observed precipitate and uncertainty",
            "inputRequired": true
          },
          "prerequisites": [
            {
              "id": "observe-precipitate--establish-hard-water-precipitate-required",
              "type": "actionEvidence",
              "label": "The wet precipitate suspension is present.",
              "actionId": "establish-hard-water-precipitate"
            }
          ],
          "stateChanges": [
            "Record precipitate observation: Precipitate formation is recorded."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "Precipitate formation is recorded.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "observe",
            "notebook",
            "student-observation"
          ],
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "note",
            "accessibleLabel": "Record the precipitate observation and any uncertainty."
          }
        },
        {
          "id": "weigh-hard-water-filter-paper-tare",
          "verb": "weigh",
          "label": "Weigh dry filter paper",
          "parameters": {
            "sourceDefinitionId": "filter-paper",
            "targetDefinitionId": "analytical-balance",
            "instrumentDefinitionId": "analytical-balance",
            "tolerance": 0.001,
            "evidenceProvenance": "learner-entered reading from the configured simulated balance; no expected mass is embedded",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputKey": "hard-water-filter-paper-mass-input",
            "inputLabel": "Weigh dry filter paper from the configured simulated balance (g)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "g"
          },
          "prerequisites": [
            {
              "id": "weigh-hard-water-filter-paper-tare--observe-precipitate-required",
              "type": "actionEvidence",
              "label": "The precipitation observation is recorded.",
              "actionId": "observe-precipitate"
            }
          ],
          "stateChanges": [
            "Weigh dry filter paper: The dry filter-paper tare is available."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The dry filter-paper tare is available.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "weigh"
          ],
          "atomId": "atom.weigh.filter-medium-tare",
          "equipmentRoleBindings": {
            "balance-instrument": "analytical-balance",
            "filter-medium": "filter-paper"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "filter-paper",
            "targetDefinitionId": "analytical-balance",
            "stationId": "analytical-balance",
            "valueParameter": "inputKey",
            "accessibleLabel": "Read the mass of the dry filter paper before seating it."
          },
          "mass": {
            "source": "action-input",
            "outputMeasurementId": "hard-water-filter-paper-mass"
          }
        },
        {
          "id": "record-hard-water-filter-paper-tare",
          "verb": "record",
          "label": "Record filter-paper tare",
          "parameters": {
            "measurementId": "hard-water-filter-paper-mass",
            "label": "Dry filter-paper tare",
            "unit": "g",
            "copyExistingMeasurementOnly": true
          },
          "prerequisites": [
            {
              "id": "record-hard-water-filter-paper-tare--hard-water-filter-paper-mass-required",
              "type": "measurementRecorded",
              "label": "The filter-paper mass has been read.",
              "measurementId": "hard-water-filter-paper-mass"
            }
          ],
          "stateChanges": [
            "Record filter-paper tare: The filter-paper tare is recorded."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The filter-paper tare is recorded.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "record",
            "measurement"
          ],
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Copy the dry filter-paper tare into the notebook."
          }
        },
        {
          "id": "place-hard-water-buchner",
          "verb": "place",
          "label": "Place Buchner funnel",
          "parameters": {
            "equipmentDefinitionId": "buchner-funnel",
            "location": "workbench"
          },
          "prerequisites": [
            {
              "id": "place-hard-water-buchner--hard-water-filter-paper-mass-required",
              "type": "measurementRecorded",
              "label": "The dry filter-paper tare is recorded.",
              "measurementId": "hard-water-filter-paper-mass"
            }
          ],
          "stateChanges": [
            "Place Buchner funnel: The Buchner funnel is on the workbench."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The Buchner funnel is on the workbench.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "place"
          ],
          "atomId": "atom.place.filtration-funnel",
          "equipmentRoleBindings": {
            "filtration-funnel": "buchner-funnel"
          },
          "interaction": {
            "type": "dragToZone",
            "sourceDefinitionId": "buchner-funnel",
            "stationId": "workbench",
            "accessibleLabel": "Place the Buchner funnel on the workbench."
          }
        },
        {
          "id": "seat-hard-water-filter-paper",
          "verb": "place",
          "label": "Seat filter paper",
          "parameters": {
            "equipmentDefinitionId": "filter-paper",
            "targetDefinitionId": "buchner-funnel",
            "snapZoneId": "buchner-funnel-paper-seat"
          },
          "prerequisites": [
            {
              "id": "seat-hard-water-filter-paper--place-hard-water-buchner-required",
              "type": "actionEvidence",
              "label": "The Buchner funnel is placed.",
              "actionId": "place-hard-water-buchner"
            }
          ],
          "stateChanges": [
            "Seat filter paper: The filter paper is seated flat in the funnel."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The filter paper is seated flat in the funnel.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "place"
          ],
          "atomId": "atom.place.filter-medium",
          "equipmentRoleBindings": {
            "filtration-funnel": "buchner-funnel",
            "filter-medium": "filter-paper"
          },
          "interaction": {
            "type": "snapIntoTarget",
            "sourceDefinitionId": "filter-paper",
            "targetDefinitionId": "buchner-funnel",
            "snapZoneId": "buchner-funnel-paper-seat",
            "accessibleLabel": "Seat the filter paper flat on the Buchner funnel plate."
          }
        },
        {
          "id": "attach-hard-water-filter-flask",
          "verb": "place",
          "label": "Attach side-arm receiver",
          "parameters": {
            "equipmentDefinitionId": "side-arm-filter-flask",
            "targetDefinitionId": "buchner-funnel",
            "snapZoneId": "buchner-funnel-receiver-neck"
          },
          "prerequisites": [
            {
              "id": "attach-hard-water-filter-flask--place-hard-water-buchner-required",
              "type": "actionEvidence",
              "label": "The Buchner funnel is placed.",
              "actionId": "place-hard-water-buchner"
            }
          ],
          "stateChanges": [
            "Attach side-arm receiver: The side-arm flask is aligned beneath the funnel."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The side-arm flask is aligned beneath the funnel.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "place"
          ],
          "atomId": "atom.place.filtration-receiver",
          "equipmentRoleBindings": {
            "filtration-receiver": "side-arm-filter-flask"
          },
          "interaction": {
            "type": "snapIntoTarget",
            "sourceDefinitionId": "side-arm-filter-flask",
            "targetDefinitionId": "buchner-funnel",
            "snapZoneId": "buchner-funnel-receiver-neck",
            "accessibleLabel": "Attach the side-arm flask beneath the Buchner funnel."
          }
        },
        {
          "id": "place-hard-water-vacuum",
          "verb": "place",
          "label": "Place vacuum source",
          "parameters": {
            "equipmentDefinitionId": "vacuum-source",
            "location": "workbench"
          },
          "prerequisites": [
            {
              "id": "place-hard-water-vacuum--attach-hard-water-filter-flask-required",
              "type": "actionEvidence",
              "label": "The side-arm receiver is attached.",
              "actionId": "attach-hard-water-filter-flask"
            }
          ],
          "stateChanges": [
            "Place vacuum source: The vacuum source is beside the side-arm flask."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The vacuum source is beside the side-arm flask.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "place"
          ],
          "atomId": "atom.place.filtration-vacuum-source",
          "equipmentRoleBindings": {
            "filtration-vacuum-source": "vacuum-source",
            "filtration-receiver": "side-arm-filter-flask"
          },
          "interaction": {
            "type": "dragToZone",
            "sourceDefinitionId": "vacuum-source",
            "stationId": "workbench",
            "accessibleLabel": "Place the vacuum source beside the side-arm filter flask."
          }
        },
        {
          "id": "wet-hard-water-filter-paper",
          "verb": "rinse",
          "label": "Wet and seal filter paper",
          "parameters": {
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "filter-paper",
            "rinseType": "pre-wet",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputKey": "wet-hard-water-filter-paper-rinse-volume",
            "inputLabel": "Approved rinse portion (mL)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true
          },
          "prerequisites": [
            {
              "id": "wet-hard-water-filter-paper--seat-hard-water-filter-paper-required",
              "type": "actionEvidence",
              "label": "The paper is seated.",
              "actionId": "seat-hard-water-filter-paper"
            },
            {
              "id": "wet-hard-water-filter-paper--attach-hard-water-filter-flask-required",
              "type": "actionEvidence",
              "label": "The receiver is attached.",
              "actionId": "attach-hard-water-filter-flask"
            }
          ],
          "stateChanges": [
            "Wet and seal filter paper: The filter paper is wetted and sealed."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The filter paper is wetted and sealed.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "rinse"
          ],
          "atomId": "atom.rinse.wet-filter-medium",
          "equipmentRoleBindings": {
            "rinse-water-source": "wash-bottle",
            "filter-medium": "filter-paper"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "filter-paper",
            "valueParameter": "inputKey",
            "accessibleLabel": "Wet the seated filter paper with deionized water."
          }
        },
        {
          "id": "filter-hard-water-mixture",
          "verb": "filter",
          "label": "Filter hard-water suspension",
          "parameters": {
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "buchner-funnel",
            "retainedVisualState": "filter-cake",
            "filtrateVisualState": "clear-filtrate"
          },
          "prerequisites": [
            {
              "id": "filter-hard-water-mixture--wet-hard-water-filter-paper-required",
              "type": "actionEvidence",
              "label": "The paper is wetted and sealed.",
              "actionId": "wet-hard-water-filter-paper"
            },
            {
              "id": "filter-hard-water-mixture--place-hard-water-vacuum-required",
              "type": "actionEvidence",
              "label": "The vacuum source is placed.",
              "actionId": "place-hard-water-vacuum"
            }
          ],
          "stateChanges": [
            "Filter hard-water suspension: The precipitate is retained on the filter paper."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The precipitate is retained on the filter paper.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "filter"
          ],
          "atomId": "atom.filter.pour-through-medium",
          "equipmentRoleBindings": {
            "mixture-source": "beaker-250ml",
            "filtration-funnel": "buchner-funnel"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "buchner-funnel",
            "accessibleLabel": "Pour the suspension slowly through the prepared Buchner funnel."
          }
        },
        {
          "id": "rinse-precipitate",
          "verb": "rinse",
          "label": "Wash collected precipitate",
          "parameters": {
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "buchner-funnel",
            "rinseType": "precipitate",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputKey": "rinse-precipitate-rinse-volume",
            "inputLabel": "Approved rinse portion (mL)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true
          },
          "prerequisites": [
            {
              "id": "rinse-precipitate--filter-hard-water-mixture-required",
              "type": "actionEvidence",
              "label": "The suspension has been filtered.",
              "actionId": "filter-hard-water-mixture"
            }
          ],
          "stateChanges": [
            "Wash collected precipitate: The collected precipitate is washed."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The collected precipitate is washed.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "rinse"
          ],
          "atomId": "atom.rinse.wash-precipitate",
          "equipmentRoleBindings": {
            "rinse-water-source": "wash-bottle",
            "filter-medium": "filter-paper"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "buchner-funnel",
            "valueParameter": "inputKey",
            "accessibleLabel": "Wash the collected precipitate with a small amount of deionized water."
          }
        },
        {
          "id": "weigh-hard-water-watch-glass-tare",
          "verb": "weigh",
          "label": "Weigh dry watch glass",
          "parameters": {
            "sourceDefinitionId": "watch-glass",
            "targetDefinitionId": "analytical-balance",
            "instrumentDefinitionId": "analytical-balance",
            "tolerance": 0.001,
            "evidenceProvenance": "learner-entered reading from the configured simulated balance; no expected mass is embedded",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputKey": "hard-water-watch-glass-mass-input",
            "inputLabel": "Weigh dry watch glass from the configured simulated balance (g)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "g"
          },
          "prerequisites": [
            {
              "id": "weigh-hard-water-watch-glass-tare--rinse-precipitate-required",
              "type": "actionEvidence",
              "label": "The precipitate has been washed.",
              "actionId": "rinse-precipitate"
            }
          ],
          "stateChanges": [
            "Weigh dry watch glass: The dry watch-glass tare is available."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The dry watch-glass tare is available.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "weigh"
          ],
          "atomId": "atom.weigh.tare-vessel",
          "equipmentRoleBindings": {
            "balance-instrument": "analytical-balance",
            "weighed-vessel": "watch-glass"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "watch-glass",
            "targetDefinitionId": "analytical-balance",
            "stationId": "analytical-balance",
            "valueParameter": "inputKey",
            "accessibleLabel": "Read the mass of the clean, dry watch glass."
          },
          "mass": {
            "source": "action-input",
            "outputMeasurementId": "hard-water-watch-glass-mass"
          }
        },
        {
          "id": "record-hard-water-watch-glass-tare",
          "verb": "record",
          "label": "Record watch-glass tare",
          "parameters": {
            "measurementId": "hard-water-watch-glass-mass",
            "label": "Dry watch-glass tare",
            "unit": "g",
            "copyExistingMeasurementOnly": true
          },
          "prerequisites": [
            {
              "id": "record-hard-water-watch-glass-tare--hard-water-watch-glass-mass-required",
              "type": "measurementRecorded",
              "label": "The watch-glass mass has been read.",
              "measurementId": "hard-water-watch-glass-mass"
            }
          ],
          "stateChanges": [
            "Record watch-glass tare: The watch-glass tare is recorded."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The watch-glass tare is recorded.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "record",
            "measurement"
          ],
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Copy the dry watch-glass tare into the notebook."
          }
        },
        {
          "id": "transfer-hard-water-paper-to-watch",
          "verb": "place",
          "label": "Transfer paper and precipitate",
          "parameters": {
            "equipmentDefinitionId": "filter-paper",
            "targetDefinitionId": "watch-glass",
            "snapZoneId": "watch-glass-paper-seat",
            "detachBeforeAttach": true
          },
          "prerequisites": [
            {
              "id": "transfer-hard-water-paper-to-watch--hard-water-watch-glass-mass-required",
              "type": "measurementRecorded",
              "label": "The watch-glass tare is recorded.",
              "measurementId": "hard-water-watch-glass-mass"
            }
          ],
          "stateChanges": [
            "Transfer paper and precipitate: The paper and precipitate are on the tared watch glass."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The paper and precipitate are on the tared watch glass.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "place"
          ],
          "atomId": "atom.place.transfer-medium-to-drying-vessel",
          "equipmentRoleBindings": {
            "filter-medium": "filter-paper",
            "dried-assembly": "watch-glass"
          },
          "interaction": {
            "type": "snapIntoTarget",
            "sourceDefinitionId": "filter-paper",
            "targetDefinitionId": "watch-glass",
            "snapZoneId": "watch-glass-paper-seat",
            "accessibleLabel": "Transfer the filter paper and precipitate to the tared watch glass."
          }
        },
        {
          "id": "first-hard-water-drying",
          "verb": "dry",
          "label": "Complete first drying stage",
          "parameters": {
            "sourceDefinitionId": "watch-glass",
            "targetDefinitionId": "watch-glass",
            "ovenDefinitionId": "drying-oven",
            "precipitateSourceInstanceId": "filter-paper-1",
            "drynessResult": "damp",
            "temperatureC": "{{config.ovenTemperatureC}}",
            "durationMinutes": "{{config.firstDurationMinutes}}",
            "visualState": "partially-dry-precipitate",
            "temperatureProvenance": "teacher-configured within 110-120 C",
            "durationProvenance": "teacher-configured within 10-15 minutes",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputKey": "first-hard-water-drying-elapsed-minutes",
            "inputLabel": "Observed elapsed drying time (minutes)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "requireElapsedDryingTime": true,
            "instruction": "Carry out this separate drying stage at the configured oven temperature; record actual elapsed minutes before removing the same assembly."
          },
          "prerequisites": [
            {
              "id": "first-hard-water-drying--transfer-hard-water-paper-to-watch-required",
              "type": "actionEvidence",
              "label": "The paper and solid are on the watch glass.",
              "actionId": "transfer-hard-water-paper-to-watch"
            }
          ],
          "stateChanges": [
            "Complete first drying stage: The first drying stage is complete."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The first drying stage is complete.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "dry"
          ],
          "atomId": "atom.dry.oven-stage",
          "equipmentRoleBindings": {
            "drying-instrument": "drying-oven",
            "dried-assembly": "watch-glass"
          },
          "interaction": {
            "type": "placeInInstrument",
            "sourceDefinitionId": "watch-glass",
            "targetDefinitionId": "drying-oven",
            "stationId": "drying-oven",
            "accessibleLabel": "Place the watch-glass assembly in the teacher-configured oven for the first drying stage.",
            "valueParameter": "inputKey"
          }
        },
        {
          "id": "break-hard-water-precipitate",
          "verb": "observe",
          "label": "Break precipitate into small pieces",
          "parameters": {
            "tag": "hard-water-breakup",
            "note": "Break the partly dried precipitate into small pieces with the approved metal scoop before returning it to the oven.",
            "inputMode": "choice",
            "inputRole": "studentResponse",
            "inputLabel": "Precipitate breakup",
            "inputOptions": [
              "Broken into small pieces"
            ]
          },
          "prerequisites": [
            {
              "id": "break-hard-water-precipitate--first-hard-water-drying-required",
              "type": "actionEvidence",
              "label": "The first drying stage is complete.",
              "actionId": "first-hard-water-drying"
            }
          ],
          "stateChanges": [
            "Break precipitate into small pieces: The precipitate breakup is recorded."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The precipitate breakup is recorded.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "observe",
            "notebook",
            "manipulation"
          ],
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "note",
            "accessibleLabel": "Confirm the precipitate was broken into small pieces."
          }
        },
        {
          "id": "second-hard-water-drying",
          "verb": "dry",
          "label": "Complete second drying stage",
          "parameters": {
            "sourceDefinitionId": "watch-glass",
            "targetDefinitionId": "watch-glass",
            "ovenDefinitionId": "drying-oven",
            "precipitateSourceInstanceId": "filter-paper-1",
            "drynessResult": "dry",
            "temperatureC": "{{config.ovenTemperatureC}}",
            "durationMinutes": 5,
            "visualState": "broken-dry-precipitate",
            "temperatureProvenance": "teacher-configured within 110-120 C",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputKey": "second-hard-water-drying-elapsed-minutes",
            "inputLabel": "Observed elapsed drying time (minutes)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "requireElapsedDryingTime": true,
            "instruction": "Carry out this separate drying stage at the configured oven temperature; record actual elapsed minutes before removing the same assembly."
          },
          "prerequisites": [
            {
              "id": "second-hard-water-drying--hard-water-breakup-required",
              "type": "notebookEntry",
              "label": "The precipitate was broken into small pieces.",
              "notebookTag": "hard-water-breakup"
            }
          ],
          "stateChanges": [
            "Complete second drying stage: The second drying stage is complete."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The second drying stage is complete.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "dry"
          ],
          "atomId": "atom.dry.oven-stage",
          "equipmentRoleBindings": {
            "drying-instrument": "drying-oven",
            "dried-assembly": "watch-glass"
          },
          "interaction": {
            "type": "placeInInstrument",
            "sourceDefinitionId": "watch-glass",
            "targetDefinitionId": "drying-oven",
            "stationId": "drying-oven",
            "accessibleLabel": "Return the broken precipitate assembly to the oven for five minutes.",
            "valueParameter": "inputKey"
          }
        },
        {
          "id": "cool-hard-water-assembly",
          "verb": "cool",
          "label": "Cool dried assembly",
          "parameters": {
            "sourceDefinitionId": "watch-glass",
            "targetDefinitionId": "crucible-tongs",
            "cooledTemperatureC": "{{config.coolingTemperatureC}}",
            "cooledObjectLabel": "watch-glass, paper, and precipitate assembly",
            "visualState": "cooled-dry-precipitate"
          },
          "prerequisites": [
            {
              "id": "cool-hard-water-assembly--second-hard-water-drying-required",
              "type": "actionEvidence",
              "label": "The second drying stage is complete.",
              "actionId": "second-hard-water-drying"
            }
          ],
          "stateChanges": [
            "Cool dried assembly: The dried assembly has cooled before weighing."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The dried assembly has cooled before weighing.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "cool"
          ],
          "atomId": "atom.cool.before-weighing",
          "equipmentRoleBindings": {
            "dried-assembly": "watch-glass",
            "cooling-tool": "crucible-tongs"
          },
          "interaction": {
            "type": "placeInInstrument",
            "sourceDefinitionId": "watch-glass",
            "targetDefinitionId": "crucible-tongs",
            "stationId": "crucible-tongs",
            "accessibleLabel": "Use heat-safe handling and set the dried assembly aside to cool."
          }
        },
        {
          "id": "weigh-hard-water-combined",
          "verb": "weigh",
          "label": "Read cooled combined mass",
          "parameters": {
            "sourceDefinitionId": "watch-glass",
            "targetDefinitionId": "analytical-balance",
            "instrumentDefinitionId": "analytical-balance",
            "requiresDryPrecipitate": true,
            "maxSafeTemperatureC": "{{config.coolingTemperatureC}}",
            "tolerance": 0.001,
            "evidenceProvenance": "learner-entered reading from the configured simulated balance; no expected mass is embedded",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputKey": "hard-water-combined-mass-input",
            "inputLabel": "Read cooled combined mass from the configured simulated balance (g)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "g"
          },
          "prerequisites": [
            {
              "id": "weigh-hard-water-combined--cool-hard-water-assembly-required",
              "type": "actionEvidence",
              "label": "The assembly has cooled.",
              "actionId": "cool-hard-water-assembly"
            },
            {
              "id": "weigh-hard-water-combined--hard-water-watch-glass-mass-required",
              "type": "measurementRecorded",
              "label": "The watch-glass tare is recorded.",
              "measurementId": "hard-water-watch-glass-mass"
            },
            {
              "id": "weigh-hard-water-combined--hard-water-filter-paper-mass-required",
              "type": "measurementRecorded",
              "label": "The filter-paper tare is recorded.",
              "measurementId": "hard-water-filter-paper-mass"
            }
          ],
          "stateChanges": [
            "Read cooled combined mass: The cooled combined mass is available."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The cooled combined mass is available.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "weigh"
          ],
          "atomId": "atom.weigh.dry-assembly",
          "equipmentRoleBindings": {
            "balance-instrument": "analytical-balance",
            "dried-assembly": "watch-glass"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "watch-glass",
            "targetDefinitionId": "analytical-balance",
            "stationId": "analytical-balance",
            "valueParameter": "inputKey",
            "accessibleLabel": "Read the cooled combined mass on the analytical balance."
          },
          "mass": {
            "source": "action-input",
            "outputMeasurementId": "hard-water-combined-mass"
          }
        },
        {
          "id": "record-hard-water-combined",
          "verb": "record",
          "label": "Record cooled combined mass",
          "parameters": {
            "measurementId": "hard-water-combined-mass",
            "label": "Cooled watch glass, filter paper, and precipitate mass",
            "unit": "g",
            "copyExistingMeasurementOnly": true
          },
          "prerequisites": [
            {
              "id": "record-hard-water-combined--hard-water-combined-mass-required",
              "type": "measurementRecorded",
              "label": "The combined mass has been read.",
              "measurementId": "hard-water-combined-mass"
            }
          ],
          "stateChanges": [
            "Record cooled combined mass: The cooled combined mass is recorded."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The cooled combined mass is recorded.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "record",
            "measurement"
          ],
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Copy the cooled combined mass into the notebook."
          }
        },
        {
          "id": "calculate-hard-water-precipitate-mass",
          "verb": "calculate",
          "label": "Calculate collected precipitate mass",
          "parameters": {
            "calculationId": "hard-water-precipitate-mass",
            "template": "gravimetricPrecipitateMass",
            "combinedMassMeasurementId": "hard-water-combined-mass",
            "watchGlassMassMeasurementId": "hard-water-watch-glass-mass",
            "filterPaperMassMeasurementId": "hard-water-filter-paper-mass",
            "tolerance": 0.001,
            "requireStudentValue": true,
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Collected precipitate mass",
            "inputMin": 0,
            "inputStep": 0.0001,
            "unit": "g"
          },
          "prerequisites": [
            {
              "id": "calculate-hard-water-precipitate-mass--hard-water-watch-glass-mass-required",
              "type": "measurementRecorded",
              "label": "The watch-glass tare is recorded.",
              "measurementId": "hard-water-watch-glass-mass"
            },
            {
              "id": "calculate-hard-water-precipitate-mass--hard-water-filter-paper-mass-required",
              "type": "measurementRecorded",
              "label": "The filter-paper tare is recorded.",
              "measurementId": "hard-water-filter-paper-mass"
            },
            {
              "id": "calculate-hard-water-precipitate-mass--hard-water-combined-mass-required",
              "type": "measurementRecorded",
              "label": "The cooled combined mass is recorded.",
              "measurementId": "hard-water-combined-mass"
            }
          ],
          "stateChanges": [
            "Calculate collected precipitate mass: Collected precipitate mass is calculated."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "Collected precipitate mass is calculated.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "calculate",
            "measurement-derived"
          ],
          "interaction": {
            "type": "submitCalculation",
            "valueParameter": "calculationId",
            "accessibleLabel": "Subtract both the watch-glass and filter-paper tares from the cooled combined mass."
          }
        },
        {
          "id": "calculate-hardness",
          "verb": "calculate",
          "label": "Calculate water hardness",
          "parameters": {
            "calculationId": "hardness-mg-l",
            "template": "hardnessMgLAsCaCO3",
            "sampleVolumeMeasurementId": "sample-volume",
            "precipitateMassCalculationId": "hard-water-precipitate-mass",
            "requireStudentValue": true,
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Hardness as CaCO3",
            "inputMin": 0,
            "inputStep": 1,
            "unit": "mg/L as CaCO3",
            "tolerance": 5
          },
          "prerequisites": [
            {
              "id": "calculate-hardness--sample-volume-required",
              "type": "measurementRecorded",
              "label": "The sample volume is recorded.",
              "measurementId": "sample-volume"
            }
          ],
          "stateChanges": [
            "Calculate water hardness: Water hardness is calculated from measured evidence."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "Water hardness is calculated from measured evidence.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "calculate",
            "measurement-derived"
          ],
          "interaction": {
            "type": "submitCalculation",
            "valueParameter": "calculationId",
            "accessibleLabel": "Calculate hardness from the measured sample volume and calculated precipitate mass."
          }
        }
      ],
      "process": {
        "startNodeId": "measure-water-sample-node",
        "nodes": [
          {
            "id": "measure-water-sample-node",
            "type": "action",
            "title": "Measure water sample",
            "description": "Pour 20 mL of water sample into the graduated cylinder.",
            "actionId": "measure-water-sample",
            "config": {},
            "validation": [
              {
                "id": "measure-water-sample-node--measure-water-sample-node-done",
                "type": "actionEvidence",
                "label": "Action measure-water-sample was completed.",
                "actionId": "measure-water-sample"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Measure water sample complete.",
              "retry": "Review Measure water sample and try again."
            }
          },
          {
            "id": "transfer-water-sample-node",
            "type": "action",
            "title": "Transfer water sample",
            "description": "Pour the water sample into the reaction beaker.",
            "actionId": "transfer-water-sample",
            "config": {},
            "validation": [
              {
                "id": "transfer-water-sample-node--transfer-water-sample-node-done",
                "type": "actionEvidence",
                "label": "Action transfer-water-sample was completed.",
                "actionId": "transfer-water-sample"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Transfer water sample complete.",
              "retry": "Review Transfer water sample and try again."
            }
          },
          {
            "id": "add-carbonate-reagent-node",
            "type": "action",
            "title": "Add carbonate reagent",
            "description": "Pour carbonate reagent into the water sample while stirring.",
            "actionId": "add-carbonate-reagent",
            "config": {},
            "validation": [
              {
                "id": "add-carbonate-reagent-node--add-carbonate-reagent-node-done",
                "type": "actionEvidence",
                "label": "Action add-carbonate-reagent was completed.",
                "actionId": "add-carbonate-reagent"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Add carbonate reagent complete.",
              "retry": "Review Add carbonate reagent and try again."
            }
          },
          {
            "id": "establish-hard-water-precipitate-node",
            "type": "action",
            "title": "Establish wet precipitate",
            "description": "Represent the wet calcium carbonate suspension for filtration.",
            "actionId": "establish-hard-water-precipitate",
            "config": {},
            "validation": [
              {
                "id": "establish-hard-water-precipitate-node--establish-hard-water-precipitate-node-done",
                "type": "actionEvidence",
                "label": "Action establish-hard-water-precipitate was completed.",
                "actionId": "establish-hard-water-precipitate"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Establish wet precipitate complete.",
              "retry": "Review Establish wet precipitate and try again."
            }
          },
          {
            "id": "observe-precipitate-node",
            "type": "observation",
            "title": "Observe precipitate",
            "description": "Record the precipitate formed in the hard water sample.",
            "actionId": "observe-precipitate",
            "config": {},
            "validation": [
              {
                "id": "observe-precipitate-node--observe-precipitate-node-done",
                "type": "actionEvidence",
                "label": "Action observe-precipitate was completed.",
                "actionId": "observe-precipitate"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Observe precipitate complete.",
              "retry": "Review Observe precipitate and try again."
            }
          },
          {
            "id": "weigh-hard-water-filter-paper-tare-node",
            "type": "action",
            "title": "Read filter-paper tare",
            "description": "Read the dry filter-paper mass before seating it.",
            "actionId": "weigh-hard-water-filter-paper-tare",
            "config": {},
            "validation": [
              {
                "id": "weigh-hard-water-filter-paper-tare-node--weigh-hard-water-filter-paper-tare-node-done",
                "type": "actionEvidence",
                "label": "Action weigh-hard-water-filter-paper-tare was completed.",
                "actionId": "weigh-hard-water-filter-paper-tare"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read filter-paper tare complete.",
              "retry": "Review Read filter-paper tare and try again."
            }
          },
          {
            "id": "record-hard-water-filter-paper-tare-node",
            "type": "observation",
            "title": "Record filter-paper tare",
            "description": "Copy the dry filter-paper tare into the notebook.",
            "actionId": "record-hard-water-filter-paper-tare",
            "config": {},
            "validation": [
              {
                "id": "record-hard-water-filter-paper-tare-node--record-hard-water-filter-paper-tare-node-done",
                "type": "actionEvidence",
                "label": "Action record-hard-water-filter-paper-tare was completed.",
                "actionId": "record-hard-water-filter-paper-tare"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record filter-paper tare complete.",
              "retry": "Review Record filter-paper tare and try again."
            }
          },
          {
            "id": "place-hard-water-buchner-node",
            "type": "action",
            "title": "Place funnel",
            "description": "Place the Buchner funnel on the workbench.",
            "actionId": "place-hard-water-buchner",
            "config": {},
            "validation": [
              {
                "id": "place-hard-water-buchner-node--place-hard-water-buchner-node-done",
                "type": "actionEvidence",
                "label": "Action place-hard-water-buchner was completed.",
                "actionId": "place-hard-water-buchner"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Place funnel complete.",
              "retry": "Review Place funnel and try again."
            }
          },
          {
            "id": "seat-hard-water-filter-paper-node",
            "type": "action",
            "title": "Seat filter paper",
            "description": "Seat the filter paper flat in the funnel.",
            "actionId": "seat-hard-water-filter-paper",
            "config": {},
            "validation": [
              {
                "id": "seat-hard-water-filter-paper-node--seat-hard-water-filter-paper-node-done",
                "type": "actionEvidence",
                "label": "Action seat-hard-water-filter-paper was completed.",
                "actionId": "seat-hard-water-filter-paper"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Seat filter paper complete.",
              "retry": "Review Seat filter paper and try again."
            }
          },
          {
            "id": "attach-hard-water-filter-flask-node",
            "type": "action",
            "title": "Attach receiver",
            "description": "Attach the side-arm receiver beneath the funnel.",
            "actionId": "attach-hard-water-filter-flask",
            "config": {},
            "validation": [
              {
                "id": "attach-hard-water-filter-flask-node--attach-hard-water-filter-flask-node-done",
                "type": "actionEvidence",
                "label": "Action attach-hard-water-filter-flask was completed.",
                "actionId": "attach-hard-water-filter-flask"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Attach receiver complete.",
              "retry": "Review Attach receiver and try again."
            }
          },
          {
            "id": "place-hard-water-vacuum-node",
            "type": "action",
            "title": "Place vacuum source",
            "description": "Place the vacuum source beside the filter flask.",
            "actionId": "place-hard-water-vacuum",
            "config": {},
            "validation": [
              {
                "id": "place-hard-water-vacuum-node--place-hard-water-vacuum-node-done",
                "type": "actionEvidence",
                "label": "Action place-hard-water-vacuum was completed.",
                "actionId": "place-hard-water-vacuum"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Place vacuum source complete.",
              "retry": "Review Place vacuum source and try again."
            }
          },
          {
            "id": "wet-hard-water-filter-paper-node",
            "type": "action",
            "title": "Wet filter paper",
            "description": "Wet and seal the seated filter paper.",
            "actionId": "wet-hard-water-filter-paper",
            "config": {},
            "validation": [
              {
                "id": "wet-hard-water-filter-paper-node--wet-hard-water-filter-paper-node-done",
                "type": "actionEvidence",
                "label": "Action wet-hard-water-filter-paper was completed.",
                "actionId": "wet-hard-water-filter-paper"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Wet filter paper complete.",
              "retry": "Review Wet filter paper and try again."
            }
          },
          {
            "id": "filter-hard-water-mixture-node",
            "type": "action",
            "title": "Filter suspension",
            "description": "Pour the suspension through the prepared apparatus.",
            "actionId": "filter-hard-water-mixture",
            "config": {},
            "validation": [
              {
                "id": "filter-hard-water-mixture-node--filter-hard-water-mixture-node-done",
                "type": "actionEvidence",
                "label": "Action filter-hard-water-mixture was completed.",
                "actionId": "filter-hard-water-mixture"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Filter suspension complete.",
              "retry": "Review Filter suspension and try again."
            }
          },
          {
            "id": "rinse-precipitate-node",
            "type": "action",
            "title": "Wash precipitate",
            "description": "Wash the collected precipitate with a small water portion.",
            "actionId": "rinse-precipitate",
            "config": {},
            "validation": [
              {
                "id": "rinse-precipitate-node--rinse-precipitate-node-done",
                "type": "actionEvidence",
                "label": "Action rinse-precipitate was completed.",
                "actionId": "rinse-precipitate"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Wash precipitate complete.",
              "retry": "Review Wash precipitate and try again."
            }
          },
          {
            "id": "weigh-hard-water-watch-glass-tare-node",
            "type": "action",
            "title": "Read watch-glass tare",
            "description": "Read the clean, dry watch-glass mass.",
            "actionId": "weigh-hard-water-watch-glass-tare",
            "config": {},
            "validation": [
              {
                "id": "weigh-hard-water-watch-glass-tare-node--weigh-hard-water-watch-glass-tare-node-done",
                "type": "actionEvidence",
                "label": "Action weigh-hard-water-watch-glass-tare was completed.",
                "actionId": "weigh-hard-water-watch-glass-tare"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read watch-glass tare complete.",
              "retry": "Review Read watch-glass tare and try again."
            }
          },
          {
            "id": "record-hard-water-watch-glass-tare-node",
            "type": "observation",
            "title": "Record watch-glass tare",
            "description": "Copy the watch-glass mass into the notebook.",
            "actionId": "record-hard-water-watch-glass-tare",
            "config": {},
            "validation": [
              {
                "id": "record-hard-water-watch-glass-tare-node--record-hard-water-watch-glass-tare-node-done",
                "type": "actionEvidence",
                "label": "Action record-hard-water-watch-glass-tare was completed.",
                "actionId": "record-hard-water-watch-glass-tare"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record watch-glass tare complete.",
              "retry": "Review Record watch-glass tare and try again."
            }
          },
          {
            "id": "transfer-hard-water-paper-to-watch-node",
            "type": "action",
            "title": "Transfer collected solid",
            "description": "Move the filter paper and precipitate to the tared watch glass.",
            "actionId": "transfer-hard-water-paper-to-watch",
            "config": {},
            "validation": [
              {
                "id": "transfer-hard-water-paper-to-watch-node--transfer-hard-water-paper-to-watch-node-done",
                "type": "actionEvidence",
                "label": "Action transfer-hard-water-paper-to-watch was completed.",
                "actionId": "transfer-hard-water-paper-to-watch"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Transfer collected solid complete.",
              "retry": "Review Transfer collected solid and try again."
            }
          },
          {
            "id": "first-hard-water-drying-node",
            "type": "action",
            "title": "First drying stage",
            "description": "Dry the assembly for the teacher-configured 10-15 minute stage.",
            "actionId": "first-hard-water-drying",
            "config": {},
            "validation": [
              {
                "id": "first-hard-water-drying-node--first-hard-water-drying-node-done",
                "type": "actionEvidence",
                "label": "Action first-hard-water-drying was completed.",
                "actionId": "first-hard-water-drying"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "First drying stage complete.",
              "retry": "Review First drying stage and try again."
            }
          },
          {
            "id": "break-hard-water-precipitate-node",
            "type": "checkpoint",
            "title": "Break precipitate",
            "description": "Break the partly dried precipitate into small pieces.",
            "actionId": "break-hard-water-precipitate",
            "config": {},
            "validation": [
              {
                "id": "break-hard-water-precipitate-node--break-hard-water-precipitate-node-done",
                "type": "actionEvidence",
                "label": "Action break-hard-water-precipitate was completed.",
                "actionId": "break-hard-water-precipitate"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Break precipitate complete.",
              "retry": "Review Break precipitate and try again."
            }
          },
          {
            "id": "second-hard-water-drying-node",
            "type": "action",
            "title": "Second drying stage",
            "description": "Return the assembly to the oven for five minutes.",
            "actionId": "second-hard-water-drying",
            "config": {},
            "validation": [
              {
                "id": "second-hard-water-drying-node--second-hard-water-drying-node-done",
                "type": "actionEvidence",
                "label": "Action second-hard-water-drying was completed.",
                "actionId": "second-hard-water-drying"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Second drying stage complete.",
              "retry": "Review Second drying stage and try again."
            }
          },
          {
            "id": "cool-hard-water-assembly-node",
            "type": "action",
            "title": "Cool assembly",
            "description": "Set the dried assembly aside until safe to weigh.",
            "actionId": "cool-hard-water-assembly",
            "config": {},
            "validation": [
              {
                "id": "cool-hard-water-assembly-node--cool-hard-water-assembly-node-done",
                "type": "actionEvidence",
                "label": "Action cool-hard-water-assembly was completed.",
                "actionId": "cool-hard-water-assembly"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Cool assembly complete.",
              "retry": "Review Cool assembly and try again."
            }
          },
          {
            "id": "weigh-hard-water-combined-node",
            "type": "action",
            "title": "Read combined mass",
            "description": "Read the cooled watch-glass, paper, and precipitate mass.",
            "actionId": "weigh-hard-water-combined",
            "config": {},
            "validation": [
              {
                "id": "weigh-hard-water-combined-node--weigh-hard-water-combined-node-done",
                "type": "actionEvidence",
                "label": "Action weigh-hard-water-combined was completed.",
                "actionId": "weigh-hard-water-combined"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read combined mass complete.",
              "retry": "Review Read combined mass and try again."
            }
          },
          {
            "id": "record-hard-water-combined-node",
            "type": "observation",
            "title": "Record combined mass",
            "description": "Copy the cooled combined mass into the notebook.",
            "actionId": "record-hard-water-combined",
            "config": {},
            "validation": [
              {
                "id": "record-hard-water-combined-node--record-hard-water-combined-node-done",
                "type": "actionEvidence",
                "label": "Action record-hard-water-combined was completed.",
                "actionId": "record-hard-water-combined"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record combined mass complete.",
              "retry": "Review Record combined mass and try again."
            }
          },
          {
            "id": "calculate-hard-water-precipitate-mass-node",
            "type": "calculation",
            "title": "Calculate precipitate mass",
            "description": "Calculate collected precipitate mass by difference.",
            "actionId": "calculate-hard-water-precipitate-mass",
            "config": {},
            "validation": [
              {
                "id": "calculate-hard-water-precipitate-mass-node--calculate-hard-water-precipitate-mass-node-done",
                "type": "actionEvidence",
                "label": "Action calculate-hard-water-precipitate-mass was completed.",
                "actionId": "calculate-hard-water-precipitate-mass"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Calculate precipitate mass complete.",
              "retry": "Review Calculate precipitate mass and try again."
            }
          },
          {
            "id": "calculate-hardness-node",
            "type": "calculation",
            "title": "Calculate hardness",
            "description": "Calculate hardness in mg/L as CaCO3 from sample volume and precipitate mass.",
            "actionId": "calculate-hardness",
            "config": {},
            "validation": [
              {
                "id": "calculate-hardness-node--calculate-hardness-node-done",
                "type": "actionEvidence",
                "label": "Action calculate-hardness was completed.",
                "actionId": "calculate-hardness"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Calculate hardness complete.",
              "retry": "Review Calculate hardness and try again."
            }
          }
        ],
        "edges": [
          {
            "from": "measure-water-sample-node",
            "to": "transfer-water-sample-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "transfer-water-sample-node",
            "to": "add-carbonate-reagent-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "add-carbonate-reagent-node",
            "to": "establish-hard-water-precipitate-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "establish-hard-water-precipitate-node",
            "to": "observe-precipitate-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "observe-precipitate-node",
            "to": "weigh-hard-water-filter-paper-tare-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "weigh-hard-water-filter-paper-tare-node",
            "to": "record-hard-water-filter-paper-tare-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-hard-water-filter-paper-tare-node",
            "to": "place-hard-water-buchner-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "place-hard-water-buchner-node",
            "to": "seat-hard-water-filter-paper-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "seat-hard-water-filter-paper-node",
            "to": "attach-hard-water-filter-flask-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "attach-hard-water-filter-flask-node",
            "to": "place-hard-water-vacuum-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "place-hard-water-vacuum-node",
            "to": "wet-hard-water-filter-paper-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "wet-hard-water-filter-paper-node",
            "to": "filter-hard-water-mixture-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "filter-hard-water-mixture-node",
            "to": "rinse-precipitate-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "rinse-precipitate-node",
            "to": "weigh-hard-water-watch-glass-tare-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "weigh-hard-water-watch-glass-tare-node",
            "to": "record-hard-water-watch-glass-tare-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-hard-water-watch-glass-tare-node",
            "to": "transfer-hard-water-paper-to-watch-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "transfer-hard-water-paper-to-watch-node",
            "to": "first-hard-water-drying-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "first-hard-water-drying-node",
            "to": "break-hard-water-precipitate-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "break-hard-water-precipitate-node",
            "to": "second-hard-water-drying-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "second-hard-water-drying-node",
            "to": "cool-hard-water-assembly-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "cool-hard-water-assembly-node",
            "to": "weigh-hard-water-combined-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "weigh-hard-water-combined-node",
            "to": "record-hard-water-combined-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-hard-water-combined-node",
            "to": "calculate-hard-water-precipitate-mass-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "calculate-hard-water-precipitate-mass-node",
            "to": "calculate-hardness-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          }
        ]
      },
      "successCriteria": [
        {
          "id": "measure-water-sample-node-success",
          "type": "actionEvidence",
          "label": "Action measure-water-sample was completed.",
          "actionId": "measure-water-sample"
        },
        {
          "id": "transfer-water-sample-node-success",
          "type": "actionEvidence",
          "label": "Action transfer-water-sample was completed.",
          "actionId": "transfer-water-sample"
        },
        {
          "id": "add-carbonate-reagent-node-success",
          "type": "actionEvidence",
          "label": "Action add-carbonate-reagent was completed.",
          "actionId": "add-carbonate-reagent"
        },
        {
          "id": "establish-hard-water-precipitate-node-success",
          "type": "actionEvidence",
          "label": "Action establish-hard-water-precipitate was completed.",
          "actionId": "establish-hard-water-precipitate"
        },
        {
          "id": "observe-precipitate-node-success",
          "type": "actionEvidence",
          "label": "Action observe-precipitate was completed.",
          "actionId": "observe-precipitate"
        },
        {
          "id": "weigh-hard-water-filter-paper-tare-node-success",
          "type": "actionEvidence",
          "label": "Action weigh-hard-water-filter-paper-tare was completed.",
          "actionId": "weigh-hard-water-filter-paper-tare"
        },
        {
          "id": "record-hard-water-filter-paper-tare-node-success",
          "type": "actionEvidence",
          "label": "Action record-hard-water-filter-paper-tare was completed.",
          "actionId": "record-hard-water-filter-paper-tare"
        },
        {
          "id": "place-hard-water-buchner-node-success",
          "type": "actionEvidence",
          "label": "Action place-hard-water-buchner was completed.",
          "actionId": "place-hard-water-buchner"
        },
        {
          "id": "seat-hard-water-filter-paper-node-success",
          "type": "actionEvidence",
          "label": "Action seat-hard-water-filter-paper was completed.",
          "actionId": "seat-hard-water-filter-paper"
        },
        {
          "id": "attach-hard-water-filter-flask-node-success",
          "type": "actionEvidence",
          "label": "Action attach-hard-water-filter-flask was completed.",
          "actionId": "attach-hard-water-filter-flask"
        },
        {
          "id": "place-hard-water-vacuum-node-success",
          "type": "actionEvidence",
          "label": "Action place-hard-water-vacuum was completed.",
          "actionId": "place-hard-water-vacuum"
        },
        {
          "id": "wet-hard-water-filter-paper-node-success",
          "type": "actionEvidence",
          "label": "Action wet-hard-water-filter-paper was completed.",
          "actionId": "wet-hard-water-filter-paper"
        },
        {
          "id": "filter-hard-water-mixture-node-success",
          "type": "actionEvidence",
          "label": "Action filter-hard-water-mixture was completed.",
          "actionId": "filter-hard-water-mixture"
        },
        {
          "id": "rinse-precipitate-node-success",
          "type": "actionEvidence",
          "label": "Action rinse-precipitate was completed.",
          "actionId": "rinse-precipitate"
        },
        {
          "id": "weigh-hard-water-watch-glass-tare-node-success",
          "type": "actionEvidence",
          "label": "Action weigh-hard-water-watch-glass-tare was completed.",
          "actionId": "weigh-hard-water-watch-glass-tare"
        },
        {
          "id": "record-hard-water-watch-glass-tare-node-success",
          "type": "actionEvidence",
          "label": "Action record-hard-water-watch-glass-tare was completed.",
          "actionId": "record-hard-water-watch-glass-tare"
        },
        {
          "id": "transfer-hard-water-paper-to-watch-node-success",
          "type": "actionEvidence",
          "label": "Action transfer-hard-water-paper-to-watch was completed.",
          "actionId": "transfer-hard-water-paper-to-watch"
        },
        {
          "id": "first-hard-water-drying-node-success",
          "type": "actionEvidence",
          "label": "Action first-hard-water-drying was completed.",
          "actionId": "first-hard-water-drying"
        },
        {
          "id": "break-hard-water-precipitate-node-success",
          "type": "actionEvidence",
          "label": "Action break-hard-water-precipitate was completed.",
          "actionId": "break-hard-water-precipitate"
        },
        {
          "id": "second-hard-water-drying-node-success",
          "type": "actionEvidence",
          "label": "Action second-hard-water-drying was completed.",
          "actionId": "second-hard-water-drying"
        },
        {
          "id": "cool-hard-water-assembly-node-success",
          "type": "actionEvidence",
          "label": "Action cool-hard-water-assembly was completed.",
          "actionId": "cool-hard-water-assembly"
        },
        {
          "id": "weigh-hard-water-combined-node-success",
          "type": "actionEvidence",
          "label": "Action weigh-hard-water-combined was completed.",
          "actionId": "weigh-hard-water-combined"
        },
        {
          "id": "record-hard-water-combined-node-success",
          "type": "actionEvidence",
          "label": "Action record-hard-water-combined was completed.",
          "actionId": "record-hard-water-combined"
        },
        {
          "id": "calculate-hard-water-precipitate-mass-node-success",
          "type": "actionEvidence",
          "label": "Action calculate-hard-water-precipitate-mass was completed.",
          "actionId": "calculate-hard-water-precipitate-mass"
        },
        {
          "id": "calculate-hardness-node-success",
          "type": "actionEvidence",
          "label": "Action calculate-hardness was completed.",
          "actionId": "calculate-hardness"
        }
      ],
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
        "version": "1.1.0",
        "author": "Lab Studio",
        "updatedAt": "2026-09-04T00:00:00.000Z",
        "tags": [
          "technique",
          "chemistry",
          "gravimetry",
          "hard-water"
        ]
      },
      "composition": {
        "schemaVersion": 1,
        "ports": [
          {
            "id": "entry-measure-water-sample-node",
            "kind": "entry",
            "nodeId": "measure-water-sample-node",
            "label": "Entry"
          },
          {
            "id": "exit-calculate-hardness-node",
            "kind": "exit",
            "nodeId": "calculate-hardness-node",
            "label": "Exit"
          }
        ],
        "equipmentRoles": [
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
              "sample-bottle"
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
              "beaker-250ml"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "precipitating-reagent-source",
            "required": true,
            "allowedDefinitionIds": [
              "reagent-bottle"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "precipitation-vessel",
            "required": true,
            "allowedDefinitionIds": [
              "beaker-250ml"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "stirring-device",
            "required": true,
            "allowedDefinitionIds": [
              "stirring-rod"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "balance-instrument",
            "required": true,
            "allowedDefinitionIds": [
              "analytical-balance"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "filter-medium",
            "required": true,
            "allowedDefinitionIds": [
              "filter-paper"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "filtration-funnel",
            "required": true,
            "allowedDefinitionIds": [
              "buchner-funnel"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "filtration-receiver",
            "required": true,
            "allowedDefinitionIds": [
              "side-arm-filter-flask"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "filtration-vacuum-source",
            "required": true,
            "allowedDefinitionIds": [
              "vacuum-source"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "rinse-water-source",
            "required": true,
            "allowedDefinitionIds": [
              "wash-bottle"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "mixture-source",
            "required": true,
            "allowedDefinitionIds": [
              "beaker-250ml"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "weighed-vessel",
            "required": true,
            "allowedDefinitionIds": [
              "watch-glass"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "dried-assembly",
            "required": true,
            "allowedDefinitionIds": [
              "watch-glass"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "drying-instrument",
            "required": true,
            "allowedDefinitionIds": [
              "drying-oven"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "cooling-tool",
            "required": true,
            "allowedDefinitionIds": [
              "crucible-tongs"
            ],
            "sourceInstanceIds": []
          }
        ],
        "modelSlots": [],
        "configurationSlots": [
          {
            "id": "ovenTemperatureC",
            "valueType": "number",
            "required": true
          },
          {
            "id": "firstDurationMinutes",
            "valueType": "number",
            "required": true
          },
          {
            "id": "coolingTemperatureC",
            "valueType": "number",
            "required": true
          }
        ],
        "approvalGates": [],
        "variants": [],
        "evidenceOutputs": [],
        "completion": {
          "exitPortIds": [
            "exit-calculate-hardness-node"
          ],
          "requiredEvidenceOutputIds": [],
          "requiredValidationRuleIds": []
        },
        "catalogDisposition": "composable",
        "legacyActionEffects": [
          {
            "actionId": "observe-precipitate",
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
            "actionId": "record-hard-water-filter-paper-tare",
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
            "actionId": "record-hard-water-watch-glass-tare",
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
            "actionId": "break-hard-water-precipitate",
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
            "actionId": "record-hard-water-combined",
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
            "actionId": "calculate-hard-water-precipitate-mass",
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
            "actionId": "calculate-hardness",
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
    "bonding-solids-tests",
    {
      "id": "bonding-solids-tests",
      "title": "Bonding Solids Tests",
      "learningGoal": "Collect a configured, fresh-microsample property panel for one known or blind solid without revealing blind identity.",
      "requiredEquipment": [
        "small-vial",
        "test-tube",
        "distilled-water-bottle",
        "reagent-bottle",
        "naoh-bottle",
        "spatula",
        "conductivity-tester",
        "ph-paper",
        "magnet",
        "melting-point-apparatus",
        "waste-beaker"
      ],
      "initialState": {
        "equipment": [
          {
            "id": "sample-vial",
            "definitionId": "small-vial",
            "label": "Configured sample",
            "location": "shelf",
            "contents": {
              "kind": "solid",
              "label": "Configured unidentified solid",
              "massG": 1,
              "solutes": [
                {
                  "id": "configured-solid",
                  "label": "Configured unidentified solid",
                  "amount": 1,
                  "unit": "g"
                }
              ],
              "contamination": [],
              "wetState": "dry",
              "visualState": "granular-solid"
            }
          },
          {
            "id": "water-test-line",
            "definitionId": "test-tube",
            "label": "Labeled test tube 1",
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
            "id": "ethanol-test-line",
            "definitionId": "test-tube",
            "label": "Labeled test tube 2",
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
            "id": "hexanes-test-line",
            "definitionId": "test-tube",
            "label": "Labeled test tube 3",
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
            "id": "dry-test-line",
            "definitionId": "test-tube",
            "label": "Labeled test tube 4",
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
            "id": "hcl-test-line",
            "definitionId": "test-tube",
            "label": "Labeled test tube 5",
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
            "id": "naoh-test-line",
            "definitionId": "test-tube",
            "label": "Labeled test tube 6",
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
            "id": "water-source",
            "definitionId": "distilled-water-bottle",
            "label": "Distilled water",
            "location": "shelf",
            "contents": {
              "kind": "liquid",
              "label": "Distilled water",
              "volumeMl": 500,
              "solutes": [],
              "contamination": [],
              "wetState": "wet",
              "visualState": "clear-liquid"
            }
          },
          {
            "id": "ethanol-source",
            "definitionId": "reagent-bottle",
            "label": "Ethanol test solvent",
            "location": "shelf",
            "contents": {
              "kind": "liquid",
              "label": "Ethanol",
              "volumeMl": 250,
              "solutes": [],
              "contamination": [],
              "wetState": "wet",
              "visualState": "clear-liquid"
            }
          },
          {
            "id": "hexanes-source",
            "definitionId": "reagent-bottle",
            "label": "Hexanes test solvent - hood only",
            "location": "shelf",
            "contents": {
              "kind": "liquid",
              "label": "Hexanes",
              "volumeMl": 250,
              "solutes": [],
              "contamination": [],
              "wetState": "wet",
              "visualState": "clear-liquid"
            }
          },
          {
            "id": "hcl-source",
            "definitionId": "reagent-bottle",
            "label": "0.1 M hydrochloric acid",
            "location": "shelf",
            "contents": {
              "kind": "solution",
              "label": "0.1 M hydrochloric acid",
              "volumeMl": 250,
              "solutes": [
                {
                  "id": "0-1-m-hydrochloric-acid",
                  "label": "0.1 M hydrochloric acid",
                  "amount": 0.1,
                  "unit": "mol"
                }
              ],
              "concentration": {
                "value": 0.1,
                "unit": "M"
              },
              "contamination": [],
              "wetState": "wet",
              "visualState": "clear-liquid"
            }
          },
          {
            "id": "naoh-source",
            "definitionId": "naoh-bottle",
            "label": "0.1 M sodium hydroxide",
            "location": "shelf",
            "contents": {
              "kind": "solution",
              "label": "0.1 M sodium hydroxide",
              "volumeMl": 250,
              "solutes": [
                {
                  "id": "0-1-m-sodium-hydroxide",
                  "label": "0.1 M sodium hydroxide",
                  "amount": 0.1,
                  "unit": "mol"
                }
              ],
              "concentration": {
                "value": 0.1,
                "unit": "M"
              },
              "contamination": [],
              "wetState": "wet",
              "visualState": "clear-liquid"
            }
          },
          {
            "id": "transfer-tool",
            "definitionId": "spatula",
            "label": "Clean spatula",
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
            "id": "conductivity-instrument",
            "definitionId": "conductivity-tester",
            "label": "Conductivity tester",
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
            "id": "ph-medium",
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
          },
          {
            "id": "magnetic-tool",
            "definitionId": "magnet",
            "label": "Magnet",
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
            "id": "melting-instrument",
            "definitionId": "melting-point-apparatus",
            "label": "Melting-point apparatus",
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
            "id": "water-waste",
            "definitionId": "waste-beaker",
            "label": "Teacher-labeled aqueous waste",
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
            "id": "ethanol-waste",
            "definitionId": "waste-beaker",
            "label": "Teacher-labeled organic waste",
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
            "id": "hexanes-waste",
            "definitionId": "waste-beaker",
            "label": "Teacher-labeled organic waste",
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
            "id": "hcl-waste",
            "definitionId": "waste-beaker",
            "label": "Teacher-labeled aqueous waste",
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
            "id": "naoh-waste",
            "definitionId": "waste-beaker",
            "label": "Teacher-labeled aqueous waste",
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
            "id": "dry-waste",
            "definitionId": "waste-beaker",
            "label": "Teacher-labeled aqueous waste",
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
          "id": "label-test-locations",
          "verb": "observe",
          "label": "label test locations",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sampleIdentity": "{{config.sampleIdentity}}",
            "sampleMode": "{{config.sampleMode}}",
            "selectedTestPanel": "{{config.selectedTestPanel}}"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "evidenceScopeSlotId",
            "accessibleLabel": "Complete label test locations for the configured sample."
          },
          "prerequisites": [],
          "stateChanges": [
            "label test locations is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "label test locations complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "label-test-locations"
          ]
        },
        {
          "id": "inspect-solid-appearance",
          "verb": "observe",
          "label": "inspect solid appearance",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "inputMode": "choice",
            "inputRole": "studentResponse",
            "inputKey": "inspect-solid-appearance-choice",
            "inputLabel": "inspect solid appearance",
            "inputRequired": true
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "inputKey",
            "accessibleLabel": "Record the direct inspect solid appearance observation."
          },
          "prerequisites": [
            {
              "id": "inspect-solid-appearance--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "label-test-locations"
            }
          ],
          "stateChanges": [
            "inspect solid appearance is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "inspect solid appearance complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "inspect-solid-appearance"
          ],
          "choiceObservation": {
            "outputCalculationId": "inspect-solid-appearance-choice",
            "options": [
              {
                "label": "Observed",
                "tag": "observed",
                "value": 1
              },
              {
                "label": "Not observed",
                "tag": "not-observed",
                "value": 0
              },
              {
                "label": "Ambiguous",
                "tag": "ambiguous",
                "value": 0.5
              }
            ]
          }
        },
        {
          "id": "record-solid-appearance",
          "verb": "record",
          "label": "record solid appearance",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "evidenceScopeSlotId",
            "accessibleLabel": "Complete record solid appearance for the configured sample."
          },
          "prerequisites": [
            {
              "id": "record-solid-appearance--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "inspect-solid-appearance"
            }
          ],
          "stateChanges": [
            "record solid appearance is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "record solid appearance complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "record-solid-appearance"
          ]
        },
        {
          "id": "dispense-water-microsample",
          "verb": "transfer",
          "label": "dispense water microsample",
          "atomId": "atom.transfer.microsample-portion",
          "equipmentRoleBindings": {
            "sample-source": "small-vial",
            "bonding-test-vessel": "test-tube",
            "solid-transfer-tool": "spatula"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "small-vial",
            "sourceInstanceId": "sample-vial",
            "targetDefinitionId": "test-tube",
            "targetInstanceId": "water-test-line",
            "microsampleAmount": "{{config.microsampleAmount}}",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputKey": "dispense-water-microsample-mass-g",
            "inputLabel": "Instructor-approved microsample transfer mass (g)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "g",
            "evidenceProvenance": "C: configured transfer quantity; not an acquired balance measurement"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "small-vial",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Transfer the configured fresh microsample to the water test line.",
            "valueParameter": "inputKey"
          },
          "prerequisites": [
            {
              "id": "dispense-water-microsample--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "record-solid-appearance"
            }
          ],
          "stateChanges": [
            "dispense water microsample is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "dispense water microsample complete.",
            "invalid": "Enter a positive approved transfer mass within the source inventory."
          },
          "evidence": [
            "sample-scoped",
            "dispense-water-microsample"
          ],
          "mass": {
            "source": "configured-input"
          }
        },
        {
          "id": "apply-water-solvent",
          "verb": "transfer",
          "label": "apply water solvent",
          "atomId": "atom.transfer.apply-test-solvent",
          "equipmentRoleBindings": {
            "bonding-test-solvent-source": "distilled-water-bottle",
            "bonding-test-vessel": "test-tube"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "distilled-water-bottle",
            "sourceInstanceId": "water-source",
            "targetDefinitionId": "test-tube",
            "targetInstanceId": "water-test-line",
            "reagentAmount": "{{config.waterAmount}}",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputKey": "apply-water-solvent-volume",
            "inputLabel": "Approved reagent volume (mL)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "mL"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "distilled-water-bottle",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Apply the configured water reagent under the approved controls.",
            "valueParameter": "inputKey"
          },
          "prerequisites": [
            {
              "id": "apply-water-solvent--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "dispense-water-microsample"
            }
          ],
          "stateChanges": [
            "apply water solvent is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "apply water solvent complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "apply-water-solvent"
          ],
          "volume": {
            "source": "action-input"
          }
        },
        {
          "id": "inspect-water-solubility",
          "verb": "observe",
          "label": "inspect water solubility",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "inputMode": "choice",
            "inputRole": "studentResponse",
            "inputKey": "inspect-water-solubility-choice",
            "inputLabel": "inspect water solubility",
            "inputRequired": true
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "inputKey",
            "accessibleLabel": "Record the direct inspect water solubility observation."
          },
          "prerequisites": [
            {
              "id": "inspect-water-solubility--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "apply-water-solvent"
            }
          ],
          "stateChanges": [
            "inspect water solubility is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "inspect water solubility complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "inspect-water-solubility"
          ],
          "choiceObservation": {
            "outputCalculationId": "inspect-water-solubility-choice",
            "options": [
              {
                "label": "Observed",
                "tag": "observed",
                "value": 1
              },
              {
                "label": "Not observed",
                "tag": "not-observed",
                "value": 0
              },
              {
                "label": "Ambiguous",
                "tag": "ambiguous",
                "value": 0.5
              }
            ]
          }
        },
        {
          "id": "record-water-solubility",
          "verb": "record",
          "label": "record water solubility",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "evidenceScopeSlotId",
            "accessibleLabel": "Complete record water solubility for the configured sample."
          },
          "prerequisites": [
            {
              "id": "record-water-solubility--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "inspect-water-solubility"
            }
          ],
          "stateChanges": [
            "record water solubility is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "record water solubility complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "record-water-solubility"
          ]
        },
        {
          "id": "read-aqueous-conductivity",
          "verb": "observe",
          "label": "read aqueous conductivity",
          "atomId": "atom.observe.read-aqueous-conductivity",
          "equipmentRoleBindings": {
            "immersed-probe-instrument": "conductivity-tester",
            "bonding-test-vessel": "test-tube"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceInstanceId": "water-test-line",
            "instrumentInstanceId": "conductivity-instrument",
            "conductivityThresholds": "{{config.conductivityThresholds}}",
            "measurementId": "aqueous-conductivity",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputKey": "read-aqueous-conductivity-reading",
            "inputLabel": "Externally acquired classroom instrument reading",
            "inputRequired": true,
            "instrumentEvidence": "read-aqueous-conductivity",
            "unit": "uS/cm"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "test-tube",
            "stationId": "conductivity-tester",
            "valueParameter": "inputKey",
            "accessibleLabel": "Read aqueous conductivity for this sample."
          },
          "prerequisites": [
            {
              "id": "read-aqueous-conductivity--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "record-water-solubility"
            },
            {
              "id": "read-aqueous-conductivity--test-solution-required",
              "type": "actionEvidence",
              "label": "The water test solution has been applied.",
              "actionId": "apply-water-solvent"
            }
          ],
          "stateChanges": [
            "read aqueous conductivity is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "read aqueous conductivity complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "read-aqueous-conductivity"
          ]
        },
        {
          "id": "record-aqueous-conductivity",
          "verb": "record",
          "label": "record aqueous conductivity",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "measurementId": "aqueous-conductivity",
            "copyExistingMeasurementOnly": true
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "evidenceScopeSlotId",
            "accessibleLabel": "Complete record aqueous conductivity for the configured sample."
          },
          "prerequisites": [
            {
              "id": "record-aqueous-conductivity--measurement-required",
              "type": "measurementRecorded",
              "label": "Instrument evidence was acquired.",
              "measurementId": "aqueous-conductivity"
            }
          ],
          "stateChanges": [
            "record aqueous conductivity is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "record aqueous conductivity complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "record-aqueous-conductivity"
          ]
        },
        {
          "id": "read-ph-indicator",
          "verb": "observe",
          "label": "read ph indicator",
          "atomId": "atom.observe.read-ph-indicator",
          "equipmentRoleBindings": {
            "ph-indicator-medium": "ph-paper",
            "bonding-test-vessel": "test-tube"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceInstanceId": "water-test-line",
            "instrumentInstanceId": "ph-medium",
            "phThresholds": "{{config.phThresholds}}",
            "measurementId": "ph-indicator",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputKey": "read-ph-indicator-reading",
            "inputLabel": "Externally acquired classroom instrument reading",
            "inputRequired": true,
            "instrumentEvidence": "read-ph-indicator",
            "unit": "pH"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "test-tube",
            "stationId": "ph-paper",
            "valueParameter": "inputKey",
            "accessibleLabel": "Read pH evidence for this sample."
          },
          "prerequisites": [
            {
              "id": "read-ph-indicator--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "record-aqueous-conductivity"
            },
            {
              "id": "read-ph-indicator--test-solution-required",
              "type": "actionEvidence",
              "label": "The water test solution has been applied.",
              "actionId": "apply-water-solvent"
            }
          ],
          "stateChanges": [
            "read ph indicator is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "read ph indicator complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "read-ph-indicator"
          ]
        },
        {
          "id": "record-ph",
          "verb": "record",
          "label": "record ph",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "measurementId": "ph-indicator",
            "copyExistingMeasurementOnly": true
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "evidenceScopeSlotId",
            "accessibleLabel": "Complete record ph for the configured sample."
          },
          "prerequisites": [
            {
              "id": "record-ph--measurement-required",
              "type": "measurementRecorded",
              "label": "Instrument evidence was acquired.",
              "measurementId": "ph-indicator"
            }
          ],
          "stateChanges": [
            "record ph is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "record ph complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "record-ph"
          ]
        },
        {
          "id": "dispose-water-test-line",
          "verb": "transfer",
          "label": "dispose water test line",
          "atomId": "atom.transfer.dispose-to-waste-stream",
          "equipmentRoleBindings": {
            "bonding-test-vessel": "test-tube",
            "waste-receiver": "waste-beaker"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "test-tube",
            "sourceInstanceId": "water-test-line",
            "targetDefinitionId": "waste-beaker",
            "targetInstanceId": "water-waste",
            "wasteDestination": "{{config.waterWasteDestination}}"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "waste-beaker",
            "accessibleLabel": "Dispose the water test line to its configured waste destination."
          },
          "prerequisites": [
            {
              "id": "dispose-water-test-line--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "record-ph"
            }
          ],
          "stateChanges": [
            "dispose water test line is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "dispose water test line complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "dispose-water-test-line"
          ]
        },
        {
          "id": "dispense-ethanol-microsample",
          "verb": "transfer",
          "label": "dispense ethanol microsample",
          "atomId": "atom.transfer.microsample-portion",
          "equipmentRoleBindings": {
            "sample-source": "small-vial",
            "bonding-test-vessel": "test-tube",
            "solid-transfer-tool": "spatula"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "small-vial",
            "sourceInstanceId": "sample-vial",
            "targetDefinitionId": "test-tube",
            "targetInstanceId": "ethanol-test-line",
            "microsampleAmount": "{{config.microsampleAmount}}",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputKey": "dispense-ethanol-microsample-mass-g",
            "inputLabel": "Instructor-approved microsample transfer mass (g)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "g",
            "evidenceProvenance": "C: configured transfer quantity; not an acquired balance measurement"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "small-vial",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Transfer the configured fresh microsample to the ethanol test line.",
            "valueParameter": "inputKey"
          },
          "prerequisites": [
            {
              "id": "dispense-ethanol-microsample--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "dispose-water-test-line"
            }
          ],
          "stateChanges": [
            "dispense ethanol microsample is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "dispense ethanol microsample complete.",
            "invalid": "Enter a positive approved transfer mass within the source inventory."
          },
          "evidence": [
            "sample-scoped",
            "dispense-ethanol-microsample"
          ],
          "mass": {
            "source": "configured-input"
          }
        },
        {
          "id": "apply-ethanol-solvent",
          "verb": "transfer",
          "label": "apply ethanol solvent",
          "atomId": "atom.transfer.apply-test-solvent",
          "equipmentRoleBindings": {
            "bonding-test-solvent-source": "reagent-bottle",
            "bonding-test-vessel": "test-tube"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "reagent-bottle",
            "sourceInstanceId": "ethanol-source",
            "targetDefinitionId": "test-tube",
            "targetInstanceId": "ethanol-test-line",
            "reagentAmount": "{{config.ethanolAmount}}",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputKey": "apply-ethanol-solvent-volume",
            "inputLabel": "Approved reagent volume (mL)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "mL"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "reagent-bottle",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Apply the configured ethanol reagent under the approved controls.",
            "valueParameter": "inputKey"
          },
          "prerequisites": [
            {
              "id": "apply-ethanol-solvent--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "dispense-ethanol-microsample"
            }
          ],
          "stateChanges": [
            "apply ethanol solvent is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "apply ethanol solvent complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "apply-ethanol-solvent"
          ],
          "volume": {
            "source": "action-input"
          }
        },
        {
          "id": "inspect-ethanol-solubility",
          "verb": "observe",
          "label": "inspect ethanol solubility",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "inputMode": "choice",
            "inputRole": "studentResponse",
            "inputKey": "inspect-ethanol-solubility-choice",
            "inputLabel": "inspect ethanol solubility",
            "inputRequired": true
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "inputKey",
            "accessibleLabel": "Record the direct inspect ethanol solubility observation."
          },
          "prerequisites": [
            {
              "id": "inspect-ethanol-solubility--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "apply-ethanol-solvent"
            }
          ],
          "stateChanges": [
            "inspect ethanol solubility is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "inspect ethanol solubility complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "inspect-ethanol-solubility"
          ],
          "choiceObservation": {
            "outputCalculationId": "inspect-ethanol-solubility-choice",
            "options": [
              {
                "label": "Observed",
                "tag": "observed",
                "value": 1
              },
              {
                "label": "Not observed",
                "tag": "not-observed",
                "value": 0
              },
              {
                "label": "Ambiguous",
                "tag": "ambiguous",
                "value": 0.5
              }
            ]
          }
        },
        {
          "id": "record-ethanol-solubility",
          "verb": "record",
          "label": "record ethanol solubility",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "evidenceScopeSlotId",
            "accessibleLabel": "Complete record ethanol solubility for the configured sample."
          },
          "prerequisites": [
            {
              "id": "record-ethanol-solubility--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "inspect-ethanol-solubility"
            }
          ],
          "stateChanges": [
            "record ethanol solubility is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "record ethanol solubility complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "record-ethanol-solubility"
          ]
        },
        {
          "id": "dispose-ethanol-test-line",
          "verb": "transfer",
          "label": "dispose ethanol test line",
          "atomId": "atom.transfer.dispose-to-waste-stream",
          "equipmentRoleBindings": {
            "bonding-test-vessel": "test-tube",
            "waste-receiver": "waste-beaker"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "test-tube",
            "sourceInstanceId": "ethanol-test-line",
            "targetDefinitionId": "waste-beaker",
            "targetInstanceId": "ethanol-waste",
            "wasteDestination": "{{config.ethanolWasteDestination}}"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "waste-beaker",
            "accessibleLabel": "Dispose the ethanol test line to its configured waste destination."
          },
          "prerequisites": [
            {
              "id": "dispose-ethanol-test-line--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "record-ethanol-solubility"
            }
          ],
          "stateChanges": [
            "dispose ethanol test line is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "dispose ethanol test line complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "dispose-ethanol-test-line"
          ]
        },
        {
          "id": "dispense-hexanes-microsample",
          "verb": "transfer",
          "label": "dispense hexanes microsample",
          "atomId": "atom.transfer.microsample-portion",
          "equipmentRoleBindings": {
            "sample-source": "small-vial",
            "bonding-test-vessel": "test-tube",
            "solid-transfer-tool": "spatula"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "small-vial",
            "sourceInstanceId": "sample-vial",
            "targetDefinitionId": "test-tube",
            "targetInstanceId": "hexanes-test-line",
            "microsampleAmount": "{{config.microsampleAmount}}",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputKey": "dispense-hexanes-microsample-mass-g",
            "inputLabel": "Instructor-approved microsample transfer mass (g)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "g",
            "evidenceProvenance": "C: configured transfer quantity; not an acquired balance measurement"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "small-vial",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Transfer the configured fresh microsample to the hexanes test line.",
            "valueParameter": "inputKey"
          },
          "prerequisites": [
            {
              "id": "dispense-hexanes-microsample--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "dispose-ethanol-test-line"
            }
          ],
          "stateChanges": [
            "dispense hexanes microsample is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "dispense hexanes microsample complete.",
            "invalid": "Enter a positive approved transfer mass within the source inventory."
          },
          "evidence": [
            "sample-scoped",
            "dispense-hexanes-microsample"
          ],
          "mass": {
            "source": "configured-input"
          }
        },
        {
          "id": "apply-hexanes-solvent",
          "verb": "transfer",
          "label": "apply hexanes solvent",
          "atomId": "atom.transfer.apply-test-solvent",
          "equipmentRoleBindings": {
            "bonding-test-solvent-source": "reagent-bottle",
            "bonding-test-vessel": "test-tube"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "reagent-bottle",
            "sourceInstanceId": "hexanes-source",
            "targetDefinitionId": "test-tube",
            "targetInstanceId": "hexanes-test-line",
            "reagentAmount": "{{config.hexanesAmount}}",
            "hoodControl": "{{config.hoodControl}}",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputKey": "apply-hexanes-solvent-volume",
            "inputLabel": "Approved reagent volume (mL)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "mL"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "reagent-bottle",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Apply the configured hexanes reagent under the approved controls.",
            "valueParameter": "inputKey"
          },
          "prerequisites": [
            {
              "id": "apply-hexanes-solvent--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "dispense-hexanes-microsample"
            }
          ],
          "stateChanges": [
            "apply hexanes solvent is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "apply hexanes solvent complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "apply-hexanes-solvent"
          ],
          "volume": {
            "source": "action-input"
          }
        },
        {
          "id": "inspect-hexanes-solubility",
          "verb": "observe",
          "label": "inspect hexanes solubility",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "inputMode": "choice",
            "inputRole": "studentResponse",
            "inputKey": "inspect-hexanes-solubility-choice",
            "inputLabel": "inspect hexanes solubility",
            "inputRequired": true
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "inputKey",
            "accessibleLabel": "Record the direct inspect hexanes solubility observation."
          },
          "prerequisites": [
            {
              "id": "inspect-hexanes-solubility--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "apply-hexanes-solvent"
            }
          ],
          "stateChanges": [
            "inspect hexanes solubility is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "inspect hexanes solubility complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "inspect-hexanes-solubility"
          ],
          "choiceObservation": {
            "outputCalculationId": "inspect-hexanes-solubility-choice",
            "options": [
              {
                "label": "Observed",
                "tag": "observed",
                "value": 1
              },
              {
                "label": "Not observed",
                "tag": "not-observed",
                "value": 0
              },
              {
                "label": "Ambiguous",
                "tag": "ambiguous",
                "value": 0.5
              }
            ]
          }
        },
        {
          "id": "record-hexanes-solubility",
          "verb": "record",
          "label": "record hexanes solubility",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "evidenceScopeSlotId",
            "accessibleLabel": "Complete record hexanes solubility for the configured sample."
          },
          "prerequisites": [
            {
              "id": "record-hexanes-solubility--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "inspect-hexanes-solubility"
            }
          ],
          "stateChanges": [
            "record hexanes solubility is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "record hexanes solubility complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "record-hexanes-solubility"
          ]
        },
        {
          "id": "dispose-hexanes-test-line",
          "verb": "transfer",
          "label": "dispose hexanes test line",
          "atomId": "atom.transfer.dispose-to-waste-stream",
          "equipmentRoleBindings": {
            "bonding-test-vessel": "test-tube",
            "waste-receiver": "waste-beaker"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "test-tube",
            "sourceInstanceId": "hexanes-test-line",
            "targetDefinitionId": "waste-beaker",
            "targetInstanceId": "hexanes-waste",
            "wasteDestination": "{{config.hexanesWasteDestination}}"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "waste-beaker",
            "accessibleLabel": "Dispose the hexanes test line to its configured waste destination."
          },
          "prerequisites": [
            {
              "id": "dispose-hexanes-test-line--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "record-hexanes-solubility"
            }
          ],
          "stateChanges": [
            "dispose hexanes test line is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "dispose hexanes test line complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "dispose-hexanes-test-line"
          ]
        },
        {
          "id": "dispense-dry-microsample",
          "verb": "transfer",
          "label": "dispense dry microsample",
          "atomId": "atom.transfer.microsample-portion",
          "equipmentRoleBindings": {
            "sample-source": "small-vial",
            "bonding-test-vessel": "test-tube",
            "solid-transfer-tool": "spatula"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "small-vial",
            "sourceInstanceId": "sample-vial",
            "targetDefinitionId": "test-tube",
            "targetInstanceId": "dry-test-line",
            "microsampleAmount": "{{config.microsampleAmount}}",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputKey": "dispense-dry-microsample-mass-g",
            "inputLabel": "Instructor-approved microsample transfer mass (g)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "g",
            "evidenceProvenance": "C: configured transfer quantity; not an acquired balance measurement"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "small-vial",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Transfer the configured fresh microsample to the dry test line.",
            "valueParameter": "inputKey"
          },
          "prerequisites": [
            {
              "id": "dispense-dry-microsample--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "dispose-hexanes-test-line"
            }
          ],
          "stateChanges": [
            "dispense dry microsample is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "dispense dry microsample complete.",
            "invalid": "Enter a positive approved transfer mass within the source inventory."
          },
          "evidence": [
            "sample-scoped",
            "dispense-dry-microsample"
          ],
          "mass": {
            "source": "configured-input"
          }
        },
        {
          "id": "test-magnetic-response",
          "verb": "observe",
          "label": "test magnetic response",
          "atomId": "atom.observe.test-magnetic-response",
          "equipmentRoleBindings": {
            "bonding-test-vessel": "test-tube",
            "magnetic-response-tool": "magnet"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceInstanceId": "dry-test-line",
            "instrumentInstanceId": "magnetic-tool",
            "measurementId": "magnetic-response",
            "instrumentEvidence": "test-magnetic-response",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputKey": "magnetic-observation",
            "inputLabel": "Observed attraction: 1 = attracted, 0 = no attraction",
            "inputRequired": true,
            "inputMin": 0,
            "inputMax": 1,
            "unit": "flag"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "test-tube",
            "stationId": "magnet",
            "valueParameter": "inputKey",
            "accessibleLabel": "Test and read magnetic response for this sample."
          },
          "prerequisites": [
            {
              "id": "test-magnetic-response--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "dispense-dry-microsample"
            }
          ],
          "stateChanges": [
            "test magnetic response is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "test magnetic response complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "test-magnetic-response"
          ]
        },
        {
          "id": "record-magnetic-response",
          "verb": "record",
          "label": "record magnetic response",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "measurementId": "magnetic-response",
            "copyExistingMeasurementOnly": true
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "evidenceScopeSlotId",
            "accessibleLabel": "Complete record magnetic response for the configured sample."
          },
          "prerequisites": [
            {
              "id": "record-magnetic-response--measurement-required",
              "type": "measurementRecorded",
              "label": "Instrument evidence was acquired.",
              "measurementId": "magnetic-response"
            }
          ],
          "stateChanges": [
            "record magnetic response is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "record magnetic response complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "record-magnetic-response"
          ]
        },
        {
          "id": "stage-melting-sample",
          "verb": "place",
          "label": "stage melting sample",
          "atomId": "atom.place.melting-point-sample",
          "equipmentRoleBindings": {
            "bonding-test-vessel": "test-tube",
            "melting-point-instrument": "melting-point-apparatus"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceInstanceId": "dry-test-line",
            "instrumentInstanceId": "melting-instrument",
            "meltingApparatusLimits": "{{config.meltingApparatusLimits}}"
          },
          "interaction": {
            "type": "dragToZone",
            "sourceDefinitionId": "test-tube",
            "stationId": "melting-point-apparatus",
            "accessibleLabel": "Stage the sample at the configured melting apparatus."
          },
          "prerequisites": [
            {
              "id": "stage-melting-sample--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "record-magnetic-response"
            }
          ],
          "stateChanges": [
            "stage melting sample is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "stage melting sample complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "stage-melting-sample"
          ]
        },
        {
          "id": "read-melting-behavior",
          "verb": "observe",
          "label": "read melting behavior",
          "atomId": "atom.observe.read-melting-behavior",
          "equipmentRoleBindings": {
            "melting-point-instrument": "melting-point-apparatus",
            "bonding-test-vessel": "test-tube"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceInstanceId": "dry-test-line",
            "instrumentInstanceId": "melting-instrument",
            "meltingApparatusLimits": "{{config.meltingApparatusLimits}}",
            "measurementId": "melting-behavior",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputKey": "read-melting-behavior-reading",
            "inputLabel": "Externally acquired classroom instrument reading",
            "inputRequired": true,
            "instrumentEvidence": "read-melting-behavior",
            "unit": "C"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "test-tube",
            "stationId": "melting-point-apparatus",
            "valueParameter": "inputKey",
            "accessibleLabel": "Read melting behavior within configured apparatus limits."
          },
          "prerequisites": [
            {
              "id": "read-melting-behavior--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "stage-melting-sample"
            }
          ],
          "stateChanges": [
            "read melting behavior is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "read melting behavior complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "read-melting-behavior"
          ]
        },
        {
          "id": "record-melting-behavior",
          "verb": "record",
          "label": "record melting behavior",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "measurementId": "melting-behavior",
            "copyExistingMeasurementOnly": true
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "evidenceScopeSlotId",
            "accessibleLabel": "Complete record melting behavior for the configured sample."
          },
          "prerequisites": [
            {
              "id": "record-melting-behavior--measurement-required",
              "type": "measurementRecorded",
              "label": "Instrument evidence was acquired.",
              "measurementId": "melting-behavior"
            }
          ],
          "stateChanges": [
            "record melting behavior is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "record melting behavior complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "record-melting-behavior"
          ]
        },
        {
          "id": "dispose-dry-test-line",
          "verb": "transfer",
          "label": "dispose dry test line",
          "atomId": "atom.transfer.dispose-to-waste-stream",
          "equipmentRoleBindings": {
            "bonding-test-vessel": "test-tube",
            "waste-receiver": "waste-beaker"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "test-tube",
            "sourceInstanceId": "dry-test-line",
            "targetDefinitionId": "waste-beaker",
            "targetInstanceId": "dry-waste",
            "wasteDestination": "{{config.dryWasteDestination}}"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "waste-beaker",
            "accessibleLabel": "Dispose the dry test line to its configured waste destination."
          },
          "prerequisites": [
            {
              "id": "dispose-dry-test-line--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "record-melting-behavior"
            }
          ],
          "stateChanges": [
            "dispose dry test line is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "dispose dry test line complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "dispose-dry-test-line"
          ]
        },
        {
          "id": "dispense-hcl-microsample",
          "verb": "transfer",
          "label": "dispense hcl microsample",
          "atomId": "atom.transfer.microsample-portion",
          "equipmentRoleBindings": {
            "sample-source": "small-vial",
            "bonding-test-vessel": "test-tube",
            "solid-transfer-tool": "spatula"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "small-vial",
            "sourceInstanceId": "sample-vial",
            "targetDefinitionId": "test-tube",
            "targetInstanceId": "hcl-test-line",
            "microsampleAmount": "{{config.microsampleAmount}}",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputKey": "dispense-hcl-microsample-mass-g",
            "inputLabel": "Instructor-approved microsample transfer mass (g)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "g",
            "evidenceProvenance": "C: configured transfer quantity; not an acquired balance measurement"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "small-vial",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Transfer the configured fresh microsample to the hcl test line.",
            "valueParameter": "inputKey"
          },
          "prerequisites": [
            {
              "id": "dispense-hcl-microsample--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "dispose-dry-test-line"
            }
          ],
          "stateChanges": [
            "dispense hcl microsample is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "dispense hcl microsample complete.",
            "invalid": "Enter a positive approved transfer mass within the source inventory."
          },
          "evidence": [
            "sample-scoped",
            "dispense-hcl-microsample"
          ],
          "mass": {
            "source": "configured-input"
          }
        },
        {
          "id": "apply-hcl-reagent",
          "verb": "transfer",
          "label": "apply hcl reagent",
          "atomId": "atom.transfer.apply-test-solvent",
          "equipmentRoleBindings": {
            "bonding-test-solvent-source": "reagent-bottle",
            "bonding-test-vessel": "test-tube"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "reagent-bottle",
            "sourceInstanceId": "hcl-source",
            "targetDefinitionId": "test-tube",
            "targetInstanceId": "hcl-test-line",
            "reagentAmount": "{{config.hclAmount}}",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputKey": "apply-hcl-reagent-volume",
            "inputLabel": "Approved reagent volume (mL)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "mL"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "reagent-bottle",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Apply the configured hcl reagent under the approved controls.",
            "valueParameter": "inputKey"
          },
          "prerequisites": [
            {
              "id": "apply-hcl-reagent--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "dispense-hcl-microsample"
            }
          ],
          "stateChanges": [
            "apply hcl reagent is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "apply hcl reagent complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "apply-hcl-reagent"
          ],
          "volume": {
            "source": "action-input"
          }
        },
        {
          "id": "inspect-hcl-response",
          "verb": "observe",
          "label": "inspect hcl response",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "inputMode": "choice",
            "inputRole": "studentResponse",
            "inputKey": "inspect-hcl-response-choice",
            "inputLabel": "inspect hcl response",
            "inputRequired": true
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "inputKey",
            "accessibleLabel": "Record the direct inspect hcl response observation."
          },
          "prerequisites": [
            {
              "id": "inspect-hcl-response--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "apply-hcl-reagent"
            }
          ],
          "stateChanges": [
            "inspect hcl response is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "inspect hcl response complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "inspect-hcl-response"
          ],
          "choiceObservation": {
            "outputCalculationId": "inspect-hcl-response-choice",
            "options": [
              {
                "label": "Observed",
                "tag": "observed",
                "value": 1
              },
              {
                "label": "Not observed",
                "tag": "not-observed",
                "value": 0
              },
              {
                "label": "Ambiguous",
                "tag": "ambiguous",
                "value": 0.5
              }
            ]
          }
        },
        {
          "id": "record-hcl-response",
          "verb": "record",
          "label": "record hcl response",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "evidenceScopeSlotId",
            "accessibleLabel": "Complete record hcl response for the configured sample."
          },
          "prerequisites": [
            {
              "id": "record-hcl-response--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "inspect-hcl-response"
            }
          ],
          "stateChanges": [
            "record hcl response is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "record hcl response complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "record-hcl-response"
          ]
        },
        {
          "id": "dispose-hcl-test-line",
          "verb": "transfer",
          "label": "dispose hcl test line",
          "atomId": "atom.transfer.dispose-to-waste-stream",
          "equipmentRoleBindings": {
            "bonding-test-vessel": "test-tube",
            "waste-receiver": "waste-beaker"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "test-tube",
            "sourceInstanceId": "hcl-test-line",
            "targetDefinitionId": "waste-beaker",
            "targetInstanceId": "hcl-waste",
            "wasteDestination": "{{config.hclWasteDestination}}"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "waste-beaker",
            "accessibleLabel": "Dispose the hcl test line to its configured waste destination."
          },
          "prerequisites": [
            {
              "id": "dispose-hcl-test-line--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "record-hcl-response"
            }
          ],
          "stateChanges": [
            "dispose hcl test line is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "dispose hcl test line complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "dispose-hcl-test-line"
          ]
        },
        {
          "id": "dispense-naoh-microsample",
          "verb": "transfer",
          "label": "dispense naoh microsample",
          "atomId": "atom.transfer.microsample-portion",
          "equipmentRoleBindings": {
            "sample-source": "small-vial",
            "bonding-test-vessel": "test-tube",
            "solid-transfer-tool": "spatula"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "small-vial",
            "sourceInstanceId": "sample-vial",
            "targetDefinitionId": "test-tube",
            "targetInstanceId": "naoh-test-line",
            "microsampleAmount": "{{config.microsampleAmount}}",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputKey": "dispense-naoh-microsample-mass-g",
            "inputLabel": "Instructor-approved microsample transfer mass (g)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "g",
            "evidenceProvenance": "C: configured transfer quantity; not an acquired balance measurement"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "small-vial",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Transfer the configured fresh microsample to the naoh test line.",
            "valueParameter": "inputKey"
          },
          "prerequisites": [
            {
              "id": "dispense-naoh-microsample--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "dispose-hcl-test-line"
            }
          ],
          "stateChanges": [
            "dispense naoh microsample is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "dispense naoh microsample complete.",
            "invalid": "Enter a positive approved transfer mass within the source inventory."
          },
          "evidence": [
            "sample-scoped",
            "dispense-naoh-microsample"
          ],
          "mass": {
            "source": "configured-input"
          }
        },
        {
          "id": "apply-naoh-reagent",
          "verb": "transfer",
          "label": "apply naoh reagent",
          "atomId": "atom.transfer.apply-test-solvent",
          "equipmentRoleBindings": {
            "bonding-test-solvent-source": "naoh-bottle",
            "bonding-test-vessel": "test-tube"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "naoh-bottle",
            "sourceInstanceId": "naoh-source",
            "targetDefinitionId": "test-tube",
            "targetInstanceId": "naoh-test-line",
            "reagentAmount": "{{config.naohAmount}}",
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputKey": "apply-naoh-reagent-volume",
            "inputLabel": "Approved reagent volume (mL)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "mL"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "naoh-bottle",
            "targetDefinitionId": "test-tube",
            "accessibleLabel": "Apply the configured naoh reagent under the approved controls.",
            "valueParameter": "inputKey"
          },
          "prerequisites": [
            {
              "id": "apply-naoh-reagent--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "dispense-naoh-microsample"
            }
          ],
          "stateChanges": [
            "apply naoh reagent is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "apply naoh reagent complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "apply-naoh-reagent"
          ],
          "volume": {
            "source": "action-input"
          }
        },
        {
          "id": "inspect-naoh-response",
          "verb": "observe",
          "label": "inspect naoh response",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "inputMode": "choice",
            "inputRole": "studentResponse",
            "inputKey": "inspect-naoh-response-choice",
            "inputLabel": "inspect naoh response",
            "inputRequired": true
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "inputKey",
            "accessibleLabel": "Record the direct inspect naoh response observation."
          },
          "prerequisites": [
            {
              "id": "inspect-naoh-response--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "apply-naoh-reagent"
            }
          ],
          "stateChanges": [
            "inspect naoh response is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "inspect naoh response complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "inspect-naoh-response"
          ],
          "choiceObservation": {
            "outputCalculationId": "inspect-naoh-response-choice",
            "options": [
              {
                "label": "Observed",
                "tag": "observed",
                "value": 1
              },
              {
                "label": "Not observed",
                "tag": "not-observed",
                "value": 0
              },
              {
                "label": "Ambiguous",
                "tag": "ambiguous",
                "value": 0.5
              }
            ]
          }
        },
        {
          "id": "record-naoh-response",
          "verb": "record",
          "label": "record naoh response",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "evidenceScopeSlotId",
            "accessibleLabel": "Complete record naoh response for the configured sample."
          },
          "prerequisites": [
            {
              "id": "record-naoh-response--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "inspect-naoh-response"
            }
          ],
          "stateChanges": [
            "record naoh response is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "record naoh response complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "record-naoh-response"
          ]
        },
        {
          "id": "dispose-naoh-test-line",
          "verb": "transfer",
          "label": "dispose naoh test line",
          "atomId": "atom.transfer.dispose-to-waste-stream",
          "equipmentRoleBindings": {
            "bonding-test-vessel": "test-tube",
            "waste-receiver": "waste-beaker"
          },
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "sourceDefinitionId": "test-tube",
            "sourceInstanceId": "naoh-test-line",
            "targetDefinitionId": "waste-beaker",
            "targetInstanceId": "naoh-waste",
            "wasteDestination": "{{config.naohWasteDestination}}"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "test-tube",
            "targetDefinitionId": "waste-beaker",
            "accessibleLabel": "Dispose the naoh test line to its configured waste destination."
          },
          "prerequisites": [
            {
              "id": "dispose-naoh-test-line--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "record-naoh-response"
            }
          ],
          "stateChanges": [
            "dispose naoh test line is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "dispose naoh test line complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "dispose-naoh-test-line"
          ]
        },
        {
          "id": "complete-sample-matrix",
          "verb": "observe",
          "label": "complete sample matrix",
          "parameters": {
            "evidenceScopeSlotId": "{{config.evidenceScopeId}}",
            "selectedTestPanel": "{{config.selectedTestPanel}}"
          },
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "evidenceScopeSlotId",
            "accessibleLabel": "Complete complete sample matrix for the configured sample."
          },
          "prerequisites": [
            {
              "id": "complete-sample-matrix--previous-action",
              "type": "actionEvidence",
              "label": "Previous sample operation is complete.",
              "actionId": "dispose-naoh-test-line"
            }
          ],
          "stateChanges": [
            "complete sample matrix is completed for only the configured sample evidence scope."
          ],
          "invalidCases": [],
          "feedback": {
            "success": "complete sample matrix complete.",
            "invalid": "Use the configured sample, fresh test line, and approved panel."
          },
          "evidence": [
            "sample-scoped",
            "complete-sample-matrix"
          ]
        }
      ],
      "process": {
        "startNodeId": "label-test-locations-node",
        "nodes": [
          {
            "id": "label-test-locations-node",
            "type": "action",
            "title": "label test locations",
            "description": "label test locations",
            "actionId": "label-test-locations",
            "config": {},
            "validation": [
              {
                "id": "label-test-locations-node--label-test-locations-complete",
                "type": "actionEvidence",
                "label": "label test locations is complete.",
                "actionId": "label-test-locations"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "label test locations complete.",
              "retry": "Complete label test locations with the named sample evidence."
            }
          },
          {
            "id": "inspect-solid-appearance-node",
            "type": "action",
            "title": "inspect solid appearance",
            "description": "inspect solid appearance",
            "actionId": "inspect-solid-appearance",
            "config": {},
            "validation": [
              {
                "id": "inspect-solid-appearance-node--inspect-solid-appearance-complete",
                "type": "actionEvidence",
                "label": "inspect solid appearance is complete.",
                "actionId": "inspect-solid-appearance"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "inspect solid appearance complete.",
              "retry": "Complete inspect solid appearance with the named sample evidence."
            }
          },
          {
            "id": "record-solid-appearance-node",
            "type": "action",
            "title": "record solid appearance",
            "description": "record solid appearance",
            "actionId": "record-solid-appearance",
            "config": {},
            "validation": [
              {
                "id": "record-solid-appearance-node--record-solid-appearance-complete",
                "type": "actionEvidence",
                "label": "record solid appearance is complete.",
                "actionId": "record-solid-appearance"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "record solid appearance complete.",
              "retry": "Complete record solid appearance with the named sample evidence."
            }
          },
          {
            "id": "dispense-water-microsample-node",
            "type": "action",
            "title": "dispense water microsample",
            "description": "dispense water microsample",
            "actionId": "dispense-water-microsample",
            "config": {},
            "validation": [
              {
                "id": "dispense-water-microsample-node--dispense-water-microsample-complete",
                "type": "actionEvidence",
                "label": "dispense water microsample is complete.",
                "actionId": "dispense-water-microsample"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "dispense water microsample complete.",
              "retry": "Complete dispense water microsample with the named sample evidence."
            }
          },
          {
            "id": "apply-water-solvent-node",
            "type": "action",
            "title": "apply water solvent",
            "description": "apply water solvent",
            "actionId": "apply-water-solvent",
            "config": {},
            "validation": [
              {
                "id": "apply-water-solvent-node--apply-water-solvent-complete",
                "type": "actionEvidence",
                "label": "apply water solvent is complete.",
                "actionId": "apply-water-solvent"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "apply water solvent complete.",
              "retry": "Complete apply water solvent with the named sample evidence."
            }
          },
          {
            "id": "inspect-water-solubility-node",
            "type": "action",
            "title": "inspect water solubility",
            "description": "inspect water solubility",
            "actionId": "inspect-water-solubility",
            "config": {},
            "validation": [
              {
                "id": "inspect-water-solubility-node--inspect-water-solubility-complete",
                "type": "actionEvidence",
                "label": "inspect water solubility is complete.",
                "actionId": "inspect-water-solubility"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "inspect water solubility complete.",
              "retry": "Complete inspect water solubility with the named sample evidence."
            }
          },
          {
            "id": "record-water-solubility-node",
            "type": "action",
            "title": "record water solubility",
            "description": "record water solubility",
            "actionId": "record-water-solubility",
            "config": {},
            "validation": [
              {
                "id": "record-water-solubility-node--record-water-solubility-complete",
                "type": "actionEvidence",
                "label": "record water solubility is complete.",
                "actionId": "record-water-solubility"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "record water solubility complete.",
              "retry": "Complete record water solubility with the named sample evidence."
            }
          },
          {
            "id": "read-aqueous-conductivity-node",
            "type": "action",
            "title": "read aqueous conductivity",
            "description": "read aqueous conductivity",
            "actionId": "read-aqueous-conductivity",
            "config": {},
            "validation": [
              {
                "id": "read-aqueous-conductivity-node--read-aqueous-conductivity-complete",
                "type": "actionEvidence",
                "label": "read aqueous conductivity is complete.",
                "actionId": "read-aqueous-conductivity"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "read aqueous conductivity complete.",
              "retry": "Complete read aqueous conductivity with the named sample evidence."
            }
          },
          {
            "id": "record-aqueous-conductivity-node",
            "type": "action",
            "title": "record aqueous conductivity",
            "description": "record aqueous conductivity",
            "actionId": "record-aqueous-conductivity",
            "config": {},
            "validation": [
              {
                "id": "record-aqueous-conductivity-node--record-aqueous-conductivity-complete",
                "type": "actionEvidence",
                "label": "record aqueous conductivity is complete.",
                "actionId": "record-aqueous-conductivity"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "record aqueous conductivity complete.",
              "retry": "Complete record aqueous conductivity with the named sample evidence."
            }
          },
          {
            "id": "read-ph-indicator-node",
            "type": "action",
            "title": "read ph indicator",
            "description": "read ph indicator",
            "actionId": "read-ph-indicator",
            "config": {},
            "validation": [
              {
                "id": "read-ph-indicator-node--read-ph-indicator-complete",
                "type": "actionEvidence",
                "label": "read ph indicator is complete.",
                "actionId": "read-ph-indicator"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "read ph indicator complete.",
              "retry": "Complete read ph indicator with the named sample evidence."
            }
          },
          {
            "id": "record-ph-node",
            "type": "action",
            "title": "record ph",
            "description": "record ph",
            "actionId": "record-ph",
            "config": {},
            "validation": [
              {
                "id": "record-ph-node--record-ph-complete",
                "type": "actionEvidence",
                "label": "record ph is complete.",
                "actionId": "record-ph"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "record ph complete.",
              "retry": "Complete record ph with the named sample evidence."
            }
          },
          {
            "id": "dispose-water-test-line-node",
            "type": "action",
            "title": "dispose water test line",
            "description": "dispose water test line",
            "actionId": "dispose-water-test-line",
            "config": {},
            "validation": [
              {
                "id": "dispose-water-test-line-node--dispose-water-test-line-complete",
                "type": "actionEvidence",
                "label": "dispose water test line is complete.",
                "actionId": "dispose-water-test-line"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "dispose water test line complete.",
              "retry": "Complete dispose water test line with the named sample evidence."
            }
          },
          {
            "id": "dispense-ethanol-microsample-node",
            "type": "action",
            "title": "dispense ethanol microsample",
            "description": "dispense ethanol microsample",
            "actionId": "dispense-ethanol-microsample",
            "config": {},
            "validation": [
              {
                "id": "dispense-ethanol-microsample-node--dispense-ethanol-microsample-complete",
                "type": "actionEvidence",
                "label": "dispense ethanol microsample is complete.",
                "actionId": "dispense-ethanol-microsample"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "dispense ethanol microsample complete.",
              "retry": "Complete dispense ethanol microsample with the named sample evidence."
            }
          },
          {
            "id": "apply-ethanol-solvent-node",
            "type": "action",
            "title": "apply ethanol solvent",
            "description": "apply ethanol solvent",
            "actionId": "apply-ethanol-solvent",
            "config": {},
            "validation": [
              {
                "id": "apply-ethanol-solvent-node--apply-ethanol-solvent-complete",
                "type": "actionEvidence",
                "label": "apply ethanol solvent is complete.",
                "actionId": "apply-ethanol-solvent"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "apply ethanol solvent complete.",
              "retry": "Complete apply ethanol solvent with the named sample evidence."
            }
          },
          {
            "id": "inspect-ethanol-solubility-node",
            "type": "action",
            "title": "inspect ethanol solubility",
            "description": "inspect ethanol solubility",
            "actionId": "inspect-ethanol-solubility",
            "config": {},
            "validation": [
              {
                "id": "inspect-ethanol-solubility-node--inspect-ethanol-solubility-complete",
                "type": "actionEvidence",
                "label": "inspect ethanol solubility is complete.",
                "actionId": "inspect-ethanol-solubility"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "inspect ethanol solubility complete.",
              "retry": "Complete inspect ethanol solubility with the named sample evidence."
            }
          },
          {
            "id": "record-ethanol-solubility-node",
            "type": "action",
            "title": "record ethanol solubility",
            "description": "record ethanol solubility",
            "actionId": "record-ethanol-solubility",
            "config": {},
            "validation": [
              {
                "id": "record-ethanol-solubility-node--record-ethanol-solubility-complete",
                "type": "actionEvidence",
                "label": "record ethanol solubility is complete.",
                "actionId": "record-ethanol-solubility"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "record ethanol solubility complete.",
              "retry": "Complete record ethanol solubility with the named sample evidence."
            }
          },
          {
            "id": "dispose-ethanol-test-line-node",
            "type": "action",
            "title": "dispose ethanol test line",
            "description": "dispose ethanol test line",
            "actionId": "dispose-ethanol-test-line",
            "config": {},
            "validation": [
              {
                "id": "dispose-ethanol-test-line-node--dispose-ethanol-test-line-complete",
                "type": "actionEvidence",
                "label": "dispose ethanol test line is complete.",
                "actionId": "dispose-ethanol-test-line"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "dispose ethanol test line complete.",
              "retry": "Complete dispose ethanol test line with the named sample evidence."
            }
          },
          {
            "id": "dispense-hexanes-microsample-node",
            "type": "action",
            "title": "dispense hexanes microsample",
            "description": "dispense hexanes microsample",
            "actionId": "dispense-hexanes-microsample",
            "config": {},
            "validation": [
              {
                "id": "dispense-hexanes-microsample-node--dispense-hexanes-microsample-complete",
                "type": "actionEvidence",
                "label": "dispense hexanes microsample is complete.",
                "actionId": "dispense-hexanes-microsample"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "dispense hexanes microsample complete.",
              "retry": "Complete dispense hexanes microsample with the named sample evidence."
            }
          },
          {
            "id": "apply-hexanes-solvent-node",
            "type": "action",
            "title": "apply hexanes solvent",
            "description": "apply hexanes solvent",
            "actionId": "apply-hexanes-solvent",
            "config": {},
            "validation": [
              {
                "id": "apply-hexanes-solvent-node--apply-hexanes-solvent-complete",
                "type": "actionEvidence",
                "label": "apply hexanes solvent is complete.",
                "actionId": "apply-hexanes-solvent"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "apply hexanes solvent complete.",
              "retry": "Complete apply hexanes solvent with the named sample evidence."
            }
          },
          {
            "id": "inspect-hexanes-solubility-node",
            "type": "action",
            "title": "inspect hexanes solubility",
            "description": "inspect hexanes solubility",
            "actionId": "inspect-hexanes-solubility",
            "config": {},
            "validation": [
              {
                "id": "inspect-hexanes-solubility-node--inspect-hexanes-solubility-complete",
                "type": "actionEvidence",
                "label": "inspect hexanes solubility is complete.",
                "actionId": "inspect-hexanes-solubility"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "inspect hexanes solubility complete.",
              "retry": "Complete inspect hexanes solubility with the named sample evidence."
            }
          },
          {
            "id": "record-hexanes-solubility-node",
            "type": "action",
            "title": "record hexanes solubility",
            "description": "record hexanes solubility",
            "actionId": "record-hexanes-solubility",
            "config": {},
            "validation": [
              {
                "id": "record-hexanes-solubility-node--record-hexanes-solubility-complete",
                "type": "actionEvidence",
                "label": "record hexanes solubility is complete.",
                "actionId": "record-hexanes-solubility"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "record hexanes solubility complete.",
              "retry": "Complete record hexanes solubility with the named sample evidence."
            }
          },
          {
            "id": "dispose-hexanes-test-line-node",
            "type": "action",
            "title": "dispose hexanes test line",
            "description": "dispose hexanes test line",
            "actionId": "dispose-hexanes-test-line",
            "config": {},
            "validation": [
              {
                "id": "dispose-hexanes-test-line-node--dispose-hexanes-test-line-complete",
                "type": "actionEvidence",
                "label": "dispose hexanes test line is complete.",
                "actionId": "dispose-hexanes-test-line"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "dispose hexanes test line complete.",
              "retry": "Complete dispose hexanes test line with the named sample evidence."
            }
          },
          {
            "id": "dispense-dry-microsample-node",
            "type": "action",
            "title": "dispense dry microsample",
            "description": "dispense dry microsample",
            "actionId": "dispense-dry-microsample",
            "config": {},
            "validation": [
              {
                "id": "dispense-dry-microsample-node--dispense-dry-microsample-complete",
                "type": "actionEvidence",
                "label": "dispense dry microsample is complete.",
                "actionId": "dispense-dry-microsample"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "dispense dry microsample complete.",
              "retry": "Complete dispense dry microsample with the named sample evidence."
            }
          },
          {
            "id": "test-magnetic-response-node",
            "type": "action",
            "title": "test magnetic response",
            "description": "test magnetic response",
            "actionId": "test-magnetic-response",
            "config": {},
            "validation": [
              {
                "id": "test-magnetic-response-node--test-magnetic-response-complete",
                "type": "actionEvidence",
                "label": "test magnetic response is complete.",
                "actionId": "test-magnetic-response"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "test magnetic response complete.",
              "retry": "Complete test magnetic response with the named sample evidence."
            }
          },
          {
            "id": "record-magnetic-response-node",
            "type": "action",
            "title": "record magnetic response",
            "description": "record magnetic response",
            "actionId": "record-magnetic-response",
            "config": {},
            "validation": [
              {
                "id": "record-magnetic-response-node--record-magnetic-response-complete",
                "type": "actionEvidence",
                "label": "record magnetic response is complete.",
                "actionId": "record-magnetic-response"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "record magnetic response complete.",
              "retry": "Complete record magnetic response with the named sample evidence."
            }
          },
          {
            "id": "stage-melting-sample-node",
            "type": "action",
            "title": "stage melting sample",
            "description": "stage melting sample",
            "actionId": "stage-melting-sample",
            "config": {},
            "validation": [
              {
                "id": "stage-melting-sample-node--stage-melting-sample-complete",
                "type": "actionEvidence",
                "label": "stage melting sample is complete.",
                "actionId": "stage-melting-sample"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "stage melting sample complete.",
              "retry": "Complete stage melting sample with the named sample evidence."
            }
          },
          {
            "id": "read-melting-behavior-node",
            "type": "action",
            "title": "read melting behavior",
            "description": "read melting behavior",
            "actionId": "read-melting-behavior",
            "config": {},
            "validation": [
              {
                "id": "read-melting-behavior-node--read-melting-behavior-complete",
                "type": "actionEvidence",
                "label": "read melting behavior is complete.",
                "actionId": "read-melting-behavior"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "read melting behavior complete.",
              "retry": "Complete read melting behavior with the named sample evidence."
            }
          },
          {
            "id": "record-melting-behavior-node",
            "type": "action",
            "title": "record melting behavior",
            "description": "record melting behavior",
            "actionId": "record-melting-behavior",
            "config": {},
            "validation": [
              {
                "id": "record-melting-behavior-node--record-melting-behavior-complete",
                "type": "actionEvidence",
                "label": "record melting behavior is complete.",
                "actionId": "record-melting-behavior"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "record melting behavior complete.",
              "retry": "Complete record melting behavior with the named sample evidence."
            }
          },
          {
            "id": "dispose-dry-test-line-node",
            "type": "action",
            "title": "dispose dry test line",
            "description": "dispose dry test line",
            "actionId": "dispose-dry-test-line",
            "config": {},
            "validation": [
              {
                "id": "dispose-dry-test-line-node--dispose-dry-test-line-complete",
                "type": "actionEvidence",
                "label": "dispose dry test line is complete.",
                "actionId": "dispose-dry-test-line"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "dispose dry test line complete.",
              "retry": "Complete dispose dry test line with the named sample evidence."
            }
          },
          {
            "id": "dispense-hcl-microsample-node",
            "type": "action",
            "title": "dispense hcl microsample",
            "description": "dispense hcl microsample",
            "actionId": "dispense-hcl-microsample",
            "config": {},
            "validation": [
              {
                "id": "dispense-hcl-microsample-node--dispense-hcl-microsample-complete",
                "type": "actionEvidence",
                "label": "dispense hcl microsample is complete.",
                "actionId": "dispense-hcl-microsample"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "dispense hcl microsample complete.",
              "retry": "Complete dispense hcl microsample with the named sample evidence."
            }
          },
          {
            "id": "apply-hcl-reagent-node",
            "type": "action",
            "title": "apply hcl reagent",
            "description": "apply hcl reagent",
            "actionId": "apply-hcl-reagent",
            "config": {},
            "validation": [
              {
                "id": "apply-hcl-reagent-node--apply-hcl-reagent-complete",
                "type": "actionEvidence",
                "label": "apply hcl reagent is complete.",
                "actionId": "apply-hcl-reagent"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "apply hcl reagent complete.",
              "retry": "Complete apply hcl reagent with the named sample evidence."
            }
          },
          {
            "id": "inspect-hcl-response-node",
            "type": "action",
            "title": "inspect hcl response",
            "description": "inspect hcl response",
            "actionId": "inspect-hcl-response",
            "config": {},
            "validation": [
              {
                "id": "inspect-hcl-response-node--inspect-hcl-response-complete",
                "type": "actionEvidence",
                "label": "inspect hcl response is complete.",
                "actionId": "inspect-hcl-response"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "inspect hcl response complete.",
              "retry": "Complete inspect hcl response with the named sample evidence."
            }
          },
          {
            "id": "record-hcl-response-node",
            "type": "action",
            "title": "record hcl response",
            "description": "record hcl response",
            "actionId": "record-hcl-response",
            "config": {},
            "validation": [
              {
                "id": "record-hcl-response-node--record-hcl-response-complete",
                "type": "actionEvidence",
                "label": "record hcl response is complete.",
                "actionId": "record-hcl-response"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "record hcl response complete.",
              "retry": "Complete record hcl response with the named sample evidence."
            }
          },
          {
            "id": "dispose-hcl-test-line-node",
            "type": "action",
            "title": "dispose hcl test line",
            "description": "dispose hcl test line",
            "actionId": "dispose-hcl-test-line",
            "config": {},
            "validation": [
              {
                "id": "dispose-hcl-test-line-node--dispose-hcl-test-line-complete",
                "type": "actionEvidence",
                "label": "dispose hcl test line is complete.",
                "actionId": "dispose-hcl-test-line"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "dispose hcl test line complete.",
              "retry": "Complete dispose hcl test line with the named sample evidence."
            }
          },
          {
            "id": "dispense-naoh-microsample-node",
            "type": "action",
            "title": "dispense naoh microsample",
            "description": "dispense naoh microsample",
            "actionId": "dispense-naoh-microsample",
            "config": {},
            "validation": [
              {
                "id": "dispense-naoh-microsample-node--dispense-naoh-microsample-complete",
                "type": "actionEvidence",
                "label": "dispense naoh microsample is complete.",
                "actionId": "dispense-naoh-microsample"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "dispense naoh microsample complete.",
              "retry": "Complete dispense naoh microsample with the named sample evidence."
            }
          },
          {
            "id": "apply-naoh-reagent-node",
            "type": "action",
            "title": "apply naoh reagent",
            "description": "apply naoh reagent",
            "actionId": "apply-naoh-reagent",
            "config": {},
            "validation": [
              {
                "id": "apply-naoh-reagent-node--apply-naoh-reagent-complete",
                "type": "actionEvidence",
                "label": "apply naoh reagent is complete.",
                "actionId": "apply-naoh-reagent"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "apply naoh reagent complete.",
              "retry": "Complete apply naoh reagent with the named sample evidence."
            }
          },
          {
            "id": "inspect-naoh-response-node",
            "type": "action",
            "title": "inspect naoh response",
            "description": "inspect naoh response",
            "actionId": "inspect-naoh-response",
            "config": {},
            "validation": [
              {
                "id": "inspect-naoh-response-node--inspect-naoh-response-complete",
                "type": "actionEvidence",
                "label": "inspect naoh response is complete.",
                "actionId": "inspect-naoh-response"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "inspect naoh response complete.",
              "retry": "Complete inspect naoh response with the named sample evidence."
            }
          },
          {
            "id": "record-naoh-response-node",
            "type": "action",
            "title": "record naoh response",
            "description": "record naoh response",
            "actionId": "record-naoh-response",
            "config": {},
            "validation": [
              {
                "id": "record-naoh-response-node--record-naoh-response-complete",
                "type": "actionEvidence",
                "label": "record naoh response is complete.",
                "actionId": "record-naoh-response"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "record naoh response complete.",
              "retry": "Complete record naoh response with the named sample evidence."
            }
          },
          {
            "id": "dispose-naoh-test-line-node",
            "type": "action",
            "title": "dispose naoh test line",
            "description": "dispose naoh test line",
            "actionId": "dispose-naoh-test-line",
            "config": {},
            "validation": [
              {
                "id": "dispose-naoh-test-line-node--dispose-naoh-test-line-complete",
                "type": "actionEvidence",
                "label": "dispose naoh test line is complete.",
                "actionId": "dispose-naoh-test-line"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "dispose naoh test line complete.",
              "retry": "Complete dispose naoh test line with the named sample evidence."
            }
          },
          {
            "id": "complete-sample-matrix-node",
            "type": "action",
            "title": "complete sample matrix",
            "description": "complete sample matrix",
            "actionId": "complete-sample-matrix",
            "config": {},
            "validation": [
              {
                "id": "complete-sample-matrix-node--complete-sample-matrix-complete",
                "type": "actionEvidence",
                "label": "complete sample matrix is complete.",
                "actionId": "complete-sample-matrix"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "complete sample matrix complete.",
              "retry": "Complete complete sample matrix with the named sample evidence."
            }
          }
        ],
        "edges": [
          {
            "from": "label-test-locations-node",
            "to": "inspect-solid-appearance-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "inspect-solid-appearance-node",
            "to": "record-solid-appearance-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-solid-appearance-node",
            "to": "dispense-water-microsample-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "dispense-water-microsample-node",
            "to": "apply-water-solvent-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "apply-water-solvent-node",
            "to": "inspect-water-solubility-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "inspect-water-solubility-node",
            "to": "record-water-solubility-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-water-solubility-node",
            "to": "read-aqueous-conductivity-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "read-aqueous-conductivity-node",
            "to": "record-aqueous-conductivity-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-aqueous-conductivity-node",
            "to": "read-ph-indicator-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "read-ph-indicator-node",
            "to": "record-ph-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-ph-node",
            "to": "dispose-water-test-line-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "dispose-water-test-line-node",
            "to": "dispense-ethanol-microsample-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "dispense-ethanol-microsample-node",
            "to": "apply-ethanol-solvent-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "apply-ethanol-solvent-node",
            "to": "inspect-ethanol-solubility-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "inspect-ethanol-solubility-node",
            "to": "record-ethanol-solubility-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-ethanol-solubility-node",
            "to": "dispose-ethanol-test-line-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "dispose-ethanol-test-line-node",
            "to": "dispense-hexanes-microsample-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "dispense-hexanes-microsample-node",
            "to": "apply-hexanes-solvent-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "apply-hexanes-solvent-node",
            "to": "inspect-hexanes-solubility-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "inspect-hexanes-solubility-node",
            "to": "record-hexanes-solubility-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-hexanes-solubility-node",
            "to": "dispose-hexanes-test-line-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "dispose-hexanes-test-line-node",
            "to": "dispense-dry-microsample-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "dispense-dry-microsample-node",
            "to": "test-magnetic-response-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "test-magnetic-response-node",
            "to": "record-magnetic-response-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-magnetic-response-node",
            "to": "stage-melting-sample-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "stage-melting-sample-node",
            "to": "read-melting-behavior-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "read-melting-behavior-node",
            "to": "record-melting-behavior-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-melting-behavior-node",
            "to": "dispose-dry-test-line-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "dispose-dry-test-line-node",
            "to": "dispense-hcl-microsample-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "dispense-hcl-microsample-node",
            "to": "apply-hcl-reagent-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "apply-hcl-reagent-node",
            "to": "inspect-hcl-response-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "inspect-hcl-response-node",
            "to": "record-hcl-response-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-hcl-response-node",
            "to": "dispose-hcl-test-line-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "dispose-hcl-test-line-node",
            "to": "dispense-naoh-microsample-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "dispense-naoh-microsample-node",
            "to": "apply-naoh-reagent-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "apply-naoh-reagent-node",
            "to": "inspect-naoh-response-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "inspect-naoh-response-node",
            "to": "record-naoh-response-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-naoh-response-node",
            "to": "dispose-naoh-test-line-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "dispose-naoh-test-line-node",
            "to": "complete-sample-matrix-node",
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
        "version": "1.2.0",
        "author": "Lab Studio",
        "updatedAt": "2026-09-04T00:00:00.000Z",
        "tags": [
          "technique",
          "chemistry",
          "bonding",
          "qualitative-analysis"
        ]
      },
      "composition": {
        "schemaVersion": 1,
        "ports": [
          {
            "id": "entry-label-test-locations-node",
            "kind": "entry",
            "nodeId": "label-test-locations-node",
            "label": "Entry"
          },
          {
            "id": "exit-complete-sample-matrix-node",
            "kind": "exit",
            "nodeId": "complete-sample-matrix-node",
            "label": "Exit"
          }
        ],
        "equipmentRoles": [
          {
            "roleId": "sample-source",
            "required": true,
            "allowedDefinitionIds": [
              "small-vial"
            ],
            "sourceInstanceIds": [
              "sample-vial"
            ]
          },
          {
            "roleId": "bonding-test-vessel",
            "required": true,
            "allowedDefinitionIds": [
              "test-tube"
            ],
            "sourceInstanceIds": [
              "water-test-line",
              "ethanol-test-line",
              "hexanes-test-line",
              "dry-test-line",
              "hcl-test-line",
              "naoh-test-line"
            ]
          },
          {
            "roleId": "solid-transfer-tool",
            "required": true,
            "allowedDefinitionIds": [
              "spatula"
            ],
            "sourceInstanceIds": [
              "transfer-tool"
            ]
          },
          {
            "roleId": "bonding-test-solvent-source",
            "required": true,
            "allowedDefinitionIds": [
              "distilled-water-bottle",
              "reagent-bottle",
              "naoh-bottle"
            ],
            "sourceInstanceIds": [
              "water-source",
              "ethanol-source",
              "hexanes-source",
              "hcl-source",
              "naoh-source"
            ]
          },
          {
            "roleId": "immersed-probe-instrument",
            "required": true,
            "allowedDefinitionIds": [
              "conductivity-tester"
            ],
            "sourceInstanceIds": [
              "conductivity-instrument"
            ]
          },
          {
            "roleId": "ph-indicator-medium",
            "required": true,
            "allowedDefinitionIds": [
              "ph-paper"
            ],
            "sourceInstanceIds": [
              "ph-medium"
            ]
          },
          {
            "roleId": "waste-receiver",
            "required": true,
            "allowedDefinitionIds": [
              "waste-beaker"
            ],
            "sourceInstanceIds": [
              "water-waste",
              "ethanol-waste",
              "hexanes-waste",
              "hcl-waste",
              "naoh-waste",
              "dry-waste"
            ]
          },
          {
            "roleId": "magnetic-response-tool",
            "required": true,
            "allowedDefinitionIds": [
              "magnet"
            ],
            "sourceInstanceIds": [
              "magnetic-tool"
            ]
          },
          {
            "roleId": "melting-point-instrument",
            "required": true,
            "allowedDefinitionIds": [
              "melting-point-apparatus"
            ],
            "sourceInstanceIds": [
              "melting-instrument"
            ]
          }
        ],
        "modelSlots": [],
        "configurationSlots": [
          {
            "id": "sampleIdentity",
            "required": true,
            "valueType": "string",
            "redactWhenBlind": true
          },
          {
            "id": "sampleMode",
            "required": true,
            "valueType": "string",
            "allowedValues": [
              "known",
              "blind"
            ]
          },
          {
            "id": "evidenceScopeId",
            "required": true,
            "valueType": "string"
          },
          {
            "id": "selectedTestPanel",
            "required": true,
            "valueType": "string"
          },
          {
            "id": "microsampleAmount",
            "required": true,
            "valueType": "string"
          },
          {
            "id": "waterAmount",
            "required": true,
            "valueType": "string"
          },
          {
            "id": "ethanolAmount",
            "required": true,
            "valueType": "string"
          },
          {
            "id": "hexanesAmount",
            "required": true,
            "valueType": "string"
          },
          {
            "id": "hclAmount",
            "required": true,
            "valueType": "string"
          },
          {
            "id": "naohAmount",
            "required": true,
            "valueType": "string"
          },
          {
            "id": "conductivityThresholds",
            "required": true,
            "valueType": "number"
          },
          {
            "id": "phThresholds",
            "required": true,
            "valueType": "number"
          },
          {
            "id": "meltingApparatusLimits",
            "required": true,
            "valueType": "number"
          },
          {
            "id": "hoodControl",
            "required": true,
            "valueType": "string"
          },
          {
            "id": "waterWasteDestination",
            "required": true,
            "valueType": "string"
          },
          {
            "id": "ethanolWasteDestination",
            "required": true,
            "valueType": "string"
          },
          {
            "id": "hexanesWasteDestination",
            "required": true,
            "valueType": "string"
          },
          {
            "id": "hclWasteDestination",
            "required": true,
            "valueType": "string"
          },
          {
            "id": "naohWasteDestination",
            "required": true,
            "valueType": "string"
          },
          {
            "id": "dryWasteDestination",
            "required": true,
            "valueType": "string"
          },
          {
            "id": "selectedProcedure",
            "required": true,
            "valueType": "string"
          }
        ],
        "approvalGates": [],
        "variants": [],
        "evidenceOutputs": [],
        "completion": {
          "exitPortIds": [
            "exit-complete-sample-matrix-node"
          ],
          "requiredEvidenceOutputIds": [],
          "requiredValidationRuleIds": []
        },
        "catalogDisposition": "composable",
        "legacyActionEffects": [
          {
            "actionId": "label-test-locations",
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
            "actionId": "inspect-solid-appearance",
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
            "actionId": "record-solid-appearance",
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
            "actionId": "inspect-water-solubility",
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
            "actionId": "record-water-solubility",
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
            "actionId": "record-aqueous-conductivity",
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
            "actionId": "record-ph",
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
            "actionId": "inspect-ethanol-solubility",
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
            "actionId": "record-ethanol-solubility",
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
            "actionId": "inspect-hexanes-solubility",
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
            "actionId": "record-hexanes-solubility",
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
            "actionId": "record-magnetic-response",
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
            "actionId": "record-melting-behavior",
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
            "actionId": "inspect-hcl-response",
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
            "actionId": "record-hcl-response",
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
            "actionId": "inspect-naoh-response",
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
            "actionId": "record-naoh-response",
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
            "actionId": "complete-sample-matrix",
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
          }
        ],
        "orderedProcedure": {
          "configurationSlotId": "selectedProcedure",
          "startActionIds": [
            "label-test-locations"
          ],
          "endActionIds": [
            "complete-sample-matrix"
          ],
          "minimumTests": 4,
          "requireMixedEvidence": true,
          "resources": [
            {
              "id": "water",
              "prepareActionIds": [
                "dispense-water-microsample",
                "apply-water-solvent"
              ],
              "cleanupActionIds": [
                "dispose-water-test-line"
              ]
            },
            {
              "id": "ethanol",
              "prepareActionIds": [
                "dispense-ethanol-microsample",
                "apply-ethanol-solvent"
              ],
              "cleanupActionIds": [
                "dispose-ethanol-test-line"
              ]
            },
            {
              "id": "hexanes",
              "prepareActionIds": [
                "dispense-hexanes-microsample",
                "apply-hexanes-solvent"
              ],
              "cleanupActionIds": [
                "dispose-hexanes-test-line"
              ]
            },
            {
              "id": "dry",
              "prepareActionIds": [
                "dispense-dry-microsample"
              ],
              "cleanupActionIds": [
                "dispose-dry-test-line"
              ]
            },
            {
              "id": "hcl",
              "prepareActionIds": [
                "dispense-hcl-microsample",
                "apply-hcl-reagent"
              ],
              "cleanupActionIds": [
                "dispose-hcl-test-line"
              ]
            },
            {
              "id": "naoh",
              "prepareActionIds": [
                "dispense-naoh-microsample",
                "apply-naoh-reagent"
              ],
              "cleanupActionIds": [
                "dispose-naoh-test-line"
              ]
            }
          ],
          "groups": [
            {
              "id": "appearance",
              "actionIds": [
                "inspect-solid-appearance",
                "record-solid-appearance"
              ],
              "evidenceKind": "qualitative",
              "testCount": 1
            },
            {
              "id": "water",
              "actionIds": [
                "inspect-water-solubility",
                "record-water-solubility"
              ],
              "evidenceKind": "qualitative",
              "resourceId": "water",
              "testCount": 1
            },
            {
              "id": "conductivity",
              "actionIds": [
                "read-aqueous-conductivity",
                "record-aqueous-conductivity"
              ],
              "evidenceKind": "quantitative",
              "resourceId": "water",
              "testCount": 1
            },
            {
              "id": "ph",
              "actionIds": [
                "read-ph-indicator",
                "record-ph"
              ],
              "evidenceKind": "quantitative",
              "resourceId": "water",
              "testCount": 1
            },
            {
              "id": "ethanol",
              "actionIds": [
                "inspect-ethanol-solubility",
                "record-ethanol-solubility"
              ],
              "evidenceKind": "qualitative",
              "resourceId": "ethanol",
              "testCount": 1
            },
            {
              "id": "hexanes",
              "actionIds": [
                "inspect-hexanes-solubility",
                "record-hexanes-solubility"
              ],
              "evidenceKind": "qualitative",
              "resourceId": "hexanes",
              "testCount": 1
            },
            {
              "id": "magnet",
              "actionIds": [
                "test-magnetic-response",
                "record-magnetic-response"
              ],
              "evidenceKind": "qualitative",
              "resourceId": "dry",
              "testCount": 1
            },
            {
              "id": "melting",
              "actionIds": [
                "stage-melting-sample",
                "read-melting-behavior",
                "record-melting-behavior"
              ],
              "evidenceKind": "quantitative",
              "resourceId": "dry",
              "testCount": 1,
              "requiresEarlier": [
                "magnet"
              ]
            },
            {
              "id": "hcl",
              "actionIds": [
                "inspect-hcl-response",
                "record-hcl-response"
              ],
              "evidenceKind": "qualitative",
              "resourceId": "hcl",
              "testCount": 1
            },
            {
              "id": "naoh",
              "actionIds": [
                "inspect-naoh-response",
                "record-naoh-response"
              ],
              "evidenceKind": "qualitative",
              "resourceId": "naoh",
              "testCount": 1
            }
          ]
        }
      }
    }
  ],
  [
    "tablet-separation",
    {
      "id": "tablet-separation",
      "title": "Tablet Separation",
      "learningGoal": "Filter one teacher-approved recovered tablet fraction, dry and cool it, and calculate its percent by mass without claiming an unsupported identity.",
      "requiredEquipment": [
        "analytical-balance",
        "beaker-250ml",
        "buchner-funnel",
        "filter-paper",
        "side-arm-filter-flask",
        "vacuum-source",
        "wash-bottle",
        "watch-glass",
        "drying-oven",
        "crucible-tongs",
        "spatula"
      ],
      "initialState": {
        "equipment": [
          {
            "id": "watch-glass-1",
            "definitionId": "watch-glass",
            "label": "Watch glass",
            "location": "shelf",
            "contents": {
              "kind": "solid",
              "label": "Simulated crushed tablet sample",
              "massG": 3,
              "solutes": [
                {
                  "id": "simulated-crushed-tablet-sample",
                  "label": "Simulated crushed tablet sample",
                  "amount": 3,
                  "unit": "g"
                }
              ],
              "contamination": [],
              "wetState": "dry",
              "visualState": "powder"
            }
          },
          {
            "id": "watch-glass-2",
            "definitionId": "watch-glass",
            "label": "Watch glass",
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
            "id": "beaker-250ml-1",
            "definitionId": "beaker-250ml",
            "label": "250 mL beaker",
            "location": "shelf",
            "contents": {
              "kind": "mixture",
              "label": "Teacher-approved simulated recovered tablet fraction",
              "volumeMl": 30,
              "solutes": [],
              "precipitate": {
                "substance": "Simulated recovered tablet solid fraction",
                "massG": 0.82,
                "rinsed": false,
                "dryness": "wet"
              },
              "contamination": [],
              "wetState": "wet",
              "visualState": "cloudy-precipitate"
            }
          },
          {
            "id": "wash-bottle-1",
            "definitionId": "wash-bottle",
            "label": "Wash bottle",
            "location": "shelf",
            "contents": {
              "kind": "liquid",
              "label": "Teacher-approved rinse",
              "volumeMl": 100,
              "solutes": [],
              "contamination": [],
              "wetState": "wet",
              "visualState": "clear-liquid"
            }
          },
          {
            "id": "analytical-balance-1",
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
            "id": "buchner-funnel-1",
            "definitionId": "buchner-funnel",
            "label": "Buchner funnel",
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
            "id": "side-arm-filter-flask-1",
            "definitionId": "side-arm-filter-flask",
            "label": "Side-arm filter flask",
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
            "id": "vacuum-source-1",
            "definitionId": "vacuum-source",
            "label": "Vacuum source",
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
            "id": "filter-paper-1",
            "definitionId": "filter-paper",
            "label": "Filter paper",
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
            "id": "drying-oven-1",
            "definitionId": "drying-oven",
            "label": "Drying oven",
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
            "id": "crucible-tongs-1",
            "definitionId": "crucible-tongs",
            "label": "Crucible tongs",
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
            "id": "spatula-1",
            "definitionId": "spatula",
            "label": "Spatula",
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
          "id": "weigh-tablet-sample",
          "verb": "weigh",
          "label": "Read starting sample mass",
          "parameters": {
            "sourceDefinitionId": "watch-glass",
            "sourceInstanceId": "watch-glass-1",
            "targetDefinitionId": "analytical-balance",
            "instrumentDefinitionId": "analytical-balance",
            "tolerance": 0.001,
            "evidenceProvenance": "learner-entered reading from the configured simulated balance; no expected mass is embedded",
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputKey": "tablet-sample-mass-input",
            "inputLabel": "Read starting sample mass from the configured simulated balance (g)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "g"
          },
          "prerequisites": [],
          "stateChanges": [
            "Read starting sample mass: The starting sample mass is available from the balance."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The starting sample mass is available from the balance.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "weigh",
            "measurement"
          ],
          "atomId": "atom.weigh.solid-portion",
          "equipmentRoleBindings": {
            "balance-instrument": "analytical-balance",
            "weighed-vessel": "watch-glass"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "watch-glass",
            "targetDefinitionId": "analytical-balance",
            "stationId": "analytical-balance",
            "valueParameter": "inputKey",
            "accessibleLabel": "Read the starting sample mass on the analytical balance."
          },
          "mass": {
            "source": "action-input",
            "outputMeasurementId": "tablet-sample-mass"
          }
        },
        {
          "id": "record-tablet-sample-mass",
          "verb": "record",
          "label": "Record starting sample mass",
          "parameters": {
            "measurementId": "tablet-sample-mass",
            "label": "Starting sample mass",
            "unit": "g",
            "copyExistingMeasurementOnly": true
          },
          "prerequisites": [
            {
              "id": "record-tablet-sample-mass--tablet-sample-mass-required",
              "type": "measurementRecorded",
              "label": "The starting sample mass has been read.",
              "measurementId": "tablet-sample-mass"
            }
          ],
          "stateChanges": [
            "Record starting sample mass: The starting sample mass is recorded."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The starting sample mass is recorded.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "record",
            "measurement"
          ],
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Copy the starting balance reading into the notebook."
          }
        },
        {
          "id": "confirm-tablet-recovery-scope",
          "verb": "observe",
          "label": "Confirm approved recovered fraction",
          "parameters": {
            "tag": "tablet-recovery-scope-approved",
            "note": "Confirm that the supplied beaker contains the teacher-approved recovered fraction for this reusable technique. Its chemical identity remains unassigned.",
            "inputMode": "choice",
            "inputRole": "teacherConfiguration",
            "inputLabel": "Recovered-fraction scope",
            "inputOptions": [
              "Teacher approved recovered fraction"
            ],
            "inputRequired": true,
            "configurationRequired": true,
            "unlocked": false
          },
          "prerequisites": [
            {
              "id": "confirm-tablet-recovery-scope--record-tablet-sample-mass-required",
              "type": "actionEvidence",
              "label": "The starting sample mass is recorded.",
              "actionId": "record-tablet-sample-mass"
            }
          ],
          "stateChanges": [
            "Confirm approved recovered fraction: The teacher-approved recovered-fraction scope is recorded without assigning an identity."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The teacher-approved recovered-fraction scope is recorded without assigning an identity.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "configuration",
            "scope-boundary"
          ],
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "note",
            "accessibleLabel": "Confirm the teacher-approved recovered fraction before setting up filtration."
          }
        },
        {
          "id": "place-tablet-buchner",
          "verb": "place",
          "label": "Place Buchner funnel",
          "parameters": {
            "equipmentDefinitionId": "buchner-funnel",
            "location": "workbench"
          },
          "prerequisites": [
            {
              "id": "place-tablet-buchner--confirm-tablet-recovery-scope-required",
              "type": "actionEvidence",
              "label": "The recovered-fraction scope is approved.",
              "actionId": "confirm-tablet-recovery-scope"
            }
          ],
          "stateChanges": [
            "Place Buchner funnel: The Buchner funnel is on the workbench."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The Buchner funnel is on the workbench.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "place"
          ],
          "atomId": "atom.place.filtration-funnel",
          "equipmentRoleBindings": {
            "filtration-funnel": "buchner-funnel"
          },
          "interaction": {
            "type": "dragToZone",
            "sourceDefinitionId": "buchner-funnel",
            "stationId": "workbench",
            "accessibleLabel": "Place the Buchner funnel on the workbench."
          }
        },
        {
          "id": "seat-tablet-filter-paper",
          "verb": "place",
          "label": "Seat filter paper",
          "parameters": {
            "equipmentDefinitionId": "filter-paper",
            "targetDefinitionId": "buchner-funnel",
            "snapZoneId": "buchner-funnel-paper-seat"
          },
          "prerequisites": [
            {
              "id": "seat-tablet-filter-paper--place-tablet-buchner-required",
              "type": "actionEvidence",
              "label": "The Buchner funnel is placed.",
              "actionId": "place-tablet-buchner"
            }
          ],
          "stateChanges": [
            "Seat filter paper: The filter paper is seated in the funnel."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The filter paper is seated in the funnel.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "place"
          ],
          "atomId": "atom.place.filter-medium",
          "equipmentRoleBindings": {
            "filtration-funnel": "buchner-funnel",
            "filter-medium": "filter-paper"
          },
          "interaction": {
            "type": "snapIntoTarget",
            "sourceDefinitionId": "filter-paper",
            "targetDefinitionId": "buchner-funnel",
            "snapZoneId": "buchner-funnel-paper-seat",
            "accessibleLabel": "Seat the filter paper in the Buchner funnel."
          }
        },
        {
          "id": "attach-tablet-filter-flask",
          "verb": "place",
          "label": "Attach side-arm receiver",
          "parameters": {
            "equipmentDefinitionId": "side-arm-filter-flask",
            "targetDefinitionId": "buchner-funnel",
            "snapZoneId": "buchner-funnel-receiver-neck"
          },
          "prerequisites": [
            {
              "id": "attach-tablet-filter-flask--place-tablet-buchner-required",
              "type": "actionEvidence",
              "label": "The Buchner funnel is placed.",
              "actionId": "place-tablet-buchner"
            }
          ],
          "stateChanges": [
            "Attach side-arm receiver: The side-arm receiver is attached."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The side-arm receiver is attached.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "place"
          ],
          "atomId": "atom.place.filtration-receiver",
          "equipmentRoleBindings": {
            "filtration-receiver": "side-arm-filter-flask"
          },
          "interaction": {
            "type": "snapIntoTarget",
            "sourceDefinitionId": "side-arm-filter-flask",
            "targetDefinitionId": "buchner-funnel",
            "snapZoneId": "buchner-funnel-receiver-neck",
            "accessibleLabel": "Attach the side-arm receiver beneath the Buchner funnel."
          }
        },
        {
          "id": "place-tablet-vacuum",
          "verb": "place",
          "label": "Place vacuum source",
          "parameters": {
            "equipmentDefinitionId": "vacuum-source",
            "location": "workbench"
          },
          "prerequisites": [
            {
              "id": "place-tablet-vacuum--attach-tablet-filter-flask-required",
              "type": "actionEvidence",
              "label": "The side-arm receiver is attached.",
              "actionId": "attach-tablet-filter-flask"
            }
          ],
          "stateChanges": [
            "Place vacuum source: The vacuum source is beside the filter flask."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The vacuum source is beside the filter flask.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "place"
          ],
          "atomId": "atom.place.filtration-vacuum-source",
          "equipmentRoleBindings": {
            "filtration-vacuum-source": "vacuum-source",
            "filtration-receiver": "side-arm-filter-flask"
          },
          "interaction": {
            "type": "dragToZone",
            "sourceDefinitionId": "vacuum-source",
            "stationId": "workbench",
            "accessibleLabel": "Place the vacuum source beside the side-arm flask."
          }
        },
        {
          "id": "wet-tablet-filter-paper",
          "verb": "rinse",
          "label": "Wet and seal filter paper",
          "parameters": {
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "filter-paper",
            "rinseType": "pre-wet",
            "volumeMl": 3,
            "volumeProvenance": "teacher-approved rinse"
          },
          "prerequisites": [
            {
              "id": "wet-tablet-filter-paper--seat-tablet-filter-paper-required",
              "type": "actionEvidence",
              "label": "The filter paper is seated.",
              "actionId": "seat-tablet-filter-paper"
            }
          ],
          "stateChanges": [
            "Wet and seal filter paper: The filter paper is wetted and sealed."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The filter paper is wetted and sealed.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "rinse"
          ],
          "atomId": "atom.rinse.wet-filter-medium",
          "equipmentRoleBindings": {
            "rinse-water-source": "wash-bottle",
            "filter-medium": "filter-paper"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "filter-paper",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Wet the seated paper with the approved rinse liquid."
          }
        },
        {
          "id": "filter-tablet-mixture",
          "verb": "filter",
          "label": "Filter approved recovered fraction",
          "parameters": {
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "buchner-funnel",
            "retainedVisualState": "filter-cake",
            "filtrateVisualState": "clear-filtrate",
            "fractionIdentity": "teacher-approved recovered solid fraction; chemical identity remains unassigned"
          },
          "prerequisites": [
            {
              "id": "filter-tablet-mixture--wet-tablet-filter-paper-required",
              "type": "actionEvidence",
              "label": "The paper is wetted and sealed.",
              "actionId": "wet-tablet-filter-paper"
            },
            {
              "id": "filter-tablet-mixture--place-tablet-vacuum-required",
              "type": "actionEvidence",
              "label": "The vacuum source is placed.",
              "actionId": "place-tablet-vacuum"
            }
          ],
          "stateChanges": [
            "Filter approved recovered fraction: The recovered solid fraction is retained on the filter paper."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The recovered solid fraction is retained on the filter paper.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "filter"
          ],
          "atomId": "atom.filter.pour-through-medium",
          "equipmentRoleBindings": {
            "mixture-source": "beaker-250ml",
            "filtration-funnel": "buchner-funnel"
          },
          "interaction": {
            "type": "pourInto",
            "sourceDefinitionId": "beaker-250ml",
            "targetDefinitionId": "buchner-funnel",
            "accessibleLabel": "Filter the teacher-approved recovered fraction through the prepared apparatus."
          }
        },
        {
          "id": "wash-tablet-residue",
          "verb": "rinse",
          "label": "Wash recovered solid",
          "parameters": {
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "filter-paper",
            "rinseType": "precipitate",
            "volumeMl": 3,
            "volumeProvenance": "teacher-approved rinse"
          },
          "prerequisites": [
            {
              "id": "wash-tablet-residue--filter-tablet-mixture-required",
              "type": "actionEvidence",
              "label": "The recovered fraction has been filtered.",
              "actionId": "filter-tablet-mixture"
            }
          ],
          "stateChanges": [
            "Wash recovered solid: The recovered solid is washed before drying."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The recovered solid is washed before drying.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "rinse"
          ],
          "atomId": "atom.rinse.wash-precipitate",
          "equipmentRoleBindings": {
            "rinse-water-source": "wash-bottle",
            "filter-medium": "filter-paper"
          },
          "interaction": {
            "type": "rinseTarget",
            "sourceDefinitionId": "wash-bottle",
            "targetDefinitionId": "filter-paper",
            "valueParameter": "volumeMl",
            "accessibleLabel": "Wash the recovered solid with the teacher-approved rinse."
          }
        },
        {
          "id": "weigh-tablet-watch-glass-tare",
          "verb": "weigh",
          "label": "Tare recovery watch glass",
          "parameters": {
            "sourceDefinitionId": "watch-glass",
            "sourceInstanceId": "watch-glass-2",
            "targetDefinitionId": "analytical-balance",
            "instrumentDefinitionId": "analytical-balance",
            "tolerance": 0.001,
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputKey": "tablet-watch-glass-mass-input",
            "inputLabel": "Tare recovery watch glass from the configured simulated balance (g)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "g",
            "evidenceProvenance": "learner-entered reading from the configured simulated balance; no expected mass is embedded"
          },
          "prerequisites": [
            {
              "id": "weigh-tablet-watch-glass-tare--wash-tablet-residue-required",
              "type": "actionEvidence",
              "label": "The recovered solid has been washed.",
              "actionId": "wash-tablet-residue"
            }
          ],
          "stateChanges": [
            "Tare recovery watch glass: The balance is tared with the clean, dry recovery watch glass."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The balance is tared with the clean, dry recovery watch glass.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "weigh"
          ],
          "atomId": "atom.weigh.tare-vessel",
          "equipmentRoleBindings": {
            "balance-instrument": "analytical-balance",
            "weighed-vessel": "watch-glass"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "watch-glass",
            "targetDefinitionId": "analytical-balance",
            "stationId": "analytical-balance",
            "valueParameter": "inputKey",
            "accessibleLabel": "Tare the balance with the clean, dry recovery watch glass."
          },
          "mass": {
            "source": "action-input",
            "outputMeasurementId": "tablet-watch-glass-mass"
          }
        },
        {
          "id": "record-tablet-watch-glass-tare",
          "verb": "record",
          "label": "Record recovery watch-glass tare",
          "parameters": {
            "measurementId": "tablet-watch-glass-mass",
            "label": "Recovery watch-glass tare",
            "unit": "g",
            "copyExistingMeasurementOnly": true
          },
          "prerequisites": [
            {
              "id": "record-tablet-watch-glass-tare--tablet-watch-glass-mass-required",
              "type": "measurementRecorded",
              "label": "The recovery watch-glass tare has been read.",
              "measurementId": "tablet-watch-glass-mass"
            }
          ],
          "stateChanges": [
            "Record recovery watch-glass tare: The recovery watch-glass tare is recorded."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The recovery watch-glass tare is recorded.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "record",
            "measurement"
          ],
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Copy the recovery watch-glass tare into the notebook."
          }
        },
        {
          "id": "transfer-tablet-paper-to-watch",
          "verb": "place",
          "label": "Transfer recovered solid to watch glass",
          "parameters": {
            "equipmentDefinitionId": "filter-paper",
            "targetDefinitionId": "watch-glass",
            "targetInstanceId": "watch-glass-2",
            "snapZoneId": "watch-glass-paper-seat",
            "detachBeforeAttach": true
          },
          "prerequisites": [
            {
              "id": "transfer-tablet-paper-to-watch--tablet-watch-glass-mass-required",
              "type": "measurementRecorded",
              "label": "The recovery watch-glass tare is recorded.",
              "measurementId": "tablet-watch-glass-mass"
            }
          ],
          "stateChanges": [
            "Transfer recovered solid to watch glass: The recovered solid and filter paper are on the tared watch glass."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The recovered solid and filter paper are on the tared watch glass.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "place"
          ],
          "atomId": "atom.place.transfer-medium-to-drying-vessel",
          "equipmentRoleBindings": {
            "filter-medium": "filter-paper",
            "dried-assembly": "watch-glass"
          },
          "interaction": {
            "type": "snapIntoTarget",
            "sourceDefinitionId": "filter-paper",
            "targetDefinitionId": "watch-glass",
            "snapZoneId": "watch-glass-paper-seat",
            "accessibleLabel": "Transfer the filter paper and recovered solid to the tared recovery watch glass."
          }
        },
        {
          "id": "dry-tablet-residue",
          "verb": "dry",
          "label": "Dry recovered solid",
          "parameters": {
            "sourceDefinitionId": "watch-glass",
            "sourceInstanceId": "watch-glass-2",
            "targetDefinitionId": "watch-glass",
            "ovenDefinitionId": "drying-oven",
            "precipitateSourceInstanceId": "filter-paper-1",
            "drynessResult": "dry",
            "endpointProvenance": "teacher-approved drying endpoint",
            "dryMassProvenance": "derived from the teacher-configured recovered-fraction profile; not source fact or an authored answer",
            "configurationParameter": "temperatureC",
            "configurationRequired": true,
            "unlocked": false,
            "inputMode": "numeric",
            "inputRole": "teacherConfiguration",
            "inputLabel": "Teacher-approved oven temperature",
            "inputMin": 0,
            "inputMinExclusive": true,
            "inputStep": 1,
            "unit": "C"
          },
          "prerequisites": [
            {
              "id": "dry-tablet-residue--transfer-tablet-paper-to-watch-required",
              "type": "actionEvidence",
              "label": "The recovered solid is on the tared watch glass.",
              "actionId": "transfer-tablet-paper-to-watch"
            }
          ],
          "stateChanges": [
            "Dry recovered solid: The recovered solid reaches the approved dry endpoint."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The recovered solid reaches the approved dry endpoint.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "dry"
          ],
          "atomId": "atom.dry.oven-stage",
          "equipmentRoleBindings": {
            "drying-instrument": "drying-oven",
            "dried-assembly": "watch-glass"
          },
          "interaction": {
            "type": "placeInInstrument",
            "sourceDefinitionId": "watch-glass",
            "targetDefinitionId": "drying-oven",
            "stationId": "drying-oven",
            "accessibleLabel": "Dry the recovered solid to the teacher-approved endpoint."
          }
        },
        {
          "id": "cool-tablet-residue",
          "verb": "cool",
          "label": "Cool recovered solid",
          "parameters": {
            "sourceDefinitionId": "watch-glass",
            "sourceInstanceId": "watch-glass-2",
            "targetDefinitionId": "crucible-tongs",
            "cooledTemperatureC": 25,
            "cooledObjectLabel": "recovery watch-glass assembly"
          },
          "prerequisites": [
            {
              "id": "cool-tablet-residue--dry-tablet-residue-required",
              "type": "actionEvidence",
              "label": "The recovered solid is dry.",
              "actionId": "dry-tablet-residue"
            }
          ],
          "stateChanges": [
            "Cool recovered solid: The recovery assembly is cool enough to weigh."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The recovery assembly is cool enough to weigh.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "cool"
          ],
          "atomId": "atom.cool.before-weighing",
          "equipmentRoleBindings": {
            "dried-assembly": "watch-glass",
            "cooling-tool": "crucible-tongs"
          },
          "interaction": {
            "type": "placeInInstrument",
            "sourceDefinitionId": "watch-glass",
            "targetDefinitionId": "crucible-tongs",
            "stationId": "crucible-tongs",
            "accessibleLabel": "Use heat-safe handling and cool the recovery assembly before weighing."
          }
        },
        {
          "id": "weigh-tablet-residue",
          "verb": "weigh",
          "label": "Read dry recovered mass",
          "parameters": {
            "sourceDefinitionId": "watch-glass",
            "sourceInstanceId": "watch-glass-2",
            "targetDefinitionId": "analytical-balance",
            "instrumentDefinitionId": "analytical-balance",
            "requiresDryPrecipitate": true,
            "maxSafeTemperatureC": 40,
            "tolerance": 0.001,
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputKey": "tablet-residue-mass-input",
            "inputLabel": "Read dry recovered mass from the configured simulated balance (g)",
            "inputRequired": true,
            "inputMin": 0,
            "inputMinExclusive": true,
            "unit": "g",
            "evidenceProvenance": "learner-entered reading from the configured simulated balance; no expected mass is embedded"
          },
          "prerequisites": [
            {
              "id": "weigh-tablet-residue--cool-tablet-residue-required",
              "type": "actionEvidence",
              "label": "The recovery assembly has cooled.",
              "actionId": "cool-tablet-residue"
            },
            {
              "id": "weigh-tablet-residue--tablet-watch-glass-mass-required",
              "type": "measurementRecorded",
              "label": "The recovery watch-glass tare is recorded.",
              "measurementId": "tablet-watch-glass-mass"
            }
          ],
          "stateChanges": [
            "Read dry recovered mass: The tared balance reports the dry recovered mass."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The tared balance reports the dry recovered mass.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "weigh"
          ],
          "atomId": "atom.weigh.dry-assembly",
          "equipmentRoleBindings": {
            "balance-instrument": "analytical-balance",
            "dried-assembly": "watch-glass"
          },
          "interaction": {
            "type": "readInstrument",
            "sourceDefinitionId": "watch-glass",
            "targetDefinitionId": "analytical-balance",
            "stationId": "analytical-balance",
            "valueParameter": "inputKey",
            "accessibleLabel": "Read the dry recovered mass on the tared balance."
          },
          "mass": {
            "source": "action-input",
            "outputMeasurementId": "tablet-residue-mass"
          }
        },
        {
          "id": "record-tablet-residue",
          "verb": "record",
          "label": "Record dry recovered mass",
          "parameters": {
            "measurementId": "tablet-residue-mass",
            "unit": "g",
            "label": "Dry recovered fraction mass",
            "copyExistingMeasurementOnly": true
          },
          "prerequisites": [
            {
              "id": "record-tablet-residue--tablet-residue-mass-required",
              "type": "measurementRecorded",
              "label": "The dry recovered mass has been read.",
              "measurementId": "tablet-residue-mass"
            }
          ],
          "stateChanges": [
            "Record dry recovered mass: The dry recovered fraction mass is recorded."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "The dry recovered fraction mass is recorded.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "record",
            "measurement"
          ],
          "interaction": {
            "type": "recordNotebook",
            "valueParameter": "measurementId",
            "accessibleLabel": "Copy the dry recovered fraction mass into the notebook."
          }
        },
        {
          "id": "calculate-tablet-component",
          "verb": "calculate",
          "label": "Calculate recovered fraction percent",
          "parameters": {
            "calculationId": "tablet-component-percent",
            "template": "componentMassPercent",
            "startingMassMeasurementId": "tablet-sample-mass",
            "componentMassMeasurementId": "tablet-residue-mass",
            "compositionFormulaConfirmation": "component-mass-over-starting-mass",
            "requireStudentValue": true,
            "inputMode": "numeric",
            "inputRole": "studentResponse",
            "inputLabel": "Recovered fraction percent by mass",
            "inputMin": 0,
            "inputMax": 100,
            "inputStep": 0.1,
            "tolerance": 0.5,
            "unit": "%",
            "identityLimit": "This percent describes a recovered fraction. It does not identify a tablet ingredient without independent evidence."
          },
          "prerequisites": [
            {
              "id": "calculate-tablet-component--tablet-sample-mass-required",
              "type": "measurementRecorded",
              "label": "The starting sample mass is recorded.",
              "measurementId": "tablet-sample-mass"
            },
            {
              "id": "calculate-tablet-component--tablet-residue-mass-required",
              "type": "measurementRecorded",
              "label": "The dry recovered mass is recorded.",
              "measurementId": "tablet-residue-mass"
            }
          ],
          "stateChanges": [
            "Calculate recovered fraction percent: Recovered fraction percent is calculated from measured masses."
          ],
          "invalidCases": [
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
          "feedback": {
            "success": "Recovered fraction percent is calculated from measured masses.",
            "invalid": "The simulator could not complete that action. Review the step requirements."
          },
          "evidence": [
            "calculate",
            "measurement-derived",
            "identity-boundary"
          ],
          "interaction": {
            "type": "submitCalculation",
            "valueParameter": "calculationId",
            "accessibleLabel": "Calculate recovered fraction percent from the measured starting and dry recovered masses."
          }
        }
      ],
      "process": {
        "startNodeId": "weigh-tablet-sample-node",
        "nodes": [
          {
            "id": "weigh-tablet-sample-node",
            "type": "action",
            "title": "Read starting mass",
            "description": "Read the starting sample mass on the balance.",
            "actionId": "weigh-tablet-sample",
            "config": {},
            "validation": [
              {
                "id": "weigh-tablet-sample-node--weigh-tablet-sample-node-done",
                "type": "actionEvidence",
                "label": "Action weigh-tablet-sample was completed.",
                "actionId": "weigh-tablet-sample"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read starting mass complete.",
              "retry": "Review Read starting mass and try again."
            }
          },
          {
            "id": "record-tablet-sample-mass-node",
            "type": "observation",
            "title": "Record starting mass",
            "description": "Copy the starting mass into the notebook.",
            "actionId": "record-tablet-sample-mass",
            "config": {},
            "validation": [
              {
                "id": "record-tablet-sample-mass-node--record-tablet-sample-mass-node-done",
                "type": "actionEvidence",
                "label": "Action record-tablet-sample-mass was completed.",
                "actionId": "record-tablet-sample-mass"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record starting mass complete.",
              "retry": "Review Record starting mass and try again."
            }
          },
          {
            "id": "confirm-tablet-recovery-scope-node",
            "type": "teacherNote",
            "title": "Confirm recovery scope",
            "description": "Confirm the supplied beaker is the teacher-approved recovered fraction without assigning it an identity.",
            "actionId": "confirm-tablet-recovery-scope",
            "config": {},
            "validation": [
              {
                "id": "confirm-tablet-recovery-scope-node--confirm-tablet-recovery-scope-node-done",
                "type": "actionEvidence",
                "label": "Action confirm-tablet-recovery-scope was completed.",
                "actionId": "confirm-tablet-recovery-scope"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Confirm recovery scope complete.",
              "retry": "Review Confirm recovery scope and try again."
            }
          },
          {
            "id": "place-tablet-buchner-node",
            "type": "action",
            "title": "Place funnel",
            "description": "Place the Buchner funnel on the workbench.",
            "actionId": "place-tablet-buchner",
            "config": {},
            "validation": [
              {
                "id": "place-tablet-buchner-node--place-tablet-buchner-node-done",
                "type": "actionEvidence",
                "label": "Action place-tablet-buchner was completed.",
                "actionId": "place-tablet-buchner"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Place funnel complete.",
              "retry": "Review Place funnel and try again."
            }
          },
          {
            "id": "seat-tablet-filter-paper-node",
            "type": "action",
            "title": "Seat filter paper",
            "description": "Seat the filter paper in the funnel.",
            "actionId": "seat-tablet-filter-paper",
            "config": {},
            "validation": [
              {
                "id": "seat-tablet-filter-paper-node--seat-tablet-filter-paper-node-done",
                "type": "actionEvidence",
                "label": "Action seat-tablet-filter-paper was completed.",
                "actionId": "seat-tablet-filter-paper"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Seat filter paper complete.",
              "retry": "Review Seat filter paper and try again."
            }
          },
          {
            "id": "attach-tablet-filter-flask-node",
            "type": "action",
            "title": "Attach receiver",
            "description": "Attach the side-arm receiver beneath the funnel.",
            "actionId": "attach-tablet-filter-flask",
            "config": {},
            "validation": [
              {
                "id": "attach-tablet-filter-flask-node--attach-tablet-filter-flask-node-done",
                "type": "actionEvidence",
                "label": "Action attach-tablet-filter-flask was completed.",
                "actionId": "attach-tablet-filter-flask"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Attach receiver complete.",
              "retry": "Review Attach receiver and try again."
            }
          },
          {
            "id": "place-tablet-vacuum-node",
            "type": "action",
            "title": "Place vacuum source",
            "description": "Place the vacuum source beside the receiver.",
            "actionId": "place-tablet-vacuum",
            "config": {},
            "validation": [
              {
                "id": "place-tablet-vacuum-node--place-tablet-vacuum-node-done",
                "type": "actionEvidence",
                "label": "Action place-tablet-vacuum was completed.",
                "actionId": "place-tablet-vacuum"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Place vacuum source complete.",
              "retry": "Review Place vacuum source and try again."
            }
          },
          {
            "id": "wet-tablet-filter-paper-node",
            "type": "action",
            "title": "Wet filter paper",
            "description": "Wet and seal the seated filter paper.",
            "actionId": "wet-tablet-filter-paper",
            "config": {},
            "validation": [
              {
                "id": "wet-tablet-filter-paper-node--wet-tablet-filter-paper-node-done",
                "type": "actionEvidence",
                "label": "Action wet-tablet-filter-paper was completed.",
                "actionId": "wet-tablet-filter-paper"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Wet filter paper complete.",
              "retry": "Review Wet filter paper and try again."
            }
          },
          {
            "id": "filter-tablet-mixture-node",
            "type": "action",
            "title": "Filter recovered fraction",
            "description": "Filter the teacher-approved recovered fraction.",
            "actionId": "filter-tablet-mixture",
            "config": {},
            "validation": [
              {
                "id": "filter-tablet-mixture-node--filter-tablet-mixture-node-done",
                "type": "actionEvidence",
                "label": "Action filter-tablet-mixture was completed.",
                "actionId": "filter-tablet-mixture"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Filter recovered fraction complete.",
              "retry": "Review Filter recovered fraction and try again."
            }
          },
          {
            "id": "wash-tablet-residue-node",
            "type": "action",
            "title": "Wash recovered solid",
            "description": "Wash the recovered solid with the teacher-approved rinse.",
            "actionId": "wash-tablet-residue",
            "config": {},
            "validation": [
              {
                "id": "wash-tablet-residue-node--wash-tablet-residue-node-done",
                "type": "actionEvidence",
                "label": "Action wash-tablet-residue was completed.",
                "actionId": "wash-tablet-residue"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Wash recovered solid complete.",
              "retry": "Review Wash recovered solid and try again."
            }
          },
          {
            "id": "weigh-tablet-watch-glass-tare-node",
            "type": "action",
            "title": "Tare recovery vessel",
            "description": "Tare the balance with the clean, dry recovery watch glass.",
            "actionId": "weigh-tablet-watch-glass-tare",
            "config": {},
            "validation": [
              {
                "id": "weigh-tablet-watch-glass-tare-node--weigh-tablet-watch-glass-tare-node-done",
                "type": "actionEvidence",
                "label": "Action weigh-tablet-watch-glass-tare was completed.",
                "actionId": "weigh-tablet-watch-glass-tare"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Tare recovery vessel complete.",
              "retry": "Review Tare recovery vessel and try again."
            }
          },
          {
            "id": "record-tablet-watch-glass-tare-node",
            "type": "observation",
            "title": "Record recovery tare",
            "description": "Copy the recovery watch-glass tare into the notebook.",
            "actionId": "record-tablet-watch-glass-tare",
            "config": {},
            "validation": [
              {
                "id": "record-tablet-watch-glass-tare-node--record-tablet-watch-glass-tare-node-done",
                "type": "actionEvidence",
                "label": "Action record-tablet-watch-glass-tare was completed.",
                "actionId": "record-tablet-watch-glass-tare"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record recovery tare complete.",
              "retry": "Review Record recovery tare and try again."
            }
          },
          {
            "id": "transfer-tablet-paper-to-watch-node",
            "type": "action",
            "title": "Transfer recovered solid",
            "description": "Move the filter paper and recovered solid to the tared watch glass.",
            "actionId": "transfer-tablet-paper-to-watch",
            "config": {},
            "validation": [
              {
                "id": "transfer-tablet-paper-to-watch-node--transfer-tablet-paper-to-watch-node-done",
                "type": "actionEvidence",
                "label": "Action transfer-tablet-paper-to-watch was completed.",
                "actionId": "transfer-tablet-paper-to-watch"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Transfer recovered solid complete.",
              "retry": "Review Transfer recovered solid and try again."
            }
          },
          {
            "id": "dry-tablet-residue-node",
            "type": "action",
            "title": "Dry recovered solid",
            "description": "Dry the recovered solid to the teacher-approved endpoint.",
            "actionId": "dry-tablet-residue",
            "config": {},
            "validation": [
              {
                "id": "dry-tablet-residue-node--dry-tablet-residue-node-done",
                "type": "actionEvidence",
                "label": "Action dry-tablet-residue was completed.",
                "actionId": "dry-tablet-residue"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Dry recovered solid complete.",
              "retry": "Review Dry recovered solid and try again."
            }
          },
          {
            "id": "cool-tablet-residue-node",
            "type": "action",
            "title": "Cool recovered solid",
            "description": "Cool the recovery assembly before weighing.",
            "actionId": "cool-tablet-residue",
            "config": {},
            "validation": [
              {
                "id": "cool-tablet-residue-node--cool-tablet-residue-node-done",
                "type": "actionEvidence",
                "label": "Action cool-tablet-residue was completed.",
                "actionId": "cool-tablet-residue"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Cool recovered solid complete.",
              "retry": "Review Cool recovered solid and try again."
            }
          },
          {
            "id": "weigh-tablet-residue-node",
            "type": "observation",
            "title": "Read dry recovered mass",
            "description": "Read the dry recovered fraction mass on the tared balance.",
            "actionId": "weigh-tablet-residue",
            "config": {},
            "validation": [
              {
                "id": "weigh-tablet-residue-node--weigh-tablet-residue-node-done",
                "type": "actionEvidence",
                "label": "Action weigh-tablet-residue was completed.",
                "actionId": "weigh-tablet-residue"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Read dry recovered mass complete.",
              "retry": "Review Read dry recovered mass and try again."
            }
          },
          {
            "id": "record-tablet-residue-node",
            "type": "observation",
            "title": "Record dry recovered mass",
            "description": "Copy the dry recovered fraction mass into the notebook.",
            "actionId": "record-tablet-residue",
            "config": {},
            "validation": [
              {
                "id": "record-tablet-residue-node--record-tablet-residue-node-done",
                "type": "actionEvidence",
                "label": "Action record-tablet-residue was completed.",
                "actionId": "record-tablet-residue"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Record dry recovered mass complete.",
              "retry": "Review Record dry recovered mass and try again."
            }
          },
          {
            "id": "calculate-tablet-component-node",
            "type": "calculation",
            "title": "Calculate recovered percent",
            "description": "Calculate recovered fraction percent from measured masses.",
            "actionId": "calculate-tablet-component",
            "config": {},
            "validation": [
              {
                "id": "calculate-tablet-component-node--calculate-tablet-component-node-done",
                "type": "actionEvidence",
                "label": "Action calculate-tablet-component was completed.",
                "actionId": "calculate-tablet-component"
              }
            ],
            "hints": [],
            "feedback": {
              "success": "Calculate recovered percent complete.",
              "retry": "Review Calculate recovered percent and try again."
            }
          }
        ],
        "edges": [
          {
            "from": "weigh-tablet-sample-node",
            "to": "record-tablet-sample-mass-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-tablet-sample-mass-node",
            "to": "confirm-tablet-recovery-scope-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "confirm-tablet-recovery-scope-node",
            "to": "place-tablet-buchner-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "place-tablet-buchner-node",
            "to": "seat-tablet-filter-paper-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "seat-tablet-filter-paper-node",
            "to": "attach-tablet-filter-flask-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "attach-tablet-filter-flask-node",
            "to": "place-tablet-vacuum-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "place-tablet-vacuum-node",
            "to": "wet-tablet-filter-paper-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "wet-tablet-filter-paper-node",
            "to": "filter-tablet-mixture-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "filter-tablet-mixture-node",
            "to": "wash-tablet-residue-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "wash-tablet-residue-node",
            "to": "weigh-tablet-watch-glass-tare-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "weigh-tablet-watch-glass-tare-node",
            "to": "record-tablet-watch-glass-tare-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-tablet-watch-glass-tare-node",
            "to": "transfer-tablet-paper-to-watch-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "transfer-tablet-paper-to-watch-node",
            "to": "dry-tablet-residue-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "dry-tablet-residue-node",
            "to": "cool-tablet-residue-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "cool-tablet-residue-node",
            "to": "weigh-tablet-residue-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "weigh-tablet-residue-node",
            "to": "record-tablet-residue-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          },
          {
            "from": "record-tablet-residue-node",
            "to": "calculate-tablet-component-node",
            "label": "Next",
            "condition": {
              "type": "validationPassed"
            }
          }
        ]
      },
      "successCriteria": [
        {
          "id": "weigh-tablet-sample-node-success",
          "type": "actionEvidence",
          "label": "Action weigh-tablet-sample was completed.",
          "actionId": "weigh-tablet-sample"
        },
        {
          "id": "record-tablet-sample-mass-node-success",
          "type": "actionEvidence",
          "label": "Action record-tablet-sample-mass was completed.",
          "actionId": "record-tablet-sample-mass"
        },
        {
          "id": "confirm-tablet-recovery-scope-node-success",
          "type": "actionEvidence",
          "label": "Action confirm-tablet-recovery-scope was completed.",
          "actionId": "confirm-tablet-recovery-scope"
        },
        {
          "id": "place-tablet-buchner-node-success",
          "type": "actionEvidence",
          "label": "Action place-tablet-buchner was completed.",
          "actionId": "place-tablet-buchner"
        },
        {
          "id": "seat-tablet-filter-paper-node-success",
          "type": "actionEvidence",
          "label": "Action seat-tablet-filter-paper was completed.",
          "actionId": "seat-tablet-filter-paper"
        },
        {
          "id": "attach-tablet-filter-flask-node-success",
          "type": "actionEvidence",
          "label": "Action attach-tablet-filter-flask was completed.",
          "actionId": "attach-tablet-filter-flask"
        },
        {
          "id": "place-tablet-vacuum-node-success",
          "type": "actionEvidence",
          "label": "Action place-tablet-vacuum was completed.",
          "actionId": "place-tablet-vacuum"
        },
        {
          "id": "wet-tablet-filter-paper-node-success",
          "type": "actionEvidence",
          "label": "Action wet-tablet-filter-paper was completed.",
          "actionId": "wet-tablet-filter-paper"
        },
        {
          "id": "filter-tablet-mixture-node-success",
          "type": "actionEvidence",
          "label": "Action filter-tablet-mixture was completed.",
          "actionId": "filter-tablet-mixture"
        },
        {
          "id": "wash-tablet-residue-node-success",
          "type": "actionEvidence",
          "label": "Action wash-tablet-residue was completed.",
          "actionId": "wash-tablet-residue"
        },
        {
          "id": "weigh-tablet-watch-glass-tare-node-success",
          "type": "actionEvidence",
          "label": "Action weigh-tablet-watch-glass-tare was completed.",
          "actionId": "weigh-tablet-watch-glass-tare"
        },
        {
          "id": "record-tablet-watch-glass-tare-node-success",
          "type": "actionEvidence",
          "label": "Action record-tablet-watch-glass-tare was completed.",
          "actionId": "record-tablet-watch-glass-tare"
        },
        {
          "id": "transfer-tablet-paper-to-watch-node-success",
          "type": "actionEvidence",
          "label": "Action transfer-tablet-paper-to-watch was completed.",
          "actionId": "transfer-tablet-paper-to-watch"
        },
        {
          "id": "dry-tablet-residue-node-success",
          "type": "actionEvidence",
          "label": "Action dry-tablet-residue was completed.",
          "actionId": "dry-tablet-residue"
        },
        {
          "id": "cool-tablet-residue-node-success",
          "type": "actionEvidence",
          "label": "Action cool-tablet-residue was completed.",
          "actionId": "cool-tablet-residue"
        },
        {
          "id": "weigh-tablet-residue-node-success",
          "type": "actionEvidence",
          "label": "Action weigh-tablet-residue was completed.",
          "actionId": "weigh-tablet-residue"
        },
        {
          "id": "record-tablet-residue-node-success",
          "type": "actionEvidence",
          "label": "Action record-tablet-residue was completed.",
          "actionId": "record-tablet-residue"
        },
        {
          "id": "calculate-tablet-component-node-success",
          "type": "actionEvidence",
          "label": "Action calculate-tablet-component was completed.",
          "actionId": "calculate-tablet-component"
        }
      ],
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
        "version": "1.1.0",
        "author": "Lab Studio",
        "updatedAt": "2026-09-04T00:00:00.000Z",
        "tags": [
          "technique",
          "chemistry",
          "separation",
          "tablet"
        ]
      },
      "composition": {
        "schemaVersion": 1,
        "ports": [
          {
            "id": "entry-weigh-tablet-sample-node",
            "kind": "entry",
            "nodeId": "weigh-tablet-sample-node",
            "label": "Entry"
          },
          {
            "id": "exit-calculate-tablet-component-node",
            "kind": "exit",
            "nodeId": "calculate-tablet-component-node",
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
            "sourceInstanceIds": []
          },
          {
            "roleId": "weighed-vessel",
            "required": true,
            "allowedDefinitionIds": [
              "watch-glass"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "filtration-funnel",
            "required": true,
            "allowedDefinitionIds": [
              "buchner-funnel"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "filter-medium",
            "required": true,
            "allowedDefinitionIds": [
              "filter-paper"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "filtration-receiver",
            "required": true,
            "allowedDefinitionIds": [
              "side-arm-filter-flask"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "filtration-vacuum-source",
            "required": true,
            "allowedDefinitionIds": [
              "vacuum-source"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "rinse-water-source",
            "required": true,
            "allowedDefinitionIds": [
              "wash-bottle"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "mixture-source",
            "required": true,
            "allowedDefinitionIds": [
              "beaker-250ml"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "dried-assembly",
            "required": true,
            "allowedDefinitionIds": [
              "watch-glass"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "drying-instrument",
            "required": true,
            "allowedDefinitionIds": [
              "drying-oven"
            ],
            "sourceInstanceIds": []
          },
          {
            "roleId": "cooling-tool",
            "required": true,
            "allowedDefinitionIds": [
              "crucible-tongs"
            ],
            "sourceInstanceIds": []
          }
        ],
        "modelSlots": [],
        "configurationSlots": [],
        "approvalGates": [],
        "variants": [],
        "evidenceOutputs": [],
        "completion": {
          "exitPortIds": [
            "exit-calculate-tablet-component-node"
          ],
          "requiredEvidenceOutputIds": [],
          "requiredValidationRuleIds": []
        },
        "catalogDisposition": "composable",
        "legacyActionEffects": [
          {
            "actionId": "record-tablet-sample-mass",
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
            "actionId": "confirm-tablet-recovery-scope",
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
            "actionId": "record-tablet-watch-glass-tare",
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
            "actionId": "record-tablet-residue",
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
            "actionId": "calculate-tablet-component",
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
  ]
]);

export const refineGravimetrySeparationDefinition = (definition) => {
  const next = applyStockSupplyVolumes(structuredClone(definitions.get(definition.id) ?? definition));
  if (next.id === "quick-ache-extraction-recovery") {
    next.metadata = {
      ...next.metadata,
      version: "1.3.1",
      updatedAt: "2026-09-12T00:00:00.000Z",
    };
    const actions = next.actions;
    const isLayerInspection = (id) => id === "qar-inspect-separated-layers" || /^plan-wash-[2-5]-qar-inspect-separated-layers$/.test(id);
    const isLayerIdentification = (id) => id === "qar-identify-layer-from-evidence" || /^plan-wash-[2-5]-qar-identify-layer-from-evidence$/.test(id);
    const isRecoveryPh = (id) => id === "qar-read-recovery-ph" || id === "plan-gravity-qar-read-recovery-ph";
    if (!next.composition.equipmentRoles.some((role) => role.roleId === "immersed-probe-vessel")) {
      next.composition.equipmentRoles.push({
        roleId: "immersed-probe-vessel",
        required: true,
        allowedDefinitionIds: ["erlenmeyer-flask-250ml"],
        sourceInstanceIds: ["qar-aqueous-fraction-flask"],
      });
    }
    for (const action of actions) {
      if (isLayerInspection(action.id)) {
        action.atomId = "atom.observe.extraction-layer-state";
        action.equipmentRoleBindings = { ...(action.equipmentRoleBindings ?? {}), "extraction-funnel": "separatory-funnel" };
        action.evidence = [...new Set([...(action.evidence ?? []), "settled-layer-observation"])];
      } else if (isLayerIdentification(action.id)) {
        action.atomId = "atom.observe.identify-extraction-layers-from-evidence";
        action.equipmentRoleBindings = { ...(action.equipmentRoleBindings ?? {}), "extraction-funnel": "separatory-funnel" };
        action.evidence = [...new Set([...(action.evidence ?? []), "density-supported-layer-identification"])];
      } else if (isRecoveryPh(action.id)) {
        action.atomId = "atom.observe.read-recovery-ph";
        action.equipmentRoleBindings = {
          ...(action.equipmentRoleBindings ?? {}),
          "recovery-vessel": "erlenmeyer-flask-250ml",
          "immersed-probe-instrument": "ph-meter",
          "immersed-probe-vessel": "erlenmeyer-flask-250ml",
        };
        action.evidence = [...new Set([...(action.evidence ?? []), "recovery-ph-reading"])];
      }
    }
    const atomBackedObservationActionIds = new Set(
      actions
        .filter((action) =>
          (isLayerInspection(action.id) || isLayerIdentification(action.id) || isRecoveryPh(action.id)) &&
          Boolean(action.atomId),
        )
        .map((action) => action.id),
    );
    next.composition.legacyActionEffects = next.composition.legacyActionEffects.filter(
      (entry) => !atomBackedObservationActionIds.has(entry.actionId),
    );
    const massContracts = new Map([
      ["qar-weigh-filter-paper-tare", "qar-filter-paper-mass"],
      ["plan-gravity-qar-weigh-filter-paper-tare", "qar-filter-paper-mass"],
      ["qar-weigh-acidic-watch-glass-tare", "qar-acidic-recovery-watch-glass-mass"],
      ["plan-gravity-qar-weigh-acidic-watch-glass-tare", "qar-acidic-recovery-watch-glass-mass"],
      ["qar-weigh-acidic-solid", "qar-recovered-acidic-component-mass"],
      ["plan-gravity-qar-weigh-acidic-solid", "qar-recovered-acidic-component-mass"],
      ["qar-weigh-aqueous-watch-glass-tare", "qar-aqueous-recovery-watch-glass-mass"],
      ["plan-gravity-qar-weigh-aqueous-watch-glass-tare", "qar-aqueous-recovery-watch-glass-mass"],
      ["qar-weigh-aqueous-solid", "qar-recovered-aqueous-component-mass"],
      ["plan-gravity-qar-weigh-aqueous-solid", "qar-recovered-aqueous-component-mass"],
    ]);
    for (const [actionId, outputMeasurementId] of massContracts) {
      const action = actions.find((candidate) => candidate.id === actionId);
      if (!action) throw new Error(`Expected Quick Ache mass action ${actionId} is missing.`);
      delete action.parameters.configurationRequired;
      delete action.parameters.unlocked;
      delete action.parameters.sourceConfigurationBlock;
      // The typed mass contract is the sole measurement producer.  The legacy
      // parameter name would make the same action emit that identifier twice
      // after the selected procedure is materialized.
      delete action.parameters.measurementId;
      action.prerequisites = (action.prerequisites ?? []).filter((rule) =>
        !(rule.type === "statePath" && rule.path === "unsupportedMassOutputBindingApproved"));
      action.mass = {
        source: "action-input",
        outputMeasurementId,
        continuity: {
          version: 1,
          quantityKind: "balance-display",
          measuredSupportInstanceId: action.parameters.sourceInstanceId,
        },
      };
    }
    return next;
  }
  if (next.id === "quick-ache-property-evidence") {
    next.metadata = {
      ...next.metadata,
      version: "1.2.1",
      updatedAt: "2026-09-12T00:00:00.000Z",
    };
    for (const action of next.actions) {
      if (!/^qar-inspect-(?:sucrose|acetaminophen|aspirin)-property-result$/.test(action.id)) continue;
      const inputKey = `${action.id}-input`;
      action.atomId = "atom.observe.record-property-test-result";
      action.equipmentRoleBindings = { "bonding-test-vessel": "test-tube" };
      action.parameters = {
        ...(action.parameters ?? {}),
        inputMode: "text",
        inputRole: "studentResponse",
        inputKey,
        inputLabel: "Directly observed property-test result",
        inputRequired: true,
      };
      delete action.parameters.measurementId;
      action.interaction = {
        type: "recordNotebook",
        sourceDefinitionId: "test-tube",
        valueParameter: "inputKey",
        accessibleLabel: action.label,
      };
      action.evidence = [...new Set([...(action.evidence ?? []), "direct-visual-observation", "property-test-result"])];
    }
    const atomBackedPropertyActionIds = new Set(
      next.actions
        .filter((action) =>
          /^qar-inspect-(?:sucrose|acetaminophen|aspirin)-property-result$/.test(action.id) &&
          action.atomId === "atom.observe.record-property-test-result"
        )
        .map((action) => action.id),
    );
    next.composition.legacyActionEffects = next.composition.legacyActionEffects.filter(
      (entry) => !atomBackedPropertyActionIds.has(entry.actionId),
    );
    return next;
  }
  if (next.id !== "tablet-separation") return next;
  const contracts = new Map([
    ["weigh-tablet-sample", ["tablet-sample-mass", "watch-glass-1"]],
    ["weigh-tablet-watch-glass-tare", ["tablet-watch-glass-mass", "watch-glass-2"]],
    ["weigh-tablet-residue", ["tablet-residue-mass", "watch-glass-2"]],
  ]);
  for (const [actionId, [outputMeasurementId, measuredSupportInstanceId]] of contracts) {
    const action = next.actions.find((candidate) => candidate.id === actionId);
    if (!action) throw new Error(`Expected tablet balance action ${actionId} is missing.`);
    action.mass = {
      source: "action-input",
      outputMeasurementId,
      continuity: {
        version: 1,
        quantityKind: "balance-display",
        measuredSupportInstanceId,
      },
    };
  }
  return next;
};
