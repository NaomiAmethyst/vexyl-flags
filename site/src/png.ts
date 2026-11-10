// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Naomi Persephone Amethyst <naomi@amethyst.name>

// Pictures as PNG, drawn by the browser from the library's SVG. Whatever isn't painted stays
// transparent, as a shaped flag's corners are. A copy of Vexyl web's own helper, kept short.

/** The most a side can be, and the most pixels in all, which iOS Safari's canvas allows. */
export const maxSide = 16384;
export const maxArea = 16777216;

export interface PngSize {
	width: number;
	height: number;
	/** Whether it had to be made smaller than was asked, to fit what a browser can draw. */
	capped: boolean;
}

/** A size in whole pixels, made smaller if it has to be, keeping its shape. */
export function fitPng(width: number, height: number): PngSize {
	const w = Math.max(1, Math.round(width));
	const h = Math.max(1, Math.round(height));
	const scale = Math.min(1, maxSide / w, maxSide / h, Math.sqrt(maxArea / (w * h)));
	if (scale >= 1) {
		return { width: w, height: h, capped: false };
	}
	return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), capped: true };
}

/** A picture `px` high of something `width` by `height` in any units. */
export const pngForHeight = (width: number, height: number, px: number): PngSize => fitPng((px * width) / height, px);

/** A sheet at so many dots per inch, from its size on paper. */
export const pngForPaper = (widthMm: number, heightMm: number, dpi: number): PngSize => fitPng((widthMm / 25.4) * dpi, (heightMm / 25.4) * dpi);

/** What to say about a PNG made smaller than asked, which is nothing for one that wasn't. */
export const cappedNote = (size: PngSize): string => (size.capped ? `More than a browser can draw, so the PNG will be ${size.width} × ${size.height} pixels` : "");

/** An SVG document's own width and height, from its root's attributes, in whatever units it gives. */
export function svgOwnSize(svg: string): { width: number; height: number } | null {
	const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
	const width = Number.parseFloat(/\swidth="([^"]*)"/.exec(root)?.[1] ?? "");
	const height = Number.parseFloat(/\sheight="([^"]*)"/.exec(root)?.[1] ?? "");
	return width > 0 && height > 0 ? { width, height } : null;
}

/** Draws an SVG as a PNG, `size` big. The SVG is given that size first, since some browsers draw
 * an SVG at its own size and then stretch the pixels. The library's always has a viewBox. */
export async function svgToPng(svg: string, size: PngSize): Promise<Blob> {
	const sized = svg.replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\swidth="[^"]*"/, ` width="${size.width}"`).replace(/\sheight="[^"]*"/, ` height="${size.height}"`));
	const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
	try {
		const img = new Image();
		img.src = url;
		await img.decode();
		const canvas = document.createElement("canvas");
		canvas.width = size.width;
		canvas.height = size.height;
		const g = canvas.getContext("2d");
		if (g === null) {
			throw new Error("this browser couldn’t make a picture that size");
		}
		g.drawImage(img, 0, 0, size.width, size.height);
		return await new Promise<Blob>((done, fail) => canvas.toBlob((b) => (b === null ? fail(new Error("this browser couldn’t make a picture that size")) : done(b)), "image/png"));
	} finally {
		URL.revokeObjectURL(url);
	}
}
