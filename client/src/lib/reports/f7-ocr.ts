import { createWorker, PSM } from "tesseract.js";

type LabelRegion = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

let workerPromise: ReturnType<typeof createWorker> | undefined;
let workerQueue: Promise<void> = Promise.resolve();

type MeasurementLabel = {
  color: HTMLCanvasElement;
  thresholded: HTMLCanvasElement;
  highThreshold: HTMLCanvasElement;
};

function isYellowLabelPixel(data: Uint8ClampedArray, index: number) {
  const red = data[index]!;
  const green = data[index + 1]!;
  const blue = data[index + 2]!;
  return red > 180 && green > 145 && blue < 150 && red - blue > 70 && green - blue > 35;
}

function findMeasurementLabels(data: ImageData): LabelRegion[] {
  const { width, height } = data;
  const regions: LabelRegion[] = [];

  for (let y = 0; y < height; y++) {
    const spans: Array<[number, number]> = [];
    let x = 0;

    while (x < width) {
      if (!isYellowLabelPixel(data.data, (y * width + x) * 4)) {
        x++;
        continue;
      }

      const left = x;
      while (x < width && isYellowLabelPixel(data.data, (y * width + x) * 4)) x++;
      if (x - left >= 2) spans.push([left, x - 1]);
    }

    for (const [left, right] of spans) {
      const matching = regions.filter(
        (region) => y - region.bottom <= 2 && left <= region.right + 2 && right >= region.left - 2,
      );
      if (!matching.length) {
        regions.push({ left, top: y, right, bottom: y });
        continue;
      }

      const target = matching[0]!;
      target.left = Math.min(target.left, left);
      target.right = Math.max(target.right, right);
      target.bottom = y;
      for (const duplicate of matching.slice(1)) {
        target.left = Math.min(target.left, duplicate.left);
        target.top = Math.min(target.top, duplicate.top);
        target.right = Math.max(target.right, duplicate.right);
        target.bottom = Math.max(target.bottom, duplicate.bottom);
        regions.splice(regions.indexOf(duplicate), 1);
      }
    }
  }

  return regions
    .filter((region) => {
      const regionWidth = region.right - region.left + 1;
      const regionHeight = region.bottom - region.top + 1;
      const aspectRatio = regionWidth / regionHeight;
      return (
        regionWidth >= 35 &&
        regionWidth <= 190 &&
        regionHeight >= 12 &&
        regionHeight <= 50 &&
        aspectRatio >= 1.4 &&
        aspectRatio <= 8.5 &&
        regionWidth * regionHeight >= 450
      );
    })
    .sort((a, b) => a.top - b.top || a.left - b.left);
}

async function measurementLabels(file: File): Promise<MeasurementLabel[]> {
  const bitmap = await createImageBitmap(file);
  try {
    const source = document.createElement("canvas");
    source.width = bitmap.width;
    source.height = bitmap.height;
    const sourceContext = source.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) throw new Error("Unable to prepare the image for OCR.");
    sourceContext.drawImage(bitmap, 0, 0);

    const regions = findMeasurementLabels(
      sourceContext.getImageData(0, 0, source.width, source.height),
    );
    return regions.map((region) => {
      const padding = 4;
      const left = Math.max(0, region.left - padding);
      const top = Math.max(0, region.top - padding);
      const width = Math.min(source.width, region.right + padding + 1) - left;
      const height = Math.min(source.height, region.bottom + padding + 1) - top;
      const scale = 5;
      const color = document.createElement("canvas");
      color.width = width * scale;
      color.height = height * scale;
      const colorContext = color.getContext("2d", { willReadFrequently: true });
      if (!colorContext) throw new Error("Unable to prepare a measurement label for OCR.");
      colorContext.imageSmoothingEnabled = true;
      colorContext.drawImage(source, left, top, width, height, 0, 0, color.width, color.height);

      function thresholdLabel(threshold: number) {
        const canvas = document.createElement("canvas");
        canvas.width = color.width;
        canvas.height = color.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Unable to prepare a measurement label for OCR.");
        context.drawImage(color, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let index = 0; index < pixels.data.length; index += 4) {
          const brightness =
            pixels.data[index]! * 0.299 +
            pixels.data[index + 1]! * 0.587 +
            pixels.data[index + 2]! * 0.114;
          const value = brightness < threshold ? 0 : 255;
          pixels.data[index] = value;
          pixels.data[index + 1] = value;
          pixels.data[index + 2] = value;
        }
        context.putImageData(pixels, 0, 0);
        return canvas;
      }

      return {
        color,
        thresholded: thresholdLabel(155),
        highThreshold: thresholdLabel(185),
      };
    });
  } finally {
    bitmap.close();
  }
}

