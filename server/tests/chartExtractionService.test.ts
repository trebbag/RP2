import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { extractStructuredChart } from "../src/services/chartExtractionService.js"

test("extractStructuredChart normalizes meds, vitals, and labs from text chart", async () => {
  const fixturePath = path.resolve(os.tmpdir(), `rp2-chart-${Date.now()}.txt`)
  await fs.writeFile(
    fixturePath,
    [
      "Medications: Aspirin 81mg; Metformin 500mg",
      "Allergies: Penicillin",
      "PMH: Hypertension, Diabetes",
      "BP: 130/82",
      "HR: 74",
      "Temp: 98.6 F",
      "Lab: A1c=7.1 % H"
    ].join("\n"),
    "utf8"
  )

  const extracted = await extractStructuredChart({
    filePath: fixturePath,
    fileName: "fixture.txt",
    mimeType: "text/plain",
    patientId: "PAT-123",
    encounterId: "ENC-123"
  })

  await fs.rm(fixturePath, { force: true })

  assert.equal(extracted.extractedJson.medications.includes("Aspirin 81mg"), true)
  assert.equal(extracted.extractedJson.vitals.bpSystolic, 130)
  assert.equal(extracted.extractedJson.vitals.bpDiastolic, 82)
  assert.equal(extracted.extractedJson.labs.length > 0, true)
})
