// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Naomi Persephone Amethyst <naomi@amethyst.name>

// A zip, stored without compression, which is all a few SVG files need.

const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}
	return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
	let c = 0xffffffff;
	for (const b of bytes) {
		c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
}

export function zip(files: { name: string; data: Uint8Array<ArrayBuffer> }[]): Blob {
	const now = new Date();
	const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
	const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
	const parts: BlobPart[] = [];
	const central: BlobPart[] = [];
	let offset = 0;
	let size = 0;
	for (const f of files) {
		const name = new TextEncoder().encode(f.name);
		const crc = crc32(f.data);
		// The fields both headers share, from "version needed" to the name's length.
		const common = (v: DataView, at: number): void => {
			v.setUint16(at, 20, true);
			v.setUint16(at + 2, 0x0800, true); // Names are UTF-8.
			v.setUint16(at + 4, 0, true); // Stored.
			v.setUint16(at + 6, time, true);
			v.setUint16(at + 8, date, true);
			v.setUint32(at + 10, crc, true);
			v.setUint32(at + 14, f.data.length, true);
			v.setUint32(at + 18, f.data.length, true);
			v.setUint16(at + 22, name.length, true);
		};
		const local = new DataView(new ArrayBuffer(30));
		local.setUint32(0, 0x04034b50, true);
		common(local, 4);
		parts.push(local, name, f.data);
		const entry = new DataView(new ArrayBuffer(46));
		entry.setUint32(0, 0x02014b50, true);
		entry.setUint16(4, 20, true);
		common(entry, 6);
		entry.setUint32(42, offset, true);
		central.push(entry, name);
		offset += 30 + name.length + f.data.length;
		size += 46 + name.length;
	}
	const end = new DataView(new ArrayBuffer(22));
	end.setUint32(0, 0x06054b50, true);
	end.setUint16(8, files.length, true);
	end.setUint16(10, files.length, true);
	end.setUint32(12, size, true);
	end.setUint32(16, offset, true);
	return new Blob([...parts, ...central, end], { type: "application/zip" });
}
