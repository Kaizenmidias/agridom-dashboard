const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Google Maps separa termo e localização e exige os campos na interface", () => {
  const page = read("../src/pages/commercial/ProspectingPage.tsx");
  assert.match(page, /O que deseja encontrar\?/);
  assert.match(page, /Onde deseja buscar\?/);
  assert.match(page, /locationQuery/);
  assert.match(page, /!locationQuery\.trim\(\)/);
  assert.match(page, /payload\.source === "google_maps"/);
  assert.match(page, /destinationFolderId == null/);
});

test("jobs antigos sem locationQuery continuam com fallback seguro no histórico", () => {
  const page = read("../src/pages/commercial/ProspectingPage.tsx");
  assert.match(page, /ProspectingHistory/);
  assert.doesNotMatch(page, /searchParameters\.locationQuery\!/);
});

test("CNPJ e Instagram continuam sem locationQuery", () => {
  const page = read("../src/pages/commercial/ProspectingPage.tsx");
  const cnpjSection = page.slice(page.indexOf("function CnpjSearchForm"), page.indexOf("function InstagramSearchForm"));
  const instagramSection = page.slice(page.indexOf("function InstagramSearchForm"), page.indexOf("function ProspectingJobProgress"));
  assert.doesNotMatch(cnpjSection, /locationQuery/);
  assert.doesNotMatch(instagramSection, /locationQuery/);
});
