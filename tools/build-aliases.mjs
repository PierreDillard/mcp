import fs from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";

// ---- Helpers ----
const norm = s =>
  s.toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

const tokenize = name =>
  norm(name).split(/[-_]+/).filter(Boolean);

// Ajoute sans doublon
const add = (arr, ...vals) => {
  for (const v of vals) if (v && !arr.includes(v)) arr.push(v);
  return arr;
};

// ---- Règles d'alias très simples (KISS) ----
// On ne cherche pas l'exhaustivité, juste des grands thèmes utiles.
function deriveAliases(name) {
  const n = norm(name);
  const t = tokenize(name);
  const tags = [];

  // Grands thèmes par présence de mots dans le nom
  if (n.includes("mp4box-")) add(tags, "mp4box", "isobmff");
  if (t.includes("bifs") || t.includes("laser") || t.includes("x3d")) add(tags, "bifs", "scene");
  if (t.includes("compositor") || t.includes("vout") || t.includes("graphics") || t.includes("thumbs")) add(tags, "render");

  // DASH / CMAF
  if (t.includes("dash")) add(tags, "dash");
  if (t.includes("cmaf")) add(tags, "dash", "cmaf");
  if (t.includes("timeline") || t.includes("template") || t.includes("sidx") || t.includes("ssix") || t.includes("srd")) add(tags, "dash-features");

  // HLS
  if (t.includes("hls") || t.includes("llhls")) add(tags, "hls");
  if (t.includes("saes")) add(tags, "hls", "encryption");

  // Encryption / DRM / CENC
  if (t.includes("cenc") || t.includes("encryption") || t.includes("crypt") || t.includes("pssh") || t.includes("selkey") || t.includes("xps") || n.includes("iff_crypt"))
    add(tags, "encryption", "cenc");

  // Protocoles / I/O
  if (t.includes("rtp")) add(tags, "rtp");
  if (t.includes("rtsp")) add(tags, "rtsp");
  if (t.includes("http") || n.includes("out_http")) add(tags, "http");
  if (t.includes("socket") || t.includes("pipe")) add(tags, "io");

  // Transport MPEG-TS/PS/ROUTE
  if (t.includes("mpeg2ts") || t.includes("tsmux") || t.includes("route")) add(tags, "mpeg-ts");
  if (t.includes("mpeg2ps")) add(tags, "mpeg-ps");

  // Codecs / formats image/vidéo
  if (t.includes("hevc") || n.includes("hevcsplit") || n.includes("hevc-tiles") || t.includes("dovi") || n.includes("dolby_vision"))
    add(tags, "hevc");
  if (t.includes("heif")) add(tags, "heif");
  if (t.includes("qt") || t.includes("qtvr") || t.includes("prores")) add(tags, "quicktime");

  // FFmpeg bridges
  if (t.some(x => x.startsWith("ff"))) add(tags, "ffmpeg");

  // Sous-titres / captions / texte
  if (t.includes("ttml") || t.includes("vtt") || t.includes("stl") || n.includes("rawsubs") || t.includes("subtitle") || t.includes("vobsub") || t.includes("ttxtdec") || t.includes("txtgen") || t.includes("txtconv") || t.includes("cc708"))
    add(tags, "subtitles");

  // Inspection / analyse
  if (n.includes("inspect") || n.includes("analyze") || n.includes("graphics_dump")) add(tags, "inspect");

  // Divers utiles
  if (t.includes("mux") || t.includes("demux") || t.includes("reframers")) add(tags, "muxing");
  if (t.includes("cues") || t.includes("cue") || t.includes("chap")) add(tags, "metadata");
  if (t.includes("yuv4mpeg") || t.includes("raw-video") || t.includes("raw-audio")) add(tags, "raw");
  if (t.includes("jsfilter")) add(tags, "quickjs");
  if (t.includes("python") || t.includes("node")) add(tags, "bindings");
  if (t.includes("svg") || t.includes("swf") || t.includes("x3d")) add(tags, "vector-graphics");
  if (t.includes("filelist") || t.includes("netcap")) add(tags, "utils");

  // Petits raffinements par tokens spécifiques
  if (t.includes("cues") || t.includes("id3")) add(tags, "id3");

  // S'il n'y a rien, mettre un "misc" pour ne pas laisser vide
  if (tags.length === 0) add(tags, "misc");

  return tags;
}

// ---- Extract keywords from XML ----
async function extractXmlKeywords(xmlPath) {
  const xmlContent = await fs.readFile(xmlPath, "utf-8");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    textNodeName: "_text"
  });

  const result = parser.parse(xmlContent);
  const tests = Array.isArray(result.TestSuiteDescription?.Test)
    ? result.TestSuiteDescription.Test
    : (result.TestSuiteDescription?.Test ? [result.TestSuiteDescription.Test] : []);

  // Map: filename -> Set<keywords>
  const fileToKeywords = new Map();

  for (const test of tests) {
    const fileName = test.file?.replace(/\.sh$/, "") || "";
    if (!fileName) continue;

    if (!fileToKeywords.has(fileName)) {
      fileToKeywords.set(fileName, new Set());
    }
    const kwSet = fileToKeywords.get(fileName);

    // Add tokens from test name itself (général)
    const testNameTokens = tokenize(test.name || "");
    testNameTokens.forEach(token => kwSet.add(token));

    // Collect keywords from subtests
    const subtests = Array.isArray(test.Subtest)
      ? test.Subtest
      : (test.Subtest ? [test.Subtest] : []);

    for (const subtest of subtests) {
      // Add keywords attribute
      if (subtest.keywords) {
        const keywords = subtest.keywords.split(/\s+/).filter(Boolean);
        keywords.forEach(kw => kwSet.add(kw));
      }

      // Add tokens from subtest name (pour plus d'information)
      if (subtest.name) {
        const subtestTokens = tokenize(subtest.name);
        subtestTokens.forEach(token => kwSet.add(token));
      }
    }
  }

  // Convert Set to Array and normalize
  const result_map = {};
  for (const [file, kwSet] of fileToKeywords.entries()) {
    result_map[file] = [...kwSet].map(kw => norm(kw));
  }

  return result_map;
}

// ---- Main ----
const IN = "test name.txt";
const XML_PATH = "all_tests_descriptions.xml";
const OUT = "aliases.json";

// 1. Extract keywords from XML
console.log(`Reading XML keywords from ${XML_PATH}...`);
const xmlKeywords = await extractXmlKeywords(XML_PATH);
console.log(`Extracted keywords for ${Object.keys(xmlKeywords).length} test files.`);

// 2. Read test names
const raw = await fs.readFile(IN, "utf8");
const names = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

// 3. Build aliases: derived tags + XML keywords (deduplicated)
const aliases = {};
for (const name of names) {
  const derivedTags = deriveAliases(name);
  const xmlTags = xmlKeywords[name] || [];

  // Merge and deduplicate (normalize all for consistency)
  const allTags = [...new Set([...derivedTags, ...xmlTags])];

  aliases[name] = allTags;
}

await fs.writeFile(OUT, JSON.stringify(aliases, null, 2) + "\n", "utf8");
console.log(`✅ Wrote ${OUT} with ${names.length} entries (enriched with XML keywords + test/subtest names).`);
