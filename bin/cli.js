#!/usr/bin/env node

const yargs = require("yargs");
const fs = require("fs");
const path = require("path");
const pdf2img = require("pdf-img-convert");
const jimp = require("jimp");
const imgToPDF = require("image-to-pdf");
const pdfLib = require("pdf-lib");
const { PDFDocument, degrees } = pdfLib;
const DocxMerger = require("docx-merger");

const optionsArgument = yargs
  .usage("Usage: pdf-tools [options]")
  .option("s", {
    alias: "source",
    describe: "Lokasi file atau folder PDF",
    type: "String",
    demandOption: true,
  })
  .option("d", {
    alias: "depth",
    describe: "Kedalaman pencarian ke subfolder",
    type: "number",
    demandOption: false,
  })
  .option("t", {
    alias: "type",
    describe: "Jenis output, pilihan : greyscale,nonocr,mergeword",
    type: "String",
    demandOption: true,
  }).argv;

function searchPdfFile(folderPath, currentDepth, depth, extension = ".pdf") {
  let files = [];
  if (fs.statSync(folderPath).isFile()) {
    files.push(folderPath);
    return files;
  } else {
    if (typeof depth != "undefined" && currentDepth == depth) return [];

    let readFiles = fs.readdirSync(folderPath);
    readFiles.forEach((item) => {
      let ext = path.extname(item);
      if (ext.toLowerCase() == extension) {
        files.push(path.join(folderPath, item));
      } else if (ext == "") {
        files = files.concat(
          searchPdfFile(path.join(folderPath, item), currentDepth + 1, depth)
        );
      }
    });
    return files;
  }
}

async function pdfToImage(pdfPath, suffix = "") {
  let basedir = path.dirname(pdfPath);
  let filename = path.basename(pdfPath, path.extname(pdfPath));
  let outputPath = path.join(basedir, filename + suffix);
  if (fs.existsSync(outputPath)) {
    fs.rmSync(outputPath, {
      recursive: true,
      force: true,
    });
  }
  fs.mkdirSync(outputPath);
  let outputImages = await pdf2img.convert(pdfPath, { scale: 2.0 });
  outputImages.forEach((val, ind) => {
    fs.writeFileSync(path.join(outputPath, `${ind}.png`), val);
  });
  return outputPath;
}

async function imageToGreyscale(imagePath) {
  let readFiles = fs.readdirSync(imagePath);
  let outputPath = imagePath + "_grayscale";
  if (fs.existsSync(outputPath)) {
    fs.rmSync(outputPath, {
      recursive: true,
      force: true,
    });
  }
  fs.mkdirSync(outputPath);
  for (const file of readFiles) {
    console.log(path.join(imagePath, file));
    try {
      let jimpFile = await jimp.read(path.join(imagePath, file));
      await jimpFile.grayscale().writeAsync(path.join(outputPath, file));
    } catch (error) {
      console.log(error);
    }
  }
  return outputPath;
}

function imageToPdf(imageFolderPath, size) {
  let readFiles = fs.readdirSync(imageFolderPath).sort((a, b) => {
    return Number(a.split(".")[0]) - Number(b.split(".")[0]);
  });
  imgToPDF(
    readFiles.map((item) => path.join(imageFolderPath, item)),
    size
  ).pipe(fs.createWriteStream(`${imageFolderPath}.pdf`));
}

async function forceToPortrait(doc, pathOriginal) {
  let outputFile = path.join(
    path.dirname(pathOriginal),
    path.basename(pathOriginal, path.extname(pathOriginal)) + "_out.pdf"
  );
  for (let i = 0; i < doc.getPageCount(); i++) {
    let page = doc.getPage(i);
    let { width, height } = page.getSize();
    if (width > height) {
      page.setRotation(degrees(90));
    }
  }
  fs.writeFileSync(outputFile, await doc.save());
  return outputFile;
}

async function mergeDoc(path) {
  let files = [];
  let readFiles = fs.readdirSync(path);
  readFiles.forEach((item) => {
    let ext = path.extname(item);
    if ([".doc", "docx"].includes(ext.toLowerCase())) {
      files.push(fs.readFileSync(path.join(folderPath, item), "binary"));
    }
  });

  var docx = new DocxMerger({}, files);
  docx.save("nodebuffer", function (data) {
    fs.writeFile("output.docx", data, function (err) {});
  });
}

async function run(yArgument) {
  let listFile = [];
  switch (yArgument.type) {
    case "mergeword":
      mergeDoc(yArgument.s);
      break;
    case "greyscale":
      listFile = searchPdfFile(yArgument.s, 0, yArgument.d);
      for (const item of listFile) {
        console.log(`Konversi file : ${path.basename(item)}`);

        let originalFileByte = fs.readFileSync(item);
        let originalFile = await pdfLib.PDFDocument.load(originalFileByte);
        const { width, height } = originalFile.getPage(0).getSize();

        let allPortraitFile = await forceToPortrait(originalFile, item);
        let imageFolder = await pdfToImage(allPortraitFile);
        let greyscaleFolder = await imageToGreyscale(imageFolder);
        imageToPdf(greyscaleFolder, [width, height]);
        fs.rmSync(allPortraitFile);
        fs.rmSync(imageFolder, { recursive: true, force: true });
        fs.rmSync(greyscaleFolder, { recursive: true, force: true });
      }
      break;
    case "nonocr":
      listFile = searchPdfFile(yArgument.s, 0, yArgument.d);
      for (const item of listFile) {
        console.log(`Konversi file : ${path.basename(item)}`);
        let originalFileByte = fs.readFileSync(item);
        let originalFile = await pdfLib.PDFDocument.load(originalFileByte);
        const { width, height } = originalFile.getPage(0).getSize();

        let imageFolder = await pdfToImage(item, "_nonocr");
        imageToPdf(imageFolder, [width, height]);
        fs.rmSync(imageFolder, { recursive: true, force: true });
      }
      break;
    default:
      console.log("Jenis output tidak dikenal");
  }
}

async function runtest() {
  let item = "Sample.pdf";
  let originalFileByte = fs.readFileSync(item);
  let originalFile = await pdfLib.PDFDocument.load(originalFileByte);
  const { width, height } = originalFile.getPage(0).getSize();

  let allPortraitFile = await forceToPortrait(originalFile, item);
  let imageFolder = await pdfToImage(allPortraitFile);
  let greyscaleFolder = await imageToGreyscale(imageFolder);
  imageToPdf(greyscaleFolder, [width, height]);
  fs.rmSync(allPortraitFile);
  // fs.rmSync(imageFolder, { recursive: true, force: true });
  fs.rmSync(greyscaleFolder, { recursive: true, force: true });
}
// runtest();
run(optionsArgument);
