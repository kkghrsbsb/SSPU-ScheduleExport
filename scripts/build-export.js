"use strict";

var fs = require("fs");
var path = require("path");

var renderTemplate = require("../src/sspu/template-render");
var parseOriginal = require("../src/sspu/parse-original");

function readOptional(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, "utf8");
}

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function stripBom(text) {
  if (!text) {
    return text;
  }
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

var root = path.resolve(__dirname, "..");
var templatePath = path.join(root, "src", "sspu", "template.html");
var runtimePath = path.join(root, "src", "sspu", "template-runtime.js");
var themePath = path.join(root, "src", "themes", "midnight-ink.css");
var originalPath = path.join(root, "src", "original", "schedule.html");
var outDir = path.join(root, "dist");
var outPath = path.join(outDir, "schedule.html");

var template = stripBom(readFile(templatePath));
var runtime = stripBom(readFile(runtimePath));
var css = stripBom(readFile(themePath));

var originalHtml = readOptional(originalPath);
var data = parseOriginal(originalHtml);
if (!data) {
  data = require("../src/sspu/template-data");
}

var html = renderTemplate({
  template: template,
  runtime: runtime,
  css: css,
  data: data,
});

ensureDir(outDir);
fs.writeFileSync(outPath, html, "utf8");

console.log("Generated:", outPath);
