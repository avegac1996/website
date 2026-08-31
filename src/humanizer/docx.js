/**
 * Extracción de texto de .docx sin dependencias externas.
 * Un .docx es un ZIP; leemos word/document.xml (deflate) con zlib nativo.
 */
const zlib = require('zlib');

function findEOCD(buf) {
  // End of Central Directory: firma 0x06054b50, buscada desde el final
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

function extractEntry(buf, name) {
  const eocd = findEOCD(buf);
  if (eocd < 0) throw new Error('ZIP inválido (no se encontró EOCD)');
  const total = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const fname = buf.toString('utf8', off + 46, off + 46 + nameLen);
    if (fname === name) {
      // Local file header en localOff
      const lnLen = buf.readUInt16LE(localOff + 26);
      const leLen = buf.readUInt16LE(localOff + 28);
      const dataStart = localOff + 30 + lnLen + leLen;
      const comp = buf.slice(dataStart, dataStart + compSize);
      if (method === 0) return comp;
      if (method === 8) return zlib.inflateRawSync(comp);
      throw new Error('Método de compresión no soportado: ' + method);
    }
    off += 46 + nameLen + extraLen + commLen;
  }
  throw new Error('No se encontró ' + name + ' en el .docx');
}

function docxToText(buf) {
  const xml = extractEntry(buf, 'word/document.xml').toString('utf8');
  let out = xml
    .replace(/<w:p\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br\b[^>]*\/?>/g, '\n')
    .replace(/<w:tab\b[^>]*\/?>/g, '\t')
    .replace(/<[^>]+>/g, '');
  out = out
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d));
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { docxToText };