function formatMeasurement(text: string): string | null {
  const number = /(\d{1,4}[.,]\d{1,4})/.exec(text)?.[1]?.replace(",", ".");
  if (!number) return null;

  const unit = /(mil|mm|[µμuypi]m)/i.exec(text)?.[1]?.toLowerCase().replace(/\s/g, "");
  if (!unit) return null;
  if (unit === "mil") return `${number} mil`;
  if (unit === "mm") return `${number} mm`;
  return `${number} µm`;
}

function runWorkerTask<T>(task: () => Promise<T>): Promise<T> {
  const result = workerQueue.then(task);
  workerQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function readF7Measurements(file: File): Promise<string[]> {
  workerPromise ??= createWorker("eng");
  const worker = await workerPromise;
  const labels = await measurementLabels(file);
  return runWorkerTask(async () => {
    const values: string[] = [];

    if (labels.length) {
      async function recognizeLabel(
        image: HTMLCanvasElement,
        mode: PSM.SINGLE_LINE | PSM.SINGLE_WORD,
      ) {
        await worker.setParameters({
          tessedit_pageseg_mode: mode,
          tessedit_char_whitelist: "",
        });
        const result = await worker.recognize(image);
        return {
          value: formatMeasurement(result.data.text),
          confidence: result.data.confidence,
        };
      }

      for (const label of labels) {
        const first = await recognizeLabel(label.thresholded, PSM.SINGLE_LINE);
        if (first.value && first.confidence >= 65) {
          values.push(first.value);
          continue;
        }

        const alternatives = [
          await recognizeLabel(label.highThreshold, PSM.SINGLE_LINE),
          await recognizeLabel(label.thresholded, PSM.SINGLE_WORD),
          await recognizeLabel(label.highThreshold, PSM.SINGLE_WORD),
          await recognizeLabel(label.color, PSM.SINGLE_LINE),
        ];
        const readings = [first, ...alternatives].filter(
          (reading): reading is { value: string; confidence: number } => Boolean(reading.value),
        );
        const counts = new Map<string, number>();
        for (const reading of readings) {
          counts.set(reading.value, (counts.get(reading.value) || 0) + 1);
        }
        const consensus = [...counts.entries()].sort(
          (a, b) => b[1] - a[1] || b[0].localeCompare(a[0]),
        )[0]?.[0];
        const selected =
          consensus && (counts.get(consensus) || 0) > 1
            ? consensus
            : readings.sort((a, b) => b.confidence - a.confidence)[0]?.value;
        if (selected) values.push(selected);
      }
    }

    if (!values.length) {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        tessedit_char_whitelist: "",
      });
      const result = await worker.recognize(file);
      const matches = [
        ...result.data.text.matchAll(/([+-]?\d+(?:[.,]\d+)?)\s*(µm|μm|um|mm|mil)\b/giu),
      ];
      for (const match of matches) {
        const value = formatMeasurement(`${match[1]} ${match[2]}`);
        if (value) values.push(value);
      }
    }

    if (!values.length) {
      throw new Error("OCR did not find any readable numeric measurement labels in this image.");
    }

    return values;
  });
}
